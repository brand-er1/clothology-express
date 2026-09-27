import { useState, type ReactNode } from "react";
import { ChevronDown, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConceptPicker } from "@/components/detail-page/ConceptPicker";
import { ProductAnalysisPanel } from "@/components/detail-page/ProductAnalysisPanel";
import { ReferenceUploader } from "@/components/detail-page/DetailStudioExtras";
import { cn } from "@/lib/utils";
import type {
  AiQuota,
  DetailConceptRecommendation,
  DetailFundingStats,
  DetailPageSource,
  DetailPageTemplateId,
  DetailProductAnalysis,
  DetailUserProvidedInfo,
  ProductDetailPage,
} from "@/types/detailPage";

const inputClass = "h-11 rounded-md text-base sm:text-sm";

const Field = ({
  id,
  label,
  auto,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  auto?: boolean;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-xs font-semibold text-stone-700">
        {label}
        {required && <span className="ml-0.5 text-brand">*</span>}
      </Label>
      {auto && <span className="bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold text-stone-600">자동 불러옴</span>}
    </div>
    {children}
    {hint && <p className="text-[11px] leading-4 text-stone-500">{hint}</p>}
  </div>
);

export const missingRequired = (source: DetailPageSource, productName: string) =>
  [
    !productName.trim() && "상품명",
    !source.clothType.trim() && "상품 카테고리",
    !(source.userProvided.price && source.userProvided.price > 0) && "판매가격",
    !source.imageUrl && "대표 이미지",
  ].filter(Boolean) as string[];

/**
 * Step 1 — only what the page needs. Values that already exist in the design / funding / brand data
 * are pre-filled and marked "자동 불러옴", so nothing is typed twice.
 */
export const ProductInfoStep = ({
  page,
  source,
  productName,
  autoLoaded,
  onSourceChange,
  onProductNameChange,
}: {
  page: Pick<ProductDetailPage, "id" | "fundingId">;
  source: DetailPageSource;
  productName: string;
  /** Field keys that were filled from existing data when the step opened. */
  autoLoaded: Set<string>;
  onSourceChange: (next: DetailPageSource) => void;
  onProductNameChange: (value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const provided = source.userProvided;
  const setProvided = (patch: Partial<DetailUserProvidedInfo>) => onSourceChange({ ...source, userProvided: { ...provided, ...patch } });
  const text = (key: keyof DetailUserProvidedInfo, label: string, placeholder: string, options: { multiline?: boolean; max?: number; hint?: string } = {}) => {
    const id = `info-${key}`;
    const value = (provided[key] as string | undefined) ?? "";
    return (
      <Field id={id} label={label} auto={autoLoaded.has(key)} hint={options.hint}>
        {options.multiline ? (
          <Textarea id={id} value={value} maxLength={options.max ?? 600} placeholder={placeholder} onChange={(event) => setProvided({ [key]: event.target.value })} className="min-h-[76px] rounded-md text-base sm:text-sm" />
        ) : (
          <Input id={id} value={value} maxLength={options.max ?? 120} placeholder={placeholder} onChange={(event) => setProvided({ [key]: event.target.value })} className={inputClass} />
        )}
      </Field>
    );
  };

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-sm font-bold">필수 정보</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
          <div>
            <p className="text-xs font-semibold text-stone-700">대표 이미지<span className="ml-0.5 text-brand">*</span></p>
            {source.imageUrl ? (
              <img src={source.imageUrl} alt="대표 디자인 이미지" className="mt-1.5 aspect-[4/3] w-full bg-white object-contain" />
            ) : (
              <p className="mt-1.5 flex aspect-[4/3] items-center justify-center bg-white text-xs text-stone-400">디자인 이미지가 없어요</p>
            )}
            <p className="mt-1.5 text-[11px] leading-4 text-stone-500">생성된 의류 이미지를 모든 AI 촬영의 기준(Reference)으로 사용합니다.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="info-name" label="상품명" required auto={autoLoaded.has("productName")}>
              <Input id="info-name" value={productName} maxLength={60} placeholder="예: 노스바운드 그래픽 후드" onChange={(event) => onProductNameChange(event.target.value)} className={inputClass} />
            </Field>
            <Field id="info-category" label="상품 카테고리" required auto={autoLoaded.has("clothType")}>
              <Input id="info-category" value={source.clothType} maxLength={30} placeholder="예: 후드티" onChange={(event) => onSourceChange({ ...source, clothType: event.target.value })} className={inputClass} />
            </Field>
            <Field id="info-price" label="판매가격 (원)" required auto={autoLoaded.has("price")} hint={source.estimateUnitMin ? `예상 제작비 ${source.estimateUnitMin.toLocaleString("ko-KR")}원~ / 장` : undefined}>
              <Input
                id="info-price"
                inputMode="numeric"
                value={provided.price !== null ? provided.price.toLocaleString("ko-KR") : ""}
                placeholder="예: 59,000"
                onChange={(event) => {
                  const digits = event.target.value.replace(/[^\d]/g, "");
                  setProvided({ price: digits ? Math.min(Number(digits), 100_000_000) : null });
                }}
                className={inputClass}
              />
            </Field>
            <Field id="info-brand" label="브랜드명" auto={Boolean(source.brandName)} hint={source.brandName ? "내 브랜드 정보에서 자동으로 연결돼요." : "내 브랜드를 등록하면 자동으로 표시돼요."}>
              <Input id="info-brand" value={source.brandName} readOnly disabled className={cn(inputClass, "bg-stone-100")} />
            </Field>
          </div>
        </div>
      </section>

      <section className="border-t border-stone-300">
        <button type="button" onClick={() => setOpen((value) => !value)} className="flex min-h-14 w-full items-center justify-between gap-3 text-left" aria-expanded={open}>
          <span>
            <span className="block text-sm font-bold">선택 정보</span>
            <span className="block text-xs text-stone-500">입력한 내용만 사실로 사용해요. 비워두면 AI가 임의로 만들지 않습니다.</span>
          </span>
          <ChevronDown className={cn("h-5 w-5 shrink-0 transition", open && "rotate-180")} />
        </button>
        {open && (
          <div className="grid gap-5 pb-4 pt-2 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field id="info-description" label="제품 설명" auto={autoLoaded.has("designDescription")}>
                <Textarea id="info-description" value={source.designDescription} maxLength={1200} placeholder="디자인 특징을 적어주세요." onChange={(event) => onSourceChange({ ...source, designDescription: event.target.value })} className="min-h-[88px] rounded-md text-base sm:text-sm" />
              </Field>
            </div>
            <div className="md:col-span-2">{text("background", "제작 의도", "이 옷을 만들게 된 이유를 한두 문장으로 — 스토리 섹션은 이 내용으로만 작성돼요.", { multiline: true })}</div>
            <Field id="info-material" label="원단" auto={autoLoaded.has("material")}>
              <Input id="info-material" value={source.material} maxLength={60} placeholder="예: 기모 스웨트" onChange={(event) => onSourceChange({ ...source, material: event.target.value })} className={inputClass} />
            </Field>
            {text("composition", "혼용률", "예: 면 100% — 모르면 비워두세요")}
            {text("fabricWeight", "원단 중량", "예: 420g/m²")}
            {text("fabricHand", "촉감", "예: 도톰하고 부드러운 기모")}
            {text("fabricStretch", "신축성", "예: 약간 있음")}
            {text("fabricThickness", "두께", "예: 도톰함")}
            <Field id="info-fit" label="핏" auto={autoLoaded.has("fit")}>
              <Input id="info-fit" value={source.fit || provided.fitNote} maxLength={40} placeholder="예: 오버핏" onChange={(event) => (source.fitId ? onSourceChange({ ...source, fit: event.target.value }) : setProvided({ fitNote: event.target.value }))} className={inputClass} />
            </Field>
            <Field id="info-color" label="컬러" auto={Boolean(source.color)}>
              <Input id="info-color" value={provided.colorName || source.color} maxLength={40} placeholder="예: 차콜 그레이" onChange={(event) => setProvided({ colorName: event.target.value })} className={inputClass} />
            </Field>
            <div className="md:col-span-2">
              <p className="text-xs font-semibold text-stone-700">사이즈</p>
              <p className="mt-1.5 text-sm">{source.sizeOptions.length ? source.sizeOptions.join(" / ") : <span className="text-stone-400">펀딩 등록 단계에서 확정돼요</span>}</p>
            </div>
            <div className="md:col-span-2">{text("highlights", "디자인 포인트", "예: 등판 대형 자수 로고, 넉넉한 캥거루 포켓", { multiline: true, max: 400 })}</div>
            <div className="md:col-span-2">{text("details", "디테일 (실제 있는 것만)", "예: 등판 자수, 소매 립 조직, YKK 지퍼", { multiline: true, max: 400 })}</div>
            {text("targetCustomer", "타깃 고객", "예: 데일리 캠퍼스룩을 찾는 20대")}
            {text("mood", "원하는 분위기", "예: 차분한 겨울 새벽, 필름 사진 느낌")}
            {text("careNote", "세탁 · 관리", "예: 찬물 단독 손세탁 권장")}
            <div className="md:col-span-2">
              <p className="text-xs font-semibold text-stone-700">참고 사진 (선택)</p>
              <p className="mt-1 text-[11px] leading-4 text-stone-500">실제 샘플·원단·디테일 사진을 올리면 AI 촬영이 실물에 더 가까워져요.</p>
              <div className="mt-2"><ReferenceUploader page={page} /></div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

/** Step 2 — AI 분석 확인 + 콘셉트 3개 중 선택. */
export const ConceptStep = ({
  analysis,
  concepts,
  conceptId,
  source,
  productName,
  stats,
  onAnalysisChange,
  onConceptChange,
  onEditInfo,
}: {
  analysis: DetailProductAnalysis;
  concepts: DetailConceptRecommendation[];
  conceptId: DetailPageTemplateId | null;
  source: DetailPageSource;
  productName: string;
  stats: DetailFundingStats;
  onAnalysisChange: (next: DetailProductAnalysis) => void;
  onConceptChange: (id: DetailPageTemplateId) => void;
  onEditInfo: () => void;
}) => (
  <div className="space-y-12">
    <section>
      <h2 className="text-sm font-bold">AI 상품 분석</h2>
      <p className="mt-1 text-xs leading-5 text-stone-500">분석 결과로 촬영할 컷과 섹션 구성을 정해요. 다르게 보이는 항목은 고칠 수 있어요.</p>
      <div className="mt-4">
        <ProductAnalysisPanel analysis={analysis} onChange={onAnalysisChange} onEditInfo={onEditInfo} />
      </div>
    </section>
    <section>
      <h2 className="text-sm font-bold">추천 콘셉트</h2>
      <p className="mt-1 text-xs leading-5 text-stone-500">콘셉트마다 섹션 순서·이미지 비율·그리드·타이포·여백이 달라져요. 미리보기는 실제 레이아웃입니다.</p>
      <div className="mt-4">
        <ConceptPicker concepts={concepts} value={conceptId} onChange={onConceptChange} source={source} analysis={analysis} productName={productName} stats={stats} />
      </div>
    </section>
  </div>
);

export const SetupActions = ({
  step,
  busy,
  busyLabel,
  blockedReason,
  quota,
  plannedShots,
  onAutoPilot,
  onNext,
}: {
  step: "info" | "concept";
  busy: boolean;
  busyLabel: string;
  blockedReason: string | null;
  quota: AiQuota | null;
  plannedShots: number;
  onAutoPilot: () => void;
  onNext: () => void;
}) => (
  <div className="mx-auto flex max-w-[1080px] flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
    <p className="min-w-0 flex-1 truncate text-xs text-stone-500">
      {blockedReason
        ? blockedReason
        : step === "concept"
          ? `AI 촬영 ${plannedShots}컷${quota ? ` · 오늘 남은 이미지 ${Math.max(0, quota.imageLimit - quota.imageUsed)}장` : ""}`
          : "잘 모르겠다면 ‘AI에게 맡기기’를 누르세요. 콘셉트·레이아웃·이미지·타이포를 AI가 정합니다."}
    </p>
    <div className="grid grid-cols-2 gap-2 sm:flex">
      <Button type="button" variant="outline" disabled={busy || Boolean(blockedReason)} onClick={onAutoPilot} className="h-12 rounded-md px-4 text-sm font-bold">
        <Wand2 className="mr-1.5 h-4 w-4" /> AI에게 맡기기
      </Button>
      <Button type="button" disabled={busy || Boolean(blockedReason)} onClick={onNext} className="h-12 rounded-md bg-brand px-5 text-sm font-bold hover:bg-brand-dark">
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
        {busy ? busyLabel : step === "info" ? "상품 분석하기" : "이 콘셉트로 만들기"}
      </Button>
    </div>
  </div>
);
