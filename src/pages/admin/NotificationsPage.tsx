import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { adminRpc, type BrandRow, type FundingRow } from "@/services/adminApi";
import { dateTime, errorMessage, num } from "@/lib/admin/format";
import { DataTable, EmptyState, LoadingBlock, Notice, PageHeader, Panel, StatusBadge, Td } from "@/components/admin/shell/ui";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";

const TARGETS = [
  { value: "all_members", label: "전체 회원" },
  { value: "member", label: "특정 회원" },
  { value: "funding_participants", label: "특정 펀딩 참여자" },
  { value: "brand_followers", label: "특정 브랜드 팔로워" },
  { value: "creators", label: "제작자 전체" },
];

const TEMPLATES: Record<string, { label: string; title: string; message: string }> = {
  announcement: { label: "운영 공지", title: "BRAND-ER 운영 공지", message: "" },
  funding_approved: { label: "펀딩 승인", title: "펀딩 승인 안내", message: "등록하신 펀딩이 승인되어 공개되었습니다." },
  funding_rejected: { label: "펀딩 반려", title: "펀딩 반려 안내", message: "등록하신 펀딩이 반려되었습니다. 사유: " },
  goal_reached: { label: "목표 달성", title: "목표 달성!", message: "참여하신 펀딩이 목표 수량을 달성해 제작이 확정되었습니다." },
  funding_suspended: { label: "펀딩 중단", title: "펀딩 중단 안내", message: "참여하신 펀딩이 운영 중단되었습니다. 환불 안내를 드릴 예정입니다." },
  production_started: { label: "제작 시작", title: "제작 시작 안내", message: "참여하신 펀딩의 제작이 시작되었습니다." },
  shipping_started: { label: "배송 시작", title: "배송 시작 안내", message: "참여하신 펀딩 상품의 배송이 시작되었습니다." },
  refund: { label: "환불 안내", title: "환불 관련 안내", message: "" },
};

type Campaign = { id: string; title: string; message: string; category: string; target_type: string; target_ref: string | null; site_recipient_count: number; requested_channels: string[]; external_delivery: Record<string, string>; created_by_name: string | null; created_at: string };

const NotificationsPage = () => {
  const [category, setCategory] = useState("announcement");
  const [target, setTarget] = useState("all_members");
  const [ref, setRef] = useState("");
  const [title, setTitle] = useState(TEMPLATES.announcement.title);
  const [message, setMessage] = useState("");
  const [channels, setChannels] = useState<string[]>(["site"]);
  const [audience, setAudience] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const campaigns = useAdminQuery(() => adminRpc<Campaign[]>("admin_list_notification_campaigns", { p_limit: 50 }), []);
  const fundings = useAdminQuery(() => adminRpc<FundingRow[]>("admin_list_fundings", { p_limit: 200 }), []);
  const brands = useAdminQuery(() => adminRpc<BrandRow[]>("admin_list_brands"), []);

  useEffect(() => {
    const needsRef = ["member", "funding_participants", "brand_followers"].includes(target);
    if (needsRef && !ref) { setAudience(null); return; }
    const timer = window.setTimeout(() => {
      adminRpc<number>("admin_preview_notification_audience", { p_target_type: target, p_target_ref: ref || null })
        .then(setAudience).catch(() => setAudience(null));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [target, ref]);

  const applyTemplate = (key: string) => {
    setCategory(key);
    setTitle(TEMPLATES[key].title);
    setMessage(TEMPLATES[key].message);
  };

  const send = async () => {
    if (!window.confirm(`${num(audience)}명에게 사이트 알림을 발송합니다. 계속할까요?`)) return;
    setSending(true);
    try {
      const result = await adminRpc<{ site_recipients: number; external_delivery: Record<string, string> }>("admin_send_notification", {
        p_title: title, p_message: message, p_category: category, p_target_type: target, p_target_ref: ref || null,
        p_funding_id: target === "funding_participants" ? ref : null, p_channels: channels,
      });
      const external = Object.entries(result.external_delivery).map(([k, v]) => `${k}: ${v === "not_integrated" ? "미연동(발송 안 됨)" : v}`).join(", ");
      toast({ title: `사이트 알림 ${num(result.site_recipients)}건 발송`, description: external || undefined });
      setMessage("");
      void campaigns.reload();
    } catch (error) {
      toast({ title: "발송하지 못했습니다", description: errorMessage(error), variant: "destructive" });
    } finally { setSending(false); }
  };

  return (
    <div>
      <PageHeader eyebrow="Notifications" title="공지 · 알림" description="BRAND-ER 사이트 내 알림(알림함)으로 발송합니다." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel title="알림 작성">
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-1">{Object.entries(TEMPLATES).map(([key, t]) => (
              <button key={key} type="button" onClick={() => applyTemplate(key)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${category === key ? "bg-[#741b2b] text-white" : "bg-stone-100 text-stone-600"}`}>{t.label}</button>
            ))}</div>
            <label className="grid gap-1 text-xs font-bold text-stone-600">발송 대상
              <select className="h-10 rounded-md border px-2 text-sm" value={target} onChange={(e) => { setTarget(e.target.value); setRef(""); }}>
                {TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></label>
            {target === "member" && <label className="grid gap-1 text-xs font-bold text-stone-600">회원 이메일 또는 회원 ID<Input value={ref} onChange={(e) => setRef(e.target.value.trim())} /></label>}
            {target === "funding_participants" && (
              <label className="grid gap-1 text-xs font-bold text-stone-600">펀딩
                <select className="h-10 rounded-md border px-2 text-sm" value={ref} onChange={(e) => setRef(e.target.value)}>
                  <option value="">선택하세요</option>{(fundings.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.product_name} ({f.participant_count}명)</option>)}
                </select></label>
            )}
            {target === "brand_followers" && (
              <label className="grid gap-1 text-xs font-bold text-stone-600">브랜드
                <select className="h-10 rounded-md border px-2 text-sm" value={ref} onChange={(e) => setRef(e.target.value)}>
                  <option value="">선택하세요</option>{(brands.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.brand_name} (팔로워 {b.follower_count})</option>)}
                </select></label>
            )}
            <label className="grid gap-1 text-xs font-bold text-stone-600">제목<Input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className="grid gap-1 text-xs font-bold text-stone-600">내용<Textarea value={message} maxLength={900} rows={5} onChange={(e) => setMessage(e.target.value)} /></label>
            <div className="grid gap-1.5 text-sm">
              <p className="text-xs font-bold text-stone-600">발송 채널</p>
              <label className="flex items-center gap-2"><Checkbox checked disabled />사이트 내 알림 <StatusBadge tone="green">연동됨</StatusBadge></label>
              {[["email", "이메일"], ["sms", "문자"], ["kakao_alimtalk", "카카오 알림톡"]].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-stone-500">
                  <Checkbox checked={channels.includes(key)} onCheckedChange={(v) => setChannels((prev) => v === true ? [...prev, key] : prev.filter((c) => c !== key))} />
                  {label} <StatusBadge>미연동 · 발송되지 않음</StatusBadge>
                </label>
              ))}
            </div>
            <Notice>이메일·문자·알림톡은 아직 외부 서비스와 연동되지 않았습니다. 선택해도 실제로 발송되지 않으며 "미연동"으로만 기록됩니다.</Notice>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">예상 수신자 <b className="tabular-nums">{audience === null ? "-" : num(audience)}</b>명</span>
              <Button className="bg-[#741b2b] hover:bg-[#551220]" disabled={sending || !title.trim() || !message.trim() || !audience} onClick={send}>
                {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}발송
              </Button>
            </div>
          </div>
        </Panel>
        <Panel title="발송 이력" bodyClassName="p-0">
          {campaigns.loading && !campaigns.data ? <LoadingBlock /> : !campaigns.data?.length ? <EmptyState title="발송 이력이 없습니다" /> : (
            <DataTable minWidth={640} head={["제목", "대상", "사이트", "외부 채널", "발송자", "일시"]}>
              {campaigns.data.map((c) => (
                <tr key={c.id}>
                  <Td className="max-w-[200px]"><p className="truncate font-semibold">{c.title}</p><p className="truncate text-[11px] text-stone-400">{c.message}</p></Td>
                  <Td className="text-xs">{TARGETS.find((t) => t.value === c.target_type)?.label}</Td>
                  <Td className="tabular-nums">{num(c.site_recipient_count)}</Td>
                  <Td className="text-[11px]">{Object.keys(c.external_delivery).length ? Object.entries(c.external_delivery).map(([k, v]) => `${k}:${v === "not_integrated" ? "미연동" : v}`).join(", ") : "-"}</Td>
                  <Td className="text-xs">{c.created_by_name}</Td>
                  <Td className="text-xs">{dateTime(c.created_at)}</Td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default NotificationsPage;
