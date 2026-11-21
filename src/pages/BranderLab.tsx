import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertCircle, ArrowDown, ArrowRight, BookOpen, Check, Loader2, Lock, PenTool, Shirt } from "lucide-react";
import { Header } from "@/components/Header";
import { LabConsentPanel, emptyLabConsents, type LabConsentState } from "@/components/lab/LabConsentPanel";
import { LabImagePicker, type LabPickedImage } from "@/components/lab/LabImagePicker";
import { LabKnowledgeSection } from "@/components/lab/LabKnowledgeSection";
import { LAB_STEPS } from "@/components/lab/labContent";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useMobileStickyCtaOffset } from "@/hooks/useMobileStickyCtaOffset";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { LabSubmitError, submitLabApplication, type LabSubmitResult } from "@/services/labApplications";
import { getAppPath, getAppUrl } from "@/utils/appUrl";
import {
  LAB_CONSENT_DOCUMENTS, LAB_CONTACT, LAB_FUTURE_PRODUCTION, LAB_GARMENT_TYPES, LAB_LIMITS, LAB_PURPOSES, formatLabPhone, validateLabApplication,
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
  designDescription: "", size: "", sizeOther: "", purpose: "", reason: "", futureProduction: "",
};

const FIELD_LABEL: Record<LabApplicationField, string> = {
  applicantName: "이름", phone: "연락처", email: "이메일", instagramId: "인스타그램 아이디",
  garmentTypes: "의류 종류", garmentTypeOther: "기타 의류 종류", designDescription: "의류 설명",
  size: "희망 사이즈", sizeOther: "기타 사이즈", purpose: "제작 목적", reason: "제작 목적 상세", futureProduction: "추가 생산 의향",
};

const LOGO_720 = getAppPath("/lab/brander-lab-logo-720.webp");
const LOGO_1254 = getAppPath("/lab/brander-lab-logo-1254.webp");

const PILLARS = [
  { key: "LEARN", title: "옷에 대해 배우다", body: "원단, GSM, 봉제, 프린팅, 샘플 제작까지. 옷을 만드는 지식을 쉽고 재미있게 나눕니다.", icon: BookOpen },
  { key: "CREATE", title: "아이디어를 디자인하다", body: "머릿속에만 있던 옷을 함께 구체화합니다. 디자인을 배운 적이 없어도 괜찮습니다.", icon: PenTool },
  { key: "MAKE", title: "실제 의류로 제작하다", body: "브랜더의 제작 공정으로 아이디어를 실제 샘플로 만들어 손에 쥘 수 있게 합니다.", icon: Shirt },
] as const;

const scrollToId = (id: string) => (event?: { preventDefault: () => void }) => {
  event?.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

// ---------------------------------------------------------------------------
// 폼 부품
// ---------------------------------------------------------------------------

const FormGroupTitle = ({ index, title, description }: { index: string; title: string; description?: string }) => (
  <div className="border-t-2 border-lab pt-5">
    <p className="font-display text-[12px] font-bold tracking-[0.2em] text-lab">{index}</p>
    <h3 className="mt-2 text-[22px] font-bold tracking-[-0.03em] text-[#211b1c] sm:text-[26px]">{title}</h3>
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
        <span className={cn("ml-1.5 text-[12px] font-medium", required ? "text-lab" : "text-stone-400")}>{required ? "필수" : "선택"}</span>
      </label>
      {counter && <span className="font-display text-[11px] tabular-nums text-stone-400">{counter}</span>}
    </div>
    {hint && <div className="mt-1 text-[12.5px] leading-5 text-stone-500">{hint}</div>}
    <div className="mt-2">{children}</div>
    {error && <p className="mt-1.5 flex items-start gap-1 text-[12.5px] font-medium text-rose-700" role="alert"><AlertCircle className="mt-[3px] h-3.5 w-3.5 shrink-0" />{error}</p>}
  </div>
);

const inputClass = (invalid?: boolean) => cn(
  "block w-full rounded-[10px] border bg-white px-3.5 text-[16px] text-[#211b1c] placeholder:text-stone-400 transition focus:outline-none focus:ring-2 focus:ring-lab/20 disabled:bg-stone-100",
  invalid ? "border-rose-400 focus:border-rose-500" : "border-black/15 focus:border-lab",
);

const Chip = ({ selected, onClick, children, role, disabled }: { selected: boolean; onClick: () => void; children: ReactNode; role: "checkbox" | "radio"; disabled?: boolean }) => (
  <button
    type="button"
    role={role}
    aria-checked={selected}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border px-4 text-[14px] font-medium transition disabled:opacity-60",
      selected ? "border-lab bg-lab text-white" : "border-black/15 bg-white text-stone-700 hover:border-lab hover:text-lab",
    )}
  >
    {selected && <Check className="h-3.5 w-3.5" strokeWidth={2.6} />}
    {children}
  </button>
);

/** 무료 샘플 제작 신청 버튼(페이지 곳곳에서 같은 모양). */
const ApplyButton = ({ tone = "lab", className, onClick }: { tone?: "lab" | "light"; className?: string; onClick: (event: { preventDefault: () => void }) => void }) => (
  <a
    href="#apply"
    onClick={onClick}
    className={cn(
      "group inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full px-7 text-[15px] font-bold transition",
      tone === "lab" ? "bg-lab text-white hover:bg-lab-dark" : "bg-white text-lab hover:bg-lab-soft",
      className,
    )}
  >
    무료 샘플 제작 신청하기 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
  </a>
);

const APPLY_RETURN_TO = encodeURIComponent("/lab/apply");

/** 비로그인 방문자에게 신청서 대신 보여준다. 로그인 · 회원가입 후 신청서(/lab/apply)로 돌아온다. */
const LoginGate = () => (
  <div className="flex flex-col items-center px-2 py-10 text-center sm:py-14">
    <span className="lab-stitch-card lab-stitch-light flex h-16 w-16 items-center justify-center rounded-[16px] bg-lab text-white"><Lock className="h-7 w-7" strokeWidth={1.6} /></span>
    <h3 className="mt-6 text-[22px] font-bold tracking-[-0.03em] sm:text-[26px]">로그인 후 신청할 수 있어요</h3>
    <p className="mt-3 max-w-md text-[14.5px] leading-7 text-stone-600">
      BRAND-ER LAB 무료 샘플 제작은 BRAND-ER 회원을 대상으로 진행합니다.<br className="hidden sm:inline" />
      로그인하면 이 신청서로 바로 돌아옵니다.
    </p>
    <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
      <Link to={`/auth?mode=login&returnTo=${APPLY_RETURN_TO}`}
        className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-lab px-8 text-[15px] font-bold text-white transition hover:bg-lab-dark">
        로그인하고 신청하기 <ArrowRight className="h-4 w-4" />
      </Link>
      <Link to={`/auth?mode=signup&returnTo=${APPLY_RETURN_TO}`}
        className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-lab/30 px-8 text-[15px] font-bold text-lab transition hover:border-lab hover:bg-lab-soft">
        회원가입
      </Link>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// 신청 완료
// ---------------------------------------------------------------------------

const Complete = ({ result }: { result: LabSubmitResult }) => (
  <section className="page-shell py-16 sm:py-24" aria-live="polite">
    <div className="mx-auto max-w-xl">
      <img src={LOGO_720} alt="BRAND-ER LAB" width={720} height={720} className="h-28 w-28 rounded-2xl object-cover" />
      <p className="eyebrow mt-8 text-lab">BRAND-ER LAB</p>
      <h1 className="mt-3 text-[28px] font-bold leading-tight tracking-[-0.035em] text-[#211b1c] sm:text-[36px]">
        브랜더 LAB 무료 샘플 제작 신청이 완료되었습니다.
      </h1>
      <p className="mt-5 text-[15px] leading-7 text-stone-700">신청 내용을 검토한 후 선정 대상자에게 개별 연락드리겠습니다.</p>
      <p className="mt-2 text-[13.5px] font-medium text-lab">※ 신청이 곧 무료 샘플 제작 확정을 의미하지는 않습니다.</p>
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
      <div className="mt-8 flex flex-wrap gap-x-6">
        <Link to="/" className="cta-text"><span className="link-draw">BRAND-ER 홈으로</span> <ArrowRight className="h-4 w-4" /></Link>
        <Link to="/portfolio" className="cta-text"><span className="link-draw">제작 포트폴리오 보기</span> <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// 페이지
// ---------------------------------------------------------------------------

/**
 * BRAND-ER LAB (/lab, 별칭 /brander-lab).
 * BRAND-ER 안에서 운영하는 패션 콘텐츠 · 의류 제작 실험 프로젝트 페이지. 공통 헤더 · 푸터를 그대로 쓰고,
 * 무료 샘플 제작 신청은 일반 제작 문의와 따로 lab_applications 에 저장된다. 신청은 로그인한 회원만 할 수 있다
 * (소개 · 지식 콘텐츠는 누구나 볼 수 있고, 비로그인 방문자에게는 신청서 자리에 로그인 안내가 나온다).
 */
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
  const [formVisible, setFormVisible] = useState(false);
  // undefined: 확인 중, null: 비로그인
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  // 신청서 하나에 고정된 키. 응답을 놓쳐 다시 보내도 서버가 한 건으로 처리한다.
  const submissionKey = useRef(newSubmissionKey());
  const formRef = useRef<HTMLFormElement>(null);
  const applyRef = useRef<HTMLElement>(null);
  const stickyCtaRef = useMobileStickyCtaOffset();

  useDocumentMeta({
    title: "BRAND-ER LAB | 당신의 상상이 옷이 되는 실험실",
    description: "의류 제작 전문 기업 BRAND-ER가 운영하는 패션 프로젝트. 옷에 관한 지식을 나누고, 선정된 신청자의 아이디어를 무료 의류 샘플로 제작합니다.",
    image: getAppUrl("/lab/brander-lab-logo-1254.webp"),
    url: getAppUrl("/lab"),
  });

  // 로그인 상태. 로그인하면 계정 이메일을 신청서 이메일 칸에 미리 채운다(비어 있을 때만).
  useEffect(() => {
    let active = true;
    const apply = (session: { user: { id: string; email?: string | null } } | null) => {
      if (!active) return;
      setUserId(session?.user.id ?? null);
      const email = session?.user.email;
      if (email) setInput((current) => (current.email ? current : { ...current, email }));
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  // 바로가기 링크(/lab/apply, /lab#apply)로 들어오면 소개를 건너뛰고 신청서 위치에서 시작한다.
  const location = useLocation();
  const directToForm = location.pathname.replace(/\/$/, "").endsWith("/apply") || location.hash === "#apply";
  useEffect(() => {
    if (!directToForm) return;
    const frame = window.requestAnimationFrame(() => {
      applyRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [directToForm, userId]);
  useEffect(() => { if (result) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, [result]);

  // 신청서가 화면에 보이는 동안에는 모바일 고정 신청 버튼을 숨긴다.
  useEffect(() => {
    const form = applyRef.current;
    if (!form || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), { rootMargin: "0px 0px -15% 0px" });
    observer.observe(form);
    return () => observer.disconnect();
  }, [result]);

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
  const goApply = scrollToId("apply");

  return (
    <div className="min-h-screen bg-white text-[#211b1c]">
      <Header />
      <main className="pt-16 sm:pt-[72px]">
        {result ? <Complete result={result} /> : (
          <>
            {/* SECTION 01 — 메인 화면 */}
            <section aria-labelledby="lab-hero-title" className="overflow-hidden bg-white">
              <div className="page-shell grid items-center gap-6 pb-14 pt-6 sm:pb-20 lg:grid-cols-12 lg:gap-10 lg:pb-24 lg:pt-10">
                <div className="mx-auto w-full max-w-[560px] lg:col-span-6 lg:max-w-none">
                  <img
                    src={LOGO_720}
                    srcSet={`${LOGO_720} 720w, ${LOGO_1254} 1254w`}
                    sizes="(min-width: 1024px) 46vw, 92vw"
                    width={1254}
                    height={1254}
                    alt="BRAND-ER LAB — 버건디 원단 질감에 봉제선이 들어간 로고"
                    fetchPriority="high"
                    decoding="async"
                    className="h-auto w-full select-none"
                    draggable={false}
                  />
                </div>
                <div className="lg:col-span-6 lg:pl-4">
                  <p className="eyebrow text-lab">BRAND-ER LAB · Fashion Lab Project</p>
                  <h1 id="lab-hero-title" className="mt-5 text-[clamp(2.2rem,5vw,4.4rem)] font-extrabold leading-[1.08] tracking-[-0.045em] text-[#1f191a]">
                    당신의 상상이<br />옷이 되는 실험실<span className="text-lab">.</span>
                  </h1>
                  <p className="mt-6 max-w-md text-[16px] leading-8 text-stone-600 sm:text-[17px]">
                    옷에 관한 모든 궁금증부터,<br />당신이 상상한 옷을 실제로 만드는 순간까지.
                  </p>
                  <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                    <ApplyButton onClick={goApply} />
                    <a href="#about" onClick={scrollToId("about")}
                      className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full border border-lab/30 px-7 text-[15px] font-bold text-lab transition hover:border-lab hover:bg-lab-soft">
                      BRAND-ER LAB 소개 <ArrowDown className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 02 — 브랜더 LAB 소개 */}
            <section id="about" aria-labelledby="lab-about-title" className="scroll-mt-20 bg-[#f4f2f1] py-16 sm:py-24">
              <div className="page-shell">
                <div className="grid gap-8 lg:grid-cols-12">
                  <div className="lg:col-span-6">
                    <p className="eyebrow text-lab">02 · About</p>
                    <h2 id="lab-about-title" className="mt-4 font-display text-[clamp(2rem,4.4vw,3.6rem)] font-extrabold leading-none tracking-[-0.04em] text-lab">WHAT IS<br />BRAND-ER LAB?</h2>
                  </div>
                  <div className="space-y-4 text-[16px] leading-8 text-stone-700 lg:col-span-5 lg:col-start-8 lg:pt-10">
                    <p>브랜더 LAB은 의류 제작 전문 기업 <b className="font-semibold text-[#211b1c]">BRAND-ER</b>가 운영하는 패션 프로젝트입니다.</p>
                    <p>옷에 대한 전문적인 지식을 공유하고, 누구나 자신이 상상한 의류를 실제 제품으로 만들어볼 수 있는 기회를 제공합니다.</p>
                  </div>
                </div>
                <ul className="mt-12 grid gap-3 md:grid-cols-3 md:gap-4">
                  {PILLARS.map(({ key, title, body, icon: Icon }) => (
                    <li key={key} className="lab-stitch-card rounded-[18px] bg-white p-7 sm:p-8">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lab text-white"><Icon className="h-5 w-5" /></span>
                      <p className="mt-8 font-display text-[28px] font-extrabold tracking-[-0.03em] text-lab">{key}</p>
                      <h3 className="mt-1 text-[17px] font-bold">{title}</h3>
                      <p className="mt-3 text-[14px] leading-7 text-stone-600">{body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* SECTION 03 — 무료 샘플 제작 프로젝트 */}
            <section aria-labelledby="lab-project-title" className="bg-white py-16 sm:py-24">
              <div className="page-shell grid gap-10 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-7">
                  <p className="eyebrow text-lab">03 · Free Sample Project</p>
                  <p className="mt-4 font-display text-[clamp(2rem,5vw,4.2rem)] font-extrabold leading-[0.98] tracking-[-0.045em] text-lab">YOUR IDEA,<br />OUR PRODUCTION.</p>
                  <h2 id="lab-project-title" className="mt-6 text-[clamp(1.4rem,2.6vw,2rem)] font-bold tracking-[-0.03em]">당신이 상상한 옷을 만들어드립니다.</h2>
                </div>
                <div className="lg:col-span-5">
                  <div className="space-y-3 text-[16px] leading-8 text-stone-700">
                    <p>평소 만들어보고 싶었던 옷이 있으신가요?<br />디자인을 전문적으로 배운 적이 없어도 괜찮습니다.</p>
                    <p>당신이 생각한 디자인과 아이디어를 알려주세요.<br />브랜더 LAB에서 신청 내용을 검토하고, 선정된 프로젝트의 의류 샘플 제작을 지원합니다.</p>
                  </div>
                  <ApplyButton onClick={goApply} className="mt-8 w-full sm:w-auto" />
                  <ul className="mt-8 grid gap-2 text-[13px] leading-6 text-stone-500">
                    <li className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-lab" />신청 비용 없음 · BRAND-ER 회원 로그인 후 신청</li>
                    <li className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-lab" />선정된 신청자에게 의류 샘플 제작 지원</li>
                    <li className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-lab" />선정 여부와 일정은 개별 안내</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* SECTION 04 — 무료 샘플 제작 신청 폼 */}
            <section ref={applyRef} id="apply" aria-labelledby="lab-apply-title" className="scroll-mt-16 bg-[#f4f2f1] py-16 sm:py-24">
              <div className="page-shell">
                <div className="mx-auto max-w-3xl">
                  <p className="eyebrow text-lab">04 · Apply</p>
                  <h2 id="lab-apply-title" className="mt-4 text-[clamp(1.8rem,3.4vw,2.6rem)] font-extrabold tracking-[-0.04em]">무료 샘플 제작 신청</h2>
                  <p className="mt-3 text-[14.5px] leading-7 text-stone-600">일반 의류 제작 문의는 <Link to="/design-quote" className="font-semibold text-lab underline underline-offset-4">제작 견적</Link>에서 따로 받고 있습니다. 이 신청서는 BRAND-ER LAB 무료 샘플 프로젝트 전용입니다.</p>

                  {userId === undefined ? (
                    <div className="mt-12 flex justify-center rounded-[22px] bg-white py-16"><Loader2 className="h-6 w-6 animate-spin text-lab" aria-label="로그인 상태 확인 중" /></div>
                  ) : userId === null ? (
                    <div className="mt-12 rounded-[22px] bg-white p-5 sm:p-10"><LoginGate /></div>
                  ) : (
                  <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-12 space-y-14 rounded-[22px] bg-white p-5 sm:p-10">
                    {/* 기본 정보 */}
                    <section className="space-y-6">
                      <FormGroupTitle index="STEP 01" title="기본 정보" description="선정 결과와 일정 안내를 위해 연락드릴 정보입니다. 공개되지 않습니다." />
                      <div className="grid gap-6 sm:grid-cols-2">
                        <Field label="이름" required htmlFor="lab-name" error={errorFor("applicantName")}>
                          <input id="lab-name" className={cn(inputClass(Boolean(errorFor("applicantName"))), "h-12")} value={input.applicantName} maxLength={LAB_LIMITS.nameMax}
                            autoComplete="name" onChange={(e) => set("applicantName", e.target.value)} onBlur={touch("applicantName")} aria-invalid={Boolean(errorFor("applicantName"))} disabled={disabled} />
                        </Field>
                        <Field label="연락처" required htmlFor="lab-phone" error={errorFor("phone")}>
                          <input id="lab-phone" type="tel" inputMode="numeric" placeholder="010-1234-5678" className={cn(inputClass(Boolean(errorFor("phone"))), "h-12")} value={input.phone} maxLength={16}
                            autoComplete="tel" onChange={(e) => set("phone", e.target.value)} onBlur={() => { touch("phone")(); set("phone", formatLabPhone(input.phone)); }} aria-invalid={Boolean(errorFor("phone"))} disabled={disabled} />
                        </Field>
                        <Field label="이메일" required htmlFor="lab-email" error={errorFor("email")}>
                          <input id="lab-email" type="email" inputMode="email" placeholder="name@example.com" className={cn(inputClass(Boolean(errorFor("email"))), "h-12")} value={input.email} maxLength={LAB_LIMITS.emailMax}
                            autoComplete="email" onChange={(e) => set("email", e.target.value)} onBlur={touch("email")} aria-invalid={Boolean(errorFor("email"))} disabled={disabled} />
                        </Field>
                        <Field label="인스타그램 아이디" htmlFor="lab-instagram" error={errorFor("instagramId")} hint="@ 없이 입력해도 됩니다. 자동 태그 · 공개에 사용하지 않습니다.">
                          <div className="relative">
                            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[16px] text-stone-400">@</span>
                            <input id="lab-instagram" placeholder="instagram_id" className={cn(inputClass(Boolean(errorFor("instagramId"))), "h-12 pl-8")} value={input.instagramId} maxLength={80}
                              autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => set("instagramId", e.target.value)} onBlur={touch("instagramId")} aria-invalid={Boolean(errorFor("instagramId"))} disabled={disabled} />
                          </div>
                        </Field>
                      </div>
                    </section>

                    {/* 제작 정보 */}
                    <section className="space-y-7">
                      <FormGroupTitle index="STEP 02" title="제작 정보" description="떠올린 옷을 최대한 자세히 들려주세요. BRAND-ER LAB 팀이 실제 제작 가능 여부와 함께 검토합니다." />
                      <Field label="제작하고 싶은 의류 종류" required error={errorFor("garmentTypes")} hint="여러 개를 고를 수 있습니다.">
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
                      <Field label="만들고 싶은 의류 설명" required htmlFor="lab-design" error={errorFor("designDescription")}
                        counter={`${Array.from(input.designDescription).length.toLocaleString("ko-KR")}/${LAB_LIMITS.designMax.toLocaleString("ko-KR")}`}
                        hint="원하는 색상, 핏, 소재, 프린팅, 자수, 디테일 등을 자유롭게 설명해주세요.">
                        <textarea id="lab-design" rows={6} className={cn(inputClass(Boolean(errorFor("designDescription"))), "resize-y py-3 leading-7")} value={input.designDescription} maxLength={LAB_LIMITS.designMax}
                          placeholder="예: 검은색 오버핏 후드티에 등판에는 큰 그래픽을 넣고, 앞면에는 작은 자수를 넣고 싶어요."
                          onChange={(e) => set("designDescription", e.target.value)} onBlur={touch("designDescription")} aria-invalid={Boolean(errorFor("designDescription"))} disabled={disabled} />
                      </Field>
                      <Field label="디자인 참고 이미지 업로드" hint={`스케치, 원하는 분위기의 사진, 그래픽 시안 등. JPG · PNG · WEBP, 최대 ${LAB_LIMITS.maxImages}장 · 이미지당 10MB 이하. 사진의 위치 정보(GPS)는 업로드 전에 지워집니다.`}>
                        <LabImagePicker images={images} onChange={setImages} disabled={disabled} />
                        <div className="mt-3 rounded-[10px] bg-[#f4f2f1] px-4 py-3 text-[12.5px] leading-6 text-stone-600">
                          <p className="font-semibold text-[#211b1c]">디자인 · 이미지 권리 안내</p>
                          <p className="mt-1">신청하신 디자인과 참고 이미지는 본인이 직접 만들었거나 사용할 권리가 있는 자료여야 합니다. 참고 이미지는 제작 검토용으로만 쓰이며 신청자 동의 없이 공개하지 않습니다.</p>
                          <p className="mt-1">타인의 저작권 · 상표권(브랜드 로고, 캐릭터, 연예인 · 타인 사진, 다른 브랜드 디자인 복제 등)을 침해할 수 있는 디자인은 선정에서 제외되거나, 제작이 제한 · 수정될 수 있습니다.</p>
                        </div>
                      </Field>
                      <Field label="제작 목적" required error={errorFor("purpose")}>
                        <div role="radiogroup" aria-label="제작 목적" className="flex flex-wrap gap-2" aria-invalid={Boolean(errorFor("purpose"))} tabIndex={-1}>
                          {LAB_PURPOSES.map((item) => (
                            <Chip key={item.value} role="radio" selected={input.purpose === item.value} onClick={() => { set("purpose", item.value); setTouched((c) => ({ ...c, purpose: true })); }} disabled={disabled}>{item.label}</Chip>
                          ))}
                        </div>
                      </Field>
                      <Field label={input.purpose === "other" ? "기타 제작 목적" : "제작 목적 상세"} required={input.purpose === "other"} htmlFor="lab-reason" error={errorFor("reason")}
                        counter={`${Array.from(input.reason).length.toLocaleString("ko-KR")}/${LAB_LIMITS.reasonMax.toLocaleString("ko-KR")}`}>
                        <textarea id="lab-reason" rows={3} className={cn(inputClass(Boolean(errorFor("reason"))), "resize-y py-3 leading-7")} value={input.reason} maxLength={LAB_LIMITS.reasonMax}
                          placeholder="예: 준비 중인 브랜드의 첫 제품을 샘플로 확인해보고 싶어요."
                          onChange={(e) => set("reason", e.target.value)} onBlur={touch("reason")} aria-invalid={Boolean(errorFor("reason"))} disabled={disabled} />
                      </Field>
                      <Field label="향후 추가 생산 의향" error={errorFor("futureProduction")} hint="샘플이 마음에 들면 수량을 늘려 생산할 생각이 있으신가요? 선정에 불이익은 없습니다.">
                        <div role="radiogroup" aria-label="향후 추가 생산 의향" className="flex flex-wrap gap-2">
                          {LAB_FUTURE_PRODUCTION.map((item) => (
                            <Chip key={item.value} role="radio" selected={input.futureProduction === item.value}
                              onClick={() => set("futureProduction", input.futureProduction === item.value ? "" : item.value)} disabled={disabled}>{item.label}</Chip>
                          ))}
                        </div>
                      </Field>
                    </section>

                    {/* 동의 */}
                    <section className="space-y-5">
                      <FormGroupTitle index="STEP 03" title="개인정보 수집 · 이용 및 프로젝트 동의" />
                      <p className="text-[14px] leading-7 text-stone-700">
                        BRAND-ER LAB 무료 샘플 프로젝트는 선정된 신청자의 아이디어를 실제 샘플로 제작하고, 그 과정과 완성품을 브랜더 콘텐츠로 소개합니다.
                        선정된 신청자에게는 제작 · 촬영 일정을 개별 안내드립니다.
                      </p>
                      <LabConsentPanel value={consents} onChange={setConsents} disabled={disabled} showErrors={attempted} />
                      <p className="text-[12.5px] leading-6 text-stone-500">
                        촬영물 이용 동의 철회, 개인정보 열람 · 정정 · 삭제 요청 및 문의: 개인정보책임자 {LAB_CONTACT.privacyOfficer} ·{" "}
                        <a className="underline underline-offset-4 hover:text-lab" href={`mailto:${LAB_CONTACT.email}`}>{LAB_CONTACT.email}</a> ·{" "}
                        <a className="underline underline-offset-4 hover:text-lab" href={`tel:${LAB_CONTACT.phone.replace(/-/g, "")}`}>{LAB_CONTACT.phone}</a>
                      </p>
                    </section>

                    {/* 제출 */}
                    <section className="border-t-2 border-lab pt-8">
                      {submitError && (
                        <div className="mb-5 flex items-start gap-2 rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] leading-6 text-rose-800" role="alert">
                          <AlertCircle className="mt-1 h-4 w-4 shrink-0" />{submitError}
                        </div>
                      )}
                      <button type="submit" disabled={!canSubmit} aria-disabled={!canSubmit}
                        className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-lab px-8 text-[16px] font-bold text-white transition hover:bg-lab-dark disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 sm:w-auto sm:min-w-[340px]">
                        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />신청서를 보내는 중...</> : <>무료 샘플 제작 신청하기 <ArrowRight className="h-4 w-4" /></>}
                      </button>
                      {!canSubmit && !submitting && pending.length > 0 && (
                        <p className="mt-3 text-[13px] leading-6 text-stone-500">남은 항목: {pending.join(" · ")}</p>
                      )}
                      <p className="mt-3 text-[12.5px] leading-6 text-stone-400">신청은 무료이며 결제가 발생하지 않습니다. 신청이 곧 무료 샘플 제작 확정을 의미하지는 않습니다.</p>
                    </section>
                  </form>
                  )}
                </div>
              </div>
            </section>

            {/* SECTION 05 — 의류 지식 콘텐츠 */}
            <LabKnowledgeSection />

            {/* SECTION 06 — 제작 과정 */}
            <section aria-labelledby="lab-how-title" className="bg-[#f4f2f1] py-16 sm:py-24">
              <div className="page-shell">
                <p className="eyebrow text-lab">06 · Process</p>
                <h2 id="lab-how-title" className="mt-4 font-display text-[clamp(2rem,4.4vw,3.6rem)] font-extrabold leading-none tracking-[-0.04em] text-lab">HOW IT WORKS</h2>
                <ol className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
                  {LAB_STEPS.map(({ title, body, icon: Icon }, index) => (
                    <li key={title} className="relative rounded-[18px] bg-white p-6">
                      <div className="flex items-center justify-between">
                        <span className="lab-stitch-card lab-stitch-light flex h-16 w-16 items-center justify-center rounded-[16px] bg-lab text-white"><Icon className="h-7 w-7" strokeWidth={1.6} /></span>
                        <span className="font-display text-[34px] font-extrabold leading-none text-lab/15">{String(index + 1).padStart(2, "0")}</span>
                      </div>
                      <h3 className="mt-6 text-[17px] font-bold tracking-[-0.02em]"><span className="mr-1 text-lab">{index + 1}.</span>{title}</h3>
                      <p className="mt-2 text-[13.5px] leading-6 text-stone-600">{body}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {/* SECTION 07 — 마지막 신청 유도 */}
            <section aria-labelledby="lab-final-title" className="bg-lab py-16 text-white sm:py-24">
              <div className="page-shell">
                <div className="relative rounded-[26px] px-6 py-14 text-center sm:px-12 sm:py-20">
                  <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[26px] border-2 border-dashed border-white/40" />
                  <h2 id="lab-final-title" className="text-[clamp(1.9rem,4.6vw,3.6rem)] font-extrabold leading-[1.15] tracking-[-0.045em]">
                    상상만 하지 마세요.<br />이제 직접 만들어보세요.
                  </h2>
                  <ApplyButton tone="light" onClick={goApply} className="mt-10 w-full sm:w-auto" />
                  <p className="mx-auto mt-6 max-w-lg text-[13px] leading-6 text-white/70">
                    무료 샘플 제작은 선정된 신청자를 대상으로 진행되며, 제작 범위와 조건은 개별 안내됩니다.
                  </p>
                </div>
              </div>
            </section>

            {/* 모바일 고정 신청 버튼 — 신청서가 보이는 동안에는 숨긴다 */}
            {!formVisible && (
              <div ref={stickyCtaRef} data-mascot-safezone
                className="fixed inset-x-0 bottom-[var(--bottom-nav-offset)] z-40 border-t border-black/10 bg-white/95 px-4 py-2 backdrop-blur-md md:hidden">
                <ApplyButton onClick={goApply} className="min-h-[48px] w-full text-[15px]" />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default BranderLab;
