import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { Funding } from "@/types/funding";
import { ExternalLink, Loader2, PackageCheck } from "lucide-react";

type Props = {
  funding: Funding | null;
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onReview: (status: "approved" | "rejected", comment: string) => Promise<void>;
};
export const FundingReviewDialog = ({ funding, open, saving, onOpenChange, onReview }: Props) => {
  const [comment, setComment] = useState("");

  useEffect(() => {
    setComment(funding?.admin_comment || "");
  }, [funding]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>펀딩 검토</DialogTitle></DialogHeader>
        {funding && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-gray-100 p-3">
                <img src={funding.image_url} alt={funding.product_name} className="h-full w-full object-contain" />
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
                  <div><dt className="text-gray-400">색상</dt><dd className="mt-1 font-medium">{funding.color || "-"}</dd></div>
                  <div><dt className="text-gray-400">사이즈</dt><dd className="mt-1 font-medium">{funding.size}</dd></div>
                  <div className="col-span-2"><dt className="text-gray-400">판매가</dt><dd className="mt-1 text-lg font-bold">{funding.price ? `${funding.price.toLocaleString("ko-KR")}원` : "미입력"}</dd></div>
                </dl>
                <Button asChild variant="outline" className="mt-4 w-full">
                  <a href={`/fundings/${funding.id}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> 펀딩 페이지 미리보기</a>
                </Button>
              </div>
            </div>
            <Separator />
            <div>
              <label htmlFor="funding-comment" className="mb-2 block text-sm font-medium">검토 의견</label>
              <Textarea id="funding-comment" value={comment} onChange={(event) => setComment(event.target.value)}
                placeholder="거절 시 수정할 내용을 구체적으로 적어주세요." className="min-h-24" />
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              승인하면 공개 펀딩 목록에 즉시 노출됩니다. MOQ는 20장 미만으로 승인할 수 없습니다.
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>닫기</Button>
          <Button variant="destructive" onClick={() => onReview("rejected", comment)} disabled={saving || !comment.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}거절하기
          </Button>
          <Button onClick={() => onReview("approved", comment)} disabled={saving || !funding?.price || (funding?.moq || 0) < 20}
            className="bg-brand hover:bg-brand-dark">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}승인하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
