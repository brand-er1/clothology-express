import { useState } from "react";
import { Link } from "react-router-dom";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { adminRpc, totalOf } from "@/services/adminApi";
import { dateTime, num, type Tone } from "@/lib/admin/format";
import {
  DataTable, EmptyState, ErrorBanner, FilterChips, KpiCard, LoadingBlock, MappedBadge, Notice, PageHeader, Pager, Panel,
  SearchInput, StatusBadge, Td,
} from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { useAdminContext } from "@/components/admin/shell/AdminContext";

type SuccessNotificationRow = {
  funding_id: string; product_name: string; creator_id: string; creator_name: string;
  target_quantity: number; final_quantity: number | null; current_orders: number; success_at: string;
  success_backfilled: boolean; funding_status: string;
  site_sent: boolean; site_sent_at: string | null; site_status: string | null;
  sms_log_id: string | null; sms_status: string | null; sms_sent: boolean; sms_sent_at: string | null;
  sms_recipient: string | null; sms_provider: string | null; sms_attempts: number | null; sms_resend_count: number | null;
  sms_error: string | null; sms_skip_reason: string | null; sms_last_attempt_at: string | null; total_count?: number | string;
};

type Summary = {
  success_fundings: number; backfilled: number; site_sent: number; sms_sent: number; sms_failed: number;
  sms_skipped: number; sms_pending: number; sms_channel_enabled: boolean; notify_participants: boolean;
};

const SMS_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "발송 대기", tone: "amber" },
  sending: { label: "발송 중", tone: "blue" },
  sent: { label: "발송 완료", tone: "green" },
  failed: { label: "발송 실패", tone: "red" },
  skipped: { label: "발송 안 함", tone: "neutral" },
};

const FILTERS = [
  { value: "all", label: "전체" },
  { value: "sms_failed", label: "SMS 실패" },
  { value: "sms_skipped", label: "SMS 미발송" },
  { value: "sms_pending", label: "대기/처리 중" },
  { value: "sms_sent", label: "SMS 완료" },
  { value: "backfilled", label: "소급(배포 전 달성)" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

const PAGE = 30;

const NotificationLogsPage = () => {
  const { can } = useAdminContext();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState<ReasonDialogState>(null);

  const summary = useAdminQuery(() => adminRpc<Summary>("admin_get_notification_summary"), []);
  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<SuccessNotificationRow[]>("admin_list_funding_success_notifications", {
      p_search: search || null, p_filter: filter, p_limit: PAGE, p_offset: page * PAGE,
    }),
    [search, filter, page],
  );
  const rows = data ?? [];
  const s = summary.data;

  const resend = (row: SuccessNotificationRow) => setDialog({
    title: "SMS 재발송",
    description: <>“{row.product_name}” 제작자({row.creator_name})에게 펀딩 성공 문자를 다시 보냅니다. 발송 완료된 건은 중복 방지를 위해 재발송할 수 없습니다.</>,
    confirmLabel: "재발송",
    reasonLabel: "재발송 사유",
    placeholder: "예: SMS 업체 장애 복구 후 재발송",
    successMessage: "재발송을 요청했습니다",
    onConfirm: async (reason) => {
      await adminRpc("admin_resend_notification", { p_log_id: row.sms_log_id, p_reason: reason });
      // 대기열로 돌린 뒤 디스패처를 호출해 즉시 발송한다(발송 결과는 목록에서 확인).
      const { data: result } = await supabase.functions.invoke("dispatch-notifications", { body: { logId: row.sms_log_id } });
      const failed = (result as { failed?: number } | null)?.failed;
      return failed ? { warning: "발송에 실패했습니다. 실패 사유를 확인해주세요." } : undefined;
    },
  });

  const reloadAll = () => { void reload(); void summary.reload(); };

  return (
    <div>
      <PageHeader
        eyebrow="Notification logs"
        title="알림 발송 내역"
        description="펀딩 성공 시 서버가 자동 발송한 제작자 사이트 알림 · SMS 기록입니다. 실패한 SMS 는 재발송할 수 있습니다."
        actions={<Button variant="outline" size="sm" onClick={reloadAll}><RotateCw className="mr-1.5 h-3.5 w-3.5" />새로고침</Button>}
      />
      {s && !s.sms_channel_enabled && (
        <div className="mb-4">
          <Notice>
            SMS 채널이 꺼져 있습니다(시스템 설정 → notification_channels.sms). SMS 발송 업체 연동(Supabase Secrets) 후 켜고, 실패 건을 재발송하세요.
          </Notice>
        </div>
      )}
      {s && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard emphasis label="펀딩 성공(자동)" value={num(s.success_fundings)} hint={`소급 기록 ${num(s.backfilled)}건`} />
          <KpiCard label="사이트 알림" value={num(s.site_sent)} />
          <KpiCard label="SMS 발송 완료" value={num(s.sms_sent)} />
          <KpiCard label="SMS 실패" value={num(s.sms_failed)} />
          <KpiCard label="SMS 미발송(번호 없음 등)" value={num(s.sms_skipped)} />
          <KpiCard label="대기/처리 중" value={num(s.sms_pending)} />
        </div>
      )}
      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="펀딩명, 제작자" />
          <FilterChips value={filter} onChange={(v) => { setFilter(v as Filter); setPage(0); }} options={FILTERS.map((f) => ({ value: f.value, label: f.label }))} />
        </div>
      }>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : !rows.length ? <EmptyState title="발송 내역이 없습니다" description="펀딩이 목표 수량을 달성하면 자동으로 기록됩니다." /> : (
          <DataTable minWidth={1180} head={["펀딩", "제작자", "목표 / 최종", "성공 시간", "사이트 알림", "SMS", "SMS 발송 시간", "실패 · 사유", ""]}>
            {rows.map((row) => (
              <tr key={row.funding_id} className="align-top">
                <Td className="max-w-[220px]">
                  <Link to={`/admin/fundings?q=${encodeURIComponent(row.product_name)}`} className="block truncate font-semibold hover:text-[#741b2b]">{row.product_name}</Link>
                  {row.success_backfilled && <StatusBadge className="mt-1">소급 기록</StatusBadge>}
                </Td>
                <Td className="whitespace-nowrap">{row.creator_name}</Td>
                <Td className="whitespace-nowrap tabular-nums">{num(row.target_quantity)} / {num(row.final_quantity ?? row.current_orders)}장</Td>
                <Td className="whitespace-nowrap text-xs">{dateTime(row.success_at)}</Td>
                <Td>
                  {row.site_sent ? <StatusBadge tone="green">발송</StatusBadge>
                    : row.site_status === "skipped" ? <StatusBadge>수신 거부</StatusBadge>
                    : <StatusBadge>없음</StatusBadge>}
                </Td>
                <Td>
                  {row.sms_status ? <MappedBadge map={SMS_STATUS} value={row.sms_status} /> : <StatusBadge>없음</StatusBadge>}
                  {row.sms_recipient && <p className="mt-1 text-[11px] text-stone-400">{row.sms_recipient}</p>}
                </Td>
                <Td className="whitespace-nowrap text-xs">
                  {row.sms_sent_at ? dateTime(row.sms_sent_at) : "-"}
                  {!!row.sms_attempts && <p className="text-[11px] text-stone-400">시도 {row.sms_attempts}회{row.sms_resend_count ? ` · 재발송 ${row.sms_resend_count}` : ""}{row.sms_provider ? ` · ${row.sms_provider}` : ""}</p>}
                </Td>
                <Td className="max-w-[260px] text-xs text-stone-600">
                  <span className="line-clamp-3" title={row.sms_error ?? row.sms_skip_reason ?? ""}>{row.sms_error ?? row.sms_skip_reason ?? "-"}</span>
                </Td>
                <Td>
                  {row.sms_log_id && (row.sms_status === "failed" || row.sms_status === "skipped") && can("notifications.send") && (
                    <Button size="sm" variant="outline" onClick={() => resend(row)}>재발송</Button>
                  )}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
        <Pager page={page} pageSize={PAGE} total={totalOf(rows)} onPage={setPage} />
      </Panel>
      <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={reloadAll} />
    </div>
  );
};

export default NotificationLogsPage;
