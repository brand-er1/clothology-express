-- 펀딩 구매자 리뷰 + 펀딩 문의(기존 CS 문의 재사용)
--
-- 리뷰 작성 조건 (RPC 와 BEFORE INSERT 트리거에서 이중 검증)
--  * 로그인 회원 본인의 주문(funding_participations.participant_id = auth.uid())
--  * 결제 완료(payment_status = 'paid') · 취소/환불 아님(status <> 'cancelled')
--  * 배송 완료 이후(shipping_status = 'delivered' 또는 production_stage = 'delivered' 또는 status = 'fulfilled')
--  * 주문 1건당 리뷰 1개(participation_id UNIQUE)
-- 테이블은 클라이언트가 직접 읽거나 쓸 수 없고 SECURITY DEFINER RPC 로만 접근한다.

-- ---------------------------------------------------------------------------
-- 1. 리뷰 테이블
-- ---------------------------------------------------------------------------

create table if not exists public.funding_reviews (
  id uuid primary key default gen_random_uuid(),
  funding_id uuid not null references public.fundings(id) on delete cascade,
  participation_id uuid not null unique references public.funding_participations(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null,
  content text not null,
  image_paths text[] not null default '{}'::text[],
  nickname text not null,
  selected_color text,
  selected_size text,
  quantity integer,
  status text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funding_reviews_rating_check check (rating between 1 and 5),
  constraint funding_reviews_content_length check (char_length(btrim(content)) between 10 and 2000),
  constraint funding_reviews_image_count check (cardinality(image_paths) <= 5),
  constraint funding_reviews_status_check check (status in ('visible', 'hidden'))
);

create index if not exists funding_reviews_funding_created_idx on public.funding_reviews (funding_id, created_at desc);
create index if not exists funding_reviews_reviewer_idx on public.funding_reviews (reviewer_id);

comment on table public.funding_reviews is
  '실제 구매자(결제 완료·미취소·배송 완료 주문)만 주문 1건당 1개 작성할 수 있는 펀딩 리뷰. RPC 로만 접근한다.';

alter table public.funding_reviews enable row level security;
revoke all on table public.funding_reviews from anon, authenticated;

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
    when p_participation.status = 'cancelled' or p_participation.payment_status in ('cancelled', 'failed') then 'cancelled'
    when p_participation.payment_status <> 'paid' then 'unpaid'
    when not (p_participation.shipping_status = 'delivered'
              or p_participation.production_stage = 'delivered'
              or p_participation.status = 'fulfilled') then 'not_delivered'
    when exists (select 1 from public.funding_reviews r where r.participation_id = p_participation.id) then 'already_reviewed'
    else null
  end;
$$;

revoke all on function public._funding_review_block_reason(public.funding_participations, uuid) from public, anon, authenticated;

-- 닉네임: 프로필 아이디(이메일 형태 제외) → 이름 마스킹(김*수) → '구매자'
create or replace function public._review_nickname(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select nullif(btrim(p.username), '') from public.profiles p
      where p.id = p_user and p.username is not null and position('@' in p.username) = 0),
    (select case
        when char_length(n) <= 1 then n || '*'
        when char_length(n) = 2 then left(n, 1) || '*'
        else left(n, 1) || repeat('*', char_length(n) - 2) || right(n, 1)
      end
      from (select nullif(btrim(p.full_name), '') as n from public.profiles p where p.id = p_user) x
      where n is not null),
    '구매자'
  );
$$;

revoke all on function public._review_nickname(uuid) from public, anon, authenticated;

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
  new.funding_id := v_fp.funding_id;
  new.selected_color := v_fp.selected_color;
  new.selected_size := v_fp.selected_size;
  new.quantity := v_fp.quantity;
  new.status := 'visible';
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public._guard_funding_review_insert() from public, anon, authenticated;

drop trigger if exists funding_reviews_guard_insert on public.funding_reviews;
create trigger funding_reviews_guard_insert
before insert on public.funding_reviews
for each row execute function public._guard_funding_review_insert();

-- ---------------------------------------------------------------------------
-- 2. 리뷰 사진 Storage (공개 읽기, 본인 폴더에만 업로드)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('funding-reviews', 'funding-reviews', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "Members can upload own review images" on storage.objects;
create policy "Members can upload own review images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'funding-reviews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Members can delete own review images" on storage.objects;
create policy "Members can delete own review images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'funding-reviews'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 3. RPC
-- ---------------------------------------------------------------------------

-- 공개 리뷰 목록 + 평균 별점. 취소/환불된 주문의 리뷰와 숨김 처리된 리뷰는 제외한다.
create or replace function public.get_funding_reviews(
  p_funding_id uuid,
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
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_sort text := case when p_sort in ('latest', 'rating_desc', 'rating_asc') then p_sort else 'latest' end;
begin
  if not exists (select 1 from public.fundings f where f.id = p_funding_id and f.status in ('approved', 'closed')) then
    return jsonb_build_object('summary', jsonb_build_object('average', 0, 'count', 0, 'distribution', '{}'::jsonb), 'rows', '[]'::jsonb);
  end if;

  return (
    with visible as (
      select r.*
      from public.funding_reviews r
      join public.funding_participations fp on fp.id = r.participation_id
      where r.funding_id = p_funding_id
        and r.status = 'visible'
        and fp.status <> 'cancelled'
        and fp.payment_status = 'paid'
    ),
    page as (
      select v.* from visible v
      order by
        case when v_sort = 'rating_desc' then v.rating end desc nulls last,
        case when v_sort = 'rating_asc' then v.rating end asc nulls last,
        v.created_at desc
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'average', coalesce((select round(avg(rating)::numeric, 1) from visible), 0),
        'count', (select count(*) from visible),
        'distribution', (
          select jsonb_object_agg(s::text, (select count(*) from visible v where v.rating = s))
          from generate_series(1, 5) s
        )
      ),
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
          'verified_purchase', true,
          'is_mine', p.reviewer_id = auth.uid(),
          'created_at', p.created_at
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

revoke all on function public.get_funding_reviews(uuid, text, integer, integer) from public;
grant execute on function public.get_funding_reviews(uuid, text, integer, integer) to anon, authenticated;

-- 내 주문별 리뷰 작성 가능 여부 ([리뷰 작성하기] 버튼 표시용 — 실제 검증은 create 에서 다시 한다)
create or replace function public.get_my_funding_review_eligibility(p_funding_id uuid)
returns table (
  participation_id uuid,
  order_number text,
  selected_color text,
  selected_size text,
  quantity integer,
  ordered_at timestamptz,
  can_review boolean,
  block_reason text,
  review_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fp.id, fp.partner_order_id, fp.selected_color, fp.selected_size, fp.quantity, fp.created_at,
    public._funding_review_block_reason(fp, auth.uid()) is null,
    public._funding_review_block_reason(fp, auth.uid()),
    (select r.id from public.funding_reviews r where r.participation_id = fp.id)
  from public.funding_participations fp
  where auth.uid() is not null
    and fp.funding_id = p_funding_id
    and fp.participant_id = auth.uid()
  order by fp.created_at desc;
$$;

revoke all on function public.get_my_funding_review_eligibility(uuid) from public, anon;
grant execute on function public.get_my_funding_review_eligibility(uuid) to authenticated;

create or replace function public.create_funding_review(
  p_participation_id uuid,
  p_rating integer,
  p_content text,
  p_image_paths text[] default '{}'::text[]
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
  v_path text;
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

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception '별점은 1~5점으로 선택해주세요.';
  end if;
  if char_length(btrim(coalesce(p_content, ''))) < 10 then
    raise exception '리뷰 내용을 10자 이상 입력해주세요.';
  end if;
  if char_length(btrim(p_content)) > 2000 then
    raise exception '리뷰 내용은 2000자까지 입력할 수 있습니다.';
  end if;
  if cardinality(v_paths) > 5 then
    raise exception '사진은 최대 5장까지 첨부할 수 있습니다.';
  end if;
  -- 사진은 본인 폴더(funding-reviews/<uid>/...)에 업로드한 파일만 연결할 수 있다.
  foreach v_path in array v_paths loop
    if v_path !~ ('^' || v_user::text || '/[A-Za-z0-9._-]+$') then
      raise exception '첨부 사진 경로가 올바르지 않습니다.';
    end if;
  end loop;

  insert into public.funding_reviews (funding_id, participation_id, reviewer_id, rating, content, image_paths, nickname)
  values (v_fp.funding_id, v_fp.id, v_user, p_rating, btrim(p_content), v_paths, public._review_nickname(v_user))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_funding_review(uuid, integer, text, text[]) from public, anon;
grant execute on function public.create_funding_review(uuid, integer, text, text[]) to authenticated;

create or replace function public.delete_my_funding_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  delete from public.funding_reviews where id = p_review_id and reviewer_id = auth.uid();
  if not found then
    raise exception '본인이 작성한 리뷰만 삭제할 수 있습니다.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.delete_my_funding_review(uuid) from public, anon;
grant execute on function public.delete_my_funding_review(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. 펀딩 문의: 기존 CS 문의(cs_tickets, 관리자 CS 화면에서 처리)를 그대로 사용한다.
-- ---------------------------------------------------------------------------

create or replace function public.create_funding_inquiry(p_funding_id uuid, p_subject text, p_content text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.fundings where id = p_funding_id and status in ('approved', 'closed')) then
    raise exception '문의할 수 없는 펀딩입니다.';
  end if;
  insert into public.cs_tickets (user_id, funding_id, category, subject, content, source, created_by)
  values (auth.uid(), p_funding_id, 'funding', btrim(coalesce(p_subject, '')), btrim(coalesce(p_content, '')), 'customer', auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_funding_inquiry(uuid, text, text) from public, anon;
grant execute on function public.create_funding_inquiry(uuid, text, text) to authenticated;

create or replace function public.list_my_funding_inquiries(p_funding_id uuid)
returns table (id uuid, subject text, content text, status text, created_at timestamptz, resolved_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.subject, t.content, t.status, t.created_at, t.resolved_at
  from public.cs_tickets t
  where auth.uid() is not null and t.user_id = auth.uid() and t.funding_id = p_funding_id
  order by t.created_at desc;
$$;

revoke all on function public.list_my_funding_inquiries(uuid) from public, anon;
grant execute on function public.list_my_funding_inquiries(uuid) to authenticated;

notify pgrst, 'reload schema';
