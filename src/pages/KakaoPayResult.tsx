import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { approveKakaoPayFunding, cancelFundingParticipation } from "@/services/funding";
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";

type ResultState = "loading" | "success" | "cancelled" | "failed";

const KakaoPayResult = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<ResultState>("loading");
  const [message, setMessage] = useState("카카오페이 결제 결과를 확인하고 있습니다.");
  const [fundingId, setFundingId] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const processPayment = async () => {
      const participationId = searchParams.get("participationId");
      const pgToken = searchParams.get("pg_token");
      const resultType = location.pathname.split("/").pop();

      if (!participationId) {
        setState("failed");
        setMessage("결제 참여번호가 없어 결과를 확인할 수 없습니다.");
        return;
      }

      try {
        if (resultType === "success") {
          if (!pgToken) throw new Error("카카오페이 승인번호가 없습니다.");
          const result = await approveKakaoPayFunding(participationId, pgToken);
          setFundingId(result.funding_id);
          setState("success");
          setMessage("결제가 완료되어 펀딩 참여 수량에 반영되었습니다.");
          return;
        }

        const result = await cancelFundingParticipation(participationId);
        setFundingId(result.funding_id || null);
        setState(resultType === "cancel" ? "cancelled" : "failed");
        setMessage(resultType === "cancel"
          ? "결제를 취소했습니다. 펀딩 참여 수량에는 반영되지 않았습니다."
          : "결제가 완료되지 않았습니다. 다시 참여해주세요.");
      } catch (error) {
        console.error(error);
        setState("failed");
        setMessage(error instanceof Error ? error.message : "결제 결과를 처리하지 못했습니다.");
      }
    };

    processPayment();
  }, [location.pathname, searchParams]);

  const content = {
    loading: {
      icon: <Loader2 className="h-16 w-16 animate-spin text-brand" />,
      title: "결제 확인 중",
    },
    success: {
      icon: <CheckCircle2 className="h-16 w-16 text-emerald-600" />,
      title: "펀딩 참여 완료",
    },
    cancelled: {
      icon: <XCircle className="h-16 w-16 text-gray-400" />,
      title: "결제 취소",
    },
    failed: {
      icon: <AlertCircle className="h-16 w-16 text-red-500" />,
      title: "결제 미완료",
    },
  }[state];

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <Header />
      <main className="container mx-auto flex min-h-screen max-w-2xl items-center px-4 py-24">
        <div className="w-full rounded-[2rem] border bg-white px-6 py-14 text-center shadow-sm md:px-12">
          <div className="flex justify-center">{content.icon}</div>
          <h1 className="mt-6 text-3xl font-bold">{content.title}</h1>
          <p className="mx-auto mt-4 max-w-md leading-7 text-gray-500">{message}</p>

          {state !== "loading" && (
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

export default KakaoPayResult;
