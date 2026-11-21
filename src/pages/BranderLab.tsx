import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowDown, ArrowRight, Check, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { LabConsentPanel, emptyLabConsents, type LabConsentState } from "@/components/lab/LabConsentPanel";
import { LabImagePicker, type LabPickedImage } from "@/components/lab/LabImagePicker";
import { cn } from "@/lib/utils";
import { LabSubmitError, submitLabApplication, type LabSubmitResult } from "@/services/labApplications";
import {
  LAB_CONSENT_DOCUMENTS, LAB_CONTACT, LAB_GARMENT_TYPES, LAB_LIMITS, LAB_SIZES, formatLabPhone, validateLabApplication,
  type LabApplicationField, type LabApplicationInput,
} from "../../supabase/functions/_shared/labApplication";

const newSubmissionKey = () => {
  const webCrypto: Crypto | undefined = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") return webCrypto.randomUUID();
  // randomUUID 가 없는 오래된 브라우저용 v4 UUID
  const bytes = new Uint8Array(16);
  if (webCrypto?.getRandomValues) webCrypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const emptyInput: LabApplicationInput = {
  applicantName: "", phone: "", email: "", instagramId: "", garmentTypes: [], garmentTypeOther: "",
  designDescription: "", size: "", sizeOther: "", reason: "",
};

const FIELD_LABEL: Record<LabApplicationField, string> = {
  applicantName: "이름 또는 닉네임", phone: "연락처", email: "이메일", instagramId: "인스타그램 아이디",
  garmentTypes: "의류 종류", garmentTypeOther: "기타 의류 종류", designDescription: "디자인 설명",
  size: "희망 사이즈", sizeOther: "기타 사이즈", reason: "제작 이유",
};

const PROCESS = [
  { title: "신청", body: "만들고 싶은 옷의 종류와 디자인, 참고 이미지를 보내주세요. 신청 비용은 없습니다." },
  { title: "검토 · 선정", body: "브랜더 팀이 모든 신청서를 검토해 제작할 디자인을 선정하고, 선정된 분께만 개별 연락드립니다." },
  { title: "일정 · 촬영 안내", body: "제작 · 촬영 일정을 협의하고, 촬영 범위와 게시 방법을 구체적으로 안내한 뒤 별도 동의를 받습니다." },
  { title: "샘플 제작", body: "디자인을 바탕으로 원단 선택부터 패턴, 프린팅 · 자수까지 실제 의류 샘플을 무료로 제작합니다." },
  { title: "전달 · 콘텐츠 공개", body: "완성된 옷을 전달하고, 제작 과정과 완성품을 브랜더 인스타그램 릴스로 소개합니다." },
];

const FACTS = [
  ["선정자 무료 제작", "선정된 분께 의류 샘플 1벌을 무료로 제작해드립니다."],
  ["결제 없음", "신청부터 제작까지 별도 비용이 발생하지 않습니다."],
  ["개별 안내", "선정 여부와 일정은 브랜더가 개별로 연락드립니다."],
] as const;

const SectionTitle = ({ index, title, description }: { index: string; title: string; description?: string }) => (
  <div className="border-t border-[#211b1c] pt-5">
    <p className="font-display text-[12px] font-semibold tracking-[0.2em] text-brand">{index}</p>
    <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[#211b1c] sm:text-[26px]">{title}</h2>
    {description && <p className="mt-2 max-w-2xl text-[14px] leading-6 text-stone-600">{description}</p>}
  </div>
);

const Field = ({ label, required, htmlFor, hint, error, children, counter }: {
  label: string; required?: boolean; htmlFor?: string; hint?: ReactNode; error?: string; children: ReactNode; counter?: string;
}) => (
  <div>
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-[14px] font-semibold text-[#211b1c]">
        {label}
        <span className={cn("ml-1.5 text-[12px] font-medium", required ? "text-brand" : "text-stone-400")}>{required ? "필수" : "선택"}</span>
      </label>
      {counter && <span className="font-display text-[11px] tabular-nums text-stone-400">{counter}</span>}
    </div>
    {hint && <div className="mt-1 text-[12.5px] leading-5 text-stone-500">{hint}</div>}
    <div className="mt-2">{children}</div>
    {error && <p className="mt-1.5 flex items-start gap-1 text-[12.5px] font-medium text-rose-700" role="alert"><AlertCircle className="mt-[3px] h-3.5 w-3.5 shrink-0" />{error}</p>}
  </div>
);

const inputClass = (invalid?: boolean) => cn(
  "block w-full rounded-[2px] border bg-white px-3.5 text-[16px] text-[#211b1c] placeholder:text-stone-400 transition focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:bg-stone-100",
  invalid ? "border-rose-400 focus:border-rose-500" : "border-black/15 focus:border-brand",
);

const Chip = ({ selected, onClick, children, role, disabled }: { selected: boolean; onClick: () => void; children: ReactNode; role: "checkbox" | "radio"; disabled?: boolean }) => (
  <button
    type="button"
    role={role}
    aria-checked={selected}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[2px] border px-3.5 text-[14px] font-medium transition disabled:opacity-60",
      selected ? "border-[#211b1c] bg-[#211b1c] text-white" : "border-black/15 bg-white text-stone-700 hover:border-[#211b1c]",
    )}
  >
    {selected && role === "checkbox" && <Check className="h-3.5 w-3.5" strokeWidth={2.6} />}
    {children}
  </button>
);

const Complete = ({ result }: { result: LabSubmitResult }) => (
  <section className="page-shell py-16 sm:py-24" aria-live="polite">
    <div className="mx-auto max-w-xl">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white"><Check className="h-7 w-7" strokeWidth={2.4} /></span>
      <p className="eyebrow mt-8">BRAND-ER LAB</p>
      <h1 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.035em] text-[#211b1c] sm:text-[38px]">신청이 완료되었습니다!</h1>
      <div className="mt-6 space-y-3 text-[15px] leading-7 text-stone-700">
        <p>브랜더 LAB 무료 의류 제작 프로젝트에 관심을 가져주셔서 감사합니다.</p>
        <p>신청 내용을 검토한 후 선정된 분께 개별 연락드릴 예정입니다.</p>
        <p className="text-[14px] font-medium text-brand">※ 신청이 곧 무료 제작 확정을 의미하지는 않습니다.</p>
      </div>
      <dl className="mt-8 grid grid-cols-[6.5rem_1fr] gap-y-2 border-y border-black/10 py-5 text-[14px]">
        <dt className="text-stone-500">접수 번호</dt>
        <dd className="font-display font-semibold tracking-[0.02em] text-[#211b1c]">{result.applicationNo}</dd>
        <dt className="text-stone-500">접수 일시</dt>
        <dd className="text-[#211b1c]">{new Date(result.createdAt).toLocaleString("ko-KR", { dateStyle: "long", timeStyle: "short" })}</dd>
      </dl>
      <p className="mt-5 text-[13px] leading-6 text-stone-500">
        신청 내용 변경 · 취소, 개인정보 삭제, 촬영물 이용 동의 철회는 접수 번호와 함께 문의해주세요.
        <br />
        개인정보책임자 {LAB_CONTACT.privacyOfficer} · <a className="underline underline-offset-4" href={`mailto:${LAB_CONTACT.email}`}>{LAB_CONTACT.email}</a> · <a className="underline underline-offset-4" href={`tel:${LAB_CONTACT.phone.replace(/-/g, "")}`}>{LAB_CONTACT.phone}</a>
      </p>
      <Link to="/" className="cta-text mt-8"><span className="link-draw">BRAND-ER 홈으로</span> <ArrowRight className="h-4 w-4" /></Link>
    </div>
  </section>
);

/** BRAND-ER LAB 무료 의류 제작 신청 (/lab). 비회원도 신청할 수 있다. */
const BranderLab = () => {
  const [input, setInput] = useState<LabApplicationInput>(emptyInput);
  const [touched, setTouched] = useState<Partial<Record<LabApplicationField, boolean>>>({});
  const [images, setImages] = useState<LabPickedImage[]>([]);
  const [consents, setConsents] = useState<LabConsentState>(emptyLabConsents);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Partial<Record<LabApplicationField, string>>>({});
  const [result, setResult] = useState<LabSubmitResult | null>(null);
  // 신청서 하나에 고정된 키. 응답을 놓쳐 다시 보내도 서버가 한 건으로 처리한다.
  const submissionKey = useRef(newSubmissionKey());
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { document.title = "무료 의류 제작 신청 | BRAND-ER LAB"; }, []);
  useEffect(() => { if (result) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, [result]);

  const validation = useMemo(() => validateLabApplication(input), [input]);
  const missingConsents = LAB_CONSENT_DOCUMENTS.filter((doc) => doc.required && !consents[doc.key]);
  const canSubmit = validation.ok && missingConsents.length === 0 && !submitting;

  const errorFor = (field: LabApplicationField) => serverErrors[field] ?? ((touched[field] || attempted) ? validation.errors[field] : undefined);
  const set = <K extends LabApplicationField>(field: K, value: LabApplicationInput[K]) => {
    setInput((current) => ({ ...current, [field]: value }));
    setServerErrors((current) => { if (!current[field]) return current; const next = { ...current }; delete next[field]; return next; });
  };
  const touch = (field: LabApplicationField) => () => setTouched((current) => ({ ...current, [field]: true }));

  const toggleGarment = (value: string) => {
    set("garmentTypes", input.garmentTypes.includes(value) ? input.garmentTypes.filter((item) => item !== value) : [...input.garmentTypes, value]);
    setTouched((current) => ({ ...current, garmentTypes: true }));
  };

  const pending = [
    ...(Object.keys(validation.errors) as LabApplicationField[]).map((field) => FIELD_LABEL[field]),
    ...(missingConsents.length ? [`필수 동의 ${missingConsents.length}개`] : []),
  ];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!validation.ok || missingConsents.length > 0 || submitting) {
      formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await submitLabApplication({ submissionKey: submissionKey.current, input, consents, images: images.map((image) => image.file) });
      setResult(response);
    } catch (error) {
      if (error instanceof LabSubmitError) {
        setSubmitError(error.message);
        if (error.fields) setServerErrors(error.fields);
      } else {
        setSubmitError("신청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting;

  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#211b1c]">
      <Header />
      <main className="pt-16 sm:pt-[72px]">
        {result ? <Complete result={result} /> : (
          <>
            {/* 1. 프로젝트 소개 */}
            <section className="page-shell pb-14 pt-12 sm:pb-20 sm:pt-20 lg:pt-28">
              <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
                <div className="lg:col-span-7">
                  <p className="eyebrow">BRAND-ER LAB · 무료 의류 제작 프로젝트</p>
                  <h1 className="display-hero mt-5 max-w-[13ch] text-[#1f191a]">
                    상상하던 옷,<br />브랜더가<br />만들어드립니다<span className="text-brand">.</span>
                  </h1>
                </div>
                <div className="lg:col-span-4 lg:col-start-9">
                  <p className="text-[15px] leading-7 text-stone-600 sm:text-base sm:leading-8">
                    평소 만들고 싶었던 옷이 있으신가요? 원하는 디자인을 알려주세요. 선정된 분께 브랜더가 무료로 의류 샘플을 제작해드립니다.
                  </p>
                  <a href="#apply" className="cta-primary mt-7 w-full sm:w-auto">무료 제작 신청하기 <ArrowDown className="h-4 w-4" /></a>
                </div>
              </div>
              <ul className="mt-14 grid gap-px overflow-hidden border-y border-black/10 sm:grid-cols-3">
                {FACTS.map(([title, body]) => (
                  <li key={title} className="py-5 sm:px-6 sm:first:pl-0">
                    <p className="text-[15px] font-semibold">{title}</p>
                    <p className="mt-1 text-[13px] leading-6 text-stone-500">{body}</p>
                  </li>
                ))}
              </ul>
            </section>

            {/* 2. 무료 제작 진행 방식 */}
            <section className="bg-[#ece7e0] py-14 sm:py-20">
              <div className="page-shell">
                <p className="eyebrow">How it works</p>
                <h2 className="display-section mt-4">무료 제작 진행 방식</h2>
                <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
                  {PROCESS.map((step, index) => (
                    <li key={step.title} className="border-t border-black/15 pt-4">
                      <span className="font-display text-xs font-semibold text-brand">{String(index + 1).padStart(2, "0")}</span>
                      <h3 className="mt-2 text-[16px] font-semibold">{step.title}</h3>
                      <p className="mt-1.5 text-[13.5px] leading-6 text-stone-600">{step.body}</p>
                    </li>
                  ))}
                </ol>
                <ul className="mt-10 space-y-1.5 text-[13px] leading-6 text-stone-600">
                  <li>· 무료 제작은 신청자 전원이 아닌 <b className="font-semibold text-[#211b1c]">선정된 참여자</b>에게 제공됩니다. 선정 여부와 제작 일정은 브랜더가 개별 안내합니다.</li>
                  <li>· 신청 시 별도 결제는 발생하지 않습니다.</li>
                  <li>· 신청자의 개인정보는 공개 페이지에 노출하지 않으며, 인스타그램 아이디로 자동 태그하거나 공개하지 않습니다.</li>
                </ul>
              </div>
            </section>

            <form ref={formRef} id="apply" onSubmit={handleSubmit} noValidate className="page-shell scroll-mt-20 py-14 sm:py-20">
              <div className="mx-auto max-w-3xl space-y-14 sm:space-y-16">
                {/* 3. 신청자 기본 정보 */}
                <section className="space-y-6">
                  <SectionTitle index="01" title="신청자 정보" description="선정 결과와 일정 안내를 위해 연락드릴 정보입니다. 공개되지 않습니다." />
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label="이름 또는 닉네임" required htmlFor="lab-name" error={errorFor("applicantName")}>
                      <input id="lab-name" className={cn(inputClass(Boolean(errorFor("applicantName"))), "h-12")} value={input.applicantName} maxLength={LAB_LIMITS.nameMax}
                        autoComplete="name" onChange={(e) => set("applicantName", e.target.value)} onBlur={touch("applicantName")} aria-invalid={Boolean(errorFor("applicantName"))} disabled={disabled} />
                    </Field>
                    <Field label="연락처" required htmlFor="lab-phone" error={errorFor("phone")}>
                      <input id="lab-phone" type="tel" inputMode="numeric" placeholder="010-1234-5678" className={cn(inputClass(Boolean(errorFor("phone"))), "h-12")} value={input.phone} maxLength={16}
                        autoComplete="tel" onChange={(e) => set("phone", e.target.value)} onBlur={() => { touch("phone")(); set("phone", formatLabPhone(input.phone)); }} aria-invalid={Boolean(errorFor("phone"))} disabled={disabled} />
                    </Field>
                    <Field label="이메일 주소" htmlFor="lab-email" error={errorFor("email")}>
                      <input id="lab-email" type="email" inputMode="email" placeholder="name@example.com" className={cn(inputClass(Boolean(errorFor("email"))), "h-12")} value={input.email} maxLength={LAB_LIMITS.emailMax}
                        autoComplete="email" onChange={(e) => set("email", e.target.value)} onBlur={touch("email")} aria-invalid={Boolean(errorFor("email"))} disabled={disabled} />
                    </Field>
                    <Field label="인스타그램 아이디" required htmlFor="lab-instagram" error={errorFor("instagramId")} hint="@ 없이 입력해도 됩니다. 자동 태그 · 공개에 사용하지 않습니다.">
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[16px] text-stone-400">@</span>
                        <input id="lab-instagram" placeholder="instagram_id" className={cn(inputClass(Boolean(errorFor("instagramId"))), "h-12 pl-8")} value={input.instagramId} maxLength={80}
                          autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => set("instagramId", e.target.value)} onBlur={touch("instagramId")} aria-invalid={Boolean(errorFor("instagramId"))} disabled={disabled} />
                      </div>
                    </Field>
                  </div>
                </section>

                {/* 4. 희망 의류 및 디자인 */}
                <section className="space-y-7">
                  <SectionTitle index="02" title="만들고 싶은 옷" description="떠올린 옷을 최대한 자세히 들려주세요. 브랜더 팀이 실제 제작 가능 여부와 함께 검토합니다." />
                  <Field label="어떤 종류의 옷을 제작하고 싶으신가요?" required error={errorFor("garmentTypes")} hint="여러 개를 고를 수 있습니다.">
                    <div role="group" aria-label="의류 종류" className="flex flex-wrap gap-2" aria-invalid={Boolean(errorFor("garmentTypes"))} tabIndex={-1}>
                      {LAB_GARMENT_TYPES.map((item) => (
                        <Chip key={item.value} role="checkbox" selected={input.garmentTypes.includes(item.value)} onClick={() => toggleGarment(item.value)} disabled={disabled}>{item.label}</Chip>
                      ))}
                    </div>
                  </Field>
                  {input.garmentTypes.includes("other") && (
                    <Field label="기타 의류 종류" required htmlFor="lab-garment-other" error={errorFor("garmentTypeOther")}>
                      <input id="lab-garment-other" placeholder="예: 조끼, 원피스, 트레이닝 세트" className={cn(inputClass(Boolean(errorFor("garmentTypeOther"))), "h-12")} value={input.garmentTypeOther} maxLength={LAB_LIMITS.garmentOtherMax}
                        onChange={(e) => set("garmentTypeOther", e.target.value)} onBlur={touch("garmentTypeOther")} aria-invalid={Boolean(errorFor("garmentTypeOther"))} disabled={disabled} />
                    </Field>
                  )}
                  <Field label="어떤 디자인의 옷을 원하시나요?" required htmlFor="lab-design" error={errorFor("designDescription")}
                    counter={`${Array.from(input.designDescription).length.toLocaleString("ko-KR")}/${LAB_LIMITS.designMax.toLocaleString("ko-KR")}`}
                    hint="원하는 색상, 핏, 소재, 프린팅, 자수, 디자인 등을 자유롭게 설명해주세요.">
                    <textarea id="lab-design" rows={6} className={cn(inputClass(Boolean(errorFor("designDescription"))), "resize-y py-3 leading-7")} value={input.designDescription} maxLength={LAB_LIMITS.designMax}
                      placeholder="예: 검은색 오버핏 후드티에 등판에는 큰 그래픽을 넣고, 앞면에는 작은 자수를 넣고 싶어요."
                      onChange={(e) => set("designDescription", e.target.value)} onBlur={touch("designDescription")} aria-invalid={Boolean(errorFor("designDescription"))} disabled={disabled} />
                  </Field>
                  <Field label="희망 의류 사이즈" required error={errorFor("size")}>
                    <div role="radiogroup" aria-label="희망 사이즈" className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap" aria-invalid={Boolean(errorFor("size"))} tabIndex={-1}>
                      {LAB_SIZES.map((item) => (
                        <Chip key={item.value} role="radio" selected={input.size === item.value} onClick={() => { set("size", item.value); setTouched((c) => ({ ...c, size: true })); }} disabled={disabled}>
                          <span className="font-display">{item.label}</span>
                        </Chip>
                      ))}
                    </div>
                  </Field>
                  {input.size === "OTHER" && (
                    <Field label="희망 사이즈 직접 입력" required htmlFor="lab-size-other" error={errorFor("sizeOther")}>
                      <input id="lab-size-other" placeholder="예: 3XL, 키 182cm · 몸무게 80kg, 허리 32인치" className={cn(inputClass(Boolean(errorFor("sizeOther"))), "h-12")} value={input.sizeOther} maxLength={LAB_LIMITS.sizeOtherMax}
                        onChange={(e) => set("sizeOther", e.target.value)} onBlur={touch("sizeOther")} aria-invalid={Boolean(errorFor("sizeOther"))} disabled={disabled} />
                    </Field>
                  )}
                  <Field label="제작하고 싶은 이유" htmlFor="lab-reason" error={errorFor("reason")}
                    counter={`${Array.from(input.reason).length.toLocaleString("ko-KR")}/${LAB_LIMITS.reasonMax.toLocaleString("ko-KR")}`}>
                    <textarea id="lab-reason" rows={3} className={cn(inputClass(Boolean(errorFor("reason"))), "resize-y py-3 leading-7")} value={input.reason} maxLength={LAB_LIMITS.reasonMax}
                      placeholder="예: 평소 마음에 드는 디자인을 찾지 못해서 직접 만들어보고 싶었습니다."
                      onChange={(e) => set("reason", e.target.value)} onBlur={touch("reason")} aria-invalid={Boolean(errorFor("reason"))} disabled={disabled} />
                  </Field>
                </section>

                {/* 5. 참고 이미지 업로드 */}
                <section className="space-y-5">
                  <SectionTitle index="03" title="참고 이미지" description="스케치, 원하는 분위기의 사진, 그래픽 시안 등을 올려주세요. 선택 항목입니다." />
                  <Field label="참고 이미지 업로드" hint={`JPG · PNG · WEBP, 최대 ${LAB_LIMITS.maxImages}장 · 이미지당 10MB 이하. 사진의 위치 정보(GPS)는 업로드 전에 지워집니다.`}>
                    <LabImagePicker images={images} onChange={setImages} disabled={disabled} />
                  </Field>
                  <div className="border-l-2 border-brand/40 bg-white/60 px-4 py-3 text-[12.5px] leading-6 text-stone-600">
                    <p className="font-semibold text-[#211b1c]">디자인 · 이미지 권리 안내</p>
                    <p className="mt-1">신청하신 디자인과 참고 이미지는 본인이 직접 만들었거나 사용할 권리가 있는 자료여야 합니다. 참고 이미지는 제작 검토용으로만 쓰이며 신청자 동의 없이 공개하지 않습니다.</p>
                    <p className="mt-1">타인의 저작권 · 상표권(브랜드 로고, 캐릭터, 연예인 · 타인 사진, 다른 브랜드 디자인 복제 등)을 침해할 수 있는 디자인은 선정에서 제외되거나, 제작이 제한 · 수정될 수 있습니다.</p>
                  </div>
                </section>

                {/* 6. 촬영 · 게시 및 개인정보 동의 */}
                <section className="space-y-5">
                  <SectionTitle index="04" title="촬영 · 게시 및 개인정보 동의" />
                  <p className="text-[14px] leading-7 text-stone-700">
                    본 프로젝트는 브랜더가 선정된 신청자의 의류 디자인을 실제 샘플로 제작하고, 그 과정과 결과물을 인스타그램 릴스 등 브랜드 콘텐츠로 소개하는 프로젝트입니다.
                    선정된 신청자에게는 촬영 및 제작 일정 등을 개별 안내드립니다.
                  </p>
                  <LabConsentPanel value={consents} onChange={setConsents} disabled={disabled} showErrors={attempted} />
                  <p className="text-[12.5px] leading-6 text-stone-500">
                    촬영물 이용 동의 철회, 개인정보 열람 · 정정 · 삭제 요청 및 문의: 개인정보책임자 {LAB_CONTACT.privacyOfficer} ·{" "}
                    <a className="underline underline-offset-4 hover:text-brand" href={`mailto:${LAB_CONTACT.email}`}>{LAB_CONTACT.email}</a> ·{" "}
                    <a className="underline underline-offset-4 hover:text-brand" href={`tel:${LAB_CONTACT.phone.replace(/-/g, "")}`}>{LAB_CONTACT.phone}</a>
                  </p>
                </section>

                {/* 7. 신청 버튼 */}
                <section className="border-t border-[#211b1c] pt-8">
                  {submitError && (
                    <div className="mb-5 flex items-start gap-2 border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] leading-6 text-rose-800" role="alert">
                      <AlertCircle className="mt-1 h-4 w-4 shrink-0" />{submitError}
                    </div>
                  )}
                  <button type="submit" disabled={!canSubmit} aria-disabled={!canSubmit}
                    className="cta-primary w-full text-[16px] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 sm:w-auto sm:min-w-[320px]">
                    {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />신청서를 보내는 중...</> : <>무료 의류 제작 신청하기 <ArrowRight className="h-4 w-4" /></>}
                  </button>
                  {!canSubmit && !submitting && pending.length > 0 && (
                    <p className="mt-3 text-[13px] leading-6 text-stone-500">남은 항목: {pending.join(" · ")}</p>
                  )}
                  <p className="mt-3 text-[12.5px] leading-6 text-stone-400">신청은 무료이며 결제가 발생하지 않습니다. 신청이 곧 무료 제작 확정을 의미하지는 않습니다.</p>
                </section>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
};

export default BranderLab;
