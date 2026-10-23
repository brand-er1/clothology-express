-- 펀딩 리뷰 확장: 세부 평가 · 리뷰 수정 · 판매자 공식 답변 · 판매자 신고 · 모의결제 주문 구분
--
-- 원칙
--  * 리뷰 테이블은 여전히 클라이언트가 직접 읽거나 쓸 수 없고 SECURITY DEFINER RPC 로만 접근한다.
--  * 판매자는 자기 펀딩 리뷰에 답변(seller_reply_*)과 신고만 할 수 있다. 별점·내용·노출 상태는 바꿀 수 없고
--    삭제 RPC 도 없다. UPDATE 가드 트리거가 컬럼 그룹별로 허용된 경로를 DB 수준에서 다시 확인한다.
--  * 모의결제(payment_provider = 'mock') 주문 리뷰는 verified_purchase = false / purchase_type = 'mock' 으로
--    표시해 실제 결제 구매 리뷰와 구분한다(배송받은 체험 주문이므로 목록에서는 보여준다).
--  * 기존 컬럼·데이터는 바꾸지 않는다. 새 컬럼은 모두 null 허용(기존 리뷰는 세부 평가 없음).

-- ---------------------------------------------------------------------------
-- 1. 컬럼 추가
-- ---------------------------------------------------------------------------

alter table public.funding_reviews
  add column if not exists fit_rating text,
  add column if not exists quality_rating smallint,
  add column if not exists delivery_rating smallint,
  add column if not exists edited_at timestamptz,
  add column if not exists seller_reply text,
  add column if not exists seller_reply_author_id uuid references auth.users(id) on delete set null,
  add column if not exists seller_replied_at timestamptz,
  add column if not exists seller_reply_updated_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'funding_reviews_fit_rating_check') then
    alter table public.funding_reviews add constraint funding_reviews_fit_rating_check
      check (fit_rating is null or fit_rating in ('small', 'true_to_size', 'large'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'funding_reviews_quality_rating_check') then
    alter table public.funding_reviews add constraint funding_reviews_quality_rating_check
      check (quality_rating is null or quality_rating between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'funding_reviews_delivery_rating_check') then
    alter table public.funding_reviews add constraint funding_reviews_delivery_rating_check
      check (delivery_rating is null or delivery_rating between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'funding_reviews_seller_reply_length') then
    alter table public.funding_reviews add constraint funding_reviews_seller_reply_length
      check (seller_reply is null or char_length(btrim(seller_reply)) between 2 and 1000);
  end if;
end;
$$;

create index if not exists funding_reviews_unanswered_idx
  on public.funding_reviews (funding_id, created_at desc) where seller_reply is null;

-- ---------------------------------------------------------------------------
-- 2. UPDATE 가드: 컬럼 그룹마다 정해진 RPC 만 바꿀 수 있다
-- ---------------------------------------------------------------------------
--  * 작성자 수정(update_my_funding_review)  → brander.review_owner_edit = on
--  * 판매자 답변(seller_reply_funding_review) → brander.review_seller_reply = on
--  * 노출 상태(admin_*)                      → brander.admin_rpc = on
--  * 주문·작성자·작성일·구매 옵션은 어떤 경로로도 바꿀 수 없다.
--  JWT 가 없는 서버 세션(마이그레이션, service role 운영 복구)은 통과시킨다.

create or replace function public._guard_funding_review_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_edit boolean := coalesce(current_setting('brander.review_owner_edit', true), '') = 'on';
  v_seller_reply boolean := coalesce(current_setting('brander.review_seller_reply', true), '') = 'on';
  v_admin boolean := coalesce(current_setting('brander.admin_rpc', true), '') = 'on';
begin
  if new.funding_id is distinct from old.funding_id
    or new.participation_id is distinct from old.participation_id
    or new.reviewer_id is distinct from old.reviewer_id
    or new.created_at is distinct from old.created_at
    or new.selected_color is distinct from old.selected_color
    or new.selected_size is distinct from old.selected_size
    or new.quantity is distinct from old.quantity then
    raise exception '리뷰의 주문 정보는 변경할 수 없습니다.' using errcode = '42501';
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if (new.rating, new.content, new.image_paths, new.fit_rating, new.quality_rating, new.delivery_rating, new.edited_at, new.nickname)
     is distinct from
     (old.rating, old.content, old.image_paths, old.fit_rating, old.quality_rating, old.delivery_rating, old.edited_at, old.nickname)
     and not v_owner_edit then
    raise exception '리뷰 내용과 별점은 작성자만 수정할 수 있습니다.' using errcode = '42501';
  end if;

  if (new.seller_reply, new.seller_reply_author_id, new.seller_replied_at, new.seller_reply_updated_at)
     is distinct from
     (old.seller_reply, old.seller_reply_author_id, old.seller_replied_at, old.seller_reply_updated_at)
     and not v_seller_reply then
    raise exception '판매자 답변은 해당 펀딩 제작자만 작성할 수 있습니다.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status and not v_admin then
    raise exception '리뷰 노출 상태는 관리자만 변경할 수 있습니다.' using errcode = '42501';
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

-- ---------------------------------------------------------------------------
-- 3. 판매자 신고 테이블
-- ---------------------------------------------------------------------------

create table if not exists public.funding_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.funding_reviews(id) on delete cascade,
  funding_id uuid not null references public.fundings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reporter_role text not null default 'creator',
  reason_code text not null,
  detail text,
  status text not null default 'pending',
  resolution text,
  resolution_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint funding_review_reports_role_check check (reporter_role in ('creator')),
  constraint funding_review_reports_reason_check check (reason_code in (
    'abusive', 'spam', 'privacy', 'false_info', 'unrelated', 'other'
  )),
  constraint funding_review_reports_status_check check (status in ('pending', 'resolved', 'dismissed')),
  constraint funding_review_reports_resolution_check check (resolution is null or resolution in ('hidden', 'kept')),
  constraint funding_review_reports_detail_length check (detail is null or char_length(detail) <= 1000)
);

-- 같은 리뷰를 처리 대기 중에 반복 신고하지 못하게 한다(처리 후 재신고는 가능).
create unique index if not exists funding_review_reports_one_pending
  on public.funding_review_reports (review_id, reporter_id) where status = 'pending';
create index if not exists funding_review_reports_status_idx
  on public.funding_review_reports (status, created_at desc);

alter table public.funding_review_reports enable row level security;
revoke all on table public.funding_review_reports from anon, authenticated;

comment on table public.funding_review_reports is
  '판매자가 자기 펀딩 리뷰를 신고한 기록. 신고만으로는 리뷰가 숨겨지지 않으며 관리자가 처리한다. RPC 로만 접근한다.';

-- ---------------------------------------------------------------------------
-- 4. 공통: 리뷰 JSON
-- ---------------------------------------------------------------------------

create or replace function public._funding_review_json(p_review public.funding_reviews, p_provider text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_review.id,
    'rating', p_review.rating,
    'content', p_review.content,
    'image_paths', to_jsonb(p_review.image_paths),
    'nickname', p_review.nickname,
    'selected_color', p_review.selected_color,
    'selected_size', p_review.selected_size,
    'quantity', p_review.quantity,
    'fit_rating', p_review.fit_rating,
    'quality_rating', p_review.quality_rating,
    'delivery_rating', p_review.delivery_rating,
    'verified_purchase', coalesce(p_provider, '') <> 'mock',
    'purchase_type', case when coalesce(p_provider, '') = 'mock' then 'mock' else 'paid' end,
    'is_mine', p_review.reviewer_id = auth.uid(),
    'created_at', p_review.created_at,
    'edited_at', p_review.edited_at,
    'seller_reply', case when p_review.seller_reply is not null then jsonb_build_object(
      'content', p_review.seller_reply,
      'replied_at', p_review.seller_replied_at,
      'updated_at', p_review.seller_reply_updated_at
    ) end
  );
$$;

revoke all on function public._funding_review_json(public.funding_reviews, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. 공개 리뷰 목록 (세부 평가 · 사진 갤러리 · 판매자 답변 포함)
-- ---------------------------------------------------------------------------

drop function if exists public.get_funding_reviews(uuid, text, integer, integer);

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
  v_empty jsonb := jsonb_build_object(
    'average', 0, 'count', 0, 'verified_count', 0, 'photo_count', 0,
    'distribution', jsonb_build_object('1', 0, '2', 0, '3', 0, '4', 0, '5', 0),
    'fit', jsonb_build_object('small', 0, 'true_to_size', 0, 'large', 0),
    'quality_average', null, 'delivery_average', null, 'photos', '[]'::jsonb
  );
begin
  if not exists (select 1 from public.fundings f where f.id = p_funding_id and f.status in ('approved', 'closed')) then
    return jsonb_build_object('summary', v_empty, 'rows', '[]'::jsonb, 'total', 0);
  end if;

  return (
    with visible as (
      select r, fp.payment_provider
      from public.funding_reviews r
      join public.funding_participations fp on fp.id = r.participation_id
      where r.funding_id = p_funding_id
        and r.status = 'visible'
        and fp.status <> 'cancelled'
        and fp.payment_status = 'paid'
    ),
    listed as (
      select * from visible v where not coalesce(p_photo_only, false) or cardinality((v.r).image_paths) > 0
    ),
    page as (
      select l.* from listed l
      order by
        case when v_sort = 'rating_desc' then (l.r).rating end desc nulls last,
        case when v_sort = 'rating_asc' then (l.r).rating end asc nulls last,
        (l.r).created_at desc
      limit v_limit offset v_offset
    ),
    photos as (
      select (v.r).id as review_id, unnest((v.r).image_paths) as path, (v.r).created_at as created_at
      from visible v
    )
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'average', coalesce((select round(avg((v.r).rating)::numeric, 1) from visible v), 0),
        'count', (select count(*) from visible),
        'verified_count', (select count(*) from visible v where coalesce(v.payment_provider, '') <> 'mock'),
        'photo_count', (select count(*) from visible v where cardinality((v.r).image_paths) > 0),
        'distribution', (
          select jsonb_object_agg(s::text, (select count(*) from visible v where (v.r).rating = s))
          from generate_series(1, 5) s
        ),
        'fit', jsonb_build_object(
          'small', (select count(*) from visible v where (v.r).fit_rating = 'small'),
          'true_to_size', (select count(*) from visible v where (v.r).fit_rating = 'true_to_size'),
          'large', (select count(*) from visible v where (v.r).fit_rating = 'large')
        ),
        'quality_average', (select round(avg((v.r).quality_rating)::numeric, 1) from visible v),
        'delivery_average', (select round(avg((v.r).delivery_rating)::numeric, 1) from visible v),
        'photos', coalesce((
          select jsonb_agg(jsonb_build_object('review_id', x.review_id, 'path', x.path) order by x.created_at desc)
          from (select * from photos order by created_at desc limit 24) x
        ), '[]'::jsonb)
      ),
      'total', (select count(*) from listed),
      'rows', coalesce((
        select jsonb_agg(public._funding_review_json(p.r, p.payment_provider) order by
          case when v_sort = 'rating_desc' then (p.r).rating end desc nulls last,
          case when v_sort = 'rating_asc' then (p.r).rating end asc nulls last,
          (p.r).created_at desc)
        from page p
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_funding_reviews(uuid, text, integer, integer, boolean) from public;
grant execute on function public.get_funding_reviews(uuid, text, integer, integer, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. 작성 · 수정 (세부 평가 추가)
-- ---------------------------------------------------------------------------

create or replace function public._validate_review_input(
  p_user uuid,
  p_rating integer,
  p_content text,
  p_image_paths text[],
  p_fit_rating text,
  p_quality_rating integer,
  p_delivery_rating integer
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception '별점은 1~5점으로 선택해주세요.';
  end if;
  if char_length(btrim(coalesce(p_content, ''))) < 10 then
    raise exception '리뷰 내용을 10자 이상 입력해주세요.';
  end if;
  if char_length(btrim(p_content)) > 2000 then
    raise exception '리뷰 내용은 2000자까지 입력할 수 있습니다.';
  end if;
  if cardinality(coalesce(p_image_paths, '{}'::text[])) > 5 then
    raise exception '사진은 최대 5장까지 첨부할 수 있습니다.';
  end if;
  -- 사진은 본인 폴더(funding-reviews/<uid>/...)에 업로드한 파일만 연결할 수 있다.
  foreach v_path in array coalesce(p_image_paths, '{}'::text[]) loop
    if v_path !~ ('^' || p_user::text || '/[A-Za-z0-9._-]+$') then
      raise exception '첨부 사진 경로가 올바르지 않습니다.';
    end if;
  end loop;
  if p_fit_rating is not null and p_fit_rating not in ('small', 'true_to_size', 'large') then
    raise exception '사이즈·핏 평가 값이 올바르지 않습니다.';
  end if;
  if p_quality_rating is not null and (p_quality_rating < 1 or p_quality_rating > 5) then
    raise exception '원단·품질 평가는 1~5점으로 선택해주세요.';
  end if;
  if p_delivery_rating is not null and (p_delivery_rating < 1 or p_delivery_rating > 5) then
    raise exception '배송 만족도는 1~5점으로 선택해주세요.';
  end if;
end;
$$;

revoke all on function public._validate_review_input(uuid, integer, text, text[], text, integer, integer) from public, anon, authenticated;

-- 기존 4개 인자 버전을 지우고 세부 평가를 받는 버전으로 교체한다(기존 호출은 그대로 동작한다).
drop function if exists public.create_funding_review(uuid, integer, text, text[]);

create or replace function public.create_funding_review(
  p_participation_id uuid,
  p_rating integer,
  p_content text,
  p_image_paths text[] default '{}'::text[],
  p_fit_rating text default null,
  p_quality_rating integer default null,
  p_delivery_rating integer default null
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
  if v_reason = 'cancelled' then
    raise exception '취소·환불된 주문에는 리뷰를 작성할 수 없습니다.' using errcode = '42501';
  elsif v_reason = 'unpaid' then
    raise exception '결제 완료된 주문에만 리뷰를 작성할 수 있습니다.' using errcode = '42501';
  elsif v_reason = 'not_delivered' then
    raise exception '배송 완료 후 리뷰를 작성할 수 있습니다.' using errcode = '42501';
  elsif v_reason = 'already_reviewed' then
    raise exception '이 주문에는 이미 리뷰를 작성했습니다.';
  elsif v_reason is not null then
    raise exception '리뷰를 작성할 수 없는 주문입니다.' using errcode = '42501';
  end if;

  perform public._validate_review_input(v_user, p_rating, p_content, v_paths, p_fit_rating, p_quality_rating, p_delivery_rating);

  insert into public.funding_reviews (
    funding_id, participation_id, reviewer_id, rating, content, image_paths, nickname,
    fit_rating, quality_rating, delivery_rating
  )
  values (
    v_fp.funding_id, v_fp.id, v_user, p_rating, btrim(p_content), v_paths, public._review_nickname(v_user),
    p_fit_rating, p_quality_rating, p_delivery_rating
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_funding_review(uuid, integer, text, text[], text, integer, integer) from public, anon;
grant execute on function public.create_funding_review(uuid, integer, text, text[], text, integer, integer) to authenticated;

-- 작성자 본인 수정. 숨김 처리된 리뷰와 취소·환불된 주문의 리뷰는 수정할 수 없다.
create or replace function public.update_my_funding_review(
  p_review_id uuid,
  p_rating integer,
  p_content text,
  p_image_paths text[] default '{}'::text[],
  p_fit_rating text default null,
  p_quality_rating integer default null,
  p_delivery_rating integer default null
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
    raise exception '운영 정책에 따라 숨김 처리된 리뷰는 수정할 수 없습니다.' using errcode = '42501';
  end if;
  select * into v_fp from public.funding_participations where id = v_review.participation_id;
  if v_fp.status = 'cancelled' or v_fp.payment_status <> 'paid' then
    raise exception '취소·환불된 주문의 리뷰는 수정할 수 없습니다.' using errcode = '42501';
  end if;

  perform public._validate_review_input(v_user, p_rating, p_content, v_paths, p_fit_rating, p_quality_rating, p_delivery_rating);

  perform set_config('brander.review_owner_edit', 'on', true);
  update public.funding_reviews
  set rating = p_rating,
      content = btrim(p_content),
      image_paths = v_paths,
      fit_rating = p_fit_rating,
      quality_rating = p_quality_rating,
      delivery_rating = p_delivery_rating,
      edited_at = now()
  where id = p_review_id;
  perform set_config('brander.review_owner_edit', '', true);

  return jsonb_build_object(
    'id', p_review_id,
    -- 더 이상 쓰지 않는 사진 경로(클라이언트가 Storage 에서 지운다)
    'removed_image_paths', coalesce((
      select jsonb_agg(p) from unnest(v_review.image_paths) p where not (p = any(v_paths))
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.update_my_funding_review(uuid, integer, text, text[], text, integer, integer) from public, anon;
grant execute on function public.update_my_funding_review(uuid, integer, text, text[], text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. 판매자: 리뷰 조회 · 답변 · 신고
-- ---------------------------------------------------------------------------

create or replace function public.seller_list_reviews(
  p_funding_id uuid default null,
  p_rating integer default null,
  p_reply_filter text default 'all',
  p_sort text default 'latest',
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_sort text := case when p_sort in ('latest', 'oldest', 'rating_desc', 'rating_asc') then p_sort else 'latest' end;
  v_reply text := case when p_reply_filter in ('all', 'unanswered', 'answered') then p_reply_filter else 'all' end;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  -- 남의 펀딩 ID 를 넣으면 빈 결과가 아니라 오류로 거부한다(본인 펀딩만).
  if p_funding_id is not null and not exists (
    select 1 from public.fundings f where f.id = p_funding_id and f.creator_id = v_user
  ) then
    raise exception '본인 펀딩의 리뷰만 볼 수 있습니다.' using errcode = '42501';
  end if;

  return (
    with mine as (
      select r, fp.payment_provider, fp.partner_order_id, f.product_name,
        (select count(*) from public.funding_review_reports rr
          where rr.review_id = r.id and rr.status = 'pending') as pending_reports
      from public.funding_reviews r
      join public.fundings f on f.id = r.funding_id
      join public.funding_participations fp on fp.id = r.participation_id
      where f.creator_id = v_user
        and (p_funding_id is null or r.funding_id = p_funding_id)
    ),
    -- 통계는 공개 화면과 같은 기준(노출 + 결제 유지 주문)으로 계산한다.
    public_rows as (
      select m.* from mine m
      join public.funding_participations fp on fp.id = (m.r).participation_id
      where (m.r).status = 'visible' and fp.status <> 'cancelled' and fp.payment_status = 'paid'
    ),
    filtered as (
      select * from mine m
      where (p_rating is null or (m.r).rating = p_rating)
        and (v_reply = 'all'
          or (v_reply = 'unanswered' and (m.r).seller_reply is null)
          or (v_reply = 'answered' and (m.r).seller_reply is not null))
    ),
    page as (
      select * from filtered x
      order by
        case when v_sort = 'rating_desc' then (x.r).rating end desc nulls last,
        case when v_sort = 'rating_asc' then (x.r).rating end asc nulls last,
        case when v_sort = 'oldest' then (x.r).created_at end asc nulls last,
        (x.r).created_at desc
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'stats', jsonb_build_object(
        'count', (select count(*) from public_rows),
        'average', coalesce((select round(avg((p.r).rating)::numeric, 1) from public_rows p), 0),
        'distribution', (
          select jsonb_object_agg(s::text, (select count(*) from public_rows p where (p.r).rating = s))
          from generate_series(1, 5) s
        ),
        'unanswered', (select count(*) from mine m where (m.r).seller_reply is null and (m.r).status = 'visible'),
        'new_7d', (select count(*) from mine m where (m.r).created_at >= now() - interval '7 days'),
        'photo_count', (select count(*) from public_rows p where cardinality((p.r).image_paths) > 0),
        'mock_count', (select count(*) from public_rows p where p.payment_provider = 'mock'),
        'hidden', (select count(*) from mine m where (m.r).status = 'hidden'),
        'reported_pending', (select coalesce(sum(m.pending_reports), 0) from mine m)
      ),
      'rows', coalesce((
        select jsonb_agg(
          public._funding_review_json(p.r, p.payment_provider) || jsonb_build_object(
            'funding_id', (p.r).funding_id,
            'funding_name', p.product_name,
            'order_number', p.partner_order_id,
            'status', (p.r).status,
            'pending_reports', p.pending_reports,
            'is_mine', false
          )
          order by
            case when v_sort = 'rating_desc' then (p.r).rating end desc nulls last,
            case when v_sort = 'rating_asc' then (p.r).rating end asc nulls last,
            case when v_sort = 'oldest' then (p.r).created_at end asc nulls last,
            (p.r).created_at desc)
        from page p
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.seller_list_reviews(uuid, integer, text, text, integer, integer) from public, anon;
grant execute on function public.seller_list_reviews(uuid, integer, text, text, integer, integer) to authenticated;

-- 판매자 공식 답변 작성/수정. 빈 값으로 지우는 기능은 없다(수정만 가능).
create or replace function public.seller_reply_funding_review(p_review_id uuid, p_content text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_review public.funding_reviews%rowtype;
  v_content text := btrim(coalesce(p_content, ''));
  v_now timestamptz := now();
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  select r.* into v_review
  from public.funding_reviews r
  join public.fundings f on f.id = r.funding_id
  where r.id = p_review_id and f.creator_id = v_user
  for update of r;
  if not found then
    raise exception '본인 펀딩의 리뷰에만 답변할 수 있습니다.' using errcode = '42501';
  end if;
  if char_length(v_content) < 2 or char_length(v_content) > 1000 then
    raise exception '답변은 2~1000자로 입력해주세요.';
  end if;

  perform set_config('brander.review_seller_reply', 'on', true);
  update public.funding_reviews
  set seller_reply = v_content,
      seller_reply_author_id = v_user,
      seller_replied_at = coalesce(v_review.seller_replied_at, v_now),
      seller_reply_updated_at = case when v_review.seller_reply is null then null else v_now end
  where id = p_review_id;
  perform set_config('brander.review_seller_reply', '', true);

  return jsonb_build_object(
    'content', v_content,
    'replied_at', coalesce(v_review.seller_replied_at, v_now),
    'updated_at', case when v_review.seller_reply is null then null else v_now end
  );
end;
$$;

revoke all on function public.seller_reply_funding_review(uuid, text) from public, anon;
grant execute on function public.seller_reply_funding_review(uuid, text) to authenticated;

-- 판매자 신고. 리뷰를 숨기지 않는다 — 관리자가 확인 후 숨김 또는 유지로 처리한다.
create or replace function public.seller_report_funding_review(p_review_id uuid, p_reason_code text, p_detail text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_review public.funding_reviews%rowtype;
  v_detail text := nullif(btrim(coalesce(p_detail, '')), '');
  v_id uuid;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  select r.* into v_review
  from public.funding_reviews r
  join public.fundings f on f.id = r.funding_id
  where r.id = p_review_id and f.creator_id = v_user;
  if not found then
    raise exception '본인 펀딩의 리뷰만 신고할 수 있습니다.' using errcode = '42501';
  end if;
  if p_reason_code is null or p_reason_code not in ('abusive', 'spam', 'privacy', 'false_info', 'unrelated', 'other') then
    raise exception '신고 사유를 선택해주세요.';
  end if;
  if p_reason_code = 'other' and v_detail is null then
    raise exception '기타 사유는 내용을 입력해주세요.';
  end if;
  if exists (select 1 from public.funding_review_reports
             where review_id = p_review_id and reporter_id = v_user and status = 'pending') then
    raise exception '이미 신고한 리뷰입니다. 관리자 확인을 기다려주세요.';
  end if;

  insert into public.funding_review_reports (review_id, funding_id, reporter_id, reporter_role, reason_code, detail)
  values (p_review_id, v_review.funding_id, v_user, 'creator', p_reason_code, left(v_detail, 1000))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.seller_report_funding_review(uuid, text, text) from public, anon;
grant execute on function public.seller_report_funding_review(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. 관리자: 리뷰 신고 처리
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_review_reports(
  p_status text default 'pending',
  p_limit integer default 30,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('content.view');
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_status text := case when p_status in ('all', 'pending', 'resolved', 'dismissed') then p_status else 'pending' end;
begin
  return (
    with base as (
      select rr.*, r.rating, r.content, r.image_paths, r.nickname, r.status as review_status,
        f.product_name, b.brand_name, public._admin_display_name(rr.reporter_id) as reporter_name
      from public.funding_review_reports rr
      join public.funding_reviews r on r.id = rr.review_id
      join public.fundings f on f.id = rr.funding_id
      left join public.brands b on b.id = f.brand_id
    ),
    filtered as (select * from base where v_status = 'all' or status = v_status),
    page as (select * from filtered order by created_at desc limit v_limit offset v_offset)
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'counts', jsonb_build_object(
        'all', (select count(*) from base),
        'pending', (select count(*) from base where status = 'pending'),
        'resolved', (select count(*) from base where status = 'resolved'),
        'dismissed', (select count(*) from base where status = 'dismissed')
      ),
      'can_resolve', public._admin_has_permission(v_actor, 'reports.manage'),
      'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'review_id', p.review_id,
        'funding_id', p.funding_id,
        'funding_name', p.product_name,
        'brand_name', p.brand_name,
        'reporter_name', p.reporter_name,
        'reason_code', p.reason_code,
        'detail', p.detail,
        'status', p.status,
        'resolution', p.resolution,
        'resolution_note', p.resolution_note,
        'resolved_at', p.resolved_at,
        'created_at', p.created_at,
        'review', jsonb_build_object(
          'rating', p.rating, 'content', p.content, 'image_paths', to_jsonb(p.image_paths),
          'nickname', p.nickname, 'status', p.review_status
        )
      ) order by p.created_at desc) from page p), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_list_review_reports(text, integer, integer) from public, anon;
grant execute on function public.admin_list_review_reports(text, integer, integer) to authenticated;

-- p_action: 'hide' (리뷰 숨김 + 신고 처리) | 'keep' (리뷰 유지, 신고 반려)
-- 같은 리뷰에 걸린 대기 중 신고는 한 번에 같은 결과로 닫는다.
create or replace function public.admin_resolve_review_report(p_report_id uuid, p_action text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('reports.manage');
  v_report public.funding_review_reports%rowtype;
  v_review public.funding_reviews%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_closed integer;
begin
  if p_action not in ('hide', 'keep') then
    raise exception '처리 방법을 선택해주세요.';
  end if;
  if v_note is null then
    raise exception '처리 사유를 입력해주세요.';
  end if;
  select * into v_report from public.funding_review_reports where id = p_report_id for update;
  if not found then
    raise exception '신고를 찾을 수 없습니다.';
  end if;
  if v_report.status <> 'pending' then
    raise exception '이미 처리된 신고입니다.';
  end if;
  select * into v_review from public.funding_reviews where id = v_report.review_id for update;

  perform set_config('brander.admin_rpc', 'on', true);
  if p_action = 'hide' and v_review.status <> 'hidden' then
    update public.funding_reviews set status = 'hidden' where id = v_review.id;
  end if;

  update public.funding_review_reports
  set status = case when p_action = 'hide' then 'resolved' else 'dismissed' end,
      resolution = case when p_action = 'hide' then 'hidden' else 'kept' end,
      resolution_note = v_note,
      resolved_by = v_actor,
      resolved_at = now()
  where review_id = v_review.id and status = 'pending';
  get diagnostics v_closed = row_count;

  perform public._admin_log(
    case when p_action = 'hide' then 'review_report.hide' else 'review_report.keep' end,
    'funding_review', v_review.id::text, left(v_review.content, 80),
    jsonb_build_object('status', v_review.status),
    jsonb_build_object('status', case when p_action = 'hide' then 'hidden' else v_review.status end, 'closed_reports', v_closed),
    v_note,
    jsonb_build_object('funding_id', v_review.funding_id, 'report_id', p_report_id, 'reason_code', v_report.reason_code)
  );

  return jsonb_build_object('closed_reports', v_closed, 'review_status',
    case when p_action = 'hide' then 'hidden' else v_review.status end);
end;
$$;

revoke all on function public.admin_resolve_review_report(uuid, text, text) from public, anon;
grant execute on function public.admin_resolve_review_report(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
