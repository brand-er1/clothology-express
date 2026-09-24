import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SafeBrandImage } from "@/components/brand/SafeBrandImage";
import type { AdminBrandSummary } from "@/types/brand";

export const BrandsAdminPanel = ({ brands }: { brands: AdminBrandSummary[] }) => (
  <Card className="rounded-2xl">
    <CardHeader>
      <CardTitle className="flex items-center justify-between gap-3">
        <span>전체 브랜드</span>
        <Badge variant="secondary">{brands.length}개</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent>
      {brands.length === 0 ? (
        <p className="py-16 text-center text-sm text-stone-500">등록된 브랜드가 없습니다.</p>
      ) : (
        <div className="grid gap-3">
          {brands.map((brand) => {
            const activeCount = brand.fundings.filter((funding) => funding.status === "approved").length;
            return (
              <article key={brand.id} className="grid min-w-0 gap-4 rounded-2xl border border-stone-200 p-4 sm:grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_110px_110px_120px] sm:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <SafeBrandImage src={brand.brand_logo_url} alt={brand.brand_name} kind="logo" className="h-12 w-12" />
                  <div className="min-w-0"><p className="truncate font-bold">{brand.brand_name}</p><p className="truncate text-xs text-stone-500">{brand.short_description || "소개 없음"}</p></div>
                </div>
                <div className="min-w-0"><p className="text-xs text-stone-400">제작자 계정</p><p className="truncate text-sm font-semibold">{brand.creator_profile?.display_name || brand.owner_user_id}</p></div>
                <div><p className="text-xs text-stone-400">진행 중</p><p className="mt-1 font-bold">{activeCount}개</p></div>
                <div><p className="text-xs text-stone-400">누적 펀딩</p><p className="mt-1 font-bold">{brand.fundings.length}개</p></div>
                <div><Badge className={brand.status === "active" ? "bg-emerald-600" : "bg-stone-500"}>{brand.status === "active" ? "정상" : "중지"}</Badge><p className="mt-2 text-xs text-stone-400">{new Date(brand.created_at).toLocaleDateString("ko-KR")}</p></div>
              </article>
            );
          })}
        </div>
      )}
    </CardContent>
  </Card>
);
