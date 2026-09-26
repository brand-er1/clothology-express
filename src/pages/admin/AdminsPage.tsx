import { useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminRpc, type AdminMemberRow } from "@/services/adminApi";
import { dateTime } from "@/lib/admin/format";
import { ROLE_DESCRIPTION, ROLE_LABEL, ROLE_PERMISSIONS, type AdminRole } from "@/lib/admin/permissions";
import { DataTable, EmptyState, ErrorBanner, LoadingBlock, Notice, PageHeader, Panel, StatusBadge, Td } from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { useAdminContext } from "@/components/admin/shell/AdminContext";

const ROLES: AdminRole[] = ["super_admin", "operations_admin", "cs_admin"];
const STATUS_TONE = { active: "green", suspended: "amber", revoked: "neutral" } as const;
const STATUS_LABEL = { active: "활성", suspended: "일시정지", revoked: "회수됨" } as Record<string, string>;

const AdminsPage = () => {
  const { context } = useAdminContext();
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  const form = useRef({ email: "", name: "", role: "cs_admin" as AdminRole, status: "active" });
  const { data, loading, error, reload } = useAdminQuery(() => adminRpc<AdminMemberRow[]>("admin_list_admins"), []);

  const grant = () => {
    form.current = { email: "", name: "", role: "cs_admin", status: "active" };
    setDialog({
      title: "관리자 추가", confirmLabel: "권한 부여", reasonRequired: false, reasonLabel: "메모",
      description: "BRAND-ER 에 가입된 회원 이메일로만 추가할 수 있습니다. 관리자 비밀번호는 회원 본인만 알 수 있습니다.",
      extra: (
        <div className="grid gap-2 text-xs font-bold text-stone-600">
          <label className="grid gap-1">회원 이메일<Input type="email" onChange={(e) => { form.current.email = e.target.value; }} /></label>
          <label className="grid gap-1">표시 이름(선택)<Input onChange={(e) => { form.current.name = e.target.value; }} /></label>
          <label className="grid gap-1">등급
            <select className="h-10 rounded-md border px-2 text-sm" defaultValue="cs_admin" onChange={(e) => { form.current.role = e.target.value as AdminRole; }}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select></label>
        </div>
      ),
      onConfirm: (note) => adminRpc("admin_grant_role", { p_email: form.current.email, p_role: form.current.role, p_display_name: form.current.name || null, p_note: note || null }),
      successMessage: "관리자 권한을 부여했습니다",
    });
  };

  const change = (row: AdminMemberRow) => {
    form.current = { email: row.email ?? "", name: "", role: row.role, status: row.status };
    setDialog({
      title: `권한 변경 · ${row.display_name}`, confirmLabel: "변경", reasonLabel: "변경 사유",
      description: "권한 회수 시 계정은 삭제되지 않고 '회수됨' 상태로 보관됩니다. 마지막 Super Admin 은 변경할 수 없습니다.",
      extra: (
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-stone-600">
          <label className="grid gap-1">등급
            <select className="h-10 rounded-md border px-2 text-sm" defaultValue={row.role} onChange={(e) => { form.current.role = e.target.value as AdminRole; }}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select></label>
          <label className="grid gap-1">상태
            <select className="h-10 rounded-md border px-2 text-sm" defaultValue={row.status} onChange={(e) => { form.current.status = e.target.value; }}>
              <option value="active">활성</option><option value="suspended">일시정지</option><option value="revoked">권한 회수</option>
            </select></label>
        </div>
      ),
      onConfirm: (reason) => adminRpc("admin_update_member_role", { p_user_id: row.user_id, p_role: form.current.role, p_status: form.current.status, p_reason: reason }),
      successMessage: "관리자 권한을 변경했습니다",
    });
  };

  return (
    <div>
      <PageHeader eyebrow="Administrators" title="관리자 관리" description="관리자 계정 추가·등급 변경·권한 회수는 Super Admin 만 가능하며 모두 Audit Log 에 기록됩니다."
        actions={<Button className="bg-[#741b2b] hover:bg-[#551220]" onClick={grant}><UserPlus className="mr-1 h-4 w-4" />관리자 추가</Button>} />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {ROLES.map((role) => (
          <Panel key={role} title={ROLE_LABEL[role]} description={ROLE_DESCRIPTION[role]}>
            <div className="flex flex-wrap gap-1">{ROLE_PERMISSIONS[role].map((p) => <span key={p} className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-600">{p}</span>)}</div>
          </Panel>
        ))}
      </div>
      <Panel bodyClassName="p-0" title="관리자 계정">
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : !data?.length ? <EmptyState /> : (
          <DataTable minWidth={900} head={["관리자", "이메일", "등급", "상태", "부여자", "최근 로그인", "등록일", ""]}>
            {data.map((row) => (
              <tr key={row.user_id} className="hover:bg-stone-50">
                <Td className="font-bold">{row.display_name}{row.user_id === context?.user_id && <span className="ml-1 text-[10px] text-[#741b2b]">(나)</span>}</Td>
                <Td className="text-xs">{row.email}</Td>
                <Td><StatusBadge tone="wine">{ROLE_LABEL[row.role]}</StatusBadge>{row.is_legacy && <p className="mt-0.5 text-[10px] text-stone-400">기존 user_roles</p>}</Td>
                <Td><StatusBadge tone={STATUS_TONE[row.status as keyof typeof STATUS_TONE] ?? "neutral"}>{STATUS_LABEL[row.status] ?? row.status}</StatusBadge></Td>
                <Td className="text-xs">{row.granted_by_name ?? "-"}</Td>
                <Td className="text-xs">{dateTime(row.last_sign_in_at)}</Td>
                <Td className="text-xs">{dateTime(row.created_at)}</Td>
                <Td><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => change(row)}>변경</Button></Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
      <div className="mt-3"><Notice tone="stone">기존 user_roles 의 admin 계정은 마이그레이션 시 Super Admin 으로 이관되었습니다(원본 행은 보존).</Notice></div>
      <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={reload} />
    </div>
  );
};

export default AdminsPage;
