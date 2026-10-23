import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { EmptyState, ErrorBanner, FilterChips, LoadingBlock, PageHeader, Pager, Panel, StatusBadge } from "@/components/admin/shell/ui";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { dateTime } from "@/lib/admin/format";
import { answerInquiry, fetchSellerInquiries, type SellerInquiry } from "@/services/seller";

const PAGE_SIZE = 20;

const TYPE_LABEL: Record<string, string> = {
  size_fit: "사이즈 · 핏", fabric: "원단", production: "제작 일정", shipping: "배송", exchange_refund: "교환 · 환불", other: "기타",
};

const InquiryItem = ({ inquiry, onSaved }: { inquiry: SellerInquiry; onSaved: () => void }) => {
  const [editing, setEditing] = useState(inquiry.status === "pending");
  const [content, setContent] = useState(inquiry.answer?.content ?? "");
  const [saving, setSaving] = useState(false);
  const trimmed = content.trim();

  const save = async () => {
    setSaving(true);
    try {
      await answerInquiry(inquiry.id, trimmed);
      toast(inquiry.answer
        ? { title: "답변을 수정했습니다" }
        : { title: "답변을 등록했습니다", description: "문의한 고객에게 답변 알림이 전송됩니다." });
      setEditing(false);
      onSaved();
    } catch (error) {
      toast({ title: "답변을 저장하지 못했습니다", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="grid gap-2 border-b border-stone-100 p-4 last:border-0 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={inquiry.status === "pending" ? "amber" : "green"}>{inquiry.status === "pending" ? "답변 대기" : "답변 완료"}</StatusBadge>
        <StatusBadge>{TYPE_LABEL[inquiry.inquiry_type] ?? inquiry.inquiry_type}</StatusBadge>
        {inquiry.is_private && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-500"><Lock className="h-3 w-3" />비공개</span>}
        {inquiry.is_hidden && <StatusBadge tone="red">관리자 숨김</StatusBadge>}
        <span className="ml-auto text-[11px] text-stone-400">{dateTime(inquiry.created_at)}</span>
      </div>
      <Link to={`/fundings/${inquiry.funding_id}?tab=inquiries`} target="_blank" className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-[#741b2b] hover:underline">
        {inquiry.funding_name}<ArrowUpRight className="h-3 w-3" />
      </Link>
      <p className="text-sm font-bold">{inquiry.title} <span className="font-normal text-stone-400">· {inquiry.nickname}</span></p>
      {inquiry.content && <p className="whitespace-pre-wrap break-words text-sm leading-6 text-stone-700">{inquiry.content}</p>}
      {inquiry.answer && !editing && (
        <div className="rounded-xl border-l-2 border-[#741b2b] bg-[#741b2b]/[0.04] p-3 text-sm">
          <p className="text-[11px] font-bold text-[#741b2b]">{inquiry.answer.role === "admin" ? "BRAND-ER 운영팀" : "판매자"} 답변 · {dateTime(inquiry.answer.updated_at ?? inquiry.answer.answered_at)}</p>
          <p className="mt-1 whitespace-pre-wrap break-words leading-6">{inquiry.answer.content}</p>
        </div>
      )}
      {editing ? (
        <div className="grid gap-2">
          <Textarea value={content} onChange={(e) => setContent(e.target.value.slice(0, 3000))} rows={4} placeholder="고객 문의에 답변을 남겨주세요." />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void save()} disabled={saving || trimmed.length < 2} className="bg-[#741b2b] hover:bg-[#5c1522]">
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{inquiry.answer ? "답변 수정" : "답변 등록"}
            </Button>
            {inquiry.answer && <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setContent(inquiry.answer?.content ?? ""); }}>취소</Button>}
          </div>
        </div>
      ) : inquiry.answer?.role !== "admin" && (
        <Button size="sm" variant="outline" className="w-fit" onClick={() => setEditing(true)}>답변 수정</Button>
      )}
    </li>
  );
};

const InquiriesPage = () => {
  const [filter, setFilter] = useState<"all" | "pending" | "answered">("pending");
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [filter]);
  const { data, loading, error, reload } = useAdminQuery(() => fetchSellerInquiries(filter, PAGE_SIZE, page * PAGE_SIZE), [filter, page]);

  return (
    <div>
      <PageHeader eyebrow="Inquiries" title="고객 문의" description="내 펀딩 상품에 들어온 문의입니다. 비공개 문의도 판매자에게는 내용이 보입니다." />
      <Panel bodyClassName="p-0" title={
        <FilterChips<"all" | "pending" | "answered"> value={filter} onChange={setFilter} options={[
          { value: "pending", label: "답변 대기", count: data?.counts.pending },
          { value: "answered", label: "답변 완료", count: data?.counts.answered },
          { value: "all", label: "전체", count: data?.counts.all },
        ]} />
      }>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : (data?.rows.length ?? 0) === 0 ? <EmptyState title="문의가 없습니다" /> : (
          <>
            <ul>{data!.rows.map((inquiry) => <InquiryItem key={`${inquiry.id}-${inquiry.status}`} inquiry={inquiry} onSaved={reload} />)}</ul>
            <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Panel>
    </div>
  );
};

export default InquiriesPage;
