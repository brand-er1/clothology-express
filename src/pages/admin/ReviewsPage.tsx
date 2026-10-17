import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminRpc } from "@/services/adminApi";
import { reviewImageUrl } from "@/services/fundingReviews";
import { dateTime } from "@/lib/admin/format";
import {
  DataTable, EmptyState, ErrorBanner, FilterChips, LoadingBlock, PageHeader, Pager, Panel, SearchInput, StatusBadge, Td,
} from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";

type Status = "all" | "visible" | "hidden";

type ReviewRow = {
  id: string;
  funding_id: string;
  funding_name: string;
  brand_name: string | null;
  reviewer_id: string;
  nickname: string;
  rating: number;
  content: string;
  image_paths: string[];
  selected_color: string | null;
  selected_size: string | null;
  status: "visible" | "hidden";
  created_at: string;
};

type ReviewList = { total: number; counts: Record<Status, number>; can_moderate: boolean; rows: ReviewRow[] };

const PAGE_SIZE = 30;

const ReviewsPage = () => {
  const [status, setStatus] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState<ReasonDialogState>(null);
  useEffect(() => setPage(0), [status, search]);

  const { data, loading, error, reload } = useAdminQuery(
    () => adminRpc<ReviewList>("admin_list_funding_reviews", { p_status: status, p_search: search || null, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE }),
    [status, search, page],
  );
  const rows = data?.rows ?? [];

  const moderate = (review: ReviewRow, next: "visible" | "hidden") => setDialog({
    title: next === "hidden" ? "리뷰 숨김" : "리뷰 다시 노출",
    description: next === "hidden"
      ? "숨긴 리뷰는 펀딩 상세페이지 리뷰 목록과 평균 별점에서 빠집니다. 삭제되지 않으며 Audit Log 에 기록됩니다."
      : "리뷰를 다시 펀딩 상세페이지에 노출합니다.",
    confirmLabel: next === "hidden" ? "숨김 처리" : "다시 노출",
    destructive: next === "hidden",
    reasonRequired: next === "hidden",
    reasonLabel: next === "hidden" ? "숨김 사유" : "메모",
    onConfirm: (reason) => adminRpc("admin_set_funding_review_status", { p_review_id: review.id, p_status: next, p_reason: reason }),
    successMessage: next === "hidden" ? "리뷰를 숨겼습니다" : "리뷰를 다시 노출했습니다",
  });

  return (
    <div>
      <PageHeader eyebrow="Reviews" title="리뷰 관리" description="실제 구매자가 남긴 펀딩 리뷰입니다. 부적절한 리뷰는 삭제 대신 숨김 처리합니다." />
      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="닉네임 · 리뷰 내용 · 펀딩명" />
          <FilterChips value={status} onChange={(value) => setStatus(value as Status)} options={[
            { value: "all", label: "전체", count: data?.counts.all },
            { value: "visible", label: "노출", count: data?.counts.visible },
            { value: "hidden", label: "숨김", count: data?.counts.hidden },
          ]} />
        </div>
      }>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="리뷰가 없습니다" /> : (
          <>
            <DataTable minWidth={1000} head={["상태", "별점", "리뷰", "펀딩 · 브랜드", "작성자", "작성일", "관리"]}>
              {rows.map((review) => (
                <tr key={review.id} className="align-top hover:bg-stone-50">
                  <Td><StatusBadge tone={review.status === "hidden" ? "red" : "green"}>{review.status === "hidden" ? "숨김" : "노출"}</StatusBadge></Td>
                  <Td><span className="inline-flex items-center gap-1 font-bold"><Star className="h-3.5 w-3.5 fill-[#741b2b] text-[#741b2b]" />{review.rating}</span></Td>
                  <Td>
                    <p className="line-clamp-3 max-w-[360px] whitespace-pre-wrap break-words text-xs leading-5">{review.content}</p>
                    {review.image_paths.length > 0 && (
                      <div className="mt-1.5 flex gap-1">
                        {review.image_paths.slice(0, 4).map((path) => (
                          <a key={path} href={reviewImageUrl(path)} target="_blank" rel="noreferrer">
                            <img src={reviewImageUrl(path)} alt="리뷰 사진" loading="lazy" className="h-10 w-10 rounded border border-stone-200 object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-[11px] text-stone-400">옵션 {review.selected_color ?? "-"} / {review.selected_size ?? "-"}</p>
                  </Td>
                  <Td>
                    <Link to={`/fundings/${review.funding_id}?tab=reviews`} target="_blank" className="inline-flex max-w-[200px] items-center gap-1 truncate text-xs font-semibold text-[#741b2b] hover:underline">
                      {review.funding_name}<ArrowUpRight className="h-3 w-3 shrink-0" />
                    </Link>
                    <p className="text-[11px] text-stone-400">{review.brand_name ?? "-"}</p>
                  </Td>
                  <Td className="text-xs font-semibold">{review.nickname}</Td>
                  <Td className="whitespace-nowrap text-xs">{dateTime(review.created_at)}</Td>
                  <Td>
                    {data?.can_moderate ? (
                      review.status === "hidden"
                        ? <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => moderate(review, "visible")}>다시 노출</Button>
                        : <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600" onClick={() => moderate(review, "hidden")}>숨김</Button>
                    ) : <span className="text-xs text-stone-400">조회 전용</span>}
                  </Td>
                </tr>
              ))}
            </DataTable>
            <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Panel>
      <ReasonDialog state={dialog} onClose={() => setDialog(null)} onDone={reload} />
    </div>
  );
};

export default ReviewsPage;
