-- 펀딩 편집기에서 남녀공용 1·2·3 프리셋과 사이즈표를 함께 저장한다.

drop function if exists public.update_creator_funding(
  uuid,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  text[],
  text[]
);

create or replace function public.update_creator_funding(
  p_funding_id uuid,
  p_product_name text,
  p_description text,
  p_moq integer,
  p_price integer,
  p_estimate_direct_unit_min integer,
  p_estimate_direct_unit_max integer,
  p_estimate_development_total integer,
  p_fabric_unit_cost integer,
  p_funding_days integer,
  p_color_options text[],
  p_size_options text[],
  p_measurements jsonb
)
returns public.fundings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funding public.fundings%rowtype;
  v_minimum_moq integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_funding
  from public.fundings
  where id = p_funding_id and creator_id = auth.uid()
  for update;

  if not found then
    raise exception '펀딩을 수정할 권한이 없습니다.';
  end if;

  if nullif(btrim(p_product_name), '') is null then
    raise exception '상품명을 입력해주세요.';
  end if;

  v_minimum_moq := public.minimum_funding_moq(
    v_funding.cloth_type,
    v_funding.material
  );

  if v_funding.status in ('pending', 'rejected') then
    if p_moq < v_minimum_moq then
      raise exception '최소 제작 수량은 %장입니다.', v_minimum_moq;
    end if;

    if p_price is not null and p_price < 0 then
      raise exception '판매가는 0원 이상이어야 합니다.';
    end if;

    if p_fabric_unit_cost < 0 then
      raise exception '원단비는 0원 이상이어야 합니다.';
    end if;

    if p_estimate_direct_unit_min is not null
      and p_estimate_direct_unit_min < 0 then
      raise exception '제작 견적은 0원 이상이어야 합니다.';
    end if;

    if p_estimate_direct_unit_max is not null
      and p_estimate_direct_unit_max < 0 then
      raise exception '제작 견적은 0원 이상이어야 합니다.';
    end if;

    if p_estimate_development_total is not null
      and p_estimate_development_total < 0 then
      raise exception '개발비 견적은 0원 이상이어야 합니다.';
    end if;

    if p_estimate_direct_unit_min is not null
      and p_estimate_direct_unit_max is not null
      and p_estimate_direct_unit_min > p_estimate_direct_unit_max then
      raise exception '최소 제작 견적은 최대 제작 견적보다 클 수 없습니다.';
    end if;

    if p_funding_days < 1 or p_funding_days > 90 then
      raise exception '진행 기간은 1일부터 90일까지 설정할 수 있습니다.';
    end if;

    if cardinality(p_color_options) = 0 or cardinality(p_size_options) = 0 then
      raise exception '컬러와 사이즈를 한 개 이상 등록해주세요.';
    end if;

    update public.fundings
    set product_name = btrim(p_product_name),
        description = p_description,
        moq = p_moq,
        price = p_price,
        estimate_direct_unit_min = p_estimate_direct_unit_min,
        estimate_direct_unit_max = p_estimate_direct_unit_max,
        estimate_development_total = p_estimate_development_total,
        fabric_unit_cost = p_fabric_unit_cost,
        funding_days = p_funding_days,
        color_options = p_color_options,
        size_options = p_size_options,
        measurements = p_measurements,
        status = 'pending',
        admin_comment = null,
        reviewed_at = null,
        reviewed_by = null,
        updated_at = now()
    where id = p_funding_id
    returning * into v_funding;
  else
    if p_moq <> v_funding.moq
      or p_price is distinct from v_funding.price
      or p_estimate_direct_unit_min is distinct from v_funding.estimate_direct_unit_min
      or p_estimate_direct_unit_max is distinct from v_funding.estimate_direct_unit_max
      or p_estimate_development_total is distinct from v_funding.estimate_development_total
      or p_fabric_unit_cost <> v_funding.fabric_unit_cost
      or p_funding_days <> v_funding.funding_days
      or p_color_options is distinct from v_funding.color_options
      or p_size_options is distinct from v_funding.size_options
      or p_measurements is distinct from v_funding.measurements then
      raise exception '승인된 펀딩은 상품명과 상세 설명만 수정할 수 있습니다.';
    end if;

    update public.fundings
    set product_name = btrim(p_product_name),
        description = p_description,
        updated_at = now()
    where id = p_funding_id
    returning * into v_funding;
  end if;

  return v_funding;
end;
$$;

revoke all on function public.update_creator_funding(
  uuid,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  text[],
  text[],
  jsonb
) from public;

grant execute on function public.update_creator_funding(
  uuid,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  text[],
  text[],
  jsonb
) to authenticated;
