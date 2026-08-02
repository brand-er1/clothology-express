import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { Funding } from "@/types/funding";
import { CircleAlert, ExternalLink, Loader2, PackageCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { getMinimumOrderQuantity } from "@/lib/minimum-order-quantity";

const similarityScoreLabels = [
  ["text", "문자"],
  ["shape", "도형"],
  ["color", "색상"],
  ["placement", "배치"],
  ["transformation", "변형 복원"],
  ["productClass", "상품류"],
] as const;

type Props = {
  funding: Funding | null;
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onReview: (
    status: "approved" | "rejected",
    comment: string,
    reviewValues: Pick<Funding, "moq" | "price">,
  ) => Promise<void>;
};
export const FundingReviewDialog = ({ funding, open, saving, onOpenChange, onReview }: Props) => {
  const [comment, setComment] = useState("");
  const [moq, setMoq] = useState("20");
  const [price, setPrice] = useState("");
  const screening = funding?.trademark_screening || null;
  const minimumOrderQuantity = funding
    ? getMinimumOrderQuantity(funding.cloth_type, funding.material)
    : 20;

  useEffect(() => {
    setComment(funding?.admin_comment || "");
    setMoq(
      String(Math.max(funding?.moq || 20, minimumOrderQuantity)),
    );
    setPrice(funding?.price == null ? "" : String(funding.price));
  }, [funding, minimumOrderQuantity]);

  const parsedMoq = Number(moq);
  const parsedPrice = price.trim() ? Number(price) : null;
  const approvalIssues = funding
    ? [
        !Number.isInteger(parsedMoq) || parsedMoq < minimumOrderQuantity
          ? `MOQ를 ${minimumOrderQuantity}장 이상으로 입력해주세요.`
          : null,
        parsedPrice == null ||
        !Number.isInteger(parsedPrice) ||
        parsedPrice <= 0
          ? "공개 전에 판매가를 1원 이상 입력해주세요."
          : null,
        funding.trademark_screening_required && !screening
          ? "연결된 상표 검수 기록이 없습니다."
          : null,
        funding.trademark_screening_required && screening?.decision === "blocked"
          ? "상표 고위험 차단 건은 승인할 수 없습니다."
          : null,
      ].filter((issue): issue is string => Boolean(issue))
    : ["펀딩 정보를 불러오지 못했습니다."];

  const reviewValues: Pick<Funding, "moq" | "price"> = {
    moq: Number.isFinite(parsedMoq) ? parsedMoq : 0,
    price: parsedPrice != null && Number.isInteger(parsedPrice) ? parsedPrice : null,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>펀딩 검토</DialogTitle></DialogHeader>
        {funding && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gray-100 p-3">
                <img src={funding.image_url} alt={funding.product_name} className="h-full w-full object-contain" />
                {screening?.candidate_regions?.map((region) => (
                  <div
                    key={region.id}
                    className="pointer-events-none absolute border-2 border-rose-500 bg-rose-500/10"
                    style={{
                      left: `${region.boundingBox.x}%`,
                      top: `${region.boundingBox.y}%`,
                      width: `${region.boundingBox.width}%`,
                      height: `${region.boundingBox.height}%`,
                    }}
                  >
                    <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {region.label}
                    </span>
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="secondary">MOQ {funding.moq}장</Badge>
                  <Badge variant="outline">{funding.funding_days}일</Badge>
                </div>
                <h2 className="text-2xl font-bold">{funding.product_name}</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">{funding.description || "소개 문구 없음"}</p>
                <dl className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 text-sm">
                  <div><dt className="text-gray-400">종류</dt><dd className="mt-1 font-medium">{funding.cloth_type}</dd></div>
                  <div><dt className="text-gray-400">소재</dt><dd className="mt-1 font-medium">{funding.material}</dd></div>
                  <div><dt className="text-gray-400">출시 컬러</dt><dd className="mt-1 font-medium">{(funding.color_options?.length ? funding.color_options : [funding.color || "-"]).join(", ")}</dd></div>
                  <div><dt className="text-gray-400">출시 사이즈</dt><dd className="mt-1 font-medium">{(funding.size_options?.length ? funding.size_options : [funding.size]).join(", ")}</dd></div>
                  <div className="col-span-2"><dt className="text-gray-400">판매가</dt><dd className="mt-1 text-lg font-bold">{funding.price ? `${funding.price.toLocaleString("ko-KR")}원` : "미입력"}</dd></div>
                </dl>
                <Button asChild variant="outline" className="mt-4 w-full">
                  <Link to={`/fundings/${funding.id}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> 펀딩 페이지 미리보기</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-4 rounded-2xl border bg-stone-50 p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="funding-review-moq">승인 MOQ</Label>
                <div className="relative">
                  <Input
                    id="funding-review-moq"
                    type="number"
                    min={minimumOrderQuantity}
                    step={1}
                    value={moq}
                    onChange={(event) => setMoq(event.target.value)}
                    className="h-11 pr-10 bg-white"
                  />
                  <span className="pointer-events-none absolute right-3 top-3 text-sm text-gray-400">장</span>
                </div>
                <p className="text-xs text-gray-500">이 품목은 {minimumOrderQuantity}장 이상이어야 승인할 수 있습니다.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="funding-review-price">승인 판매가</Label>
                <div className="relative">
                  <Input
                    id="funding-review-price"
                    type="number"
                    min={1}
                    step={1000}
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder="판매가 입력"
                    className="h-11 pr-10 bg-white"
                  />
                  <span className="pointer-events-none absolute right-3 top-3 text-sm text-gray-400">원</span>
                </div>
                <p className="text-xs text-gray-500">판매가가 비어 있던 기존 승인 요청도 여기서 입력할 수 있습니다.</p>
              </div>
            </div>
            <Separator />
            <div
              className={`rounded-2xl border p-4 ${
                !screening || screening.decision === "blocked"
                  ? "border-red-200 bg-red-50"
                  : screening.decision === "review"
                    ? "border-amber-200 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {screening?.decision === "clear" ? (
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <ShieldAlert
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      screening?.decision === "review"
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-gray-950">
                    {!screening
                      ? funding?.trademark_screening_required
                        ? "상표 검수 기록 없음"
                        : "상표 검수 도입 전 등록 건"
                      : screening.decision === "blocked"
                        ? "상표 위험 차단"
                        : screening.decision === "review"
                          ? "상표 권리 확인 필요"
                          : "상표 자동 검수 통과"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-gray-700">
                    {screening?.reason ||
                      (funding?.trademark_screening_required
                        ? "최종 이미지 상표 검수가 완료되지 않았습니다."
                        : "상표 검수 기능 도입 전에 등록된 기존 펀딩입니다.")}
                  </p>
                  {screening && (
                    <div className="mt-3 rounded-xl bg-white/80 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-gray-600">
                          복합 상표 위험점수
                        </p>
                        <p className="text-lg font-black text-gray-950">
                          {Math.round(screening.composite_risk_score || 0)}
                          <span className="ml-0.5 text-xs font-bold text-gray-400">
                            /100
                          </span>
                        </p>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${
                            screening.decision === "blocked"
                              ? "bg-red-500"
                              : screening.decision === "review"
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, screening.composite_risk_score || 0),
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {similarityScoreLabels.map(([key, label]) => (
                          <div
                            key={key}
                            className="rounded-lg border border-black/5 bg-white px-2.5 py-2"
                          >
                            <p className="text-[10px] font-bold text-gray-400">
                              {label}
                            </p>
                            <p className="mt-0.5 text-sm font-extrabold text-gray-800">
                              {Math.round(screening.similarity_scores?.[key] || 0)}
                            </p>
                          </div>
                        ))}
                      </div>
                      {screening.decision_factors?.length ? (
                        <ul className="mt-3 space-y-1 text-xs leading-5 text-gray-600">
                          {screening.decision_factors.map((factor, index) => (
                            <li key={`${factor}-${index}`}>• {factor}</li>
                          ))}
                        </ul>
                      ) : null}
                      {screening.source_priority_applied && (
                        <p className="mt-2 text-[11px] font-bold text-violet-700">
                          사용자 업로드 아트워크 분석 결과를 동일 후보보다 우선 적용
                        </p>
                      )}
                    </div>
                  )}
                  {screening?.detected_marks?.length ? (
                    <div className="mt-3 rounded-xl bg-white/75 p-3 text-sm">
                      <p className="text-xs font-bold text-gray-500">
                        AI 감지 표지
                      </p>
                      <ul className="mt-1 space-y-1">
                        {screening.detected_marks.map((mark, index) => (
                          <li key={`${mark.normalizedName}-${index}`}>
                            <span className="font-bold">
                              {mark.displayName}
                            </span>
                            <span className="ml-2 text-xs text-gray-500">
                              신뢰도 {Math.round(mark.confidence * 100)}%
                            </span>
                            {mark.evidence && (
                              <p className="text-xs leading-5 text-gray-600">
                                {mark.evidence}
                              </p>
                            )}
                            {mark.normalizationResults?.length ? (
                              <p className="mt-1 text-[11px] leading-4 text-gray-500">
                                변형 비교:{" "}
                                {mark.normalizationResults
                                  .map(
                                    (result) =>
                                      `${result.method} ${result.similarity}`,
                                  )
                                  .join(" · ")}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-gray-600">
                    <span className="rounded-full bg-white/80 px-2.5 py-1">
                      KIPRIS 공식 DB{" "}
                      {screening?.kipris_checked ? "조회 완료" : "추가 확인 필요"}
                    </span>
                    {screening?.recognized_text?.length ? (
                      <span className="rounded-full bg-white/80 px-2.5 py-1">
                        인식 문자: {screening.recognized_text.join(", ")}
                      </span>
                    ) : null}
                  </div>
                  {screening?.kipris_matches?.length ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-bold text-gray-600">
                        KIPRIS 유사·동일 검색 결과
                      </p>
                      {screening.kipris_matches.slice(0, 5).map((match, index) => (
                        <div
                          key={`${match.applicationNumber || match.trademarkName}-${index}`}
                          className="rounded-lg border border-black/5 bg-white/80 px-3 py-2 text-xs"
                        >
                          <p className="font-bold text-gray-900">
                            {match.trademarkName || match.query}
                          </p>
                          <p className="mt-0.5 text-gray-500">
                            출원번호 {match.applicationNumber || "-"} · 상태{" "}
                            {match.applicationStatus || "확인 필요"} · 분류{" "}
                            {match.classification || "확인 필요"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <label htmlFor="funding-comment" className="mb-2 block text-sm font-medium">검토 의견</label>
              <Textarea id="funding-comment" value={comment} onChange={(event) => setComment(event.target.value)}
                placeholder={screening?.decision === "review"
                  ? "권리 보유 또는 사용 허가 확인 내용을 기록해주세요."
                  : "거절 시 수정할 내용을 구체적으로 적어주세요."}
                className="min-h-24" />
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              승인하면 공개 펀딩 목록에 즉시 노출됩니다. MOQ는 20장 미만으로 승인할 수 없습니다.
            </div>
            {approvalIssues.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">승인 전 확인이 필요합니다</p>
                  <ul className="mt-1 space-y-1">
                    {approvalIssues.map((issue) => <li key={issue}>• {issue}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>닫기</Button>
          <Button variant="destructive" onClick={() => onReview("rejected", comment, reviewValues)} disabled={saving || !comment.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}거절하기
          </Button>
          <Button onClick={() => onReview("approved", comment, reviewValues)} disabled={saving || approvalIssues.length > 0}
            className="bg-brand hover:bg-brand-dark">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}승인하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
