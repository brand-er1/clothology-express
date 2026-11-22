-- BRAND-ER LAB 릴스 촬영 프로젝트 안내 · 촬영 동의 분리 (비파괴적: 기존 신청 · 동의 이력은 그대로 둔다)
--
-- 바뀌는 점
--  * 촬영 참여 가능 여부(filming_availability) 추가: available | discuss | unavailable
--    2026-11-23 이후 신청은 필수(접수 함수가 검사). 기존 신청은 비어 있을 수 있어 컬럼은 null 허용.
--  * '인스타그램 릴스 촬영 및 게시 동의'를 [필수] → [선택] 으로 바꾼다.
--    동의하지 않아도 신청 · 제작 검토가 가능하고, 신청서 제출만으로 촬영 동의가 된 것으로 보지 않는다.
--    (실제 촬영은 이 선택 동의 + 촬영 전 개별 동의서(lab_filming_agreements)가 있어야 진행)
--  * 동의 문구 · 필수 여부가 바뀌어 동의 문구 버전을 2026-11-23.v1 로 올린다(이전 버전 행은 보관, is_current 만 내림).

-- ---------------------------------------------------------------------------
-- 1. 신청서 컬럼 · 제약
-- ---------------------------------------------------------------------------

alter table public.lab_applications
  add column if not exists filming_availability text;

alter table public.lab_applications drop constraint if exists lab_applications_filming_availability_check;
alter table public.lab_applications add constraint lab_applications_filming_availability_check check (
  filming_availability is null or filming_availability in ('available', 'discuss', 'unavailable'));

comment on column public.lab_applications.filming_availability is
  '촬영 참여 가능 여부(신청자 응답): available | discuss | unavailable. 촬영 · 게시 동의(lab_consent_records 의 filming)와 별개이며, 이 값만으로 촬영 동의로 보지 않는다.';

-- ---------------------------------------------------------------------------
-- 2. 동의 문구 새 버전 (이전 버전은 보관, is_current 만 내림)
-- ---------------------------------------------------------------------------

update public.lab_consent_documents set is_current = false where is_current and version <> '2026-11-23.v1';

insert into public.lab_consent_documents (consent_key, version, title, body, is_required, is_current) values
  ('participation', '2026-11-23.v1', '프로젝트 참여 및 제작 과정 공개 동의',
   '본인은 브랜더 LAB 무료 샘플 제작 프로젝트의 진행 방식에 대해 안내받았으며, 선정 시 신청한 디자인의 제작 과정 및 완성품(의류)이 브랜더의 콘텐츠로 소개될 수 있음에 동의합니다. 본인의 얼굴·음성 등 초상이 담기는 촬영은 이 동의에 포함되지 않으며, 아래 촬영 및 게시 동의와 촬영 전 개별 동의에 따릅니다.',
   true, true),
  ('filming', '2026-11-23.v1', '인스타그램 릴스 촬영 및 게시 동의',
   '본인은 선정 시 길거리 인터뷰, 의류 제작 과정, 완성품 전달 및 착용 장면 촬영에 참여하고, 촬영된 영상과 음성, 초상 등이 편집되어 BRAND-ER LAB 공식 인스타그램 릴스로 게시되는 것에 동의합니다. 이 동의는 선택 사항으로, 동의하지 않아도 신청과 제작 검토는 가능합니다. 신청서 제출만으로 촬영이 확정되지 않으며, 실제 촬영 전에는 촬영 범위, 게시 매체, 이용 기간, 편집 및 재사용 범위를 구체적으로 안내받고 별도로 동의 여부를 결정합니다.',
   false, true),
  ('privacy', '2026-11-23.v1', '개인정보 수집 및 이용 동의',
   '신청 접수, 참여자 선정 및 연락을 위해 필요한 개인정보의 수집·이용에 동의합니다.',
   true, true),
  ('marketing', '2026-11-23.v1', '추가 콘텐츠 및 홍보 활용 동의',
   '브랜더가 프로젝트 촬영물을 공식 웹사이트, 추가 SNS 콘텐츠 및 홍보 목적으로 활용하는 것에 동의합니다.',
   false, true)
on conflict (consent_key, version) do nothing;

-- ---------------------------------------------------------------------------
-- 3. 접수 함수: 촬영 참여 가능 여부 저장 · 필수 (촬영 동의는 lab_consent_documents.is_required 를 따르므로 자동으로 선택이 된다)
-- ---------------------------------------------------------------------------

-- p_payload: { submissionKey, applicantName, phone, email, instagramId?, garmentTypes[], garmentTypeOther, designDescription,
--              size?, sizeOther?, purpose, reason?, futureProduction?, filmingAvailability, consents: [{ key, version, agreed }] }
create or replace function public.lab_create_application(
  p_payload jsonb,
  p_image_paths text[] default '{}'::text[],
  p_ip_hash text default null,
  p_user_agent text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key uuid;
  v_existing public.lab_applications%rowtype;
  v_phone text := nullif(btrim(coalesce(p_payload->>'phone', '')), '');
  v_garments text[];
  v_id uuid;
  v_no text;
  v_created timestamptz;
  v_doc record;
  v_consent jsonb;
  v_consent_count integer;
begin
  begin
    v_key := (p_payload->>'submissionKey')::uuid;
  exception when others then
    raise exception 'LAB_INVALID: 신청서 식별값이 올바르지 않습니다.';
  end;
  if v_key is null then
    raise exception 'LAB_INVALID: 신청서 식별값이 올바르지 않습니다.';
  end if;
  if p_user_id is null then
    raise exception 'LAB_LOGIN_REQUIRED: 로그인한 회원만 신청할 수 있습니다.';
  end if;

  -- 같은 신청서를 다시 보낸 경우(더블 클릭 · 네트워크 재시도) 기존 접수 결과를 돌려준다.
  select * into v_existing from public.lab_applications where submission_key = v_key and user_id = p_user_id;
  if found then
    return jsonb_build_object('id', v_existing.id, 'application_no', v_existing.application_no,
      'created_at', v_existing.created_at, 'duplicate', true);
  end if;

  -- 동시에 들어온 같은 연락처 신청이 중복 검사를 함께 통과하지 않도록 연락처 단위로 직렬화한다.
  perform pg_advisory_xact_lock(hashtext('lab_application_phone:' || coalesce(v_phone, '')));

  if p_ip_hash is not null and (
    select count(*) from public.lab_applications
    where ip_hash = p_ip_hash and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'LAB_RATE_LIMITED: 짧은 시간에 신청이 많이 접수되었습니다. 잠시 후 다시 시도해주세요.';
  end if;

  if v_phone is not null and exists (
    select 1 from public.lab_applications
    where phone = v_phone and created_at > now() - interval '24 hours'
  ) then
    raise exception 'LAB_DUPLICATE: 이 연락처로 오늘 이미 신청이 접수되었습니다. 신청 내용을 바꾸고 싶으시면 고객센터로 문의해주세요.';
  end if;

  if jsonb_typeof(p_payload->'consents') <> 'array' then
    raise exception 'LAB_CONSENT: 동의 정보가 올바르지 않습니다.';
  end if;
  select count(*) into v_consent_count from jsonb_array_elements(p_payload->'consents');
  if v_consent_count <> (select count(*) from public.lab_consent_documents where is_current) then
    raise exception 'LAB_CONSENT: 동의 항목이 변경되었습니다. 페이지를 새로고침한 뒤 다시 신청해주세요.';
  end if;
  for v_doc in select * from public.lab_consent_documents where is_current loop
    select c.value into v_consent from jsonb_array_elements(p_payload->'consents') as c(value) where c.value->>'key' = v_doc.consent_key limit 1;
    if v_consent is null or v_consent->>'version' is distinct from v_doc.version or jsonb_typeof(v_consent->'agreed') <> 'boolean' then
      raise exception 'LAB_CONSENT: 동의 문구가 변경되었습니다. 페이지를 새로고침한 뒤 다시 신청해주세요.';
    end if;
    if v_doc.is_required and not (v_consent->>'agreed')::boolean then
      raise exception 'LAB_CONSENT: [필수] %에 동의해주세요.', v_doc.title;
    end if;
  end loop;

  if nullif(btrim(coalesce(p_payload->>'email', '')), '') is null then
    raise exception 'LAB_INVALID: 이메일 주소를 입력해주세요.';
  end if;
  if nullif(btrim(coalesce(p_payload->>'purpose', '')), '') is null then
    raise exception 'LAB_INVALID: 제작 목적을 선택해주세요.';
  end if;
  if nullif(btrim(coalesce(p_payload->>'filmingAvailability', '')), '') is null then
    raise exception 'LAB_INVALID: 촬영 참여 가능 여부를 선택해주세요.';
  end if;

  if jsonb_typeof(p_payload->'garmentTypes') <> 'array' then
    raise exception 'LAB_INVALID: 의류 종류를 선택해주세요.';
  end if;
  select coalesce(array_agg(distinct value), '{}'::text[]) into v_garments from jsonb_array_elements_text(p_payload->'garmentTypes');

  if coalesce(cardinality(p_image_paths), 0) > 5
    or exists (select 1 from unnest(coalesce(p_image_paths, '{}'::text[])) path where path !~ ('^' || v_key::text || '/[0-9a-z-]+\.(jpg|png|webp)$')) then
    raise exception 'LAB_INVALID: 참고 이미지 정보가 올바르지 않습니다.';
  end if;

  v_no := 'LAB-' || to_char(now() at time zone 'Asia/Seoul', 'YYMMDD') || '-' || lpad(nextval('public.lab_application_no_seq')::text, 5, '0');

  begin
    insert into public.lab_applications (
      application_no, submission_key, user_id, applicant_name, phone, email, instagram_id,
      garment_types, garment_type_other, design_description, size, size_other, reason,
      purpose, future_production, filming_availability, image_paths, ip_hash, user_agent, retention_until
    ) values (
      v_no, v_key, p_user_id,
      btrim(p_payload->>'applicantName'),
      v_phone,
      nullif(lower(btrim(coalesce(p_payload->>'email', ''))), ''),
      nullif(lower(btrim(coalesce(p_payload->>'instagramId', ''))), ''),
      v_garments,
      nullif(btrim(coalesce(p_payload->>'garmentTypeOther', '')), ''),
      btrim(p_payload->>'designDescription'),
      nullif(btrim(coalesce(p_payload->>'size', '')), ''),
      nullif(btrim(coalesce(p_payload->>'sizeOther', '')), ''),
      nullif(btrim(coalesce(p_payload->>'reason', '')), ''),
      btrim(p_payload->>'purpose'),
      nullif(btrim(coalesce(p_payload->>'futureProduction', '')), ''),
      btrim(p_payload->>'filmingAvailability'),
      coalesce(p_image_paths, '{}'::text[]),
      p_ip_hash,
      left(p_user_agent, 500),
      now() + interval '1 year'
    )
    returning id, created_at into v_id, v_created;
  exception
    when check_violation or not_null_violation then
      raise exception 'LAB_INVALID: 입력값을 다시 확인해주세요. (%)', sqlerrm;
    when unique_violation then
      -- 같은 submission_key 가 동시에 두 번 들어온 경우
      select * into v_existing from public.lab_applications where submission_key = v_key and user_id = p_user_id;
      if found then
        return jsonb_build_object('id', v_existing.id, 'application_no', v_existing.application_no,
          'created_at', v_existing.created_at, 'duplicate', true);
      end if;
      raise;
  end;

  insert into public.lab_consent_records (application_id, consent_key, consent_version, agreed, action, source)
  select v_id, d.consent_key, d.version, (c.value->>'agreed')::boolean, 'initial', 'applicant_web'
  from public.lab_consent_documents d
  join jsonb_array_elements(p_payload->'consents') as c(value) on c.value->>'key' = d.consent_key
  where d.is_current;

  perform public._lab_event(v_id, 'submitted', null, 'received', null);

  return jsonb_build_object('id', v_id, 'application_no', v_no, 'created_at', v_created, 'duplicate', false);
end;
$$;

revoke all on function public.lab_create_application(jsonb, text[], text, text, uuid) from public, anon, authenticated;
grant execute on function public.lab_create_application(jsonb, text[], text, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. 관리자 목록 · CSV: 촬영 참여 가능 여부 포함 (상세는 to_jsonb(row) 라 자동 포함)
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_lab_applications(
  p_status text default 'all',
  p_search text default null,
  p_sort text default 'newest',
  p_retention text default 'all',
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
  v_actor uuid := public._admin_require('lab.view');
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_oldest boolean := coalesce(p_sort, 'newest') = 'oldest';
  v_expired boolean := coalesce(p_retention, 'all') = 'expired';
begin
  return (
    with base as (
      select a.* from public.lab_applications a
      where public._lab_search_match(a, v_search)
        and (not v_expired or a.retention_until <= now())
    ),
    filtered as (select * from base where coalesce(p_status, 'all') = 'all' or status = p_status),
    page as (
      select * from filtered
      order by case when v_oldest then created_at end asc, case when not v_oldest then created_at end desc
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'counts', (
        select jsonb_build_object('all', count(*)) || coalesce(jsonb_object_agg(status, n) filter (where status is not null), '{}'::jsonb)
        from (select status, count(*) as n from base group by status) s
      ),
      'expired_count', (select count(*) from public.lab_applications where retention_until <= now()),
      'can_manage', public._admin_has_permission(v_actor, 'lab.manage'),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'application_no', p.application_no, 'created_at', p.created_at,
          'applicant_name', p.applicant_name, 'phone', p.phone, 'email', p.email, 'instagram_id', p.instagram_id,
          'garment_types', p.garment_types, 'garment_type_other', p.garment_type_other,
          'size', p.size, 'size_other', p.size_other, 'design_description', p.design_description,
          'purpose', p.purpose, 'future_production', p.future_production, 'filming_availability', p.filming_availability,
          'image_paths', p.image_paths, 'status', p.status, 'status_changed_at', p.status_changed_at,
          'has_memo', p.admin_memo is not null, 'retention_until', p.retention_until,
          'consents', public._lab_consent_state(p.id),
          'has_filming_agreement', exists (select 1 from public.lab_filming_agreements f where f.application_id = p.id and f.withdrawn_at is null)
        ) order by case when v_oldest then p.created_at end asc, case when not v_oldest then p.created_at end desc)
        from page p
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_list_lab_applications(text, text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_lab_applications(text, text, text, text, integer, integer) to authenticated;

create or replace function public.admin_export_lab_applications(
  p_status text default 'all',
  p_search text default null,
  p_retention text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('lab.view');
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_expired boolean := coalesce(p_retention, 'all') = 'expired';
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb) into v_rows
  from (
    select a.created_at, jsonb_build_object(
      'application_no', a.application_no, 'created_at', a.created_at, 'status', a.status,
      'applicant_name', a.applicant_name, 'phone', a.phone, 'email', a.email, 'instagram_id', a.instagram_id,
      'garment_types', a.garment_types, 'garment_type_other', a.garment_type_other,
      'size', a.size, 'size_other', a.size_other, 'design_description', a.design_description, 'reason', a.reason,
      'purpose', a.purpose, 'future_production', a.future_production, 'filming_availability', a.filming_availability,
      'image_count', cardinality(a.image_paths), 'admin_memo', a.admin_memo, 'retention_until', a.retention_until,
      'consents', public._lab_consent_state(a.id)
    ) as row_data
    from public.lab_applications a
    where public._lab_search_match(a, v_search)
      and (coalesce(p_status, 'all') = 'all' or a.status = p_status)
      and (not v_expired or a.retention_until <= now())
    order by a.created_at desc
    limit 5000
  ) t;

  perform public._admin_log('lab_application.export', 'lab_application', null, 'CSV 다운로드', null, null, null,
    jsonb_build_object('status', p_status, 'search', v_search, 'retention', p_retention, 'count', jsonb_array_length(v_rows)));

  return v_rows;
end;
$$;

revoke all on function public.admin_export_lab_applications(text, text, text) from public, anon;
grant execute on function public.admin_export_lab_applications(text, text, text) to authenticated;

notify pgrst, 'reload schema';
