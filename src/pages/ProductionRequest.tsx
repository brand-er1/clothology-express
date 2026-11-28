import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, ImagePlus, Loader2, Phone, Sparkles, X } from "lucide-react";
import { Header } from "@/components/Header";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { trackSiteEvent } from "@/lib/site-analytics";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { formatMobilePhone, MOBILE_PHONE_ERROR, normalizeMobilePhone } from "@/utils/phone";
import {
  clearProductionDesignHandoff,
  loadProductionDesignHandoff,
  normalizeCtaSource,
  PRODUCTION_BUDGET_OPTIONS,
  PRODUCTION_ITEM_OPTIONS,
  PRODUCTION_QUANTITY_OPTIONS,
  type ProductionDesignHandoff,
} from "@/lib/production-request";
import {
  INQUIRY_ACCEPTED_TYPES,
  MAX_INQUIRY_ATTACHMENTS,
  MAX_INQUIRY_FILE_BYTES,
  submitProductionInquiry,
} from "@/services/productionInquiry";

/** 브랜더 제작 서비스 — 의뢰 양식 옆에 항상 보이는 신뢰 정보. */
const capabilities = [
  { title: "국내 소량 제작 20장부터", body: "첫 컬렉션 · 테스트 판매도 부담 없는 수량으로 시작합니다." },
  { title: "원단 및 부자재 컨택", body: "콘셉트와 예산에 맞는 원단 · 라벨 · 부자재를 찾아 제안합니다." },
  { title: "패턴 및 샘플 제작", body: "전문 패턴사가 패턴을 뜨고, 본생산 전 실물 샘플로 핏을 검수합니다." },
  { title: "국내외 생산 인프라", body: "국내 봉제 공장과 해외 협력 공장 중 수량 · 단가에 맞게 연결합니다." },
  { title: "브랜드 의류 및 단체복 제작", body: "브랜드 컬렉션부터 기업 · 학교 · 동호회 단체복까지 제작합니다." },
];

const steps = [
  { label: "의뢰 접수", body: "연락처만 남기면 끝" },
  { label: "제작 상담", body: "1영업일 내 연락" },
  { label: "견적 · 샘플", body: "원단 · 패턴 · 샘플" },
  { label: "생산 · 납품", body: "검수 후 출고" },
];

const PRIVACY = [
  ["수집 항목", "고객명 또는 브랜드명, 전화번호, 의뢰 내용(품목 · 수량 · 예산 · 납기 · 요청사항), 첨부 이미지"],
  ["이용 목적", "의류 제작 상담, 견적 안내 및 제작 진행 연락"],
  ["보유 및 이용 기간", "상담 종료 후 1년간 보관 후 파기 (계약 체결 시 관련 법령이 정한 기간 동안 보관)"],
  ["동의 거부 권리 및 불이익", "동의를 거부할 수 있으며, 거부 시 제작 의뢰 접수가 제한됩니다."],
];

const todayPlus = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const Chip = ({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={cn(
      "min-h-11 rounded-[2px] border px-3.5 text-[14px] font-medium transition-colors",
      selected ? "border-brand bg-brand text-white" : "border-black/15 bg-white text-stone-700 hover:border-brand/60 hover:text-brand",
    )}
  >
    {children}
  </button>
);

const SectionHead = ({ number, title, hint, required }: { number: string; title: string; hint?: string; required?: boolean }) => (
  <div className="flex items-baseline gap-3 border-b border-black/[0.08] pb-3">
    <span className="font-display text-[11px] font-semibold tracking-[0.2em] text-brand">{number}</span>
    <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#211b1c]">{title}</h2>
    <span className={cn("ml-auto text-[12px] font-medium", required ? "text-brand" : "text-stone-400")}>{hint ?? (required ? "필수" : "선택")}</span>
  </div>
);

const FieldLabel = ({ htmlFor, children, required }: { htmlFor?: string; children: ReactNode; required?: boolean }) => (
  <label htmlFor={htmlFor} className="mb-2 block text-[13px] font-semibold text-stone-700">
    {children}
    {required && <span className="ml-0.5 text-brand" aria-hidden>*</span>}
  </label>
);

const inputClass =
  "h-12 w-full rounded-[2px] border border-black/15 bg-white px-3.5 text-[15px] text-[#211b1c] placeholder:text-stone-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

type Submitted = { phone: string; hasDesign: boolean };

const ProductionRequest = () => {
  const location = useLocation();
  const [params] = useSearchParams();
  const source = normalizeCtaSource(params.get("from"));
  const ids = { name: useId(), phone: useId(), date: useId(), notes: useId(), consent: useId() };

  const [design, setDesign] = useState<ProductionDesignHandoff | null>(() => loadProductionDesignHandoff((location.state as { design?: unknown } | null)?.design));
  const [designImageFailed, setDesignImageFailed] = useState(false);
  const [item, setItem] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<(typeof PRODUCTION_QUANTITY_OPTIONS)[number] | null>(null);
  const [budget, setBudget] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [consent, setConsent] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [errors, setErrors] = useState<{ phone?: string; consent?: string }>({});
  const phoneRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const viewTracked = useRef(false);

  useDocumentMeta({
    title: "의류 제작 의뢰 | BRAND-ER",
    description: "AI 디자인부터 원단 선정, 샘플 제작, 소량 · 대량 생산까지. 국내 소량 제작 20장부터 브랜더에 의뢰하세요.",
  });

  // AI 결과 화면에서 넘어온 디자인의 품목 · 수량을 미리 골라 둔다(고객은 확인만 하면 된다).
  useEffect(() => {
    if (!design) return;
    if (design.quantity) {
      const match = [...PRODUCTION_QUANTITY_OPTIONS].reverse().find((option) => option.value !== null && design.quantity! >= option.value);
      if (match) setQuantity(match);
    }
  }, [design]);

  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;
    void trackSiteEvent("production_form_viewed", { from: source, has_ai_design: Boolean(design) });
  }, [source, design]);

  // 로그인한 고객은 프로필의 브랜드명 · 이름 · 전화번호를 미리 채운다.
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("brand_name, full_name, username, phone_number").eq("id", user.id).maybeSingle();
      if (!active || !profile) return;
      setName((current) => current || profile.brand_name || profile.full_name || profile.username || "");
      setPhone((current) => current || (profile.phone_number ? formatMobilePhone(profile.phone_number) : ""));
    });
    return () => { active = false; };
  }, []);

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  const phoneValid = Boolean(normalizeMobilePhone(phone));

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    const accepted = picked.filter((file) => INQUIRY_ACCEPTED_TYPES.includes(file.type) && file.size <= MAX_INQUIRY_FILE_BYTES);
    if (accepted.length < picked.length) {
      toast({ title: "일부 파일은 첨부하지 않았어요", description: "PNG · JPG · WEBP 이미지, 15MB 이하만 첨부할 수 있습니다. 다른 형식은 상담 중에 전달해주세요." });
    }
    setFiles((current) => {
      const next = [...current, ...accepted].slice(0, MAX_INQUIRY_ATTACHMENTS);
      if (current.length + accepted.length > MAX_INQUIRY_ATTACHMENTS) {
        toast({ title: `이미지는 ${MAX_INQUIRY_ATTACHMENTS}장까지 첨부할 수 있어요` });
      }
      return next;
    });
  };

  const removeDesign = () => {
    setDesign(null);
    clearProductionDesignHandoff();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!phoneValid) nextErrors.phone = phone.trim() ? MOBILE_PHONE_ERROR : "연락받으실 전화번호를 입력해주세요.";
    if (!consent) nextErrors.consent = "개인정보 수집 · 이용에 동의해주세요.";
    setErrors(nextErrors);
    setPhoneTouched(true);
    if (nextErrors.phone) { phoneRef.current?.focus(); return; }
    if (nextErrors.consent) { consentRef.current?.focus(); return; }

    setSubmitting(true);
    try {
      await submitProductionInquiry({
        contactName: name,
        contactPhone: phone,
        item,
        quantityLabel: quantity?.label ?? null,
        quantityValue: quantity?.value ?? null,
        budgetRange: budget,
        desiredDueDate: dueDate || null,
        notes,
        privacyConsent: consent,
        attachments: files,
        design,
        source,
      });
      void trackSiteEvent("production_inquiry_submitted", {
        from: source,
        has_ai_design: Boolean(design),
        attachments: files.length,
        item: item ?? "none",
        quantity: quantity?.label ?? "none",
      });
      clearProductionDesignHandoff();
      setSubmitted({ phone: formatMobilePhone(normalizeMobilePhone(phone)), hasDesign: Boolean(design) });
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch (error) {
      toast({
        title: "제작 의뢰를 접수하지 못했어요",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#211b1c]">
      <Header />
      <main className="pt-16 sm:pt-[72px]">
        <div className="page-shell pb-20 pt-10 sm:pb-28 sm:pt-14 lg:pt-20">
          {submitted ? (
            <SubmittedView submitted={submitted} />
          ) : (
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
              {/* 좌측: 제작 서비스 소개(데스크톱에서는 양식 옆에 고정) */}
              <aside className="lg:col-span-5">
                <div className="lg:sticky lg:top-28">
                  <p className="eyebrow">Production request</p>
                  <h1 className="mt-4 text-[2.1rem] font-semibold leading-[1.12] tracking-[-0.04em] sm:text-[2.6rem]">
                    상상한 디자인을
                    <br />
                    실제 의류로<span className="text-brand">.</span>
                  </h1>
                  <p className="mt-5 max-w-md text-[15px] leading-7 text-stone-600">
                    제작 경험이 없어도 괜찮습니다. 연락처만 남겨주시면 제작 매니저가 품목 · 수량 · 원단부터 함께 정리해드립니다.
                  </p>

                  <ol className="mt-8 grid grid-cols-4 border-y border-black/10 py-4 text-center">
                    {steps.map((step, index) => (
                      <li key={step.label} className="min-w-0 px-1">
                        <span className="font-display text-[11px] font-semibold text-brand">{String(index + 1).padStart(2, "0")}</span>
                        <p className="mt-1 text-[13px] font-semibold">{step.label}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-stone-500">{step.body}</p>
                      </li>
                    ))}
                  </ol>

                  <ul className="mt-8 hidden space-y-5 sm:block">
                    {capabilities.map((capability) => (
                      <li key={capability.title} className="grid grid-cols-[1.25rem_1fr] gap-3">
                        <Check className="mt-0.5 h-4 w-4 text-brand" strokeWidth={2.4} />
                        <div>
                          <p className="text-[15px] font-semibold">{capability.title}</p>
                          <p className="mt-1 text-[13px] leading-6 text-stone-500">{capability.body}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {/* 모바일: 설명은 줄이고 핵심 항목만 칩으로 */}
                  <ul className="mt-6 flex flex-wrap gap-2 sm:hidden">
                    {capabilities.map((capability) => (
                      <li key={capability.title} className="rounded-[2px] border border-black/10 bg-white/70 px-2.5 py-1.5 text-[12px] font-medium text-stone-700">
                        {capability.title}
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>

              {/* 우측: 의뢰 양식 */}
              <form onSubmit={handleSubmit} noValidate className="lg:col-span-7" aria-label="의류 제작 의뢰 양식">
                <div className="rounded-[3px] border border-black/[0.08] bg-[#fbfaf8] p-5 sm:p-8 lg:p-10">
                  <p className="flex items-center gap-2 rounded-[2px] bg-brand/[0.06] px-3.5 py-3 text-[13px] leading-5 text-brand">
                    <Phone className="h-4 w-4 shrink-0" />
                    필수 입력은 <strong className="font-semibold">전화번호</strong>와 개인정보 동의뿐이에요. 나머지는 아는 만큼만 골라주세요.
                  </p>

                  {/* 01 디자인 */}
                  <section className="mt-8">
                    <SectionHead number="01" title="디자인 이미지 · 참고자료" />
                    {design && (
                      <div className="mt-4 flex gap-4 rounded-[2px] border border-brand/30 bg-white p-3">
                        <div className="h-24 w-24 shrink-0 overflow-hidden bg-[#efebe5] sm:h-28 sm:w-28">
                          {!designImageFailed ? (
                            <img src={design.imageUrl} alt="첨부된 AI 디자인" className="h-full w-full object-contain" onError={() => setDesignImageFailed(true)} />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[11px] text-stone-400">미리보기 없음</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
                            <Sparkles className="h-3.5 w-3.5" /> {design.origin === "detail_page_done" ? "상세페이지 디자인" : "AI 디자인"}이 자동으로 첨부됐어요
                          </p>
                          <p className="mt-1 text-[14px] font-semibold">{[design.clothType, design.material].filter(Boolean).join(" · ") || "내가 만든 디자인"}</p>
                          {design.description && <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-stone-500">{design.description}</p>}
                          <button type="button" onClick={removeDesign} className="mt-2 text-[12px] font-medium text-stone-400 underline-offset-2 hover:text-stone-700 hover:underline">
                            첨부 빼기
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {previews.map((preview, index) => (
                        <div key={preview.url} className="relative aspect-square overflow-hidden border border-black/10 bg-white">
                          <img src={preview.url} alt={`첨부 이미지 ${index + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setFiles((current) => current.filter((file) => file !== preview.file))}
                            className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                            aria-label={`첨부 이미지 ${index + 1} 삭제`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {files.length < MAX_INQUIRY_ATTACHMENTS && (
                        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 border border-dashed border-black/20 bg-white text-center text-stone-500 transition-colors hover:border-brand hover:text-brand">
                          <ImagePlus className="h-5 w-5" strokeWidth={1.6} />
                          <span className="text-[11px] font-medium leading-4">이미지 추가<br />({files.length}/{MAX_INQUIRY_ATTACHMENTS})</span>
                          <input type="file" accept={INQUIRY_ACCEPTED_TYPES.join(",")} multiple onChange={handleFiles} className="sr-only" />
                        </label>
                      )}
                    </div>
                    <p className="mt-2 text-[12px] leading-5 text-stone-500">
                      디자인 시안, 참고 사진, 손그림 사진 모두 좋아요. {!design && (
                        <>디자인이 없다면 <Link to="/customize" className="font-medium text-brand underline-offset-2 hover:underline">AI 이미지 만들기</Link>로 먼저 그려볼 수도 있어요.</>
                      )}
                    </p>
                  </section>

                  {/* 02 제작 정보 */}
                  <section className="mt-10">
                    <SectionHead number="02" title="어떤 옷을 만들까요?" />
                    <div className="mt-5 space-y-6">
                      <div>
                        <FieldLabel>제작 희망 품목</FieldLabel>
                        <div className="flex flex-wrap gap-2">
                          {PRODUCTION_ITEM_OPTIONS.map((option) => (
                            <Chip key={option} selected={item === option} onClick={() => setItem(item === option ? null : option)}>{option}</Chip>
                          ))}
                        </div>
                      </div>
                      <div>
                        <FieldLabel>예상 제작 수량</FieldLabel>
                        <div className="flex flex-wrap gap-2">
                          {PRODUCTION_QUANTITY_OPTIONS.map((option) => (
                            <Chip key={option.label} selected={quantity?.label === option.label} onClick={() => setQuantity(quantity?.label === option.label ? null : option)}>{option.label}</Chip>
                          ))}
                        </div>
                        <p className="mt-2 text-[12px] text-stone-500">국내 소량 제작은 20장부터 가능해요. 그보다 적다면 상담에서 방법을 안내해드려요.</p>
                      </div>
                      <div>
                        <FieldLabel>희망 예산</FieldLabel>
                        <div className="flex flex-wrap gap-2">
                          {PRODUCTION_BUDGET_OPTIONS.map((option) => (
                            <Chip key={option} selected={budget === option} onClick={() => setBudget(budget === option ? null : option)}>{option}</Chip>
                          ))}
                        </div>
                      </div>
                      <div className="sm:max-w-xs">
                        <FieldLabel htmlFor={ids.date}>희망 납기일</FieldLabel>
                        <input id={ids.date} type="date" min={todayPlus(1)} value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClass} />
                        <p className="mt-2 text-[12px] leading-5 text-stone-500">보통 샘플 2~3주, 본생산 3~5주가 걸려요.</p>
                      </div>
                    </div>
                  </section>

                  {/* 03 연락처 */}
                  <section className="mt-10">
                    <SectionHead number="03" title="연락받을 정보" required hint="전화번호 필수" />
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel htmlFor={ids.name}>고객명 또는 브랜드명</FieldLabel>
                        <input id={ids.name} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="organization" placeholder="예) 홍길동 / BRAND-ER" className={inputClass} />
                      </div>
                      <div>
                        <FieldLabel htmlFor={ids.phone} required>전화번호</FieldLabel>
                        <input
                          id={ids.phone}
                          ref={phoneRef}
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel"
                          required
                          aria-required="true"
                          aria-invalid={Boolean(errors.phone)}
                          aria-describedby={`${ids.phone}-error`}
                          value={phone}
                          onChange={(event) => { setPhone(event.target.value); if (errors.phone) setErrors((current) => ({ ...current, phone: undefined })); }}
                          onBlur={() => { setPhoneTouched(true); if (phone && normalizeMobilePhone(phone)) setPhone(formatMobilePhone(normalizeMobilePhone(phone))); }}
                          placeholder="010-1234-5678"
                          className={cn(inputClass, (errors.phone || (phoneTouched && phone && !phoneValid)) && "border-red-400 focus:border-red-500 focus:ring-red-100")}
                        />
                        <p id={`${ids.phone}-error`} className="mt-1.5 min-h-[1rem] text-[12px] text-red-600" role="alert">
                          {errors.phone || (phoneTouched && phone && !phoneValid ? MOBILE_PHONE_ERROR : "")}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <FieldLabel htmlFor={ids.notes}>기타 요청사항</FieldLabel>
                        <textarea
                          id={ids.notes}
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          maxLength={2000}
                          rows={4}
                          placeholder={"예) 회사 워크숍용 후드티 80장, 가슴에 로고 자수 원해요.\n원단은 도톰했으면 좋겠고 상담 가능한 시간은 평일 오후예요."}
                          className={cn(inputClass, "h-auto min-h-[112px] py-3 leading-6")}
                        />
                      </div>
                    </div>
                  </section>

                  {/* 동의 + 제출 */}
                  <div className="mt-8 border-t border-black/[0.08] pt-6">
                    <div className="flex items-start gap-3">
                      <span className="relative mt-0.5 flex h-6 w-6 shrink-0">
                        <input
                          id={ids.consent}
                          ref={consentRef}
                          type="checkbox"
                          checked={consent}
                          onChange={(event) => { setConsent(event.target.checked); if (errors.consent) setErrors((current) => ({ ...current, consent: undefined })); }}
                          aria-invalid={Boolean(errors.consent)}
                          className="peer absolute inset-0 h-6 w-6 cursor-pointer appearance-none rounded-[2px] border border-black/30 bg-white transition checked:border-brand checked:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
                        />
                        <Check className="pointer-events-none absolute inset-0 m-auto h-4 w-4 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <label htmlFor={ids.consent} className="cursor-pointer text-[14px] font-medium leading-6">
                          <span className="text-brand">[필수]</span> 개인정보 수집 · 이용에 동의합니다.
                        </label>
                        <button type="button" onClick={() => setShowPrivacy((value) => !value)} aria-expanded={showPrivacy} className="ml-2 inline-flex items-center gap-0.5 text-[12px] text-stone-500 hover:text-stone-800">
                          자세히 <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showPrivacy && "rotate-180")} />
                        </button>
                        {errors.consent && <p className="mt-1 text-[12px] text-red-600" role="alert">{errors.consent}</p>}
                        {showPrivacy && (
                          <dl className="mt-3 divide-y divide-black/[0.07] border-y border-black/[0.07] text-[12px] leading-5">
                            {PRIVACY.map(([term, description]) => (
                              <div key={term} className="grid gap-1 py-2.5 sm:grid-cols-[8.5rem_1fr] sm:gap-3">
                                <dt className="font-semibold text-[#211b1c]">{term}</dt>
                                <dd className="text-stone-600">{description}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="mt-6 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[2px] bg-brand px-6 text-[16px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-wait disabled:opacity-70"
                    >
                      {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> 접수하는 중...</> : <>제작 의뢰 접수하기 <ArrowRight className="h-4 w-4" /></>}
                    </button>
                    <p className="mt-3 text-center text-[12px] text-stone-500">접수 후 영업일 기준 1일 이내 제작 매니저가 연락드립니다. 상담 · 견적은 무료예요.</p>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const SubmittedView = ({ submitted }: { submitted: Submitted }) => (
  <div className="mx-auto max-w-xl py-6 text-center sm:py-12">
    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white">
      <Check className="h-7 w-7" strokeWidth={2.4} />
    </span>
    <p className="eyebrow mt-8">Request received</p>
    <h1 className="mt-3 text-[2rem] font-semibold leading-tight tracking-[-0.04em]">제작 의뢰가 접수되었습니다</h1>
    <p className="mt-4 text-[15px] leading-7 text-stone-600">
      영업일 기준 1일 이내 <strong className="font-semibold text-[#211b1c]">{submitted.phone}</strong>(으)로
      <br className="hidden sm:block" /> 제작 매니저가 연락드립니다.
    </p>
    <ol className="mx-auto mt-10 max-w-md space-y-4 border-y border-black/10 py-6 text-left">
      {[
        ["제작 상담", "품목 · 수량 · 원단 · 예산을 함께 정리합니다."],
        ["견적 전달", "패턴 · 샘플 · 생산 단가를 포함한 견적을 보내드립니다."],
        ["샘플 · 생산", "계약 후 샘플로 핏을 확인하고 본생산을 진행합니다."],
      ].map(([title, body], index) => (
        <li key={title} className="grid grid-cols-[2rem_1fr] gap-2">
          <span className="font-display text-xs font-semibold text-brand">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <p className="text-[15px] font-semibold">{title}</p>
            <p className="mt-0.5 text-[13px] leading-5 text-stone-500">{body}</p>
          </div>
        </li>
      ))}
    </ol>
    <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-6">
      <Link to="/" className="cta-primary w-full sm:w-auto">홈으로 <ArrowRight className="h-4 w-4" /></Link>
      <Link to="/portfolio" className="cta-text"><span className="link-draw">제작 포트폴리오 보기</span> <ArrowRight className="h-4 w-4" /></Link>
    </div>
  </div>
);

export default ProductionRequest;
