import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { PaymentService } from "@/services/payment";
import { getFundingErrorMessage } from "@/services/funding";
import type { Funding, ShippingDetails } from "@/types/funding";
import { FreeTeeEventNotice } from "@/components/funding/FreeTeeEvent";
import { CheckCircle2, ChevronLeft, Loader2, PackageCheck, ShieldAlert } from "lucide-react";

type Step = "shipping" | "payment" | "complete";

type CompletedOrder = {
  orderNumber: string;
  totalAmount: number;
  completedAt: string;
};

const emptyShipping: ShippingDetails = {
  ordererName: "",
  ordererPhone: "",
  ordererEmail: "",
  recipientName: "",
  recipientPhone: "",
  postalCode: "",
  address: "",
  addressDetail: "",
  deliveryMessage: "",
  agreePrivacy: false,
};

const STEPS: { key: Step; label: string }[] = [
  { key: "shipping", label: "배송정보" },
  { key: "payment", label: "모의결제" },
  { key: "complete", label: "완료" },
];

const formatWon = (value: number) => `${value.toLocaleString("ko-KR")}원`;

/** Label/value line that wraps long product names, order numbers and addresses instead of overflowing. */
const SummaryRow = ({ label, children, emphasize = false }: { label: string; children: ReactNode; emphasize?: boolean }) => (
  <div className="flex items-start justify-between gap-4">
    <span className="shrink-0 text-stone-500">{label}</span>
    <span className={`text-wrap-anywhere min-w-0 text-right ${emphasize ? "font-bold text-brand" : "font-semibold text-stone-900"}`}>
      {children}
    </span>
  </div>
);

export const FundingCheckoutDialog = ({
  open,
  onOpenChange,
  funding,
  color,
  size,
  quantity,
  prefill,
  freeTeeEvent = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funding: Funding;
  color: string;
  size: string;
  quantity: number;
  prefill?: Partial<ShippingDetails>;
  /** 최근 드랍 반팔 무료 증정 이벤트 대상 상품이면 결제 단계에 안내를 보여준다. */
  freeTeeEvent?: boolean;
}) => {
  const [step, setStep] = useState<Step>("shipping");
  const [shipping, setShipping] = useState<ShippingDetails>(emptyShipping);
  const [sameAsOrderer, setSameAsOrderer] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<CompletedOrder | null>(null);
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const validationToastRef = useRef<ReturnType<typeof toast> | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("shipping");
    setCompleted(null);
    // Values the buyer already typed survive closing the sheet (e.g. "옵션 변경") and reopening it.
    setShipping((current) => {
      const typed = Object.fromEntries(
        Object.entries(current).filter(([, value]) => typeof value === "string" && value.trim() !== "")
      ) as Partial<ShippingDetails>;
      return { ...emptyShipping, ...prefill, ...typed, agreePrivacy: current.agreePrivacy };
    });
  }, [open, prefill]);

  // Each step starts at its top instead of inheriting the previous step's scroll position.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  // On phones the sheet follows the *visual* viewport, so when the on-screen keyboard opens
  // it shrinks to the visible area and the footer CTA stays reachable above the keyboard
  // (100dvh alone ignores the keyboard on iOS Safari).
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!open || !visualViewport) return;
    const update = () => setViewport({ height: visualViewport.height, top: visualViewport.offsetTop });
    update();
    visualViewport.addEventListener("resize", update);
    visualViewport.addEventListener("scroll", update);
    return () => {
      visualViewport.removeEventListener("resize", update);
      visualViewport.removeEventListener("scroll", update);
    };
  }, [open]);

  const unitPrice = funding.price || 0;
  const productAmount = unitPrice * quantity;
  const shippingFee: number = 0;
  const totalAmount = productAmount + shippingFee;

  const updateField = (field: keyof ShippingDetails) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = event.target.value;
    setShipping((current) => {
      const next = { ...current, [field]: value };
      if (sameAsOrderer) {
        if (field === "ordererName") next.recipientName = value;
        if (field === "ordererPhone") next.recipientPhone = value;
      }
      return next;
    });
  };

  const toggleSameAsOrderer = (checked: boolean) => {
    setSameAsOrderer(checked);
    if (checked) {
      setShipping((current) => ({
        ...current,
        recipientName: current.ordererName,
        recipientPhone: current.ordererPhone,
      }));
    }
  };

  const getMissingFields = () => {
    const missing: { label: string; inputId: string }[] = [];
    if (!shipping.ordererName.trim()) missing.push({ label: "주문자 이름", inputId: "orderer-name" });
    if (!shipping.ordererPhone.trim()) missing.push({ label: "주문자 연락처", inputId: "orderer-phone" });
    if (!shipping.ordererEmail.trim()) missing.push({ label: "주문자 이메일", inputId: "orderer-email" });
    if (!shipping.recipientName.trim()) missing.push({ label: "수령인 이름", inputId: "recipient-name" });
    if (!shipping.recipientPhone.trim()) missing.push({ label: "수령인 연락처", inputId: "recipient-phone" });
    if (!shipping.postalCode.trim()) missing.push({ label: "우편번호", inputId: "postal-code" });
    if (!shipping.address.trim()) missing.push({ label: "배송 주소", inputId: "address" });
    if (!shipping.agreePrivacy) missing.push({ label: "개인정보 수집·이용 동의", inputId: "agree-privacy" });
    return missing;
  };

  const handleNextToPayment = () => {
    const missing = getMissingFields();
    if (missing.length > 0) {
      validationToastRef.current = toast({
        title: "입력 내용을 확인해주세요",
        description: `다음 항목이 필요합니다: ${missing.map((item) => item.label).join(", ")}`,
        variant: "destructive",
      });
      // Bring the first missing field into view so the user doesn't have to hunt for it.
      const target = document.getElementById(missing[0].inputId);
      if (target instanceof HTMLInputElement && target.disabled) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      } else {
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }
    // The toast sits over the sheet's title bar on phones; clear it once the form is valid.
    validationToastRef.current?.dismiss();
    setStep("payment");
  };

  const handleSubmitPayment = async () => {
    setSubmitting(true);
    try {
      const provider = PaymentService.getProvider();
      const result = await provider.createFundingOrder({
        fundingId: funding.id,
        color,
        size,
        quantity,
        shipping,
      });

      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }

      setCompleted({
        orderNumber: result.orderNumber,
        totalAmount: result.totalAmount,
        completedAt: new Date().toISOString(),
      });
      setStep("complete");
    } catch (error) {
      toast({
        title: "펀딩 참여를 완료하지 못했습니다",
        description: getFundingErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Once the keyboard has resized the viewport, keep the field being typed in centred
  // in the scroll area rather than hidden under the keyboard or the footer.
  const keepFocusedFieldVisible = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    window.setTimeout(() => {
      if (document.activeElement === target) target.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 300);
  };

  const stepIndex = STEPS.findIndex((item) => item.key === step);
  const addressLine = [shipping.postalCode && `[${shipping.postalCode}]`, shipping.address, shipping.addressDetail]
    .filter(Boolean)
    .join(" ");

  const sheetStyle = viewport
    ? ({ "--checkout-vh": `${viewport.height}px`, "--checkout-vt": `${viewport.top}px` } as CSSProperties)
    : undefined;

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      {/* Mobile: full-height sheet sized to the visible viewport, with a fixed title bar, a
          scrollable body and a footer CTA that respects the iPhone safe area.
          sm+: the original centred dialog, capped to the viewport height. */}
      <DialogContent
        style={sheetStyle}
        className="left-0 top-[var(--checkout-vt,0px)] flex h-[var(--checkout-vh,100dvh)] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-white p-0 max-sm:data-[state=open]:slide-in-from-bottom-8 max-sm:data-[state=open]:slide-in-from-left-0 max-sm:data-[state=closed]:slide-out-to-left-0 sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[min(90dvh,880px)] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:border"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="shrink-0 border-b border-stone-100 px-4 pb-3 pr-14 pt-[max(0.875rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6">
          <ol className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold" aria-label="주문 단계">
            {STEPS.map((item, index) => (
              <li key={item.key} className={`flex items-center gap-1.5 ${index <= stepIndex ? "text-brand" : "text-stone-300"}`}>
                {index > 0 && <span className="h-px w-3 bg-current" aria-hidden />}
                <span aria-current={index === stepIndex ? "step" : undefined}>{index + 1}. {item.label}</span>
              </li>
            ))}
          </ol>
          <DialogTitle className="text-lg font-bold leading-snug">
            {step === "shipping" && "주문자 및 배송정보 입력"}
            {step === "payment" && "모의결제"}
            {step === "complete" && "펀딩 참여가 완료되었습니다"}
          </DialogTitle>
          <DialogDescription className="text-wrap-anywhere mt-0.5 line-clamp-2 text-xs text-stone-500">
            {step === "payment"
              ? "결제 예정 금액을 확인하고 펀딩 참여를 완료해주세요."
              : step === "complete"
                ? "현재는 모의결제 단계로 실제 금액이 결제되지 않았습니다."
                : `${funding.product_name} · ${color} · ${size} · ${quantity}장`}
          </DialogDescription>
        </div>

        <div
          ref={bodyRef}
          onFocus={keepFocusedFieldVisible}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
        >
          {step === "shipping" && (
            <div className="space-y-6">
              <section className="flex gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3" aria-label="주문 상품">
                <img src={funding.image_url} alt="" className="h-20 w-16 shrink-0 rounded-lg bg-white object-contain" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-wrap-anywhere line-clamp-2 font-bold leading-snug text-stone-900">{funding.product_name}</p>
                  <p className="mt-1 text-xs text-stone-500">{color} · {size} · {quantity}장</p>
                  <p className="mt-1 font-bold text-brand">{formatWon(productAmount)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="-mr-1 -mt-1 min-h-11 shrink-0 self-start rounded-lg px-2 text-xs font-semibold text-stone-500 underline underline-offset-4 hover:text-brand"
                >
                  옵션 변경
                </button>
              </section>

              <section className="space-y-3">
                <p className="text-sm font-bold text-stone-800">주문자 정보</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="orderer-name">이름 *</Label>
                    <Input id="orderer-name" autoComplete="name" enterKeyHint="next" value={shipping.ordererName} onChange={updateField("ordererName")} placeholder="홍길동" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="orderer-phone">연락처 *</Label>
                    <Input id="orderer-phone" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" value={shipping.ordererPhone} onChange={updateField("ordererPhone")} placeholder="010-0000-0000" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="orderer-email">이메일 *</Label>
                  <Input id="orderer-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" enterKeyHint="next" value={shipping.ordererEmail} onChange={updateField("ordererEmail")} placeholder="example@email.com" />
                </div>
              </section>

              <section className="space-y-3 border-t border-stone-100 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-stone-800">배송 정보</p>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-stone-600">
                    <Checkbox checked={sameAsOrderer} onCheckedChange={(checked) => toggleSameAsOrderer(checked === true)} className="h-5 w-5" />
                    주문자와 동일
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="recipient-name">수령인 이름 *</Label>
                    <Input
                      id="recipient-name"
                      autoComplete="shipping name"
                      enterKeyHint="next"
                      value={shipping.recipientName}
                      disabled={sameAsOrderer}
                      onChange={updateField("recipientName")}
                      placeholder="홍길동"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="recipient-phone">수령인 연락처 *</Label>
                    <Input
                      id="recipient-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="shipping tel"
                      enterKeyHint="next"
                      value={shipping.recipientPhone}
                      disabled={sameAsOrderer}
                      onChange={updateField("recipientPhone")}
                      placeholder="010-0000-0000"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <div className="space-y-1.5">
                    <Label htmlFor="postal-code">우편번호 *</Label>
                    <Input id="postal-code" inputMode="numeric" autoComplete="shipping postal-code" enterKeyHint="next" maxLength={10} value={shipping.postalCode} onChange={updateField("postalCode")} placeholder="12345" className="max-w-[12rem] sm:max-w-none" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="address">배송 주소 *</Label>
                    <Input id="address" autoComplete="shipping address-line1" enterKeyHint="next" value={shipping.address} onChange={updateField("address")} placeholder="도로명 주소" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address-detail">상세 주소</Label>
                  <Input id="address-detail" autoComplete="shipping address-line2" enterKeyHint="next" value={shipping.addressDetail} onChange={updateField("addressDetail")} placeholder="동/호수 등 상세 주소" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="delivery-message">배송 요청사항</Label>
                  <Textarea id="delivery-message" rows={2} value={shipping.deliveryMessage} onChange={updateField("deliveryMessage")} placeholder="예: 부재 시 경비실에 맡겨주세요." className="min-h-[88px]" />
                </div>
              </section>

              <section className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <label className="flex cursor-pointer items-start gap-3 text-sm text-stone-700">
                  <Checkbox
                    id="agree-privacy"
                    checked={shipping.agreePrivacy}
                    onCheckedChange={(checked) => setShipping((current) => ({ ...current, agreePrivacy: checked === true }))}
                    className="mt-0.5 h-5 w-5"
                  />
                  <span className="min-w-0">
                    <strong className="font-bold text-stone-900">[필수] 개인정보 수집·이용 동의</strong>
                    <br />
                    입력하신 주문자·배송지 정보는 펀딩 참여 확인과 향후 제품 배송을 위해 수집되며, 판매자와
                    관리자만 확인할 수 있습니다.
                  </span>
                </label>
              </section>
            </div>
          )}

          {step === "payment" && (
            <div className="space-y-4">
              {freeTeeEvent && <FreeTeeEventNotice className="rounded-xl" />}
              <section className="space-y-2.5 rounded-xl border border-stone-200 p-4 text-sm">
                <SummaryRow label="상품명">{funding.product_name}</SummaryRow>
                <SummaryRow label="옵션">{color} · {size}</SummaryRow>
                <SummaryRow label="수량">{quantity}장</SummaryRow>
                <SummaryRow label="상품 금액">{formatWon(productAmount)}</SummaryRow>
                <SummaryRow label="배송비">{shippingFee === 0 ? "무료배송" : formatWon(shippingFee)}</SummaryRow>
                <div className="!mt-3 border-t border-stone-200 pt-3 text-base">
                  <SummaryRow label="총 결제 예정 금액" emphasize>{formatWon(totalAmount)}</SummaryRow>
                </div>
              </section>

              <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-amber-900"><ShieldAlert className="h-4 w-4 shrink-0" /> 모의결제</p>
                <p className="mt-2 text-xs leading-5 text-amber-800">
                  현재 테스트 운영 중으로 실제 금액은 결제되지 않습니다. 입력하신 주문 및 배송정보는 펀딩 참여
                  확인과 향후 주문 처리를 위해 저장됩니다.
                </p>
              </section>

              <section className="space-y-2 rounded-xl bg-stone-50 p-4 text-xs leading-5">
                <SummaryRow label="배송지">{addressLine}</SummaryRow>
                <SummaryRow label="수령인">{shipping.recipientName} ({shipping.recipientPhone})</SummaryRow>
                {shipping.deliveryMessage && <SummaryRow label="요청사항">{shipping.deliveryMessage}</SummaryRow>}
              </section>
            </div>
          )}

          {step === "complete" && completed && (
            <div className="space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-2.5 rounded-xl border border-stone-200 p-4 text-sm">
                <SummaryRow label="주문번호"><span className="font-mono">{completed.orderNumber}</span></SummaryRow>
                <SummaryRow label="펀딩명">{funding.product_name}</SummaryRow>
                <SummaryRow label="상품명">{funding.product_name}</SummaryRow>
                <SummaryRow label="옵션">{color} · {size}</SummaryRow>
                <SummaryRow label="수량">{quantity}장</SummaryRow>
                <SummaryRow label="결제 예정 금액">{formatWon(completed.totalAmount)}</SummaryRow>
                <SummaryRow label="배송지">{addressLine}</SummaryRow>
                <SummaryRow label="참여일">{new Date(completed.completedAt).toLocaleString("ko-KR")}</SummaryRow>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-stone-200 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.04)] sm:px-6 sm:pb-6">
          {step === "shipping" && (
            <>
              <div className="mb-2.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="text-stone-500">총 결제 예정 금액</span>
                <strong className="text-wrap-anywhere text-right text-lg text-brand">{formatWon(totalAmount)}</strong>
              </div>
              <Button
                type="button"
                onClick={handleNextToPayment}
                className="h-12 w-full rounded-none bg-brand text-base font-bold hover:bg-brand-dark"
              >
                다음: 모의결제
              </Button>
            </>
          )}

          {step === "payment" && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("shipping")} disabled={submitting} className="h-12 shrink-0 rounded-none px-4">
                <ChevronLeft className="h-4 w-4" /> 이전
              </Button>
              <Button
                type="button"
                onClick={handleSubmitPayment}
                disabled={submitting}
                className="h-12 min-w-0 flex-1 rounded-none bg-brand px-3 text-base font-bold hover:bg-brand-dark"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                모의결제 후 펀딩 참여
              </Button>
            </div>
          )}

          {step === "complete" && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-12 shrink-0 rounded-none px-5">
                닫기
              </Button>
              <Button asChild className="h-12 min-w-0 flex-1 rounded-none bg-brand px-3 hover:bg-brand-dark">
                <Link to="/my-fundings?tab=joined" onClick={() => onOpenChange(false)}>
                  <PackageCheck className="h-4 w-4" /> 내 펀딩에서 확인하기
                </Link>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
