-- 메인페이지 '펀딩 성공팀' 노출 설정
--
-- 원칙
--  * 추가(additive) 전용: 새 테이블 없이 기존 fundings 행에 노출 설정 컬럼만 더한다. 기존 데이터는 바꾸지 않는다.
--  * 성공 여부는 기존 서버 판정(success_at / funding_status)을 그대로 쓴다. 이 마이그레이션은 성공을 판정하지 않는다.
--  * 대표 이미지·브랜드·상품 정보는 기존 fundings / brands 값을 그대로 사용한다(중복 저장하지 않음).
--  * 노출 설정은 관리자 RPC(admin_set_funding_success_showcase)로만 바꾼다. 변경은 Audit Log 에 남는다.

alter table public.fundings
  add column if not exists success_showcase_visible boolean not null default true,
  add column if not exists success_showcase_category text,
  add column if not exists success_showcase_rate numeric(7, 1),
  add column if not exists success_showcase_summary text;

alter table public.fundings
  drop constraint if exists fundings_success_showcase_rate_check,
  add constraint fundings_success_showcase_rate_check
    check (success_showcase_rate is null or (success_showcase_rate >= 0 and success_showcase_rate <= 100000));

alter table public.fundings
  drop constraint if exists fundings_success_showcase_text_check,
  add constraint fundings_success_showcase_text_check
    check (
      (success_showcase_category is null or char_length(success_showcase_category) <= 40)
      and (success_showcase_summary is null or char_length(success_showcase_summary) <= 1000)
    );

comment on column public.fundings.success_showcase_visible is
  '펀딩 성공팀 노출 여부. 성공(success_at 기록)한 펀딩 중 true 인 것만 메인 펀딩 성공팀에 노출한다. 기본값 true.';
comment on column public.fundings.success_showcase_category is '펀딩 성공팀 카드 카테고리 표시값(예: 퍼포먼스웨어). 비우면 cloth_type 을 쓴다.';
comment on column public.fundings.success_showcase_rate is '펀딩 성공팀 표시용 달성률(%). 비우면 final_quantity(또는 current_orders) / moq 로 계산한다.';
comment on column public.fundings.success_showcase_summary is '성공 스토리 소개 문구. 비우면 브랜드 소개/펀딩 설명을 쓴다.';

create index if not exists fundings_success_showcase_idx
  on public.fundings (success_at desc)
  where success_at is not null and success_showcase_visible = true;

-- 노출 설정 컬럼은 서버 함수(SECURITY DEFINER)만 바꿀 수 있다. 제작자 Data API 직접 변경 차단.
create or replace function public._guard_funding_success_showcase_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.success_showcase_visible := true;
    new.success_showcase_category := null;
    new.success_showcase_rate := null;
    new.success_showcase_summary := null;
    return new;
  end if;
  if new.success_showcase_visible is distinct from old.success_showcase_visible
     or new.success_showcase_category is distinct from old.success_showcase_category
     or new.success_showcase_rate is distinct from old.success_showcase_rate
     or new.success_showcase_summary is distinct from old.success_showcase_summary then
    raise exception '펀딩 성공팀 노출 설정은 관리자만 변경할 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public._guard_funding_success_showcase_columns() from public, anon, authenticated;

drop trigger if exists fundings_guard_success_showcase_columns on public.fundings;
create trigger fundings_guard_success_showcase_columns
before insert or update on public.fundings
for each row execute function public._guard_funding_success_showcase_columns();

create or replace function public.admin_set_funding_success_showcase(
  p_funding_id uuid,
  p_visible boolean,
  p_category text default null,
  p_rate numeric default null,
  p_summary text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('fundings.manage');
  v_f public.fundings%rowtype;
  v_category text := nullif(btrim(coalesce(p_category, '')), '');
  v_summary text := nullif(btrim(coalesce(p_summary, '')), '');
  v_after jsonb;
begin
  select * into v_f from public.fundings where id = p_funding_id for update;
  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;
  if p_rate is not null and (p_rate < 0 or p_rate > 100000) then
    raise exception '달성률은 0 이상으로 입력해 주세요.';
  end if;

  update public.fundings
  set success_showcase_visible = coalesce(p_visible, true),
      success_showcase_category = v_category,
      success_showcase_rate = p_rate,
      success_showcase_summary = v_summary,
      updated_at = now()
  where id = p_funding_id;

  v_after := jsonb_build_object(
    'success_showcase_visible', coalesce(p_visible, true),
    'success_showcase_category', v_category,
    'success_showcase_rate', p_rate,
    'success_showcase_summary', v_summary
  );

  perform public._admin_log(
    case when coalesce(p_visible, true) then 'funding.success_showcase_show' else 'funding.success_showcase_hide' end,
    'funding', p_funding_id::text, v_f.product_name,
    jsonb_build_object(
      'success_showcase_visible', v_f.success_showcase_visible,
      'success_showcase_category', v_f.success_showcase_category,
      'success_showcase_rate', v_f.success_showcase_rate,
      'success_showcase_summary', v_f.success_showcase_summary
    ),
    v_after,
    p_reason
  );
  return v_after;
end;
$$;

revoke all on function public.admin_set_funding_success_showcase(uuid, boolean, text, numeric, text, text) from public, anon;
grant execute on function public.admin_set_funding_success_showcase(uuid, boolean, text, numeric, text, text) to authenticated;

notify pgrst, 'reload schema';
