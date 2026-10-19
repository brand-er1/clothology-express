import { useState } from "react";
import { AlertTriangle, Flag, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import {
  earlyCloseFunding,
  getEarlyCloseResultLabel,
  getFundingErrorMessage,
  isFundingRecruitmentOver,
} from "@/services/funding";
import type { Funding } from "@/types/funding";
import { earlyCloseAchievementRate } from "@/lib/funding-close";

type ButtonProps = {
  funding: Funding;
  onClosed: () => void | Promise<void>;
  className?: string;
};

/**
 * [펀딩 조기 마감] 버튼 + 확인 팝업. 목표 수량 달성 여부와 관계없이 마감할 수 있다
 * (미달이면 '목표 미달 · 조기 마감'으로 확정). 권한·상태 검증은 서버가 다시 한다.
 */
export const FundingEarlyCloseButton = ({ funding, onClosed, className = "" }: ButtonProps) => {
  const [closing, setClosing] = useState(false);
  const [open, setOpen] = useState(false);
  const unavailable = funding.early_closed || funding.status !== "approved" || isFundingRecruitmentOver(funding);
  const unmet = funding.current_orders < funding.moq;

  const confirm = async () => {
    setClosing(true);
    try {
      const result = await earlyCloseFunding(funding.id);
      toast({
        title: result.result === "success" ? "펀딩 성공 · 조기 마감되었습니다" : "목표 미달 · 조기 마감되었습니다",
        description: `참여 ${result.quantity}장 / 목표 ${result.target_quantity}장 기준으로 결과가 확정되었습니다. 참여자 ${result.notified_participants}명에게 알림을 보냈습니다.`,
      });
      setOpen(false);
      await onClosed();
    } catch (error) {
      toast({ title: "조기 마감하지 못했습니다", description: getFundingErrorMessage(error), variant: "destructive" });
    } finally {
      setClosing(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !closing && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={unavailable || closing}
          className={`min-h-11 border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800 ${className}`}
        >
          <Flag className="mr-1.5 h-4 w-4" /> 펀딩 조기 마감
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md rounded-lg">
        <EarlyCloseConfirmBody funding={funding} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={closing}>취소</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700"
            disabled={closing}
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            {closing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {unmet ? "그래도 조기 마감" : "조기 마감"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

/**
 * 조기 마감 확인 문구. 목표 미달이면 더 강한 경고(목표·현재 수량·달성률)를 보여준다.
 * 제작자 확인창과 관리자 확인창이 함께 쓴다.
 */
export const EarlyCloseConfirmBody = ({ funding, asDialogHeader = true }: {
  funding: Pick<Funding, "product_name" | "current_orders" | "moq">; asDialogHeader?: boolean;
}) => {
  const unmet = funding.current_orders < funding.moq;
  const Title = asDialogHeader ? AlertDialogTitle : "p";
  const Description = asDialogHeader ? AlertDialogDescription : "div";
  return (
    <div className="grid gap-3">
      {asDialogHeader ? (
        <AlertDialogHeader>
          <Title className="text-lg font-semibold">펀딩을 조기 마감하시겠습니까?</Title>
          <Description className="leading-6 text-sm text-muted-foreground">
            조기 마감 후에는 새로운 구매자가 해당 펀딩에 참여할 수 없습니다.<br />
            현재까지 참여한 주문 및 구매자 정보는 그대로 유지됩니다.
          </Description>
        </AlertDialogHeader>
      ) : (
        <p className="text-sm leading-6 text-stone-600">
          조기 마감 후에는 새로운 구매자가 해당 펀딩에 참여할 수 없습니다.<br />
          현재까지 참여한 주문 및 구매자 정보는 그대로 유지됩니다.
        </p>
      )}
      {unmet ? (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="flex items-center gap-1.5 font-bold"><AlertTriangle className="h-4 w-4 shrink-0" />아직 목표 수량을 달성하지 않았습니다.</p>
          <dl className="mt-2 grid grid-cols-[6rem_minmax(0,1fr)] gap-y-0.5">
            <dt className="text-amber-800/80">목표수량</dt><dd className="font-semibold">{funding.moq.toLocaleString("ko-KR")}장</dd>
            <dt className="text-amber-800/80">현재수량</dt><dd className="font-semibold">{funding.current_orders.toLocaleString("ko-KR")}장</dd>
            <dt className="text-amber-800/80">현재 달성률</dt><dd className="font-semibold">{earlyCloseAchievementRate(funding)}%</dd>
          </dl>
          <p className="mt-2 font-semibold">그래도 펀딩을 종료하시겠습니까?</p>
          <p className="mt-1 text-xs leading-5 text-amber-800/90">
            &lsquo;목표 미달 · 조기 마감&rsquo;으로 확정됩니다. 기존 결제는 자동으로 취소·환불되지 않으며, 환불은 BRAND-ER 정책에 따라 별도로 처리됩니다.
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-stone-50 px-4 py-3 text-sm">
          <p className="font-medium">{funding.product_name}</p>
          <p className="mt-1">
            현재 <strong>{funding.current_orders.toLocaleString("ko-KR")}장</strong> / 목표 <strong>{funding.moq.toLocaleString("ko-KR")}장</strong>
            {" · "}달성률 <strong>{earlyCloseAchievementRate(funding)}%</strong>
          </p>
          <p className="mt-1 text-xs text-emerald-700">목표를 달성했습니다. 조기 마감하면 현재 달성률로 확정되고 제작 준비 단계로 넘어갑니다.</p>
        </div>
      )}
    </div>
  );
};

type Props = ButtonProps & {
  /** 로그인 사용자 id. 펀딩 제작자(creator_id)일 때만 카드가 보인다(권한 검증은 서버가 다시 한다). */
  currentUserId: string | null;
};

/** 제작자 전용 [펀딩 조기 마감] 카드 — 펀딩 관리 · 수정 페이지에서 공유한다. */
export const FundingEarlyCloseCard = ({ funding, currentUserId, onClosed, className = "" }: Props) => {
  if (!currentUserId || currentUserId !== funding.creator_id) return null;
  // 승인 전(작성중·승인대기·반려) 펀딩은 모집 자체가 시작되지 않았으므로 표시하지 않는다.
  if (funding.status !== "approved" && funding.status !== "closed") return null;

  if (funding.early_closed) {
    const succeeded = Boolean(funding.success_at);
    return (
      <Card className={`rounded-lg border-stone-300 ${className}`}>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="shrink-0 rounded-lg bg-stone-100 p-3 text-stone-700"><Flag className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="font-bold">조기 마감된 펀딩입니다</p>
              <p className="text-wrap-anywhere mt-1 text-sm text-gray-500">
                {funding.early_closed_at ? new Date(funding.early_closed_at).toLocaleString("ko-KR") : "-"} 마감
                · 마감 당시 참여 {funding.early_closed_quantity ?? funding.current_orders}장 / 목표 {funding.moq}장
              </p>
            </div>
          </div>
          <Badge className={`w-fit shrink-0 ${succeeded ? "bg-emerald-600 hover:bg-emerald-600" : "bg-stone-600 hover:bg-stone-600"}`}>
            {getEarlyCloseResultLabel(funding)}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  const unavailable = isFundingRecruitmentOver(funding);

  return (
    <Card className={`rounded-lg border-red-100 ${className}`}>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="shrink-0 rounded-lg bg-red-50 p-3 text-red-700"><Flag className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="font-bold">펀딩 조기 마감</p>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              {unavailable
                ? "이미 종료되었거나 모집이 끝난 펀딩입니다."
                : "종료일을 기다리지 않고 지금 모집을 마감합니다. 목표 수량에 미달해도 마감할 수 있으며, 현재까지 결제된 참여 수량으로 결과가 확정됩니다."}
            </p>
          </div>
        </div>
        <FundingEarlyCloseButton funding={funding} onClosed={onClosed} className="w-full shrink-0 rounded-full sm:w-auto" />
      </CardContent>
    </Card>
  );
};
