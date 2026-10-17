-- 펀딩 구매 리뷰 v2 (20261005010000_funding_reviews 위에 증분 적용, 기존 리뷰 데이터는 그대로 보존)
--
-- 변경 사항
--  * 배송완료 판단을 주문별 배송 상태(funding_participations.shipping_status = 'delivered') 하나로 통일
--  * 모의결제(payment_provider = 'mock') 주문을 실제 구매와 구분
--      - 기본값: 모의결제 주문은 리뷰 작성 불가, 기존 모의결제 리뷰는 공개 목록·평균 별점에서 제외(삭제하지 않음)
--      - 관리자 시스템 설정 funding_review_allow_mock_orders = true 일 때만 작성·노출되며, 이때도 '구매 인증' 배지는 붙지 않는다
--  * 사이즈 만족도(small/fit/large) · 품질 만족도(poor/average/good) 선택 항목
--  * 본인 리뷰 수정(update_my_funding_review), 신규 작성·수정 시 내용 최대 1,000자
--  * 첨부 사진은 본인 폴더에 실제로 업로드된 Storage 객체만 연결 가능
--  * 리뷰 신고(funding_review_reports) + 관리자 숨김/삭제(보관)/복구 + 신고 처리, 모두 Audit Log 기록
--  * 제작자: 자기 펀딩 리뷰 조회 전용 RPC (수정·삭제 권한 없음)
--  * 마이페이지 '참여한 펀딩' 주문별 리뷰 상태 RPC
--
-- 테이블은 여전히 클라이언트가 직접 읽거나 쓸 수 없고(RLS + revoke) SECURITY DEFINER RPC 로만 접근한다.
-- 평균 별점·개수는 저장하지 않고 매 조회 시 공개 조건을 만족하는 리뷰로 계산하므로 삭제·숨김·환불 즉시 반영된다.

-- ---------------------------------------------------------------------------
-- 0. 운영 설정
-- ---------------------------------------------------------------------------

insert into public.platform_settings (key, value, description) values
  ('funding_review_allow_mock_orders', 'false'::jsonb,
   '모의결제(PG 미연동) 주문의 리뷰 작성·노출 허용 여부. false 이면 실결제 주문만 리뷰를 작성할 수 있고 기존 모의결제 리뷰는 공개 목록과 평균 별점에서 제외된다(데이터는 보존). true 여도 모의결제 리뷰에는 구매 인증 배지가 붙지 않는다.')
on conflict (key) do nothing;

create or replace function public._funding_review_mock_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public._platform_setting_bool('funding_review_allow_mock_orders', false);
$$;

revoke all on function public._funding_review_mock_allowed() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. 리뷰 테이블 확장
-- ---------------------------------------------------------------------------

alter table public.funding_reviews
  add column if not exists size_feedback text,
  add column if not exists quality_feedback text,
  add column if not exists edited_at timestamptz,
  add column if not exists moderation_reason text,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'funding_reviews_size_feedback_check'
                 and conrelid = 'public.funding_reviews'::regclass) then
    alter table public.funding_reviews add constraint funding_reviews_size_feedback_check
      check (size_feedback is null or size_feedback in ('small', 'fit', 'large'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'funding_reviews_quality_feedback_check'
                 and conrelid = 'public.funding_reviews'::regclass) then
    alter table public.funding_reviews add constraint funding_reviews_quality_feedback_check
      check (quality_feedback is null or quality_feedback in ('poor', 'average', 'good'));
  end if;
end $$;

-- 관리자 삭제는 soft delete('removed', 행 보존)
alter table public.funding_reviews drop constraint if exists funding_reviews_status_check;
alter table public.funding_reviews add constraint funding_reviews_status_check
  check (status in ('visible', 'hidden', 'removed'));

-- 내용 길이 제약(10~2000자)은 기존 리뷰 보존을 위해 테이블에 그대로 두고,
-- 신규 작성·수정의 1,000자 제한은 RPC 와 INSERT 트리거에서 검증한다.

create index if not exists funding_reviews_funding_status_idx on public.funding_reviews (funding_id, status, rating);

-- ---------------------------------------------------------------------------
-- 2. 리뷰 신고
-- ---------------------------------------------------------------------------

create table if not exists public.funding_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.funding_reviews(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  detail text,
  status text not null default 'pending',
  action_taken text not null default 'none',
  resolution_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint funding_review_reports_reason_check
    check (reason in ('spam', 'abusive', 'unrelated', 'privacy', 'false_info', 'other')),
  constraint funding_review_reports_status_check check (status in ('pending', 'reviewed', 'dismissed')),
  constraint funding_review_reports_action_check check (action_taken in ('none', 'hide_review', 'remove_review')),
  constraint funding_review_reports_detail_length check (detail is null or char_length(detail) <= 500),
  constraint funding_review_reports_once unique (review_id, reporter_id)
);

create index if not exists funding_review_reports_status_idx on public.funding_review_reports (status, created_at desc);

comment on table public.funding_review_reports is
  '펀딩 리뷰 신고. 회원 1명이 리뷰 1개를 1번만 신고할 수 있고 관리자 RPC 로만 처리한다.';

alter table public.funding_review_reports enable row level security;
revoke all on table public.funding_review_reports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. 작성 권한 판단 / DB 트리거
-- ---------------------------------------------------------------------------

-- 리뷰 작성 가능 여부. null = 가능, 그 외 = 불가 사유 코드
create or replace function public._funding_review_block_reason(p_participation public.funding_participations, p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user is null then 'login_required'
    when p_participation.participant_id is distinct from p_user then 'not_owner'
    when p_participation.status = 'cancelled'
      or p_participation.payment_status in ('cancelled', 'failed')
      or p_participation.payment_cancelled_at is not null then 'cancelled'
    when p_participation.payment_status <> 'paid' then 'unpaid'
    when p_participation.payment_provider = 'mock' and not public._funding_review_mock_allowed() then 'mock_payment'
    when p_participation.shipping_status is distinct from 'delivered' then 'not_delivered'
    when exists (select 1 from public.funding_reviews r where r.participation_id = p_participation.id) then 'already_reviewed'
    else null
  end;
$$;

revoke all on function public._funding_review_block_reason(public.funding_participations, uuid) from public, anon, authenticated;

-- 공개 목록·평균 별점에 포함되는 리뷰인지
create or replace function public._funding_review_is_public(p_review public.funding_reviews, p_participation public.funding_participations)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_review.status = 'visible'
    and p_participation.status <> 'cancelled'
    and p_participation.payment_status = 'paid'
    and p_participation.payment_cancelled_at is null
    and (p_participation.payment_provider <> 'mock' or public._funding_review_mock_allowed());
$$;

revoke all on function public._funding_review_is_public(public.funding_reviews, public.funding_participations) from public, anon, authenticated;

create or replace function public._funding_review_block_message(p_reason text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_reason
    when 'login_required' then '로그인이 필요합니다.'
    when 'not_owner' then '본인이 구매한 주문에만 리뷰를 작성할 수 있습니다.'
    when 'cancelled' then '취소·환불된 주문에는 리뷰를 작성할 수 없습니다.'
    when 'unpaid' then '결제 완료된 주문에만 리뷰를 작성할 수 있습니다.'
    when 'mock_payment' then '모의결제 주문은 실제 구매가 아니어서 리뷰를 작성할 수 없습니다.'
    when 'not_delivered' then '배송 완료 후 리뷰를 작성할 수 있습니다.'
    when 'already_reviewed' then '이 주문에는 이미 리뷰를 작성했습니다.'
    else '리뷰를 작성할 수 없는 주문입니다.'
  end;
$$;

-- 별점·내용·만족도·사진 입력 검증 (작성/수정 공통)
create or replace function public._validate_funding_review_input(
  p_user uuid,
  p_rating integer,
  p_content text,
  p_image_paths text[],
  p_size_feedback text,
  p_quality_feedback text
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_path text;
  v_len integer := char_length(btrim(coalesce(p_content, '')));
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception '별점은 1~5점으로 선택해주세요.';
  end if;
  if v_len < 10 then
    raise exception '리뷰 내용을 10자 이상 입력해주세요.';
  end if;
  if v_len > 1000 then
    raise exception '리뷰 내용은 1000자까지 입력할 수 있습니다.';
  end if;
  if p_size_feedback is not null and p_size_feedback not in ('small', 'fit', 'large') then
    raise exception '사이즈 만족도 값이 올바르지 않습니다.';
  end if;
  if p_quality_feedback is not null and p_quality_feedback not in ('poor', 'average', 'good') then
    raise exception '품질 만족도 값이 올바르지 않습니다.';
  end if;
  if cardinality(coalesce(p_image_paths, '{}'::text[])) > 5 then
    raise exception '사진은 최대 5장까지 첨부할 수 있습니다.';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_image_paths, '{}'::text[])) x) <> cardinality(coalesce(p_image_paths, '{}'::text[])) then
    raise exception '같은 사진을 중복 첨부할 수 없습니다.';
  end if;
  -- 사진은 본인 폴더(funding-reviews/<uid>/...)에 실제로 업로드된 이미지 파일만 연결할 수 있다.
  -- (파일 형식·용량은 버킷 설정에서 한 번, 업로드 메타데이터로 여기서 한 번 더 확인)
  foreach v_path in array coalesce(p_image_paths, '{}'::text[]) loop
    if v_path !~ ('^' || p_user::text || '/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$') then
      raise exception '첨부 사진 경로가 올바르지 않습니다.';
    end if;
    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'funding-reviews'
        and o.name = v_path
        and coalesce(o.metadata ->> 'mimetype', 'image/jpeg') in ('image/jpeg', 'image/png', 'image/webp')
        and coalesce((o.metadata ->> 'size')::bigint, 0) <= 5242880
    ) then
      raise exception '업로드되지 않았거나 허용되지 않는 사진이 포함되어 있습니다.';
    end if;
  end loop;
end;
$$;

revoke all on function public._validate_funding_review_input(uuid, integer, text, text[], text, text) from public, anon, authenticated;

-- DB 수준 검증: 어떤 경로로 INSERT 되더라도 실제 구매 조건을 다시 확인하고 구매 옵션을 주문에서 복사한다.
create or replace function public._guard_funding_review_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fp public.funding_participations%rowtype;
  v_reason text;
begin
  select * into v_fp from public.funding_participations where id = new.participation_id;
  if not found then
    raise exception '주문을 찾을 수 없습니다.' using errcode = '42501';
  end if;
  v_reason := public._funding_review_block_reason(v_fp, new.reviewer_id);
  if v_reason is not null then
    raise exception '리뷰를 작성할 수 없는 주문입니다. (%)', v_reason using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(new.content, ''))) > 1000 then
    raise exception '리뷰 내용은 1000자까지 입력할 수 있습니다.';
  end if;
  new.funding_id := v_fp.funding_id;
  new.selected_color := v_fp.selected_color;
  new.selected_size := v_fp.selected_size;
  new.quantity := v_fp.quantity;
  new.status := 'visible';
  new.edited_at := null;
  new.moderation_reason := null;
  new.moderated_at := null;
  new.moderated_by := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public._guard_funding_review_insert() from public, anon, authenticated;

-- 주문·작성자·구매 옵션 스냅샷은 수정할 수 없다(다른 주문으로 옮기거나 작성자를 바꾸는 것 차단).
create or replace function public._guard_funding_review_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.funding_id is distinct from old.funding_id
     or new.participation_id is distinct from old.participation_id
     or new.reviewer_id is distinct from old.reviewer_id
     or new.selected_color is distinct from old.selected_color
     or new.selected_size is distinct from old.selected_size
     or new.quantity is distinct from old.quantity
     or new.created_at is distinct from old.created_at then
    raise exception '리뷰의 주문·작성자 정보는 변경할 수 없습니다.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public._guard_funding_review_update() from public, anon, authenticated;

drop trigger if exists funding_reviews_guard_update on public.funding_reviews;
create trigger funding_reviews_guard_update
before update on public.funding_reviews
for each row execute function public._guard_funding_review_update();

-- 리뷰 작성자 본인에게 돌려주는 리뷰 JSON
create or replace function public._funding_review_owner_json(p_review public.funding_reviews)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when p_review.id is null then null else jsonb_build_object(
    'id', p_review.id,
    'rating', p_review.rating,
    'content', p_review.content,
    'image_paths', to_jsonb(p_review.image_paths),
    'size_feedback', p_review.size_feedback,
    'quality_feedback', p_review.quality_feedback,
    'status', p_review.status,
    'created_at', p_review.created_at,
    'edited_at', p_review.edited_at
  ) end;
$$;

revoke all on function public._funding_review_owner_json(public.funding_reviews) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Storage: 버킷 형식·용량 제한 재확인
-- ---------------------------------------------------------------------------

update storage.buckets
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'funding-reviews';

-- ---------------------------------------------------------------------------
-- 5. 공개 조회
-- ---------------------------------------------------------------------------

drop function if exists public.get_funding_reviews(uuid, text, integer, integer);

-- 공개 리뷰 목록 + 요약(평균 별점·개수·별점 분포·사이즈/품질 분포·포토 리뷰)
create or replace function public.get_funding_reviews(
  p_funding_id uuid,
  p_sort text default 'latest',
  p_limit integer default 20,
  p_offset integer default 0,
  p_photo_only boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_sort text := case when p_sort in ('latest', 'rating_desc', 'rating_asc') then p_sort else 'latest' end;
  v_photo_only boolean := coalesce(p_photo_only, false);
  v_user uuid := auth.uid();
begin
  if not exists (select 1 from public.fundings f where f.id = p_funding_id and f.status in ('approved', 'closed')) then
    return jsonb_build_object(
      'summary', jsonb_build_object('average', 0, 'count', 0, 'photo_count', 0,
        'distribution', jsonb_build_object('1', 0, '2', 0, '3', 0, '4', 0, '5', 0),
        'size', jsonb_build_object('small', 0, 'fit', 0, 'large', 0),
        'quality', jsonb_build_object('poor', 0, 'average', 0, 'good', 0)),
      'photos', '[]'::jsonb, 'filtered_count', 0, 'rows', '[]'::jsonb);
  end if;

  return (
    with visible as (
      select r.*, fp.payment_provider
      from public.funding_reviews r
      join public.funding_participations fp on fp.id = r.participation_id
      where r.funding_id = p_funding_id
        and public._funding_review_is_public(r, fp)
    ),
    filtered as (
      select v.* from visible v where not v_photo_only or cardinality(v.image_paths) > 0
    ),
    page as (
      select f.* from filtered f
      order by
        case when v_sort = 'rating_desc' then f.rating end desc nulls last,
        case when v_sort = 'rating_asc' then f.rating end asc nulls last,
        f.created_at desc
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'average', coalesce((select round(avg(rating)::numeric, 1) from visible), 0),
        'count', (select count(*) from visible),
        'photo_count', (select count(*) from visible where cardinality(image_paths) > 0),
        'distribution', (
          select jsonb_object_agg(s::text, (select count(*) from visible v where v.rating = s))
          from generate_series(1, 5) s
        ),
        'size', jsonb_build_object(
          'small', (select count(*) from visible where size_feedback = 'small'),
          'fit', (select count(*) from visible where size_feedback = 'fit'),
          'large', (select count(*) from visible where size_feedback = 'large')),
        'quality', jsonb_build_object(
          'poor', (select count(*) from visible where quality_feedback = 'poor'),
          'average', (select count(*) from visible where quality_feedback = 'average'),
          'good', (select count(*) from visible where quality_feedback = 'good'))
      ),
      'photos', coalesce((
        select jsonb_agg(jsonb_build_object('review_id', x.id, 'path', x.path) order by x.created_at desc, x.ord)
        from (
          select v.id, v.created_at, p.path, p.ord
          from visible v, unnest(v.image_paths) with ordinality as p(path, ord)
          order by v.created_at desc, p.ord
          limit 12
        ) x
      ), '[]'::jsonb),
      'filtered_count', (select count(*) from filtered),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'rating', p.rating,
          'content', p.content,
          'image_paths', to_jsonb(p.image_paths),
          'nickname', p.nickname,
          'selected_color', p.selected_color,
          'selected_size', p.selected_size,
          'quantity', p.quantity,
          'size_feedback', p.size_feedback,
          'quality_feedback', p.quality_feedback,
          'verified_purchase', p.payment_provider <> 'mock',
          'purchase_type', case when p.payment_provider = 'mock' then 'mock' else 'real' end,
          'is_mine', coalesce(p.reviewer_id = v_user, false),
          'reported_by_me', v_user is not null and exists (
            select 1 from public.funding_review_reports rr where rr.review_id = p.id and rr.reporter_id = v_user),
          'created_at', p.created_at,
          'edited_at', p.edited_at
        ) order by
          case when v_sort = 'rating_desc' then p.rating end desc nulls last,
          case when v_sort = 'rating_asc' then p.rating end asc nulls last,
          p.created_at desc)
        from page p
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_funding_reviews(uuid, text, integer, integer, boolean) from public;
grant execute on function public.get_funding_reviews(uuid, text, integer, integer, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. 구매자 RPC
-- ---------------------------------------------------------------------------

drop function if exists public.get_my_funding_review_eligibility(uuid);

-- 이 펀딩의 내 주문별 리뷰 작성 가능 여부 ([리뷰 작성하기] 버튼 표시용 — 실제 검증은 create 에서 다시 한다)
create or replace function public.get_my_funding_review_eligibility(p_funding_id uuid)
returns table (
  participation_id uuid,
  order_number text,
  selected_color text,
  selected_size text,
  quantity integer,
  ordered_at timestamptz,
  payment_type text,
  shipping_status text,
  can_review boolean,
  block_reason text,
  review_id uuid,
  review jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fp.id, fp.partner_order_id, fp.selected_color, fp.selected_size, fp.quantity, fp.created_at,
    case when fp.payment_provider = 'mock' then 'MOCK' else 'REAL' end,
    fp.shipping_status,
    public._funding_review_block_reason(fp, auth.uid()) is null,
    public._funding_review_block_reason(fp, auth.uid()),
    r.id,
    public._funding_review_owner_json(r)
  from public.funding_participations fp
  left join public.funding_reviews r on r.participation_id = fp.id
  where auth.uid() is not null
    and fp.funding_id = p_funding_id
    and fp.participant_id = auth.uid()
  order by fp.created_at desc;
$$;

revoke all on function public.get_my_funding_review_eligibility(uuid) from public, anon;
grant execute on function public.get_my_funding_review_eligibility(uuid) to authenticated;

-- 마이페이지 '참여한 펀딩': 내 모든 주문의 리뷰 상태
create or replace function public.get_my_funding_review_states()
returns table (
  participation_id uuid,
  funding_id uuid,
  can_review boolean,
  block_reason text,
  review jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fp.id, fp.funding_id,
    public._funding_review_block_reason(fp, auth.uid()) is null,
    public._funding_review_block_reason(fp, auth.uid()),
    public._funding_review_owner_json(r)
  from public.funding_participations fp
  left join public.funding_reviews r on r.participation_id = fp.id
  where auth.uid() is not null
    and fp.participant_id = auth.uid()
  order by fp.created_at desc;
$$;

revoke all on function public.get_my_funding_review_states() from public, anon;
grant execute on function public.get_my_funding_review_states() to authenticated;

drop function if exists public.create_funding_review(uuid, integer, text, text[]);

create or replace function public.create_funding_review(
  p_participation_id uuid,
  p_rating integer,
  p_content text,
  p_image_paths text[] default '{}'::text[],
  p_size_feedback text default null,
  p_quality_feedback text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_fp public.funding_participations%rowtype;
  v_reason text;
  v_paths text[] := coalesce(p_image_paths, '{}'::text[]);
  v_id uuid;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  -- 같은 주문으로 동시에 두 번 작성하는 것을 막기 위해 주문 row 를 잠근다(UNIQUE 도 함께 보장).
  select * into v_fp from public.funding_participations where id = p_participation_id for update;
  if not found or v_fp.participant_id is distinct from v_user then
    raise exception '본인이 구매한 주문에만 리뷰를 작성할 수 있습니다.' using errcode = '42501';
  end if;

  v_reason := public._funding_review_block_reason(v_fp, v_user);
  if v_reason = 'already_reviewed' then
    raise exception '%', public._funding_review_block_message(v_reason);
  elsif v_reason is not null then
    raise exception '%', public._funding_review_block_message(v_reason) using errcode = '42501';
  end if;

  perform public._validate_funding_review_input(v_user, p_rating, p_content, v_paths, p_size_feedback, p_quality_feedback);

  insert into public.funding_reviews (
    funding_id, participation_id, reviewer_id, rating, content, image_paths, nickname, size_feedback, quality_feedback
  ) values (
    v_fp.funding_id, v_fp.id, v_user, p_rating, btrim(p_content), v_paths, public._review_nickname(v_user),
    p_size_feedback, p_quality_feedback
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_funding_review(uuid, integer, text, text[], text, text) from public, anon;
grant execute on function public.create_funding_review(uuid, integer, text, text[], text, text) to authenticated;

-- 본인 리뷰 수정. 반환값 removed_paths = 더 이상 쓰지 않는 사진(클라이언트가 Storage 에서 정리)
create or replace function public.update_my_funding_review(
  p_review_id uuid,
  p_rating integer,
  p_content text,
  p_image_paths text[] default '{}'::text[],
  p_size_feedback text default null,
  p_quality_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_review public.funding_reviews%rowtype;
  v_fp public.funding_participations%rowtype;
  v_reason text;
  v_paths text[] := coalesce(p_image_paths, '{}'::text[]);
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  select * into v_review from public.funding_reviews where id = p_review_id for update;
  if not found or v_review.reviewer_id is distinct from v_user then
    raise exception '본인이 작성한 리뷰만 수정할 수 있습니다.' using errcode = '42501';
  end if;
  if v_review.status <> 'visible' then
    raise exception '운영 정책에 따라 숨김 처리된 리뷰는 수정할 수 없습니다. 고객센터로 문의해주세요.' using errcode = '42501';
  end if;

  -- 작성 후 주문이 취소·환불되었거나 모의결제 리뷰가 비허용 상태면 수정할 수 없다.
  select * into v_fp from public.funding_participations where id = v_review.participation_id;
  v_reason := public._funding_review_block_reason(v_fp, v_user);
  if v_reason is not null and v_reason <> 'already_reviewed' then
    raise exception '%', replace(public._funding_review_block_message(v_reason), '작성할', '수정할') using errcode = '42501';
  end if;

  perform public._validate_funding_review_input(v_user, p_rating, p_content, v_paths, p_size_feedback, p_quality_feedback);

  update public.funding_reviews
  set rating = p_rating,
      content = btrim(p_content),
      image_paths = v_paths,
      size_feedback = p_size_feedback,
      quality_feedback = p_quality_feedback,
      edited_at = now()
  where id = p_review_id;

  return jsonb_build_object(
    'id', p_review_id,
    'removed_paths', coalesce((select jsonb_agg(x) from unnest(v_review.image_paths) x where not (x = any(v_paths))), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.update_my_funding_review(uuid, integer, text, text[], text, text) from public, anon;
grant execute on function public.update_my_funding_review(uuid, integer, text, text[], text, text) to authenticated;

drop function if exists public.delete_my_funding_review(uuid);

-- 본인 리뷰 삭제. 반환값 = 첨부 사진 경로(클라이언트가 Storage 에서 정리)
create or replace function public.delete_my_funding_review(p_review_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.funding_reviews%rowtype;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  select * into v_review from public.funding_reviews where id = p_review_id for update;
  if not found or v_review.reviewer_id is distinct from auth.uid() then
    raise exception '본인이 작성한 리뷰만 삭제할 수 있습니다.' using errcode = '42501';
  end if;
  -- 관리자 조치가 된 리뷰를 지우고 다시 쓰는 방식의 우회를 막는다.
  if v_review.status <> 'visible' then
    raise exception '운영 정책에 따라 숨김 처리된 리뷰는 고객센터를 통해 삭제를 요청해주세요.' using errcode = '42501';
  end if;
  delete from public.funding_reviews where id = p_review_id;
  return v_review.image_paths;
end;
$$;

revoke all on function public.delete_my_funding_review(uuid) from public, anon;
grant execute on function public.delete_my_funding_review(uuid) to authenticated;

-- 리뷰 신고 (로그인 회원, 본인 리뷰 제외, 리뷰당 1회)
create or replace function public.report_funding_review(p_review_id uuid, p_reason text, p_detail text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_review public.funding_reviews%rowtype;
  v_id uuid;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('spam', 'abusive', 'unrelated', 'privacy', 'false_info', 'other') then
    raise exception '신고 사유를 선택해주세요.';
  end if;
  if char_length(coalesce(p_detail, '')) > 500 then
    raise exception '신고 내용은 500자까지 입력할 수 있습니다.';
  end if;
  select * into v_review from public.funding_reviews where id = p_review_id;
  if not found or v_review.status <> 'visible' then
    raise exception '신고할 수 없는 리뷰입니다.';
  end if;
  if v_review.reviewer_id = v_user then
    raise exception '본인이 작성한 리뷰는 신고할 수 없습니다.';
  end if;
  insert into public.funding_review_reports (review_id, reporter_id, reason, detail)
  values (p_review_id, v_user, p_reason, nullif(btrim(coalesce(p_detail, '')), ''))
  on conflict (review_id, reporter_id) do nothing
  returning id into v_id;
  if v_id is null then
    raise exception '이미 신고한 리뷰입니다.';
  end if;
  return v_id;
end;
$$;

revoke all on function public.report_funding_review(uuid, text, text) from public, anon;
grant execute on function public.report_funding_review(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. 제작자: 자기 펀딩 리뷰 조회 전용 (수정·삭제 RPC 는 제공하지 않는다)
-- ---------------------------------------------------------------------------

create or replace function public.get_creator_funding_reviews(p_funding_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.fundings f
    where f.id = p_funding_id and (f.creator_id = auth.uid() or public.is_admin(auth.uid()))
  ) then
    raise exception '이 펀딩의 리뷰를 볼 권한이 없습니다.' using errcode = '42501';
  end if;

  return (
    with base as (
      select r.*, fp.partner_order_id, fp.payment_provider, public._funding_review_is_public(r, fp) as is_public
      from public.funding_reviews r
      join public.funding_participations fp on fp.id = r.participation_id
      where r.funding_id = p_funding_id and r.status <> 'removed'
    ),
    pub as (select * from base where is_public)
    select jsonb_build_object(
      'funding', (select jsonb_build_object('id', f.id, 'product_name', f.product_name, 'status', f.status)
                  from public.fundings f where f.id = p_funding_id),
      'summary', jsonb_build_object(
        'average', coalesce((select round(avg(rating)::numeric, 1) from pub), 0),
        'count', (select count(*) from pub),
        'photo_count', (select count(*) from pub where cardinality(image_paths) > 0),
        'distribution', (
          select jsonb_object_agg(s::text, (select count(*) from pub p where p.rating = s))
          from generate_series(1, 5) s
        ),
        'size', jsonb_build_object(
          'small', (select count(*) from pub where size_feedback = 'small'),
          'fit', (select count(*) from pub where size_feedback = 'fit'),
          'large', (select count(*) from pub where size_feedback = 'large')),
        'quality', jsonb_build_object(
          'poor', (select count(*) from pub where quality_feedback = 'poor'),
          'average', (select count(*) from pub where quality_feedback = 'average'),
          'good', (select count(*) from pub where quality_feedback = 'good'))
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', b.id,
          'rating', b.rating,
          'content', b.content,
          'image_paths', to_jsonb(b.image_paths),
          'nickname', b.nickname,
          'order_number', b.partner_order_id,
          'selected_color', b.selected_color,
          'selected_size', b.selected_size,
          'quantity', b.quantity,
          'size_feedback', b.size_feedback,
          'quality_feedback', b.quality_feedback,
          'purchase_type', case when b.payment_provider = 'mock' then 'mock' else 'real' end,
          'status', b.status,
          'is_public', b.is_public,
          'created_at', b.created_at,
          'edited_at', b.edited_at
        ) order by b.created_at desc)
        from base b
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_creator_funding_reviews(uuid) from public, anon;
grant execute on function public.get_creator_funding_reviews(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. 관리자: 리뷰 목록 · 신고 처리 · 숨김/삭제(보관)/복구
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_funding_reviews(
  p_status text default 'all',
  p_reported_only boolean default false,
  p_search text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  funding_id uuid,
  funding_name text,
  reviewer_id uuid,
  nickname text,
  order_number text,
  rating smallint,
  content text,
  image_paths text[],
  size_feedback text,
  quality_feedback text,
  purchase_type text,
  status text,
  is_public boolean,
  moderation_reason text,
  moderated_by_name text,
  moderated_at timestamptz,
  report_count integer,
  pending_report_count integer,
  created_at timestamptz,
  edited_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform public._admin_require('content.view');
  return query
  select r.id, r.funding_id, f.product_name, r.reviewer_id, r.nickname, fp.partner_order_id,
    r.rating, r.content, r.image_paths, r.size_feedback, r.quality_feedback,
    case when fp.payment_provider = 'mock' then 'mock' else 'real' end,
    r.status, public._funding_review_is_public(r, fp), r.moderation_reason,
    case when r.moderated_by is null then null else public._admin_display_name(r.moderated_by) end,
    r.moderated_at,
    (select count(*)::integer from public.funding_review_reports rr where rr.review_id = r.id),
    (select count(*)::integer from public.funding_review_reports rr where rr.review_id = r.id and rr.status = 'pending'),
    r.created_at, r.edited_at,
    count(*) over ()
  from public.funding_reviews r
  join public.funding_participations fp on fp.id = r.participation_id
  join public.fundings f on f.id = r.funding_id
  where (coalesce(p_status, 'all') = 'all' or r.status = p_status)
    and (not coalesce(p_reported_only, false)
         or exists (select 1 from public.funding_review_reports rr where rr.review_id = r.id and rr.status = 'pending'))
    and (v_search is null or r.content ilike '%' || v_search || '%' or r.nickname ilike '%' || v_search || '%'
         or f.product_name ilike '%' || v_search || '%' or fp.partner_order_id ilike '%' || v_search || '%')
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_list_funding_review_reports(p_status text default 'pending')
returns table (
  id uuid,
  review_id uuid,
  funding_id uuid,
  funding_name text,
  review_nickname text,
  review_rating smallint,
  review_content text,
  review_image_paths text[],
  review_status text,
  reporter_name text,
  reason text,
  detail text,
  status text,
  action_taken text,
  resolution_note text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._admin_require('content.view');
  return query
  select rr.id, rr.review_id, r.funding_id, f.product_name, r.nickname, r.rating, r.content, r.image_paths, r.status,
    coalesce(nullif(pr.username, ''), nullif(pr.full_name, ''), '회원'),
    rr.reason, rr.detail, rr.status, rr.action_taken, rr.resolution_note,
    case when rr.reviewed_by is null then null else public._admin_display_name(rr.reviewed_by) end,
    rr.reviewed_at, rr.created_at
  from public.funding_review_reports rr
  join public.funding_reviews r on r.id = rr.review_id
  join public.fundings f on f.id = r.funding_id
  left join public.profiles pr on pr.id = rr.reporter_id
  where coalesce(p_status, 'all') = 'all' or rr.status = p_status
  order by case when rr.status = 'pending' then 0 else 1 end, rr.created_at desc;
end;
$$;

create or replace function public.admin_moderate_funding_review(p_review_id uuid, p_status text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('content.manage');
  v_reason text := case when p_status = 'visible' then nullif(btrim(coalesce(p_reason, '')), '') else public._require_reason(p_reason, '처리 사유') end;
  v_review public.funding_reviews%rowtype;
  v_funding_name text;
begin
  if p_status not in ('visible', 'hidden', 'removed') then
    raise exception '올바르지 않은 리뷰 상태입니다.';
  end if;
  select * into v_review from public.funding_reviews where id = p_review_id for update;
  if not found then
    raise exception '리뷰를 찾을 수 없습니다.';
  end if;
  if v_review.status = p_status then
    raise exception '이미 같은 상태입니다.';
  end if;
  select product_name into v_funding_name from public.fundings where id = v_review.funding_id;

  -- removed 도 soft delete(행 보존)이다. 평균 별점·개수는 공개 리뷰로 매번 계산되므로 즉시 반영된다.
  update public.funding_reviews
  set status = p_status,
      moderation_reason = v_reason,
      moderated_at = now(),
      moderated_by = v_actor
  where id = p_review_id;

  perform public._admin_log('content.funding_review_' || p_status, 'funding_review', p_review_id::text,
    coalesce(v_funding_name, '') || ' · ' || left(v_review.content, 60),
    jsonb_build_object('status', v_review.status), jsonb_build_object('status', p_status), v_reason);

  if p_status <> 'visible' then
    perform public._admin_notify(v_review.reviewer_id,
      format('[리뷰 %s] ''%s'' 펀딩에 작성하신 리뷰가 운영 정책에 따라 %s 처리되었습니다. 사유: %s',
        case when p_status = 'hidden' then '숨김' else '삭제' end, coalesce(v_funding_name, '펀딩'),
        case when p_status = 'hidden' then '숨김' else '삭제' end, v_reason),
      v_review.funding_id);
  end if;
  return jsonb_build_object('status', p_status);
end;
$$;

create or replace function public.admin_resolve_funding_review_report(
  p_report_id uuid,
  p_status text,
  p_note text default null,
  p_action text default 'none'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('reports.manage');
  v_report public.funding_review_reports%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_action text := coalesce(p_action, 'none');
begin
  if p_status not in ('reviewed', 'dismissed') then
    raise exception '처리 완료(reviewed) 또는 기각(dismissed)만 선택할 수 있습니다.';
  end if;
  if v_action not in ('none', 'hide_review', 'remove_review') then
    raise exception '올바르지 않은 조치 유형입니다.';
  end if;
  if p_status = 'dismissed' and v_action <> 'none' then
    raise exception '기각 처리에는 조치를 함께 적용할 수 없습니다.';
  end if;
  select * into v_report from public.funding_review_reports where id = p_report_id for update;
  if not found then
    raise exception '신고를 찾을 수 없습니다.';
  end if;
  if v_report.status <> 'pending' then
    raise exception '이미 처리된 신고입니다.';
  end if;

  -- 숨김/삭제 조치는 content.manage 권한을 추가로 요구한다(admin_moderate_funding_review 내부 검증).
  if v_action in ('hide_review', 'remove_review') then
    perform public.admin_moderate_funding_review(v_report.review_id,
      case when v_action = 'hide_review' then 'hidden' else 'removed' end, coalesce(v_note, '신고 처리'));
  end if;

  update public.funding_review_reports
  set status = p_status, action_taken = v_action, resolution_note = v_note, reviewed_at = now(), reviewed_by = v_actor
  where id = p_report_id;

  -- 같은 리뷰에 대한 나머지 미처리 신고도 함께 조치 완료로 닫는다.
  if v_action <> 'none' then
    update public.funding_review_reports
    set status = 'reviewed', action_taken = v_action, resolution_note = coalesce(v_note, '동일 리뷰 신고 일괄 처리'),
        reviewed_at = now(), reviewed_by = v_actor
    where review_id = v_report.review_id and status = 'pending';
  end if;

  perform public._admin_log('report.funding_review_' || p_status, 'funding_review_report', p_report_id::text, v_report.reason,
    jsonb_build_object('status', v_report.status), jsonb_build_object('status', p_status, 'action', v_action), v_note);
  return jsonb_build_object('status', p_status, 'action', v_action);
end;
$$;

do $$
declare
  v_fn regprocedure;
begin
  for v_fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_list_funding_reviews', 'admin_list_funding_review_reports',
        'admin_moderate_funding_review', 'admin_resolve_funding_review_report'
      )
  loop
    execute format('revoke all on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end $$;

revoke all on function public._funding_review_block_message(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
