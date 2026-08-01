-- 관리자가 승인 화면에서 MOQ와 판매가를 보완하고 한 번에 승인할 수 있게 한다.
-- 기존 3개 인자 함수도 새 검토 함수로 연결해 이전 프런트엔드와 호환한다.

drop function if exists public.review_funding_with_trademark(
  uuid,
  text,
  text,
  integer,
  integer
);

create function public.review_funding_with_trademark(
  p_funding_id uuid,
  p_status text,
  p_admin_comment text,
  p_moq integer,
  p_price integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funding public.fundings%rowtype;
  v_screening public.trademark_screenings%rowtype;
  v_from_decision text;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception '관리자만 펀딩을 검토할 수 있습니다.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception '올바르지 않은 검토 상태입니다.';
  end if;

  select * into v_funding
  from public.fundings
  where id = p_funding_id
  for update;

  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;

  if p_status = 'approved' then
    if p_moq is null or p_moq < 20 then
      raise exception 'MOQ는 20장 이상이어야 승인할 수 있습니다.';
    end if;

    if p_price is null or p_price <= 0 then
      raise exception '판매가를 1원 이상 입력해야 승인할 수 있습니다.';
    end if;
  end if;

  if v_funding.trademark_screening_required then
    select * into v_screening
    from public.trademark_screenings
    where id = v_funding.trademark_screening_id
    for update;

    if not found and p_status = 'approved' then
      raise exception '상표 검수 기록을 찾을 수 없습니다.';
    end if;

    if found and p_status = 'approved' and v_screening.decision = 'blocked' then
      raise exception '상표 고위험으로 차단된 펀딩은 승인할 수 없습니다.';
    end if;

    if found and v_screening.decision = 'review' then
      v_from_decision := v_screening.decision;

      update public.trademark_screenings
      set decision = case
            when p_status = 'approved' then 'clear'
            else 'blocked'
          end,
          reviewed_at = now(),
          reviewed_by = auth.uid(),
          review_note = nullif(btrim(coalesce(p_admin_comment, '')), ''),
          reason = case
            when p_status = 'approved'
              then reason || ' 관리자 권리관계 확인을 거쳐 승인되었습니다.'
            else reason || ' 관리자 검토 결과 등록이 차단되었습니다.'
          end,
          updated_at = now()
      where id = v_screening.id;

      insert into public.trademark_screening_events (
        screening_id,
        from_decision,
        to_decision,
        actor_type,
        actor_user_id,
        reason
      )
      values (
        v_screening.id,
        v_from_decision,
        case when p_status = 'approved' then 'clear' else 'blocked' end,
        'admin',
        auth.uid(),
        coalesce(
          nullif(btrim(coalesce(p_admin_comment, '')), ''),
          case
            when p_status = 'approved' then '관리자 검토 승인'
            else '관리자 검토 차단'
          end
        )
      );
    end if;
  end if;

  update public.fundings
  set status = p_status,
      moq = case when p_status = 'approved' then p_moq else moq end,
      price = case when p_status = 'approved' then p_price else price end,
      color_options = case
        when p_status = 'approved' and cardinality(color_options) = 0
          then array[coalesce(nullif(btrim(color), ''), '기본 색상')]
        else color_options
      end,
      size_options = case
        when p_status = 'approved' and cardinality(size_options) = 0
          then array[coalesce(nullif(btrim(size), ''), 'FREE')]
        else size_options
      end,
      admin_comment = nullif(btrim(coalesce(p_admin_comment, '')), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  where id = p_funding_id;
end;
$$;

revoke all on function public.review_funding_with_trademark(
  uuid,
  text,
  text,
  integer,
  integer
) from public;

grant execute on function public.review_funding_with_trademark(
  uuid,
  text,
  text,
  integer,
  integer
) to authenticated;

create or replace function public.review_funding_with_trademark(
  p_funding_id uuid,
  p_status text,
  p_admin_comment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funding public.fundings%rowtype;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception '관리자만 펀딩을 검토할 수 있습니다.';
  end if;

  select * into v_funding
  from public.fundings
  where id = p_funding_id;

  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;

  perform public.review_funding_with_trademark(
    p_funding_id,
    p_status,
    p_admin_comment,
    v_funding.moq,
    v_funding.price
  );
end;
$$;

revoke all on function public.review_funding_with_trademark(uuid, text, text)
  from public;
grant execute on function public.review_funding_with_trademark(uuid, text, text)
  to authenticated;
