import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
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

type Props = {
  funding: Funding;
  /** 로그인 사용자 id. 펀딩 제작자(creator_id)일 때만 카드가 보인다(권한 검증은 서버가 다시 한다). */
  currentUserId: string | null;
  onClosed: () => void | Promise<void>;
  className?: string;
};

/** 제작자 전용 [펀딩 조기 마감] 카드 — 펀딩 관리 · 수정 페이지에서 공유한다. */
export const FundingEarlyCloseCard = ({ funding, currentUserId, onClosed, className = "" }: Props) => {
  const [closing, setClosing] = useState(false);
  const [open, setOpen] = useState(false);

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
    <Card className={`rounded-lg border-red-100 ${className}`}>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="shrink-0 rounded-lg bg-red-50 p-3 text-red-700"><Flag className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="font-bold">펀딩 조기 마감</p>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              {unavailable
                ? "이미 종료되었거나 모집이 끝난 펀딩입니다."
                : "종료일을 기다리지 않고 지금 모집을 마감합니다. 현재까지 결제된 참여 수량으로 결과가 확정됩니다."}
            </p>
          </div>
        </div>
        <AlertDialog open={open} onOpenChange={(next) => !closing && setOpen(next)}>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={unavailable || closing}
              className="min-h-11 w-full shrink-0 rounded-full border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800 sm:w-auto"
            >
              <Flag className="mr-1.5 h-4 w-4" /> 펀딩 조기 마감
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-md rounded-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>펀딩을 조기 마감하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription className="leading-6">
                조기 마감 후에는 추가 참여가 불가능합니다.<br />
                현재까지 참여한 주문을 기준으로 펀딩 결과가 확정됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-lg bg-stone-50 px-4 py-3 text-sm">
              현재 참여 <strong>{funding.current_orders}장</strong> / 목표 <strong>{funding.moq}장</strong>
            </div>
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
                조기 마감하기
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
