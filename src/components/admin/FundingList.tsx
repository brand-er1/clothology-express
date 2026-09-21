import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminFundingOverview, Funding } from "@/types/funding";
import { fetchAdminFundingOverview } from "@/services/funding";
import {
  CheckCircle2, Clock3, Eye, PackageCheck, ShieldAlert, ShieldCheck, TrendingUp, Users, WalletCards, XCircle,
} from "lucide-react";

const EMPTY_OVERVIEW: AdminFundingOverview = {
  total_fundings: 0,
  active_fundings: 0,
  total_participants: 0,
  total_quantity: 0,
  total_mock_amount: 0,
  total_real_amount: 0,
  avg_funding_rate: 0,
};

const statusBadge = (status: Funding["status"]) => {
  if (status === "approved") return <Badge className="bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" />승인됨</Badge>;
  if (status === "rejected") return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />거절됨</Badge>;
  if (status === "closed") return <Badge variant="secondary">종료</Badge>;
  return <Badge className="bg-amber-500"><Clock3 className="mr-1 h-3 w-3" />승인 대기</Badge>;
};

const trademarkBadge = (funding: Funding) => {
  const screening = funding.trademark_screening;
  if (!screening) {
    if (!funding.trademark_screening_required) {
      return <Badge variant="secondary">기존 등록</Badge>;
    }
    return <Badge variant="destructive"><ShieldAlert className="mr-1 h-3 w-3" />미검수</Badge>;
  }
  if (screening.decision === "blocked") {
    return <Badge variant="destructive"><ShieldAlert className="mr-1 h-3 w-3" />차단</Badge>;
  }
  if (screening.decision === "review") {
    return <Badge className="bg-amber-500"><ShieldAlert className="mr-1 h-3 w-3" />검토 필요</Badge>;
  }
  return <Badge className="bg-emerald-600"><ShieldCheck className="mr-1 h-3 w-3" />통과</Badge>;
};

export const FundingList = ({ fundings, onReview }: { fundings: Funding[]; onReview: (funding: Funding) => void }) => {
  const [overview, setOverview] = useState<AdminFundingOverview>(EMPTY_OVERVIEW);

  useEffect(() => {
    fetchAdminFundingOverview().then(setOverview).catch(() => setOverview(EMPTY_OVERVIEW));
  }, []);

  return (
  <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <OverviewCard icon={PackageCheck} label="전체 펀딩 수" value={`${overview.total_fundings.toLocaleString("ko-KR")}건`} note={`진행 중 ${overview.active_fundings.toLocaleString("ko-KR")}건`} />
      <OverviewCard icon={Users} label="전체 참여자 수" value={`${overview.total_participants.toLocaleString("ko-KR")}명`} note={`총 참여 수량 ${overview.total_quantity.toLocaleString("ko-KR")}장`} />
      <OverviewCard icon={TrendingUp} label="평균 펀딩 달성률" value={`${overview.avg_funding_rate}%`} note="승인된 펀딩 기준" />
      <OverviewCard icon={WalletCards} label="모의결제 주문금액" value={`${overview.total_mock_amount.toLocaleString("ko-KR")}원`} note="실제 매출 아님 · 사업성 검증용" />
      <OverviewCard icon={WalletCards} label="실제결제 매출" value={`${overview.total_real_amount.toLocaleString("ko-KR")}원`} note="카카오페이 등 실결제 기준" />
    </div>

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
                <TableHead>상표검수</TableHead>
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
                    <p className="text-xs text-gray-500">{funding.cloth_type} · 컬러 {funding.color_options?.length || 1}종 · 사이즈 {funding.size_options?.length || 1}종</p>
                  </TableCell>
                  <TableCell>{funding.moq}장</TableCell>
                  <TableCell>{trademarkBadge(funding)}</TableCell>
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
  </div>
  );
};

const OverviewCard = ({
  icon: Icon, label, value, note,
}: { icon: typeof Users; label: string; value: string; note: string }) => (
  <Card className="rounded-2xl">
    <CardContent className="flex items-center gap-4 p-5">
      <div className="rounded-2xl bg-brand/10 p-3 text-brand"><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-gray-400">{note}</p>
      </div>
    </CardContent>
  </Card>
);
