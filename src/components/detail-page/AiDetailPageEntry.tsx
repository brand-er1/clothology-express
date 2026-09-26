import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublishStateBadge } from "@/components/detail-page/DetailStudioExtras";
import { fetchMyDetailPageSummary } from "@/services/detailPage";
import type { DetailPagePublishState } from "@/types/detailPage";

/**
 * "✨ AI 상세페이지 제작" entry card. Reused by the funding editor (existing fundings, via
 * /fundings/:id/detail-page which only opens the signed-in creator's own page) and by any
 * new-funding surface that passes `to` pointing at a draft detail page.
 */
export const AiDetailPageEntry = ({ fundingId, to }: { fundingId?: string; to?: string }) => {
  const [state, setState] = useState<DetailPagePublishState | null>(null);
  const [hasPage, setHasPage] = useState(false);

  useEffect(() => {
    if (!fundingId) return;
    let cancelled = false;
    fetchMyDetailPageSummary(fundingId)
      .then((summary) => {
        if (cancelled || !summary) return;
        setHasPage(true);
        setState(summary.state);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [fundingId]);

  const target = to ?? (fundingId ? `/fundings/${fundingId}/detail-page` : "/customize");

  return (
    <div className="mb-6 flex flex-col gap-3 border border-stone-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">AI Detail Page</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-base font-bold">AI 상세페이지</p>
          {hasPage && <PublishStateBadge state={state} />}
        </div>
        <p className="mt-1 text-sm leading-6 text-gray-500">
          등록된 상품 정보와 의류 이미지로 AI가 카피와 상세페이지용 이미지(대표컷·디테일·원단·룩북·플랫레이)를 만들고 섹션을 구성합니다.
          편집 내용은 ‘상세페이지 적용’을 눌러야 펀딩 화면에 반영되며, 가격·수량·참여자 정보는 바뀌지 않아요.
        </p>
      </div>
      <Button asChild className="h-11 shrink-0 rounded-md bg-brand hover:bg-brand-dark">
        <Link to={target}>
          <Sparkles className="mr-1.5 h-4 w-4" />
          {hasPage ? "✨ AI 상세페이지 편집" : "✨ AI 상세페이지 제작"}
        </Link>
      </Button>
    </div>
  );
};
