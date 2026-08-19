import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Eye,
  ImageOff,
  PackageCheck,
  Search,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type Order } from "@/types/order";

interface OrderListProps {
  orders: Order[];
  onReviewOrder: (order: Order) => void;
}

type OrderFilter = "all" | "pending" | "approved" | "rejected";

const statusMeta = {
  pending: {
    label: "신규 의뢰",
    icon: Clock3,
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  approved: {
    label: "접수 완료",
    icon: CheckCircle2,
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  rejected: {
    label: "진행 불가",
    icon: XCircle,
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
  },
} as const;

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatWonRange = (minimum: number, maximum: number) =>
  minimum === maximum
    ? `${minimum.toLocaleString("ko-KR")}원`
    : `${minimum.toLocaleString("ko-KR")}원 ~ ${maximum.toLocaleString("ko-KR")}원`;

export const OrderList = ({ orders, onReviewOrder }: OrderListProps) => {
  const [filter, setFilter] = useState<OrderFilter>("pending");
  const [searchQuery, setSearchQuery] = useState("");

  const counts = {
    all: orders.length,
    pending: orders.filter((order) => order.status === "pending").length,
    approved: orders.filter((order) => order.status === "approved").length,
    rejected: orders.filter((order) => order.status === "rejected").length,
  };

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return orders
      .filter((order) => filter === "all" || order.status === filter)
      .filter((order) => {
        if (!normalizedSearch) return true;
        return [
          order.request_title,
          order.cloth_type,
          order.material,
          order.detail_description,
        ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [filter, orders, searchQuery]);

  const filterOptions: Array<{
    value: OrderFilter;
    label: string;
    icon: typeof Clock3;
  }> = [
    { value: "pending", label: "신규", icon: Clock3 },
    { value: "approved", label: "접수 완료", icon: CheckCircle2 },
    { value: "rejected", label: "진행 불가", icon: XCircle },
    { value: "all", label: "전체", icon: PackageCheck },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-stone-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl md:text-2xl">제작 의뢰 관리</CardTitle>
          <p className="text-sm leading-6 text-stone-500">
            신규 의뢰부터 먼저 확인하세요. 업로드 디자인은 이미지와 자동견적이
            한 화면에 함께 표시됩니다.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {filterOptions.map(({ value, label, icon: Icon }) => {
              const active = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-brand bg-brand text-white shadow-sm"
                      : "border-stone-200 bg-stone-50 text-stone-700 hover:border-brand/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="text-2xl font-black">
                      {counts[value].toLocaleString()}
                    </span>
                  </div>
                  <p className={`mt-2 text-xs font-bold ${active ? "text-white/80" : "text-stone-500"}`}>
                    {label}
                  </p>
                </button>
              );
            })}
          </div>

          <label className="relative mt-4 block">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="의류 종류, 소재, 요청 내용 검색"
              className="h-12 rounded-2xl border-stone-200 bg-stone-50 pl-11"
            />
          </label>
        </CardContent>
      </Card>

      {filteredOrders.length === 0 ? (
        <Card className="border-stone-200 px-5 py-14 text-center shadow-sm">
          <PackageCheck className="mx-auto h-8 w-8 text-stone-300" />
          <p className="mt-4 font-bold text-stone-700">
            조건에 맞는 제작 의뢰가 없습니다
          </p>
          <p className="mt-1 text-sm text-stone-500">
            다른 상태를 선택하거나 검색어를 지워보세요.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredOrders.map((order) => {
            const estimate = order.estimate_snapshot;
            const status =
              statusMeta[order.status as keyof typeof statusMeta] ||
              statusMeta.pending;
            const StatusIcon = status.icon;
            const isDesignUpload = order.request_source === "design_upload";
            const isReadyMadeGroupWear = order.request_source === "ready_made_group_wear";

            return (
              <Card
                key={order.id}
                className={`overflow-hidden shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  order.status === "pending"
                    ? "border-brand/40 ring-1 ring-brand/10"
                    : "border-stone-200"
                }`}
              >
                <CardContent className="p-0">
                  <div className="grid min-h-52 grid-cols-[116px_minmax(0,1fr)] sm:grid-cols-[150px_minmax(0,1fr)]">
                    <div className="relative flex items-center justify-center bg-stone-100">
                      {order.generated_image_url ? (
                        <img
                          src={order.generated_image_url}
                          alt={order.request_title || order.cloth_type}
                          className="h-full max-h-64 w-full object-cover"
                        />
                      ) : (
                        <ImageOff className="h-7 w-7 text-stone-300" />
                      )}
                      {(order.reference_image_paths?.length ?? 0) > 1 && (
                        <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                          +{(order.reference_image_paths?.length ?? 1) - 1}
                        </span>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-col p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={status.badgeClass}
                        >
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                        {isDesignUpload && (
                          <Badge className="bg-brand/10 text-brand hover:bg-brand/10">
                            <Sparkles className="mr-1 h-3 w-3" />
                            내 디자인 견적
                          </Badge>
                        )}
                        {isReadyMadeGroupWear && (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                            <Zap className="mr-1 h-3 w-3" />
                            빠른 단체복
                          </Badge>
                        )}
                      </div>

                      <h3 className="mt-3 truncate text-lg font-black text-stone-950">
                        {order.request_title || `${order.cloth_type} 제작 의뢰`}
                      </h3>
                      <p className="mt-1 truncate text-sm font-semibold text-stone-500">
                        {order.cloth_type} · {order.material}
                      </p>
                      <p className="mt-2 text-xs text-stone-400">
                        {formatDate(order.created_at)}
                      </p>

                      {estimate && (
                        <div className="mt-4 rounded-xl bg-stone-50 px-3 py-2.5">
                          <p className="text-[11px] font-bold text-stone-400">
                            {order.requested_quantity || estimate.totals.quantity}장 예상 제작비
                          </p>
                          <p className="mt-1 font-black text-brand">
                            {formatWonRange(
                              estimate.totals.totalMin,
                              estimate.totals.totalMax,
                            )}
                          </p>
                        </div>
                      )}

                      <Button
                        type="button"
                        onClick={() => onReviewOrder(order)}
                        className={`mt-4 h-10 w-full rounded-full ${
                          order.status === "pending"
                            ? "bg-brand hover:bg-brand-dark"
                            : "bg-stone-900 hover:bg-stone-800"
                        }`}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {order.status === "pending" ? "신규 의뢰 검토" : "상세 확인"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
