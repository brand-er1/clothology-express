create or replace function public.update_creator_funding(
  p_funding_id uuid,
  p_product_name text,
  p_description text,
  p_moq integer,
  p_price integer,
  p_funding_days integer,
  p_color_options text[],
  p_size_options text[]
)
returns public.fundings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funding public.fundings%rowtype;
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

  if v_funding.status in ('pending', 'rejected') then
    if p_moq < 20 then
      raise exception '최소 제작 수량은 20장입니다.';
    end if;

    if p_price is not null and p_price < 0 then
      raise exception '판매가는 0원 이상이어야 합니다.';
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
        funding_days = p_funding_days,
        color_options = p_color_options,
        size_options = p_size_options,
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
      or p_funding_days <> v_funding.funding_days
      or p_color_options is distinct from v_funding.color_options
      or p_size_options is distinct from v_funding.size_options then
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

revoke all on function public.update_creator_funding(uuid, text, text, integer, integer, integer, text[], text[]) from public;
grant execute on function public.update_creator_funding(uuid, text, text, integer, integer, integer, text[], text[]) to authenticated;
