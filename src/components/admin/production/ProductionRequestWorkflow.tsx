import { useEffect, useState } from "react";
import { ChevronDown, ClipboardList, Loader2, MessageSquareText, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { dateTime, errorMessage } from "@/lib/admin/format";
import { ErrorBanner, LoadingBlock, StatusBadge } from "@/components/admin/shell/ui";
import {
  ACCOUNT_TYPE_LABEL, addProductionMemo, ENTRY_POINT_LABEL, getProductionRequest, requestProductionSummaryRefresh,
  updateProductionProgress, type ProductionRequestDetail,
} from "@/services/productionRequestAdmin";
import {
  PRODUCTION_PROGRESS_STATUSES, PRODUCTION_REQUEST_SOURCE, PRODUCTION_REQUEST_SOURCE_LABEL, type ProductionProgressStatus,
} from "../../../../supabase/functions/_shared/productionRequest";
import { CopyPhone } from "./CopyPhone";
import { ImageLightbox } from "./ImageLightbox";

const SOURCE_LABEL: Record<string, string> = {
  ai_design: "AI 디자인 의뢰 (펀딩 · 생산 정보 단계)",
  design_upload: "디자인 업로드 의뢰 (자동견적)",
  ready_made_group_wear: "기성품 단체복 빠른 제작",
  [PRODUCTION_REQUEST_SOURCE]: `${PRODUCTION_REQUEST_SOURCE_LABEL} (AI 이미지 생성 → 제작의뢰하기)`,
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 py-1.5 text-[13px]">
    <dt className="text-stone-500">{label}</dt>
    <dd className="min-w-0 break-words font-medium text-stone-900">{children}</dd>
  </div>
);

type Props = {
  orderId: string;
  /** 진행 상태 · 메모가 바뀌면 목록을 다시 불러온다 */
  onChanged: () => void;
};

/** 기존 제작의뢰 상세 다이얼로그 안에 붙는 처리 영역: 접수 정보 · 고객 계정 · 진행 상태 8단계 · 고객 안내 문구 · 내부 메모 */
export const ProductionRequestWorkflow = ({ orderId, onChanged }: Props) => {
  const [detail, setDetail] = useState<ProductionRequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProductionProgressStatus>("new");
  const [comment, setComment] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);
  const [memo, setMemo] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const data = await getProductionRequest(orderId);
      setDetail(data);
      setProgress(data.progress_status);
      setComment(data.admin_comment ?? "");
      requestProductionSummaryRefresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  useEffect(() => {
    setDetail(null);
    setMemo("");
    setShowPrompt(false);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (error) return <ErrorBanner message={error} onRetry={() => void load()} />;
  if (!detail) return <LoadingBlock label="제작의뢰 정보를 불러오는 중..." />;

  const request = detail.request;
  const account = detail.account;
  const isAiRequest = detail.request_source === PRODUCTION_REQUEST_SOURCE;
  const progressChanged = progress !== detail.progress_status || comment.trim() !== (detail.admin_comment ?? "").trim();

  const saveProgress = async () => {
    setSavingProgress(true);
    try {
      await updateProductionProgress(orderId, progress, comment.trim() || null);
      toast({ title: "진행 상태를 저장했습니다", description: PRODUCTION_PROGRESS_STATUSES.find((s) => s.value === progress)?.label });
      await load();
      onChanged();
    } catch (err) {
      toast({ title: "진행 상태를 저장하지 못했습니다", description: errorMessage(err), variant: "destructive" });
    } finally {
      setSavingProgress(false);
    }
  };

  const saveMemo = async () => {
    if (!memo.trim()) return;
    setSavingMemo(true);
    try {
      await addProductionMemo(orderId, memo);
      setMemo("");
      await load();
    } catch (err) {
      toast({ title: "메모를 저장하지 못했습니다", description: errorMessage(err), variant: "destructive" });
    } finally {
      setSavingMemo(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="production-request-workflow">
      {/* AI 디자인 제작의뢰 접수 정보 */}
      {request && (
        <section className="rounded-2xl border border-[#741b2b]/15 bg-[#741b2b]/[0.035] p-4">
          <h3 className="mb-2 flex items-center gap-2 text-[15px] font-extrabold text-stone-950">
            <Sparkles className="h-4 w-4 text-[#741b2b]" /> {PRODUCTION_REQUEST_SOURCE_LABEL} 접수 정보
          </h3>
          <div className={cn("grid gap-4", detail.image_url && "md:grid-cols-[220px_minmax(0,1fr)]")}>
            {detail.image_url && (
              <ImageLightbox src={detail.image_url} alt="고객이 생성하고 의뢰한 의류 이미지" filename={`brander-request-${orderId.slice(0, 8)}.png`} />
            )}
            <dl className="divide-y divide-stone-200/70">
              <Row label="고객 이름">{request.contact_name}</Row>
              <Row label="전화번호"><CopyPhone phone={request.contact_phone} /></Row>
              <Row label="희망 수량">{request.quantity_undecided ? "미정" : `${request.quantity?.toLocaleString("ko-KR")}장`}</Row>
              <Row label="희망 예산">{request.budget || <span className="text-stone-400">미입력</span>}</Row>
              <Row label="추가 요청">{request.customer_request ? <span className="whitespace-pre-wrap">{request.customer_request}</span> : <span className="text-stone-400">없음</span>}</Row>
              <Row label="접수 일시">{dateTime(request.created_at)}</Row>
              <Row label="유입 경로">
                {SOURCE_LABEL[detail.request_source] ?? detail.request_source}
                <span className="block text-[12px] font-normal text-stone-500">
                  {ENTRY_POINT_LABEL[request.entry_point] ?? request.entry_point}{request.entry_path ? ` · ${request.entry_path}` : ""}
                </span>
              </Row>
              <Row label="개인정보 동의">{dateTime(request.privacy_consented_at)} <span className="text-[12px] font-normal text-stone-500">({request.privacy_consent_version})</span></Row>
            </dl>
          </div>
          {(request.ai_prompt || request.design_brief) && (
            <div className="mt-3 rounded-xl border border-stone-200 bg-white">
              <button type="button" onClick={() => setShowPrompt((value) => !value)} aria-expanded={showPrompt}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] font-bold text-stone-800">
                AI 이미지 생성 프롬프트
                <ChevronDown className={cn("h-4 w-4 text-stone-400 transition", showPrompt && "rotate-180")} />
              </button>
              {showPrompt && (
                <div className="space-y-2 border-t border-stone-100 px-3 py-2.5 text-[12px] leading-5">
                  {request.design_brief && <p><span className="font-bold text-stone-700">고객 디자인 설명 · </span><span className="whitespace-pre-wrap text-stone-700">{request.design_brief}</span></p>}
                  {request.ai_prompt && <p className="whitespace-pre-wrap rounded-lg bg-stone-50 p-2 font-mono text-[11px] text-stone-700" data-testid="request-ai-prompt">{request.ai_prompt}</p>}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 고객 계정 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="mb-1 flex items-center gap-2 text-[15px] font-extrabold text-stone-950"><UserRound className="h-4 w-4 text-[#741b2b]" /> 고객 계정 정보</h3>
        {account.is_guest ? (
          <p className="py-1.5 text-[13px] text-stone-600">비회원 접수 · 로그인 계정 없이 이름과 전화번호로 접수했습니다.</p>
        ) : (
          <dl className="divide-y divide-stone-100">
            <Row label="회원 구분">{ACCOUNT_TYPE_LABEL[account.account_type ?? ""] ?? account.account_type ?? "회원"}</Row>
            <Row label="이메일">{account.email ?? <span className="text-stone-400">권한 없음</span>}</Row>
            <Row label="아이디">{account.username ?? "-"}</Row>
            <Row label="프로필 이름">{account.full_name ?? "-"}</Row>
            <Row label="프로필 연락처"><CopyPhone phone={account.phone_number} /></Row>
            <Row label="가입일">{dateTime(account.signed_up_at)}</Row>
          </dl>
        )}
      </section>

      {/* 진행 상태 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-stone-950"><ClipboardList className="h-4 w-4 text-[#741b2b]" /> 상담 및 제작 진행 상태</h3>
          {detail.progress_updated_at && <span className="text-[11px] text-stone-400">최근 변경 {dateTime(detail.progress_updated_at)}</span>}
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="진행 상태">
          {PRODUCTION_PROGRESS_STATUSES.map((status) => (
            <button
              key={status.value} type="button" role="radio" aria-checked={progress === status.value} disabled={!detail.can_manage}
              onClick={() => setProgress(status.value)}
              className={cn(
                "h-10 rounded-lg border text-[12px] font-bold transition disabled:cursor-not-allowed",
                progress === status.value ? "border-[#741b2b] bg-[#741b2b] text-white" : "border-stone-200 bg-white text-stone-600 hover:border-[#741b2b]/40",
                !detail.can_manage && progress !== status.value && "opacity-50",
              )}
            >
              {status.label}
            </button>
          ))}
        </div>
        <label className="mt-3 block text-[12px] font-bold text-stone-700" htmlFor="pr-admin-comment">
          고객 안내 문구 <span className="font-normal text-stone-400">(고객 주문내역에 보이는 검토 의견 · 계약 미성사 시 사유 필수)</span>
        </label>
        <Textarea id="pr-admin-comment" value={comment} onChange={(event) => setComment(event.target.value)} readOnly={!detail.can_manage}
          maxLength={2000} placeholder="제작 가능 여부, 확인할 내용 또는 진행 불가 사유" className="mt-1 min-h-[72px] text-sm" />
        {detail.can_manage ? (
          <div className="mt-2 flex justify-end">
            <Button type="button" onClick={() => void saveProgress()} disabled={savingProgress || !progressChanged} className="bg-[#741b2b] hover:bg-[#5c1422]" data-testid="save-progress">
              {savingProgress && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} 진행 상태 저장
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-stone-500">조회 전용 권한입니다. 상태 변경은 orders.manage 권한이 필요합니다.</p>
        )}
      </section>

      {/* 내부 메모 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="mb-1 flex items-center gap-2 text-[15px] font-extrabold text-stone-950">
          <MessageSquareText className="h-4 w-4 text-[#741b2b]" /> 내부 상담 메모 <StatusBadge>고객에게 보이지 않음</StatusBadge>
        </h3>
        {detail.memos === null ? (
          <p className="py-1.5 text-[13px] text-stone-500">상담 메모는 고객 개인정보 열람 권한(orders.pii)이 있어야 볼 수 있습니다.</p>
        ) : (
          <>
            {detail.can_manage && (
              <div className="mt-2">
                <Textarea value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={2000}
                  placeholder="예) 11/27 통화 — 자수 위치 확인, 50장 기준 견적 문자 발송 예정" className="min-h-[72px] text-sm" data-testid="memo-input" />
                <div className="mt-2 flex justify-end">
                  <Button type="button" variant="outline" onClick={() => void saveMemo()} disabled={savingMemo || !memo.trim()} data-testid="save-memo">
                    {savingMemo && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} 메모 추가
                  </Button>
                </div>
              </div>
            )}
            {detail.memos.length === 0 ? (
              <p className="py-2 text-[13px] text-stone-400">아직 기록된 상담 메모가 없습니다.</p>
            ) : (
              <ol className="mt-2 space-y-2" data-testid="memo-list">
                {detail.memos.map((item) => (
                  <li key={item.id} className="rounded-xl bg-stone-50 px-3 py-2.5">
                    <p className="whitespace-pre-wrap text-[13px] leading-5 text-stone-800">{item.body}</p>
                    <p className="mt-1 text-[11px] text-stone-400">{item.author_name ?? "관리자"} · {dateTime(item.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </section>
      {!isAiRequest && <p className="text-[11px] text-stone-400">진행 상태는 모든 제작의뢰 유형에 공통으로 적용됩니다.</p>}
    </div>
  );
};
