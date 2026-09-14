-- 패션 디자인 수요검증 커뮤니티: 사용자가 만든 디자인을 공유하고(SHARE),
-- 좋아요/댓글/투표/"나오면 살래요" 구매의향으로 반응을 확인한 뒤(VALIDATE),
-- 목표를 달성하면 기존 BRAND-ER 펀딩(public.fundings)으로 전환(FUND)할 수 있게 한다.
-- outfits/closet_activity와 동일한 패턴: 테이블에 대한 직접 권한은 전부 회수하고,
-- 모든 읽기/쓰기는 이 파일에서 정의하는 SECURITY DEFINER 함수를 통해서만 이뤄진다.
-- 기존 테이블(users/profiles/designs/fundings 등)은 컬럼 추가 외에는 건드리지 않는다.

-- ---------------------------------------------------------------------------
-- 0. profiles 확장 (커뮤니티 프로필에 필요한 최소 컬럼만 추가)
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;

comment on column public.profiles.avatar_url is '커뮤니티/마이페이지에 노출되는 프로필 이미지 URL.';
comment on column public.profiles.bio is '커뮤니티 프로필 소개글.';

-- ---------------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------------

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  design_id uuid references public.designs(id) on delete set null,
  -- 매 조회마다 profiles를 조인하지 않도록 작성 시점의 표시 이름을 스냅샷으로 남긴다 (outfits와 동일 패턴).
  author_name text not null default 'BRAND-ER',
  brand_name text,
  title text not null,
  description text,
  category text not null default '기타',
  hashtags text[] not null default '{}',
  allow_feedback boolean not null default true,
  purchase_intent_enabled boolean not null default true,
  target_purchase_intent_count integer,
  purchase_intent_goal_reached_at timestamptz,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  purchase_intent_count integer not null default 0,
  funding_id uuid references public.fundings(id) on delete set null,
  funding_status text not null default 'none' check (funding_status in (
    'none', 'funding_active', 'funded', 'fabric_ready', 'sample_production',
    'mass_production', 'inspection', 'shipping'
  )),
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'hidden', 'removed')),
  admin_note text,
  report_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_posts_target_positive check (target_purchase_intent_count is null or target_purchase_intent_count > 0)
);

create index if not exists community_posts_feed_idx
  on public.community_posts (created_at desc) where moderation_status = 'visible';
create index if not exists community_posts_popular_idx
  on public.community_posts (like_count desc) where moderation_status = 'visible';
create index if not exists community_posts_user_id_idx on public.community_posts (user_id, created_at desc);
create index if not exists community_posts_category_idx on public.community_posts (category);
create index if not exists community_posts_funding_status_idx on public.community_posts (funding_status);
create index if not exists community_posts_hashtags_idx on public.community_posts using gin (hashtags);

create table if not exists public.community_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  image_url text not null,
  image_path text,
  side text not null default 'front' check (side in ('front', 'back', 'extra')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists community_images_post_id_idx on public.community_images (post_id, position);

create table if not exists public.community_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists community_likes_post_id_idx on public.community_likes (post_id);
create index if not exists community_likes_user_id_idx on public.community_likes (user_id);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_comment_id uuid references public.community_comments(id) on delete cascade,
  author_name text not null default 'BRAND-ER',
  content text not null,
  like_count integer not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_comments_post_id_idx on public.community_comments (post_id, created_at);
create index if not exists community_comments_parent_idx on public.community_comments (parent_comment_id);

create table if not exists public.community_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.community_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index if not exists community_comment_likes_comment_id_idx on public.community_comment_likes (comment_id);

create table if not exists public.community_purchase_intents (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists community_purchase_intents_post_id_idx on public.community_purchase_intents (post_id);

create table if not exists public.community_polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.community_posts(id) on delete cascade,
  question text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.community_polls(id) on delete cascade,
  label text not null,
  position integer not null default 0
);

create index if not exists community_poll_options_poll_id_idx on public.community_poll_options (poll_id, position);

create table if not exists public.community_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.community_polls(id) on delete cascade,
  option_id uuid not null references public.community_poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id)
);

create index if not exists community_poll_votes_option_id_idx on public.community_poll_votes (option_id);

create table if not exists public.community_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  constraint community_follows_no_self check (follower_id <> following_id)
);

create index if not exists community_follows_follower_idx on public.community_follows (follower_id);
create index if not exists community_follows_following_idx on public.community_follows (following_id);

create table if not exists public.community_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in (
    'like', 'comment', 'reply', 'purchase_intent', 'poll_vote', 'follow',
    'purchase_intent_goal', 'funding_started', 'funding_status_changed'
  )),
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.community_comments(id) on delete cascade,
  funding_id uuid references public.fundings(id) on delete set null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists community_notifications_recipient_idx
  on public.community_notifications (recipient_id, created_at desc);
create index if not exists community_notifications_unread_idx
  on public.community_notifications (recipient_id) where is_read = false;

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'user')),
  target_id uuid not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

create index if not exists community_reports_status_idx on public.community_reports (status, created_at desc);

alter table public.community_posts enable row level security;
alter table public.community_images enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_comment_likes enable row level security;
alter table public.community_purchase_intents enable row level security;
alter table public.community_polls enable row level security;
alter table public.community_poll_options enable row level security;
alter table public.community_poll_votes enable row level security;
alter table public.community_follows enable row level security;
alter table public.community_notifications enable row level security;
alter table public.community_reports enable row level security;

-- 모든 직접 접근을 막고, 아래에서 정의하는 SECURITY DEFINER 함수를 통해서만 접근하게 한다.
revoke all on table public.community_posts from anon, authenticated;
revoke all on table public.community_images from anon, authenticated;
revoke all on table public.community_likes from anon, authenticated;
revoke all on table public.community_comments from anon, authenticated;
revoke all on table public.community_comment_likes from anon, authenticated;
revoke all on table public.community_purchase_intents from anon, authenticated;
revoke all on table public.community_polls from anon, authenticated;
revoke all on table public.community_poll_options from anon, authenticated;
revoke all on table public.community_poll_votes from anon, authenticated;
revoke all on table public.community_follows from anon, authenticated;
revoke all on table public.community_notifications from anon, authenticated;
revoke all on table public.community_reports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. 내부 헬퍼
-- ---------------------------------------------------------------------------

create or replace function public._community_display_name(p_user_id uuid)
returns table (author_name text, brand_name text)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(nullif(trim(username), ''), nullif(trim(full_name), ''), 'BRAND-ER'),
    nullif(trim(brand_name), '')
  from public.profiles where id = p_user_id;
$$;

create or replace function public._community_notify(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_type text,
  p_message text,
  p_post_id uuid default null,
  p_comment_id uuid default null,
  p_funding_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient_id is null or p_recipient_id = p_actor_id then
    return;
  end if;
  insert into public.community_notifications (
    recipient_id, actor_id, type, message, post_id, comment_id, funding_id
  ) values (
    p_recipient_id, p_actor_id, p_type, p_message, p_post_id, p_comment_id, p_funding_id
  );
end;
$$;

create or replace function public._community_funding_status_label(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'funding_active' then '펀딩 진행 중'
    when 'funded' then '펀딩 성공'
    when 'fabric_ready' then '원단 준비'
    when 'sample_production' then '샘플 제작'
    when 'mass_production' then '본생산'
    when 'inspection' then '검수'
    when 'shipping' then '배송'
    else '진행 전'
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. 내 디자인 불러오기 ("만들기"에서 저장한 디자인을 커뮤니티 글감으로 사용)
-- ---------------------------------------------------------------------------

create or replace function public.list_my_designs(p_limit integer default 60)
returns table (
  id uuid,
  front_image_url text,
  back_image_url text,
  product_type text,
  color text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  return query
  select d.id, d.front_image_url, d.back_image_url, d.product_type, d.color, d.created_at
  from public.designs d
  where d.user_id = v_user_id
  order by d.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. 게시물 CRUD
-- ---------------------------------------------------------------------------

create or replace function public.create_community_post(
  p_title text,
  p_description text,
  p_category text,
  p_hashtags text[],
  p_images jsonb,
  p_design_id uuid default null,
  p_allow_feedback boolean default true,
  p_purchase_intent_enabled boolean default true,
  p_target_purchase_intent_count integer default null,
  p_poll_question text default null,
  p_poll_options text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_post_id uuid;
  v_poll_id uuid;
  v_author_name text;
  v_brand_name text;
  v_image jsonb;
  v_hashtag text;
  v_clean_tags text[] := '{}';
  v_option text;
  v_position integer;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception '제목을 입력해주세요.';
  end if;
  if p_images is null or jsonb_typeof(p_images) <> 'array' or jsonb_array_length(p_images) = 0 then
    raise exception '디자인 이미지를 최소 1장 등록해주세요.';
  end if;

  if p_design_id is not null then
    if not exists (select 1 from public.designs where id = p_design_id and user_id = v_user_id) then
      raise exception '본인이 만든 디자인만 불러올 수 있습니다.';
    end if;
  end if;

  select author_name, brand_name into v_author_name, v_brand_name
  from public._community_display_name(v_user_id);

  insert into public.community_posts (
    user_id, design_id, author_name, brand_name, title, description, category, hashtags,
    allow_feedback, purchase_intent_enabled, target_purchase_intent_count
  ) values (
    v_user_id, p_design_id, v_author_name, v_brand_name,
    left(trim(p_title), 80),
    nullif(left(coalesce(p_description, ''), 2000), ''),
    coalesce(nullif(trim(p_category), ''), '기타'),
    '{}',
    coalesce(p_allow_feedback, true),
    coalesce(p_purchase_intent_enabled, true),
    case when coalesce(p_purchase_intent_enabled, true) then p_target_purchase_intent_count else null end
  ) returning id into v_post_id;

  v_position := 0;
  for v_image in select * from jsonb_array_elements(p_images)
  loop
    if coalesce(v_image->>'imageUrl', v_image->>'image_url', '') <> '' then
      insert into public.community_images (post_id, image_url, image_path, side, position)
      values (
        v_post_id,
        coalesce(v_image->>'imageUrl', v_image->>'image_url'),
        nullif(coalesce(v_image->>'imagePath', v_image->>'image_path'), ''),
        case when coalesce(v_image->>'side', 'front') in ('front', 'back', 'extra')
          then coalesce(v_image->>'side', 'front') else 'front' end,
        v_position
      );
      v_position := v_position + 1;
    end if;
  end loop;

  select array_agg(distinct tag) into v_clean_tags
  from (
    select left(trim(both from lower(value)), 30) as tag
    from unnest(coalesce(p_hashtags, '{}'::text[])) as value
    where trim(value) <> ''
  ) tags;

  update public.community_posts set hashtags = coalesce(v_clean_tags, '{}') where id = v_post_id;

  if coalesce(trim(p_poll_question), '') <> '' and p_poll_options is not null and array_length(p_poll_options, 1) >= 2 then
    insert into public.community_polls (post_id, question)
    values (v_post_id, left(trim(p_poll_question), 200))
    returning id into v_poll_id;

    v_position := 0;
    foreach v_option in array p_poll_options
    loop
      if trim(coalesce(v_option, '')) <> '' then
        insert into public.community_poll_options (poll_id, label, position)
        values (v_poll_id, left(trim(v_option), 60), v_position);
        v_position := v_position + 1;
      end if;
    end loop;
  end if;

  return v_post_id;
end;
$$;

create or replace function public.delete_community_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner uuid;
begin
  select user_id into v_owner from public.community_posts where id = p_post_id;
  if v_owner is null then
    return;
  end if;
  if v_owner <> v_user_id and not public.is_admin(v_user_id) then
    raise exception '본인의 게시물만 삭제할 수 있습니다.';
  end if;
  delete from public.community_posts where id = p_post_id;
end;
$$;

-- 피드 목록: 카테고리 필터 탭(인기/최신/피드백 요청/펀딩 예정/제작 중) + 검색 + 해시태그.
create or replace function public.list_community_posts(
  p_filter text default 'latest',
  p_category text default null,
  p_search text default null,
  p_hashtag text default null,
  p_user_id uuid default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  user_id uuid,
  author_name text,
  brand_name text,
  avatar_url text,
  title text,
  description text,
  category text,
  hashtags text[],
  cover_image_url text,
  back_image_url text,
  like_count integer,
  comment_count integer,
  purchase_intent_count integer,
  target_purchase_intent_count integer,
  liked_by_me boolean,
  purchase_intent_by_me boolean,
  funding_id uuid,
  funding_status text,
  has_poll boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_filter text := coalesce(p_filter, 'latest');
begin
  return query
  select
    p.id, p.user_id, p.author_name, p.brand_name, prof.avatar_url,
    p.title, p.description, p.category, p.hashtags,
    (select i.image_url from public.community_images i
      where i.post_id = p.id and i.side = 'front' order by i.position limit 1),
    (select i.image_url from public.community_images i
      where i.post_id = p.id and i.side = 'back' order by i.position limit 1),
    p.like_count, p.comment_count, p.purchase_intent_count, p.target_purchase_intent_count,
    (v_user_id is not null and exists(
      select 1 from public.community_likes l where l.post_id = p.id and l.user_id = v_user_id
    )),
    (v_user_id is not null and exists(
      select 1 from public.community_purchase_intents pi where pi.post_id = p.id and pi.user_id = v_user_id
    )),
    p.funding_id, p.funding_status,
    exists(select 1 from public.community_polls pl where pl.post_id = p.id),
    p.created_at
  from public.community_posts p
  left join public.profiles prof on prof.id = p.user_id
  where (p.moderation_status = 'visible' or p.user_id = v_user_id or public.is_admin(v_user_id))
    and (p_user_id is null or p.user_id = p_user_id)
    and (p_category is null or p.category = p_category)
    and (v_filter <> 'feedback' or p.allow_feedback = true)
    and (v_filter <> 'funding_soon' or (p.funding_status = 'none' and p.purchase_intent_enabled = true))
    and (v_filter <> 'in_production' or p.funding_status <> 'none')
    and (p_hashtag is null or p.hashtags @> array[lower(trim(p_hashtag))])
    and (
      p_search is null or trim(p_search) = '' or
      p.title ilike '%' || p_search || '%' or
      p.description ilike '%' || p_search || '%' or
      p.brand_name ilike '%' || p_search || '%' or
      p.author_name ilike '%' || p_search || '%' or
      exists(select 1 from unnest(p.hashtags) tag where tag ilike '%' || p_search || '%')
    )
  order by
    case when v_filter = 'popular' then p.like_count end desc nulls last,
    case when v_filter = 'funding_soon' then
      coalesce(p.purchase_intent_count::numeric / nullif(p.target_purchase_intent_count, 0), 0)
    end desc nulls last,
    case when v_filter = 'in_production' then p.updated_at end desc nulls last,
    p.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- 게시물 상세: 이미지, 투표(옵션별 득표/퍼센트/내 투표), 작성자, 펀딩 상태를 한 번에 반환.
create or replace function public.get_community_post(p_post_id uuid)
returns table (
  id uuid,
  user_id uuid,
  author_name text,
  brand_name text,
  avatar_url text,
  bio text,
  title text,
  description text,
  category text,
  hashtags text[],
  images jsonb,
  allow_feedback boolean,
  purchase_intent_enabled boolean,
  target_purchase_intent_count integer,
  like_count integer,
  comment_count integer,
  purchase_intent_count integer,
  liked_by_me boolean,
  purchase_intent_by_me boolean,
  is_owner boolean,
  is_following_author boolean,
  design_id uuid,
  funding_id uuid,
  funding_status text,
  funding_status_label text,
  poll jsonb,
  created_at timestamptz,
  moderation_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  return query
  select
    p.id, p.user_id, p.author_name, p.brand_name, prof.avatar_url, prof.bio,
    p.title, p.description, p.category, p.hashtags,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'imageUrl', i.image_url, 'imagePath', i.image_path,
        'side', i.side, 'position', i.position
      ) order by i.position)
      from public.community_images i where i.post_id = p.id
    ), '[]'::jsonb),
    p.allow_feedback, p.purchase_intent_enabled, p.target_purchase_intent_count,
    p.like_count, p.comment_count, p.purchase_intent_count,
    (v_user_id is not null and exists(
      select 1 from public.community_likes l where l.post_id = p.id and l.user_id = v_user_id
    )),
    (v_user_id is not null and exists(
      select 1 from public.community_purchase_intents pi where pi.post_id = p.id and pi.user_id = v_user_id
    )),
    (v_user_id is not null and v_user_id = p.user_id),
    (v_user_id is not null and exists(
      select 1 from public.community_follows f where f.follower_id = v_user_id and f.following_id = p.user_id
    )),
    p.design_id, p.funding_id, p.funding_status, public._community_funding_status_label(p.funding_status),
    (
      select jsonb_build_object(
        'id', pl.id,
        'question', pl.question,
        'totalVotes', (select count(*) from public.community_poll_votes v where v.poll_id = pl.id),
        'myOptionId', (select v.option_id from public.community_poll_votes v
          where v.poll_id = pl.id and v.user_id = v_user_id),
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', o.id,
            'label', o.label,
            'votes', (select count(*) from public.community_poll_votes v where v.option_id = o.id)
          ) order by o.position)
          from public.community_poll_options o where o.poll_id = pl.id
        ), '[]'::jsonb)
      )
      from public.community_polls pl where pl.post_id = p.id
    ),
    p.created_at, p.moderation_status
  from public.community_posts p
  left join public.profiles prof on prof.id = p.user_id
  where p.id = p_post_id
    and (p.moderation_status = 'visible' or p.user_id = v_user_id or public.is_admin(v_user_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. 좋아요 / 구매의향 ("나오면 살래요")
-- ---------------------------------------------------------------------------

create or replace function public.toggle_community_post_like(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner uuid;
  v_title text;
  v_already boolean;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select user_id, title into v_owner, v_title from public.community_posts where id = p_post_id;
  if v_owner is null then
    raise exception '게시물을 찾을 수 없습니다.';
  end if;

  select exists(
    select 1 from public.community_likes where post_id = p_post_id and user_id = v_user_id
  ) into v_already;

  if v_already then
    delete from public.community_likes where post_id = p_post_id and user_id = v_user_id;
    update public.community_posts set like_count = greatest(like_count - 1, 0) where id = p_post_id;
    return false;
  else
    insert into public.community_likes (post_id, user_id) values (p_post_id, v_user_id);
    update public.community_posts set like_count = like_count + 1 where id = p_post_id;
    perform public._community_notify(
      v_owner, v_user_id, 'like', '회원님의 디자인 "' || v_title || '"에 좋아요를 남겼습니다.', p_post_id
    );
    return true;
  end if;
end;
$$;

-- "나오면 살래요" 구매의향: 좋아요와 별도 테이블에 저장하고, 목표 인원 달성 시 1회만 알림을 보낸다.
create or replace function public.toggle_community_purchase_intent(p_post_id uuid)
returns table (joined boolean, intent_count integer, goal_reached boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_post record;
  v_already boolean;
  v_new_count integer;
  v_goal_just_reached boolean := false;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_post from public.community_posts where id = p_post_id for update;
  if v_post.id is null then
    raise exception '게시물을 찾을 수 없습니다.';
  end if;
  if not v_post.purchase_intent_enabled then
    raise exception '구매의향 조사를 받지 않는 게시물입니다.';
  end if;

  select exists(
    select 1 from public.community_purchase_intents where post_id = p_post_id and user_id = v_user_id
  ) into v_already;

  if v_already then
    delete from public.community_purchase_intents where post_id = p_post_id and user_id = v_user_id;
    update public.community_posts set purchase_intent_count = greatest(purchase_intent_count - 1, 0)
      where id = p_post_id
      returning purchase_intent_count into v_new_count;
    return query select false, v_new_count, false;
    return;
  end if;

  insert into public.community_purchase_intents (post_id, user_id) values (p_post_id, v_user_id);
  update public.community_posts set purchase_intent_count = purchase_intent_count + 1
    where id = p_post_id
    returning purchase_intent_count into v_new_count;

  perform public._community_notify(
    v_post.user_id, v_user_id, 'purchase_intent',
    v_new_count || '명이 회원님의 디자인 "' || v_post.title || '"을(를) 구매하고 싶어합니다.', p_post_id
  );

  if v_post.target_purchase_intent_count is not null
     and v_post.purchase_intent_goal_reached_at is null
     and v_new_count >= v_post.target_purchase_intent_count then
    update public.community_posts set purchase_intent_goal_reached_at = now() where id = p_post_id;
    v_goal_just_reached := true;
    perform public._community_notify(
      v_post.user_id, null, 'purchase_intent_goal',
      v_new_count || '명이 회원님의 디자인 "' || v_post.title || '"을(를) 구매하고 싶어합니다. 지금 펀딩을 시작해보세요.',
      p_post_id
    );
  end if;

  return query select true, v_new_count, v_goal_just_reached;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. 댓글 / 답글 / 댓글 좋아요
-- ---------------------------------------------------------------------------

create or replace function public.create_community_comment(
  p_post_id uuid,
  p_content text,
  p_parent_comment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_post record;
  v_parent record;
  v_author_name text;
  v_comment_id uuid;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if coalesce(trim(p_content), '') = '' then
    raise exception '댓글 내용을 입력해주세요.';
  end if;

  select * into v_post from public.community_posts where id = p_post_id;
  if v_post.id is null then
    raise exception '게시물을 찾을 수 없습니다.';
  end if;

  if p_parent_comment_id is not null then
    select * into v_parent from public.community_comments
      where id = p_parent_comment_id and post_id = p_post_id;
    if v_parent.id is null then
      raise exception '답글을 달 댓글을 찾을 수 없습니다.';
    end if;
  end if;

  select author_name into v_author_name from public._community_display_name(v_user_id);

  insert into public.community_comments (post_id, user_id, parent_comment_id, author_name, content)
  values (p_post_id, v_user_id, p_parent_comment_id, v_author_name, left(trim(p_content), 1000))
  returning id into v_comment_id;

  update public.community_posts set comment_count = comment_count + 1 where id = p_post_id;

  if p_parent_comment_id is not null then
    perform public._community_notify(
      v_parent.user_id, v_user_id, 'reply', v_author_name || '님이 회원님의 댓글에 답글을 남겼습니다.',
      p_post_id, v_comment_id
    );
  else
    perform public._community_notify(
      v_post.user_id, v_user_id, 'comment', v_author_name || '님이 회원님의 디자인에 댓글을 남겼습니다.',
      p_post_id, v_comment_id
    );
  end if;

  return v_comment_id;
end;
$$;

create or replace function public.update_community_comment(p_comment_id uuid, p_content text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner uuid;
begin
  select user_id into v_owner from public.community_comments where id = p_comment_id and is_deleted = false;
  if v_owner is null then
    raise exception '댓글을 찾을 수 없습니다.';
  end if;
  if v_owner <> v_user_id then
    raise exception '본인의 댓글만 수정할 수 있습니다.';
  end if;
  if coalesce(trim(p_content), '') = '' then
    raise exception '댓글 내용을 입력해주세요.';
  end if;

  update public.community_comments
    set content = left(trim(p_content), 1000), updated_at = now()
    where id = p_comment_id;
end;
$$;

create or replace function public.delete_community_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_comment record;
begin
  select * into v_comment from public.community_comments where id = p_comment_id and is_deleted = false;
  if v_comment.id is null then
    return;
  end if;
  if v_comment.user_id <> v_user_id and not public.is_admin(v_user_id) then
    raise exception '본인의 댓글만 삭제할 수 있습니다.';
  end if;

  update public.community_comments
    set is_deleted = true, content = ''
    where id = p_comment_id;

  update public.community_posts set comment_count = greatest(comment_count - 1, 0) where id = v_comment.post_id;
end;
$$;

create or replace function public.toggle_community_comment_like(p_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_already boolean;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not exists (select 1 from public.community_comments where id = p_comment_id and is_deleted = false) then
    raise exception '댓글을 찾을 수 없습니다.';
  end if;

  select exists(
    select 1 from public.community_comment_likes where comment_id = p_comment_id and user_id = v_user_id
  ) into v_already;

  if v_already then
    delete from public.community_comment_likes where comment_id = p_comment_id and user_id = v_user_id;
    update public.community_comments set like_count = greatest(like_count - 1, 0) where id = p_comment_id;
    return false;
  else
    insert into public.community_comment_likes (comment_id, user_id) values (p_comment_id, v_user_id);
    update public.community_comments set like_count = like_count + 1 where id = p_comment_id;
    return true;
  end if;
end;
$$;

create or replace function public.list_community_comments(p_post_id uuid)
returns table (
  id uuid,
  parent_comment_id uuid,
  user_id uuid,
  author_name text,
  avatar_url text,
  content text,
  like_count integer,
  liked_by_me boolean,
  is_deleted boolean,
  is_owner boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  return query
  select
    c.id, c.parent_comment_id, c.user_id, c.author_name, prof.avatar_url,
    case when c.is_deleted then '삭제된 댓글입니다.' else c.content end,
    c.like_count,
    (v_user_id is not null and exists(
      select 1 from public.community_comment_likes l where l.comment_id = c.id and l.user_id = v_user_id
    )),
    c.is_deleted,
    (v_user_id is not null and v_user_id = c.user_id),
    c.created_at, c.updated_at
  from public.community_comments c
  left join public.profiles prof on prof.id = c.user_id
  where c.post_id = p_post_id
  order by c.created_at asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. 디자인 투표
-- ---------------------------------------------------------------------------

create or replace function public.vote_community_poll(p_poll_id uuid, p_option_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_post_id uuid;
  v_owner uuid;
  v_title text;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not exists (select 1 from public.community_poll_options where id = p_option_id and poll_id = p_poll_id) then
    raise exception '투표 항목을 찾을 수 없습니다.';
  end if;
  if exists (select 1 from public.community_poll_votes where poll_id = p_poll_id and user_id = v_user_id) then
    raise exception '이미 투표에 참여하셨습니다.';
  end if;

  insert into public.community_poll_votes (poll_id, option_id, user_id) values (p_poll_id, p_option_id, v_user_id);

  select p.id, p.user_id, p.title into v_post_id, v_owner, v_title
  from public.community_polls pl join public.community_posts p on p.id = pl.post_id
  where pl.id = p_poll_id;

  perform public._community_notify(
    v_owner, v_user_id, 'poll_vote', '회원님의 디자인 "' || v_title || '" 투표에 참여했습니다.', v_post_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. 팔로우 / 프로필
-- ---------------------------------------------------------------------------

create or replace function public.toggle_community_follow(p_target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_already boolean;
  v_actor_name text;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if v_user_id = p_target_user_id then
    raise exception '본인을 팔로우할 수 없습니다.';
  end if;

  select exists(
    select 1 from public.community_follows where follower_id = v_user_id and following_id = p_target_user_id
  ) into v_already;

  if v_already then
    delete from public.community_follows where follower_id = v_user_id and following_id = p_target_user_id;
    return false;
  else
    insert into public.community_follows (follower_id, following_id) values (v_user_id, p_target_user_id);
    select author_name into v_actor_name from public._community_display_name(v_user_id);
    perform public._community_notify(
      p_target_user_id, v_user_id, 'follow', v_actor_name || '님이 회원님을 팔로우하기 시작했습니다.'
    );
    return true;
  end if;
end;
$$;

create or replace function public.get_community_profile(p_user_id uuid)
returns table (
  user_id uuid,
  username text,
  brand_name text,
  bio text,
  avatar_url text,
  follower_count integer,
  following_count integer,
  post_count integer,
  is_following_by_me boolean,
  is_me boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  return query
  select
    prof.id, prof.username, prof.brand_name, prof.bio, prof.avatar_url,
    (select count(*)::integer from public.community_follows where following_id = prof.id),
    (select count(*)::integer from public.community_follows where follower_id = prof.id),
    (select count(*)::integer from public.community_posts
      where user_id = prof.id and (moderation_status = 'visible' or prof.id = v_user_id)),
    (v_user_id is not null and exists(
      select 1 from public.community_follows where follower_id = v_user_id and following_id = prof.id
    )),
    (v_user_id is not null and v_user_id = prof.id)
  from public.profiles prof
  where prof.id = p_user_id;
end;
$$;

create or replace function public.update_community_profile(p_bio text default null, p_avatar_url text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  update public.profiles set
    bio = coalesce(nullif(left(trim(p_bio), 300), ''), bio),
    avatar_url = coalesce(nullif(trim(p_avatar_url), ''), avatar_url)
  where id = v_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. 알림
-- ---------------------------------------------------------------------------

create or replace function public.list_my_community_notifications(p_limit integer default 50)
returns table (
  id uuid,
  actor_id uuid,
  actor_name text,
  actor_avatar_url text,
  type text,
  message text,
  post_id uuid,
  comment_id uuid,
  funding_id uuid,
  is_read boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  return query
  select
    n.id, n.actor_id,
    coalesce(prof.username, prof.full_name, 'BRAND-ER'), prof.avatar_url,
    n.type, n.message, n.post_id, n.comment_id, n.funding_id, n.is_read, n.created_at
  from public.community_notifications n
  left join public.profiles prof on prof.id = n.actor_id
  where n.recipient_id = v_user_id
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

create or replace function public.mark_community_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_notifications
    set is_read = true
    where id = p_notification_id and recipient_id = auth.uid();
end;
$$;

create or replace function public.mark_all_community_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_notifications set is_read = true
    where recipient_id = auth.uid() and is_read = false;
end;
$$;

create or replace function public.get_unread_community_notification_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer from public.community_notifications
    where recipient_id = auth.uid() and is_read = false;
$$;

-- ---------------------------------------------------------------------------
-- 10. 신고
-- ---------------------------------------------------------------------------

create or replace function public.report_community_post(p_post_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  insert into public.community_reports (reporter_id, target_type, target_id, reason)
  values (v_user_id, 'post', p_post_id, nullif(trim(p_reason), ''));
  update public.community_posts set report_count = report_count + 1 where id = p_post_id;
end;
$$;

create or replace function public.report_community_comment(p_comment_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  insert into public.community_reports (reporter_id, target_type, target_id, reason)
  values (v_user_id, 'comment', p_comment_id, nullif(trim(p_reason), ''));
end;
$$;

create or replace function public.report_community_user(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  insert into public.community_reports (reporter_id, target_type, target_id, reason)
  values (v_user_id, 'user', p_user_id, nullif(trim(p_reason), ''));
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. 구매의향 -> 펀딩 전환 (핵심 기능)
-- ---------------------------------------------------------------------------

create or replace function public.start_funding_from_community_post(p_post_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_post record;
  v_design record;
  v_cover_image record;
  v_funding_id uuid;
  v_cloth_type text;
  v_material text;
  v_size text;
  v_color text;
  v_poll_summary text := '';
  v_poll record;
  v_option record;
  v_description text;
  v_interested uuid;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_post from public.community_posts where id = p_post_id for update;
  if v_post.id is null then
    raise exception '게시물을 찾을 수 없습니다.';
  end if;
  if v_post.user_id <> v_user_id then
    raise exception '본인의 디자인만 펀딩으로 전환할 수 있습니다.';
  end if;

  if v_post.funding_id is not null then
    return v_post.funding_id;
  end if;

  if v_post.target_purchase_intent_count is not null
     and v_post.purchase_intent_count < v_post.target_purchase_intent_count then
    raise exception '구매의향 목표 인원을 달성한 뒤에 펀딩을 시작할 수 있습니다.';
  end if;

  select * into v_cover_image from public.community_images
    where post_id = p_post_id and side = 'front' order by position limit 1;
  if v_cover_image.id is null then
    select * into v_cover_image from public.community_images where post_id = p_post_id order by position limit 1;
  end if;
  if v_cover_image.id is null then
    raise exception '디자인 이미지가 없어 펀딩을 시작할 수 없습니다.';
  end if;

  if v_post.design_id is not null then
    select * into v_design from public.designs where id = v_post.design_id;
  end if;

  v_cloth_type := coalesce(v_design.product_type, v_post.category, '의류');
  v_material := coalesce(v_design.fabric, '미정');
  v_size := coalesce(v_design.fit, 'FREE');
  v_color := coalesce(v_design.color, '기본 색상');

  select pl.* into v_poll from public.community_polls pl where pl.post_id = p_post_id;
  if v_poll.id is not null then
    v_poll_summary := e'\n\n[커뮤니티 투표 결과] ' || v_poll.question || e'\n';
    for v_option in
      select o.label,
        count(v.id) as votes,
        round(count(v.id)::numeric * 100 / greatest((select count(*) from public.community_poll_votes where poll_id = v_poll.id), 1))
          as percent
      from public.community_poll_options o
      left join public.community_poll_votes v on v.option_id = o.id
      where o.poll_id = v_poll.id
      group by o.id, o.label, o.position
      order by o.position
    loop
      v_poll_summary := v_poll_summary || '- ' || v_option.label || ': ' || v_option.percent || '% (' || v_option.votes || '표)' || e'\n';
    end loop;
  end if;

  v_description := coalesce(v_post.description, '') ||
    e'\n\n[커뮤니티 구매의향] ' || v_post.purchase_intent_count || '명이 이 디자인을 구매하고 싶어합니다.' ||
    v_poll_summary;

  insert into public.fundings (
    creator_id, product_name, cloth_type, material, color, size,
    color_options, size_options, image_url, image_path,
    trademark_screening_id, trademark_screening_required,
    description, moq, current_orders, funding_days, status
  ) values (
    v_user_id, left(v_post.title, 120), v_cloth_type, v_material, v_color, v_size,
    array[v_color], array[v_size], v_cover_image.image_url, v_cover_image.image_path,
    null, false,
    trim(v_description), 20, 0, 30, 'pending'
  ) returning id into v_funding_id;

  update public.community_posts
    set funding_id = v_funding_id, funding_status = 'funding_active', updated_at = now()
    where id = p_post_id;

  for v_interested in
    select distinct pi.user_id from public.community_purchase_intents pi
    where pi.post_id = p_post_id and pi.user_id <> v_user_id
  loop
    perform public._community_notify(
      v_interested, v_user_id, 'funding_started',
      '관심 표시하신 디자인 "' || v_post.title || '"의 펀딩이 시작되었습니다.', p_post_id, null, v_funding_id
    );
  end loop;

  return v_funding_id;
end;
$$;

-- 펀딩 성공 이후 생산 단계 갱신 (작성자 본인 또는 관리자). 커뮤니티에서도 현재 상태를 보여준다.
create or replace function public.update_community_funding_status(p_post_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_post record;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_status not in ('funding_active', 'funded', 'fabric_ready', 'sample_production', 'mass_production', 'inspection', 'shipping') then
    raise exception '알 수 없는 상태입니다.';
  end if;

  select * into v_post from public.community_posts where id = p_post_id;
  if v_post.id is null then
    raise exception '게시물을 찾을 수 없습니다.';
  end if;
  if v_post.user_id <> v_user_id and not public.is_admin(v_user_id) then
    raise exception '펀딩 상태를 변경할 권한이 없습니다.';
  end if;

  update public.community_posts set funding_status = p_status, updated_at = now() where id = p_post_id;

  perform public._community_notify(
    v_post.user_id, v_user_id, 'funding_status_changed',
    '디자인 "' || v_post.title || '"의 진행 상태가 "' || public._community_funding_status_label(p_status) || '"(으)로 변경되었습니다.',
    p_post_id, null, v_post.funding_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. 관리자
-- ---------------------------------------------------------------------------

create or replace function public.get_admin_community_posts()
returns table (
  id uuid,
  user_id uuid,
  author_name text,
  brand_name text,
  title text,
  category text,
  cover_image_url text,
  like_count integer,
  comment_count integer,
  purchase_intent_count integer,
  report_count integer,
  moderation_status text,
  admin_note text,
  funding_id uuid,
  funding_status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception '관리자만 조회할 수 있습니다.';
  end if;

  return query
  select
    p.id, p.user_id, p.author_name, p.brand_name, p.title, p.category,
    (select i.image_url from public.community_images i where i.post_id = p.id order by i.position limit 1),
    p.like_count, p.comment_count, p.purchase_intent_count, p.report_count,
    p.moderation_status, p.admin_note, p.funding_id, p.funding_status, p.created_at
  from public.community_posts p
  order by p.created_at desc;
end;
$$;

create or replace function public.moderate_community_post(p_post_id uuid, p_status text, p_admin_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;
  if p_status not in ('visible', 'hidden', 'removed') then
    raise exception '알 수 없는 상태입니다.';
  end if;

  update public.community_posts
    set moderation_status = p_status, admin_note = nullif(trim(coalesce(p_admin_note, '')), '')
    where id = p_post_id;
end;
$$;

create or replace function public.get_admin_community_comments(p_limit integer default 300)
returns table (
  id uuid,
  post_id uuid,
  post_title text,
  user_id uuid,
  author_name text,
  content text,
  is_deleted boolean,
  like_count integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception '관리자만 조회할 수 있습니다.';
  end if;

  return query
  select c.id, c.post_id, p.title, c.user_id, c.author_name, c.content, c.is_deleted, c.like_count, c.created_at
  from public.community_comments c
  join public.community_posts p on p.id = c.post_id
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 300), 1), 1000);
end;
$$;

create or replace function public.admin_delete_community_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;
  perform public.delete_community_comment(p_comment_id);
end;
$$;

create or replace function public.get_admin_community_reports()
returns table (
  id uuid,
  reporter_id uuid,
  reporter_name text,
  target_type text,
  target_id uuid,
  target_summary text,
  reason text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception '관리자만 조회할 수 있습니다.';
  end if;

  return query
  select
    r.id, r.reporter_id, coalesce(prof.username, prof.full_name, 'BRAND-ER'),
    r.target_type, r.target_id,
    case r.target_type
      when 'post' then (select title from public.community_posts where id = r.target_id)
      when 'comment' then (select left(content, 80) from public.community_comments where id = r.target_id)
      when 'user' then (select coalesce(username, full_name) from public.profiles where id = r.target_id)
    end,
    r.reason, r.status, r.created_at
  from public.community_reports r
  left join public.profiles prof on prof.id = r.reporter_id
  order by r.created_at desc;
end;
$$;

create or replace function public.resolve_community_report(p_report_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;
  if p_status not in ('reviewed', 'dismissed') then
    raise exception '알 수 없는 상태입니다.';
  end if;

  update public.community_reports
    set status = p_status, reviewed_at = now(), reviewed_by = auth.uid()
    where id = p_report_id;
end;
$$;

create or replace function public.get_admin_community_stats()
returns table (
  total_posts integer,
  total_comments integer,
  total_purchase_intents integer,
  total_funding_conversions integer,
  funding_conversion_rate numeric,
  pending_reports integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception '관리자만 조회할 수 있습니다.';
  end if;

  return query
  select
    (select count(*)::integer from public.community_posts),
    (select count(*)::integer from public.community_comments where is_deleted = false),
    (select count(*)::integer from public.community_purchase_intents),
    (select count(*)::integer from public.community_posts where funding_id is not null),
    (select round(
      count(*) filter (where funding_id is not null)::numeric * 100 / greatest(count(*), 1), 1
    ) from public.community_posts),
    (select count(*)::integer from public.community_reports where status = 'pending');
end;
$$;

create or replace function public.get_admin_community_top_posts(p_metric text default 'like_count', p_limit integer default 10)
returns table (
  id uuid,
  title text,
  author_name text,
  cover_image_url text,
  like_count integer,
  purchase_intent_count integer,
  comment_count integer,
  funding_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception '관리자만 조회할 수 있습니다.';
  end if;

  return query
  select
    p.id, p.title, p.author_name,
    (select i.image_url from public.community_images i where i.post_id = p.id order by i.position limit 1),
    p.like_count, p.purchase_intent_count, p.comment_count, p.funding_id, p.created_at
  from public.community_posts p
  order by case when p_metric = 'purchase_intent_count' then p.purchase_intent_count else p.like_count end desc
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. 권한 부여
-- ---------------------------------------------------------------------------

revoke all on function public._community_display_name(uuid) from public;
revoke all on function public._community_notify(uuid, uuid, text, text, uuid, uuid, uuid) from public;
revoke all on function public._community_funding_status_label(text) from public;

grant execute on function public.list_my_designs(integer) to authenticated;
grant execute on function public.create_community_post(text, text, text, text[], jsonb, uuid, boolean, boolean, integer, text, text[]) to authenticated;
grant execute on function public.delete_community_post(uuid) to authenticated;
grant execute on function public.list_community_posts(text, text, text, text, uuid, integer, integer) to anon, authenticated;
grant execute on function public.get_community_post(uuid) to anon, authenticated;
grant execute on function public.toggle_community_post_like(uuid) to authenticated;
grant execute on function public.toggle_community_purchase_intent(uuid) to authenticated;
grant execute on function public.create_community_comment(uuid, text, uuid) to authenticated;
grant execute on function public.update_community_comment(uuid, text) to authenticated;
grant execute on function public.delete_community_comment(uuid) to authenticated;
grant execute on function public.toggle_community_comment_like(uuid) to authenticated;
grant execute on function public.list_community_comments(uuid) to anon, authenticated;
grant execute on function public.vote_community_poll(uuid, uuid) to authenticated;
grant execute on function public.toggle_community_follow(uuid) to authenticated;
grant execute on function public.get_community_profile(uuid) to anon, authenticated;
grant execute on function public.update_community_profile(text, text) to authenticated;
grant execute on function public.list_my_community_notifications(integer) to authenticated;
grant execute on function public.mark_community_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_community_notifications_read() to authenticated;
grant execute on function public.get_unread_community_notification_count() to authenticated;
grant execute on function public.report_community_post(uuid, text) to authenticated;
grant execute on function public.report_community_comment(uuid, text) to authenticated;
grant execute on function public.report_community_user(uuid, text) to authenticated;
grant execute on function public.start_funding_from_community_post(uuid) to authenticated;
grant execute on function public.update_community_funding_status(uuid, text) to authenticated;
grant execute on function public.get_admin_community_posts() to authenticated;
grant execute on function public.moderate_community_post(uuid, text, text) to authenticated;
grant execute on function public.get_admin_community_comments(integer) to authenticated;
grant execute on function public.admin_delete_community_comment(uuid) to authenticated;
grant execute on function public.get_admin_community_reports() to authenticated;
grant execute on function public.resolve_community_report(uuid, text) to authenticated;
grant execute on function public.get_admin_community_stats() to authenticated;
grant execute on function public.get_admin_community_top_posts(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 14. 이미지 업로드용 Storage 버킷 (funding-samples와 동일한 패턴: 사용자 폴더 스코프)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-posts', 'community-posts', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-avatars', 'community-avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "Community members can upload post images" on storage.objects;
create policy "Community members can upload post images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-posts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Community members can manage own post images" on storage.objects;
create policy "Community members can manage own post images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'community-posts'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Community members can delete own post images" on storage.objects;
create policy "Community members can delete own post images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'community-posts'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Community members can upload own avatar" on storage.objects;
create policy "Community members can upload own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Community members can update own avatar" on storage.objects;
create policy "Community members can update own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'community-avatars'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on table public.community_posts is
  '디자인 수요검증 커뮤니티 게시물 — CREATE(디자인) → SHARE(커뮤니티 공개) → VALIDATE(좋아요/투표/구매의향) → FUND(펀딩 전환) 흐름의 중심 테이블. 모든 접근은 SECURITY DEFINER 함수를 통해서만 이뤄진다.';
comment on table public.community_purchase_intents is
  '"나오면 살래요" 구매의향 — 좋아요(community_likes)와 별도로 저장하며 계정당 게시물 1개에 1건(unique)만 등록된다.';
comment on table public.community_follows is
  '커뮤니티 팔로우 관계. follower_id -> following_id, 계정당 1쌍 1건(unique), 자기 자신 팔로우는 금지된다.';
comment on table public.community_notifications is
  '커뮤니티 알림함 — 좋아요/댓글/답글/구매의향/투표참여/팔로워/구매의향 목표 달성/펀딩 시작/펀딩 상태 변경.';
