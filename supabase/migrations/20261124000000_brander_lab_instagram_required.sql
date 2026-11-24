-- BRAND-ER LAB 신청서: 인스타그램 아이디 필수 (비파괴적)
--
--  * 2026-11-24 이후 새로 접수되는 신청은 인스타그램 아이디가 반드시 있어야 한다.
--    Edge Function(submit-lab-application)이 먼저 검사하고, 여기서는 DB 단에서 한 번 더 막는다.
--  * 컬럼은 null 허용으로 둔다: 인스타그램 아이디 없이 접수된 과거 신청은 그대로 보관하고,
--    관리자가 과거 신청의 상태 · 메모를 바꿔도(UPDATE) 이 검사에 걸리지 않도록 INSERT 에만 적용한다.
--  * 형식(영문 소문자 · 숫자 · 마침표 · 밑줄, 30자)은 기존 lab_applications_instagram_check 가 검사한다.

create or replace function public.lab_applications_require_instagram()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if nullif(btrim(coalesce(new.instagram_id, '')), '') is null then
    raise exception 'LAB_INVALID: 인스타그램 아이디를 입력해 주세요.';
  end if;
  return new;
end;
$$;

drop trigger if exists lab_applications_require_instagram on public.lab_applications;
create trigger lab_applications_require_instagram
  before insert on public.lab_applications
  for each row execute function public.lab_applications_require_instagram();

comment on column public.lab_applications.instagram_id is
  '@ 없이 소문자로 저장. 2026-11-24 이후 신규 신청은 필수(트리거 lab_applications_require_instagram). 과거 신청은 비어 있을 수 있다. 자동 태그 · 공개에 사용하지 않는다.';
