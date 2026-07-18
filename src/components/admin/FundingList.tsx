import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Funding } from "@/types/funding";
import { CheckCircle2, Clock3, Eye, XCircle } from "lucide-react";

const statusBadge = (status: Funding["status"]) => {
  if (status === "approved") return <Badge className="bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" />승인됨</Badge>;
  if (status === "rejected") return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />거절됨</Badge>;
  if (status === "closed") return <Badge variant="secondary">종료</Badge>;
  return <Badge className="bg-amber-500"><Clock3 className="mr-1 h-3 w-3" />승인 대기</Badge>;
};

export const FundingList = ({ fundings, onReview }: { fundings: Funding[]; onReview: (funding: Funding) => void }) => (
  <Card className="rounded-2xl">
    <CardHeader>
      <CardTitle className="flex items-center justify-between">
        <span>펀딩 승인 관리</span>
        <Badge variant="secondary">대기 {fundings.filter((item) => item.status === "pending").length}건</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent>
      {fundings.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-500">등록된 펀딩이 없습니다.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>디자인</TableHead>
                <TableHead>상품명</TableHead>
                <TableHead>MOQ</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fundings.map((funding) => (
                <TableRow key={funding.id}>
                  <TableCell>
                    <div className="h-14 w-14 overflow-hidden rounded-lg bg-gray-100">
                      <img src={funding.image_url} alt="" className="h-full w-full object-contain" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="max-w-64 truncate font-medium">{funding.product_name}</p>
                    <p className="text-xs text-gray-500">{funding.cloth_type} · {funding.color || "색상 미선택"}</p>
                  </TableCell>
                  <TableCell>{funding.moq}장</TableCell>
                  <TableCell>{statusBadge(funding.status)}</TableCell>
                  <TableCell>{new Date(funding.created_at).toLocaleDateString("ko-KR")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onReview(funding)}>
                      <Eye className="mr-1 h-4 w-4" /> {funding.status === "pending" ? "검토" : "상세"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
  </Card>
);
