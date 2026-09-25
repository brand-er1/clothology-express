import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { fetchFunding } from "@/services/funding";
import { fetchMyBrand } from "@/services/brand";
import {
  createDetailPage,
  fetchMyDetailPageForFunding,
  getDetailPageErrorMessage,
} from "@/services/detailPage";
import { buildDetailSourceFromFunding, refreshBrandInSource } from "@/lib/detail-page/source";

/**
 * /fundings/:id/detail-page — opens the funding's AI detail page, creating one from the
 * funding's existing data the first time (for fundings made before detail pages existed).
 */
const FundingDetailPageLauncher = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const open = async () => {
      try {
        const existing = await fetchMyDetailPageForFunding(id);
        if (existing) {
          if (!cancelled) navigate(`/detail-pages/${existing}`, { replace: true });
          return;
        }
        const funding = await fetchFunding(id);
        const brand = await fetchMyBrand().catch(() => null);
        const pageId = await createDetailPage({
          source: refreshBrandInSource(buildDetailSourceFromFunding(funding), brand),
          template: "minimal",
          fundingId: funding.id,
        });
        if (!cancelled) navigate(`/detail-pages/${pageId}`, { replace: true });
      } catch (openError) {
        if (!cancelled) setError(getDetailPageErrorMessage(openError, "상세페이지를 열지 못했습니다."));
      }
    };
    void open();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  return (
    <div className="min-h-screen bg-[#f3f1ed]">
      <Header />
      <main className="mx-auto max-w-lg px-5 pt-28 text-center">
        {error ? (
          <>
            <h1 className="text-xl font-bold">상세페이지를 열 수 없어요</h1>
            <p className="mt-3 text-sm text-stone-500">{error}</p>
            <Button asChild variant="outline" className="mt-6 rounded-md">
              <Link to={`/fundings/${id}/edit`}>펀딩 편집으로 돌아가기</Link>
            </Button>
          </>
        ) : (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand" />
        )}
      </main>
    </div>
  );
};

export default FundingDetailPageLauncher;
