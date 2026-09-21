import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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

export const FundingCheckoutDialog = ({
  open,
  onOpenChange,
  funding,
  color,
  size,
  quantity,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funding: Funding;
  color: string;
  size: string;
  quantity: number;
  prefill?: Partial<ShippingDetails>;
}) => {
  const [step, setStep] = useState<Step>("shipping");
  const [shipping, setShipping] = useState<ShippingDetails>(emptyShipping);
  const [sameAsOrderer, setSameAsOrderer] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<CompletedOrder | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("shipping");
    setCompleted(null);
    setShipping((current) => ({ ...emptyShipping, ...prefill, agreePrivacy: current.agreePrivacy }));
  }, [open, prefill]);

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
    const missing: string[] = [];
    if (!shipping.ordererName.trim()) missing.push("주문자 이름");
    if (!shipping.ordererPhone.trim()) missing.push("주문자 연락처");
    if (!shipping.ordererEmail.trim()) missing.push("주문자 이메일");
    if (!shipping.recipientName.trim()) missing.push("수령인 이름");
    if (!shipping.recipientPhone.trim()) missing.push("수령인 연락처");
    if (!shipping.postalCode.trim()) missing.push("우편번호");
    if (!shipping.address.trim()) missing.push("배송 주소");
    if (!shipping.agreePrivacy) missing.push("개인정보 수집·이용 동의");
    return missing;
  };

  const handleNextToPayment = () => {
    const missing = getMissingFields();
    if (missing.length > 0) {
      toast({
        title: "입력 내용을 확인해주세요",
        description: `다음 항목이 필요합니다: ${missing.join(", ")}`,
        variant: "destructive",
      });
      return;
    }
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

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
        {step === "shipping" && (
          <>
            <DialogHeader>
              <DialogTitle>주문자 및 배송정보 입력</DialogTitle>
              <DialogDescription>
                {funding.product_name} · {color} · {size} · {quantity}장
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <section className="space-y-3">
                <p className="text-sm font-bold text-stone-800">주문자 정보</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="orderer-name">이름 *</Label>
                    <Input id="orderer-name" value={shipping.ordererName} onChange={updateField("ordererName")} placeholder="홍길동" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="orderer-phone">연락처 *</Label>
                    <Input id="orderer-phone" value={shipping.ordererPhone} onChange={updateField("ordererPhone")} placeholder="010-0000-0000" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="orderer-email">이메일 *</Label>
                  <Input id="orderer-email" type="email" value={shipping.ordererEmail} onChange={updateField("ordererEmail")} placeholder="example@email.com" />
                </div>
              </section>

              <section className="space-y-3 border-t border-stone-100 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-stone-800">배송 정보</p>
                  <label className="flex items-center gap-2 text-xs text-stone-500">
                    <Checkbox checked={sameAsOrderer} onCheckedChange={(checked) => toggleSameAsOrderer(checked === true)} />
                    주문자와 동일
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="recipient-name">수령인 이름 *</Label>
                    <Input
                      id="recipient-name"
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
                      value={shipping.recipientPhone}
                      disabled={sameAsOrderer}
                      onChange={updateField("recipientPhone")}
                      placeholder="010-0000-0000"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                  <div className="space-y-1.5">
                    <Label htmlFor="postal-code">우편번호 *</Label>
                    <Input id="postal-code" value={shipping.postalCode} onChange={updateField("postalCode")} placeholder="12345" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="address">배송 주소 *</Label>
                    <Input id="address" value={shipping.address} onChange={updateField("address")} placeholder="도로명 주소" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address-detail">상세 주소</Label>
                  <Input id="address-detail" value={shipping.addressDetail} onChange={updateField("addressDetail")} placeholder="동/호수 등 상세 주소" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="delivery-message">배송 요청사항</Label>
                  <Textarea id="delivery-message" rows={2} value={shipping.deliveryMessage} onChange={updateField("deliveryMessage")} placeholder="예: 부재 시 경비실에 맡겨주세요." />
                </div>
              </section>

              <section className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <label className="flex items-start gap-3 text-sm text-stone-700">
                  <Checkbox
                    checked={shipping.agreePrivacy}
                    onCheckedChange={(checked) => setShipping((current) => ({ ...current, agreePrivacy: checked === true }))}
                    className="mt-0.5"
                  />
                  <span>
                    <strong className="font-bold text-stone-900">[필수] 개인정보 수집·이용 동의</strong>
                    <br />
                    입력하신 주문자·배송지 정보는 펀딩 참여 확인과 향후 제품 배송을 위해 수집되며, 판매자와
                    관리자만 확인할 수 있습니다.
                  </span>
                </label>
              </section>
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={handleNextToPayment}
                className="h-12 w-full rounded-none bg-brand text-base font-bold hover:bg-brand-dark"
              >
                다음: 모의결제
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "payment" && (
          <>
            <DialogHeader>
              <DialogTitle>모의결제</DialogTitle>
              <DialogDescription>결제 예정 금액을 확인하고 펀딩 참여를 완료해주세요.</DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <section className="space-y-2 rounded-xl border border-stone-200 p-4 text-sm">
                <div className="flex justify-between"><span className="text-stone-500">상품명</span><span className="font-semibold">{funding.product_name}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">옵션</span><span className="font-semibold">{color} · {size}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">수량</span><span className="font-semibold">{quantity}장</span></div>
                <div className="flex justify-between"><span className="text-stone-500">상품 금액</span><span className="font-semibold">{productAmount.toLocaleString("ko-KR")}원</span></div>
                <div className="flex justify-between"><span className="text-stone-500">배송비</span><span className="font-semibold">{shippingFee === 0 ? "무료배송" : `${shippingFee.toLocaleString("ko-KR")}원`}</span></div>
                <div className="mt-2 flex justify-between border-t border-stone-200 pt-2 text-base"><span className="font-bold">총 결제 예정 금액</span><strong className="text-brand">{totalAmount.toLocaleString("ko-KR")}원</strong></div>
              </section>

              <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-amber-900"><ShieldAlert className="h-4 w-4" /> 모의결제</p>
                <p className="mt-2 text-xs leading-5 text-amber-800">
                  현재 테스트 운영 중으로 실제 금액은 결제되지 않습니다. 입력하신 주문 및 배송정보는 펀딩 참여
                  확인과 향후 주문 처리를 위해 저장됩니다.
                </p>
              </section>

              <div className="rounded-xl bg-stone-50 p-4 text-xs leading-5 text-stone-500">
                배송지: {shipping.postalCode} {shipping.address} {shipping.addressDetail}
                <br />
                수령인: {shipping.recipientName} ({shipping.recipientPhone})
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setStep("shipping")} disabled={submitting} className="rounded-none">
                <ChevronLeft className="mr-1 h-4 w-4" /> 이전
              </Button>
              <Button
                type="button"
                onClick={handleSubmitPayment}
                disabled={submitting}
                className="h-12 flex-1 rounded-none bg-brand text-base font-bold hover:bg-brand-dark"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                모의결제 후 펀딩 참여
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "complete" && completed && (
          <>
            <DialogHeader>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <DialogTitle className="text-center text-xl">펀딩 참여가 완료되었습니다</DialogTitle>
              <DialogDescription className="text-center">현재는 모의결제 단계로 실제 금액이 결제되지 않았습니다.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2 rounded-xl border border-stone-200 p-4 text-sm">
              <div className="flex justify-between"><span className="text-stone-500">주문번호</span><span className="font-mono font-semibold">{completed.orderNumber}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">펀딩명</span><span className="font-semibold">{funding.product_name}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">상품명</span><span className="font-semibold">{funding.product_name}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">옵션</span><span className="font-semibold">{color} · {size}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">수량</span><span className="font-semibold">{quantity}장</span></div>
              <div className="flex justify-between"><span className="text-stone-500">결제 예정 금액</span><span className="font-semibold">{completed.totalAmount.toLocaleString("ko-KR")}원</span></div>
              <div className="flex justify-between"><span className="text-stone-500">배송지</span><span className="max-w-56 text-right font-semibold">{shipping.postalCode} {shipping.address} {shipping.addressDetail}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">참여일</span><span className="font-semibold">{new Date(completed.completedAt).toLocaleString("ko-KR")}</span></div>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-none">
                닫기
              </Button>
              <Button asChild className="flex-1 rounded-none bg-brand hover:bg-brand-dark">
                <Link to="/my-fundings?tab=joined" onClick={() => onOpenChange(false)}>
                  <PackageCheck className="mr-2 h-4 w-4" /> 내 펀딩에서 확인하기
                </Link>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
