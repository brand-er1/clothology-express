import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { adminRpc } from "@/services/adminApi";
import { dateTime } from "@/lib/admin/format";
import { ErrorBanner, LoadingBlock, Notice, PageHeader, Panel, StatusBadge } from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { useAdminContext } from "@/components/admin/shell/AdminContext";

type Setting = { key: string; value: unknown; description: string | null; updated_by_name: string | null; updated_at: string };

const LABEL: Record<string, string> = {
  platform_commission_rate: "플랫폼 수수료율 (%)",
  settlement_delay_days: "정산 예정일 (종료 후 일수)",
  brand_requires_review: "신규 브랜드 사전 검수",
  pg_live_refund_enabled: "실제 PG 환불 자동 실행",
  notification_channels: "알림 채널 연동 상태",
};

const SettingRow = ({ setting, canEdit, onEdit }: { setting: Setting; canEdit: boolean; onEdit: (value: unknown) => void }) => {
  const [draft, setDraft] = useState(String(setting.value));
  const locked = setting.key === "pg_live_refund_enabled";
  return (
    <div className="grid gap-3 border-b border-stone-100 py-4 last:border-0 md:grid-cols-[minmax(0,1fr)_260px] md:items-center">
      <div className="min-w-0">
        <p className="font-bold">{LABEL[setting.key] ?? setting.key} <span className="font-mono text-[10px] text-stone-400">{setting.key}</span></p>
        <p className="mt-0.5 text-xs text-stone-500">{setting.description}</p>
        <p className="mt-0.5 text-[11px] text-stone-400">최근 변경: {setting.updated_by_name ?? "초기값"} · {dateTime(setting.updated_at)}</p>
      </div>
      <div className="flex items-center justify-end gap-2">
        {typeof setting.value === "number" && <>
          <Input type="number" className="w-28" value={draft} disabled={!canEdit} onChange={(e) => setDraft(e.target.value)} />
          {canEdit && <Button size="sm" variant="outline" disabled={draft === String(setting.value) || draft === ""} onClick={() => onEdit(Number(draft))}>저장</Button>}
        </>}
        {typeof setting.value === "boolean" && (
          locked ? <StatusBadge tone="red"><Lock className="mr-1 h-3 w-3" />PG 연동 전 잠금</StatusBadge>
            : <Switch checked={Boolean(setting.value)} disabled={!canEdit} onCheckedChange={(v) => onEdit(v)} />
        )}
        {typeof setting.value === "object" && setting.value !== null && (
          <div className="flex flex-wrap justify-end gap-1">{Object.entries(setting.value as Record<string, boolean>).map(([k, v]) => (
            <StatusBadge key={k} tone={v ? "green" : "neutral"}>{k} {v ? "연동" : "미연동"}</StatusBadge>
          ))}</div>
        )}
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const { can } = useAdminContext();
  const canEdit = can("settings.manage");
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const { data, loading, error, reload } = useAdminQuery(() => adminRpc<Setting[]>("admin_get_settings"), []);

  const edit = (setting: Setting, value: unknown) => setDialog({
    title: `${LABEL[setting.key] ?? setting.key} 변경`, confirmLabel: "변경", reasonLabel: "변경 사유",
    description: <span>{String(setting.value)} → <b>{String(value)}</b>{setting.key === "platform_commission_rate" && " · 이미 생성된 정산서의 수수료율은 바뀌지 않습니다."}</span>,
    onConfirm: (reason) => adminRpc("admin_update_setting", { p_key: setting.key, p_value: value, p_reason: reason }),
    successMessage: "설정을 변경했습니다",
  });

  return (
    <div>
      <PageHeader eyebrow="System" title="시스템 설정" description="운영 정책 값은 Super Admin 만 변경할 수 있으며 모든 변경은 Audit Log 에 남습니다." />
      <div className="mb-3 grid gap-2">
        <Notice tone="blue">PG Secret · Service Role Key 등 비밀키는 이 화면이나 DB 에 저장하지 않습니다. Supabase Edge Function 환경변수(Secrets)로만 관리됩니다.</Notice>
      </div>
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && !data ? <LoadingBlock /> : (
        <Panel title="운영 정책">{(data ?? []).map((s) => <SettingRow key={`${s.key}-${String(s.value)}`} setting={s} canEdit={canEdit} onEdit={(v) => edit(s, v)} />)}</Panel>
      )}
      <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={reload} />
    </div>
  );
};

export default SettingsPage;
