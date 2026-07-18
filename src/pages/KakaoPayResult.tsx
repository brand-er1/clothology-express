import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { approveKakaoPayFunding, cancelFundingParticipation } from "@/services/funding";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type PaymentResultKind = "success" | "cancel" | "fail";

const copy = {
  success: {
    pending: "카카오페이 결제를 확인하고 있습니다",
    done: "펀딩 참여가 완료됐습니다",
    description: "결제가 완료되어 펀딩 목표 수량에 반영됐습니다.",
  },
  cancel: {
    pending: "취소 내역을 정리하고 있습니다",
    done: "카카오페이 결제를 취소했습니다",
    description: "결제되지 않았으며 펀딩 수량에도 반영되지 않았습니다.",
  },
  fail: {
    pending: "결제 실패 내역을 정리하고 있습니다",
    done: "카카오페이 결제를 완료하지 못했습니다",
    description: "결제되지 않았습니다. 펀딩 상세에서 다시 시도할 수 있습니다.",
  },
} as const;

const KakaoPayResult = ({ kind }: { kind: PaymentResultKind }) => {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<"processing" | "done" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState("");
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const participationId = searchParams.get("participation_id") || "";
    const pgToken = searchParams.get("pg_token") || "";

    const processPayment = async () => {
      if (!participationId) {
        throw new Error("결제 참여번호가 없습니다.");
      }

      if (kind === "success") {
        if (!pgToken) throw new Error("카카오페이 승인번호가 없습니다.");
        await approveKakaoPayFunding(participationId, pgToken);
      } else {
        await cancelFundingParticipation(participationId);
      }
    };

    processPayment()
      .then(() => setState("done"))
      .catch((error) => {
        console.error(error);
        setErrorMessage(error instanceof Error ? error.message : "결제 상태를 반영하지 못했습니다.");
        setState("error");
      });
  }, [kind, searchParams]);

  const isSuccess = kind === "success" && state === "done";

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <Header />
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-24">
        <div className="w-full rounded-[2rem] border bg-white p-8 text-center shadow-sm md:p-12">
          {state === "processing" ? (
            <Loader2 className="mx-auto h-14 w-14 animate-spin text-brand" />
          ) : isSuccess ? (
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
          ) : (
            <XCircle className="mx-auto h-16 w-16 text-red-500" />
          )}

          <h1 className="mt-6 text-2xl font-bold md:text-3xl">
            {state === "processing" ? copy[kind].pending : state === "error" ? "결제 상태 확인이 필요합니다" : copy[kind].done}
          </h1>
          <p className="mt-3 leading-7 text-gray-500">
            {state === "error" ? errorMessage : state === "processing" ? "창을 닫지 말고 잠시 기다려주세요." : copy[kind].description}
          </p>

          {state !== "processing" && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild className="rounded-full bg-brand px-7 hover:bg-brand-dark">
                <Link to="/my-fundings">내 펀딩 참여 보기</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full px-7">
                <Link to="/fundings">펀딩 둘러보기</Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default KakaoPayResult;
