import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ImageIcon, Loader2, Paperclip, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { trackSiteEvent } from "@/lib/site-analytics";
import {
  ProductionRequestError, submitProductionRequest, type ProductionRequestDesign, type ProductionRequestForm, type ProductionRequestImage,
} from "@/services/productionRequest";
import {
  formatPhoneInput, formatProductionPhone, PRODUCTION_BUDGET_OPTIONS, PRODUCTION_REQUEST_SUCCESS_MESSAGE, PRODUCTION_REQUEST_LIMITS, PRODUCTION_REQUEST_PRIVACY_NOTICE,
  validateProductionRequest, type ProductionRequestField,
} from "../../../supabase/functions/_shared/productionRequest";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 고객이 보고 있던 생성 이미지(자동 첨부). base64 는 로고를 얹은 편집본처럼 아직 저장되지 않은 이미지. */
  image: ProductionRequestImage | null;
  design: ProductionRequestDesign;
  entryPoint: string;
  /** 접수 완료 후 'AI 이미지 생성 페이지로 돌아가기' */
  onReturnToGenerator: () => void;
};

const emptyForm: ProductionRequestForm = {
  contactName: "", phone: "", quantity: "", quantityUndecided: true, budget: "", request: "", privacyConsent: false,
};

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? <p id={id} role="alert" className="mt-1.5 text-[12px] font-semibold text-red-600">{message}</p> : null;

const Label = ({ htmlFor, children, required }: { htmlFor?: string; children: React.ReactNode; required?: boolean }) => (
  <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1 text-[13px] font-bold text-stone-900">
    {children}
    {required ? <span className="text-brand" aria-label="필수">*</span> : <span className="text-[11px] font-medium text-stone-400">(선택)</span>}
  </label>
);

export const ProductionRequestDialog = ({ open, onOpenChange, image, design, entryPoint, onReturnToGenerator }: Props) => {
  const [form, setForm] = useState<ProductionRequestForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<ProductionRequestField, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const submissionKeyRef = useRef<string>(crypto.randomUUID());
  const imageKey = image ? ("url" in image ? image.url : image.base64.slice(-64)) : "";

  // 열 때마다 새 접수 키 · 빈 양식. 로그인한 회원은 프로필의 이름 · 전화번호를 미리 채운다.
  useEffect(() => {
    if (!open) return;
    submissionKeyRef.current = crypto.randomUUID();
    setErrors({});
    setSubmitError(null);
    setDone(false);
    setShowNotice(false);
    setForm(emptyForm);
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name, phone_number").eq("id", user.id).maybeSingle();
      if (!active || !profile) return;
      setForm((current) => ({
        ...current,
        contactName: current.contactName || (profile.full_name ?? "").trim(),
        phone: current.phone || formatProductionPhone(profile.phone_number ?? "").replace(/[^0-9-]/g, ""),
      }));
    })().catch(() => undefined);
    return () => { active = false; };
  }, [open, imageKey]);

  const update = <K extends keyof ProductionRequestForm>(key: K, value: ProductionRequestForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError(null);
  };

  const previewSrc = image ? ("url" in image ? image.url : image.base64.startsWith("data:") ? image.base64 : `data:image/png;base64,${image.base64}`) : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const validation = validateProductionRequest(form);
    if ("errors" in validation) {
      setErrors(validation.errors);
      const first = Object.keys(validation.errors)[0];
      document.getElementById(`pr-${first}`)?.focus();
      return;
    }
    if (!image) {
      setSubmitError("의뢰할 생성 이미지가 없습니다. 이미지를 생성한 뒤 다시 시도해주세요.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitProductionRequest({
        submissionKey: submissionKeyRef.current,
        form,
        image,
        design,
        entryPoint,
        entryPath: `${window.location.pathname}${window.location.search}`.slice(0, 300),
      });
      setDone(true);
      void trackSiteEvent("production_request_submitted", { source: "ai_image_request" });
    } catch (error) {
      if (error instanceof ProductionRequestError) {
        if (error.fields) setErrors(error.fields);
        setSubmitError(error.message);
      } else {
        setSubmitError("제작의뢰를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <DialogContent
        className="max-h-[100dvh] w-full max-w-[100vw] gap-0 overflow-y-auto rounded-none border-0 bg-[#fbfaf8] p-0 sm:max-h-[92dvh] sm:max-w-[880px] sm:rounded-lg sm:border"
        onInteractOutside={(event) => { if (submitting) event.preventDefault(); }}
      >
        {done ? (
          <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 py-12 text-center sm:min-h-[460px] sm:px-12" data-testid="production-request-success">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
              <CheckCircle2 className="h-9 w-9 text-brand" />
            </span>
            <p className="mt-6 font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">Request received</p>
            <DialogTitle className="mt-2 text-[1.45rem] font-semibold leading-snug tracking-[-0.03em] text-stone-950 sm:text-[1.7rem]">
              {PRODUCTION_REQUEST_SUCCESS_MESSAGE[0]}
            </DialogTitle>
            <DialogDescription className="mt-4 max-w-md text-[15px] leading-7 text-stone-600">
              {PRODUCTION_REQUEST_SUCCESS_MESSAGE[1]}
            </DialogDescription>
            <Button
              type="button"
              onClick={() => { onOpenChange(false); onReturnToGenerator(); }}
              className="mt-8 h-12 w-full max-w-xs rounded-[3px] bg-brand text-[15px] font-bold hover:bg-brand-dark"
            >
              AI 이미지 생성 페이지로 돌아가기
            </Button>
          </div>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} noValidate className="grid md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            {/* 자동 첨부된 디자인 */}
            <aside className="border-b border-stone-200 bg-[#f2efeb] p-4 sm:p-6 md:border-b-0 md:border-r">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">Production request</p>
              <DialogTitle className="mt-1.5 text-[1.35rem] font-semibold tracking-[-0.03em] text-stone-950">제작의뢰하기</DialogTitle>
              <DialogDescription className="mt-1.5 text-[13px] leading-5 text-stone-500">
                디자인하신 이미지로 실제 의류 제작 상담과 견적을 받아보세요.
              </DialogDescription>
              <div className="mt-4 flex gap-3 md:block">
                <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-md border border-black/10 bg-white md:w-full">
                  {previewSrc ? (
                    <img src={previewSrc} alt="제작의뢰에 첨부되는 디자인 이미지" className="h-full w-full object-contain" data-testid="production-request-image" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-8 w-8 text-stone-300" /></div>
                  )}
                </div>
                <div className="min-w-0 md:mt-3">
                  <p className="flex items-center gap-1.5 text-[12px] font-bold text-stone-800">
                    <Paperclip className="h-3.5 w-3.5 text-brand" /> 디자인 이미지 자동 첨부
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-stone-500">따로 다운로드하거나 다시 올리지 않아도 됩니다.</p>
                  {(design.clothType || design.material) && (
                    <p className="mt-2 text-[12px] font-semibold text-stone-700">{[design.clothType, design.material].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
              </div>
            </aside>

            <div className="space-y-5 p-4 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pr-contactName" required>고객 이름</Label>
                  <Input
                    id="pr-contactName" autoComplete="name" value={form.contactName} maxLength={PRODUCTION_REQUEST_LIMITS.nameMax}
                    onChange={(event) => update("contactName", event.target.value)} placeholder="홍길동"
                    aria-invalid={Boolean(errors.contactName)} aria-describedby="pr-contactName-error"
                    className={cn("h-12 rounded-[3px] bg-white text-[15px]", errors.contactName && "border-red-500")}
                  />
                  <FieldError id="pr-contactName-error" message={errors.contactName} />
                </div>
                <div>
                  <Label htmlFor="pr-phone" required>전화번호</Label>
                  <Input
                    id="pr-phone" type="tel" inputMode="numeric" autoComplete="tel" value={form.phone} maxLength={13}
                    onChange={(event) => update("phone", formatPhoneInput(event.target.value))} placeholder="010-0000-0000"
                    aria-invalid={Boolean(errors.phone)} aria-describedby="pr-phone-help pr-phone-error"
                    className={cn("h-12 rounded-[3px] bg-white text-[15px] tabular-nums", errors.phone && "border-red-500")}
                  />
                  <p id="pr-phone-help" className="mt-1.5 text-[11px] leading-4 text-stone-500">제작 상담 및 견적 안내를 위해 연락드리는 번호입니다.</p>
                  <FieldError id="pr-phone-error" message={errors.phone} />
                </div>
              </div>

              <div>
                <Label htmlFor="pr-quantity">제작 희망 수량</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="pr-quantity" inputMode="numeric" value={form.quantity}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/[^0-9]/g, "").slice(0, 7);
                        setForm((current) => ({ ...current, quantity: digits, quantityUndecided: digits === "" ? current.quantityUndecided : false }));
                        setErrors((current) => ({ ...current, quantity: undefined }));
                      }}
                      placeholder={form.quantityUndecided ? "미정" : "예: 50"}
                      aria-invalid={Boolean(errors.quantity)} aria-describedby="pr-quantity-error"
                      className={cn("h-12 rounded-[3px] bg-white pr-10 text-[15px] tabular-nums", errors.quantity && "border-red-500")}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-stone-400">장</span>
                  </div>
                  <button
                    type="button" aria-pressed={form.quantityUndecided}
                    onClick={() => setForm((current) => ({ ...current, quantityUndecided: !current.quantityUndecided, quantity: current.quantityUndecided ? current.quantity : "" }))}
                    className={cn(
                      "h-12 shrink-0 rounded-[3px] border px-4 text-[14px] font-bold transition",
                      form.quantityUndecided ? "border-brand bg-brand text-white" : "border-stone-300 bg-white text-stone-700 hover:border-brand/50",
                    )}
                  >
                    미정
                  </button>
                </div>
                <FieldError id="pr-quantity-error" message={errors.quantity} />
              </div>

              <div>
                <Label>희망 제작 예산</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="희망 제작 예산">
                  {PRODUCTION_BUDGET_OPTIONS.map((option) => (
                    <button
                      key={option} type="button" role="radio" aria-checked={form.budget === option}
                      onClick={() => update("budget", form.budget === option ? "" : option)}
                      className={cn(
                        "h-11 rounded-[3px] border px-2 text-[13px] font-semibold transition",
                        form.budget === option ? "border-brand bg-brand/[0.07] text-brand" : "border-stone-300 bg-white text-stone-700 hover:border-brand/50",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="pr-request">추가 요청사항</Label>
                <Textarea
                  id="pr-request" value={form.request} maxLength={PRODUCTION_REQUEST_LIMITS.requestMax}
                  onChange={(event) => update("request", event.target.value)}
                  placeholder="원하는 원단, 납기 일정, 로고 위치 등 전달하고 싶은 내용을 적어주세요."
                  className="min-h-[88px] rounded-[3px] bg-white text-[14px]"
                />
                <FieldError id="pr-request-error" message={errors.request} />
              </div>

              <div className={cn("rounded-md border bg-white p-3.5", errors.privacyConsent ? "border-red-400" : "border-stone-200")}>
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="pr-privacyConsent" checked={form.privacyConsent}
                    onCheckedChange={(checked) => update("privacyConsent", checked === true)}
                    aria-invalid={Boolean(errors.privacyConsent)} aria-describedby="pr-privacyConsent-error"
                    className="mt-0.5 h-5 w-5 rounded-[3px] data-[state=checked]:border-brand data-[state=checked]:bg-brand"
                  />
                  <label htmlFor="pr-privacyConsent" className="flex-1 cursor-pointer text-[14px] font-bold leading-5 text-stone-900">
                    <span className="text-brand">[필수]</span> 개인정보 수집 및 이용에 동의합니다.
                  </label>
                  <button type="button" onClick={() => setShowNotice((value) => !value)} aria-expanded={showNotice}
                    className="flex shrink-0 items-center gap-0.5 text-[12px] font-semibold text-stone-500 hover:text-stone-800">
                    내용 보기 <ChevronDown className={cn("h-3.5 w-3.5 transition", showNotice && "rotate-180")} />
                  </button>
                </div>
                {showNotice && (
                  <dl className="mt-3 grid gap-2 border-t border-stone-100 pt-3 text-[12px] leading-5 text-stone-600">
                    <div><dt className="font-bold text-stone-800">수집 항목</dt><dd>{PRODUCTION_REQUEST_PRIVACY_NOTICE.items}</dd></div>
                    <div><dt className="font-bold text-stone-800">이용 목적</dt><dd>{PRODUCTION_REQUEST_PRIVACY_NOTICE.purpose}</dd></div>
                    <div><dt className="font-bold text-stone-800">보유 기간</dt><dd>{PRODUCTION_REQUEST_PRIVACY_NOTICE.retention}</dd></div>
                    <div><dd>{PRODUCTION_REQUEST_PRIVACY_NOTICE.refusal}</dd></div>
                  </dl>
                )}
                <FieldError id="pr-privacyConsent-error" message={errors.privacyConsent} />
              </div>

              {submitError && (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] font-semibold leading-5 text-red-700" data-testid="production-request-error">
                  {submitError}
                </p>
              )}

              <div className="sticky bottom-0 -mx-4 border-t border-stone-200 bg-[#fbfaf8]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
                <Button type="submit" disabled={submitting || !image}
                  className="h-[52px] w-full rounded-[3px] bg-brand text-[16px] font-bold hover:bg-brand-dark">
                  {submitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />접수 중...</> : "제작의뢰 접수하기"}
                </Button>
                <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-stone-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> 입력하신 정보는 제작 상담 담당자만 확인합니다.
                </p>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
