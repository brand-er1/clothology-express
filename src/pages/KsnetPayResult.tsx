import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { fetchMyFundingParticipations } from "@/services/funding";
import { supabase } from "@/lib/supabase";
import { AlertCircle, CheckCircle2, Loader2, LogIn, XCircle } from "lucide-react";

type ResultState = "loading" | "success" | "cancelled" | "failed" | "auth-required";

/**
 * KSNET 결제창이 끝나면 ksnet-return 이 승인까지 마치고 이 화면으로 보낸다.
 * 여기서는 아무것도 확정하지 않고, DB 에 기록된 결제 상태를 그대로 보여준다.
 */
const KsnetPayResult = () => {
  const [searchParams] = useSearchParams();
  const participationId = searchParams.get("participationId");
  const [state, setState] = useState<ResultState>("loading");
  const [message, setMessage] = useState("결제 결과를 확인하고 있습니다.");
  const [fundingId, setFundingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!participationId) {
        setState("failed");
        setMessage("결제 참여번호가 없어 결과를 확인할 수 없습니다.");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setState("auth-required");
        setMessage("결제 결과를 확인하려면 다시 로그인해주세요.");
        return;
      }

      try {
        const participation = (await fetchMyFundingParticipations()).find((item) => item.id === participationId);
        if (!participation) throw new Error("결제 참여 내역을 찾을 수 없습니다.");
        setFundingId(participation.funding_id);

        if (participation.payment_status === "paid") {
          setState("success");
          setMessage("결제가 완료되어 펀딩 참여 수량에 반영되었습니다.");
        } else if (participation.payment_status === "cancelled") {
          setState("cancelled");
          setMessage("결제를 취소했습니다. 펀딩 참여 수량에는 반영되지 않았습니다.");
        } else {
          setState("failed");
          setMessage("결제가 완료되지 않았습니다. 다시 참여해주세요.");
        }
      } catch (error) {
        console.error(error);
        setState("failed");
        setMessage(error instanceof Error ? error.message : "결제 결과를 확인하지 못했습니다.");
      }
    };

    void load();
  }, [participationId]);

  const content = {
    loading: { icon: <Loader2 className="h-16 w-16 animate-spin text-brand" />, title: "결제 확인 중" },
    success: { icon: <CheckCircle2 className="h-16 w-16 text-emerald-600" />, title: "펀딩 참여 완료" },
    cancelled: { icon: <XCircle className="h-16 w-16 text-gray-400" />, title: "결제 취소" },
    failed: { icon: <AlertCircle className="h-16 w-16 text-red-500" />, title: "결제 미완료" },
    "auth-required": { icon: <LogIn className="h-16 w-16 text-brand" />, title: "로그인이 필요합니다" },
  }[state];

  const returnTo = `/payments/ksnet/result?${searchParams.toString()}`;

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <Header />
      <main className="container mx-auto flex min-h-screen max-w-2xl items-center px-4 py-24">
        <div className="w-full rounded-xl border bg-white px-6 py-14 text-center shadow-sm md:px-12">
          <div className="flex justify-center">{content.icon}</div>
          <h1 className="mt-6 text-3xl font-bold tracking-[-0.03em]">{content.title}</h1>
          <p className="mx-auto mt-4 max-w-md leading-7 text-gray-500">{message}</p>

          {state === "auth-required" ? (
            <div className="mt-9">
              <Button asChild className="rounded-full bg-brand hover:bg-brand-dark">
                <Link to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}>로그인하고 결과 확인하기</Link>
              </Button>
            </div>
          ) : state !== "loading" && (
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="rounded-full bg-brand hover:bg-brand-dark">
                <Link to="/my-fundings">내 펀딩 확인</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to={fundingId ? `/fundings/${fundingId}` : "/fundings"}>
                  {fundingId ? "펀딩 페이지로 돌아가기" : "펀딩 목록 보기"}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default KsnetPayResult;
