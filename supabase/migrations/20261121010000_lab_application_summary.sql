-- BRAND-ER LAB 신청 요약: 관리자 사이드바 배지 · 대시보드 카드용 (개인정보 없이 건수만)
--  new_count     : 아직 검토하지 않은 신청(상태 '신청 접수')
--  today_count   : 오늘(한국 시간) 들어온 신청
--  total_count   : 전체 신청
--  expired_count : 개인정보 보유 기한이 지난 신청
create or replace function public.admin_lab_application_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._admin_require('lab.view');
  return (
    select jsonb_build_object(
      'new_count', count(*) filter (where status = 'received'),
      'today_count', count(*) filter (where created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')),
      'total_count', count(*),
      'expired_count', count(*) filter (where retention_until <= now())
    )
    from public.lab_applications
  );
end;
$$;

revoke all on function public.admin_lab_application_summary() from public, anon;
grant execute on function public.admin_lab_application_summary() to authenticated;

notify pgrst, 'reload schema';
