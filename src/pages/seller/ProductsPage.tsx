import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, FileText, ImagePlus, PencilLine, Plus, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState, ErrorBanner, FilterChips, LoadingBlock, MappedBadge, Notice, PageHeader, Panel, SearchInput,
} from "@/components/admin/shell/ui";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { FUNDING_PHASE, num, won } from "@/lib/admin/format";
import { fetchSellerProducts, type SellerProduct } from "@/services/seller";

type Filter = "all" | "draft" | "selling" | "ended";

const groupOf = (p: SellerProduct): Exclude<Filter, "all"> =>
  ["draft", "pending", "rejected"].includes(p.phase) ? "draft" : ["funding", "approved"].includes(p.phase) ? "selling" : "ended";

const ProductCard = ({ product }: { product: SellerProduct }) => (
  <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
    <div className="relative aspect-[4/3] bg-stone-100">
      {product.image_url
        ? <img src={product.image_url} alt={product.product_name} loading="lazy" className="h-full w-full object-cover" />
        : <div className="flex h-full items-center justify-center text-xs text-stone-400">이미지 없음</div>}
      <span className="absolute left-3 top-3 rounded-full bg-white shadow-sm"><MappedBadge map={FUNDING_PHASE} value={product.phase} /></span>
    </div>
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="min-w-0">
        <h3 className="truncate text-base font-extrabold tracking-[-0.02em]">{product.product_name}</h3>
        <p className="mt-0.5 text-xs text-stone-500">{product.brand_name ?? "브랜드 미지정"} · {product.cloth_type} · {product.material}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div><dt className="text-stone-400">판매가</dt><dd className="font-bold tabular-nums">{product.price ? won(product.price) : "미정"}</dd></div>
        <div><dt className="text-stone-400">목표 수량</dt><dd className="font-bold tabular-nums">{num(product.moq)}장</dd></div>
        <div className="col-span-2">
          <dt className="text-stone-400">컬러 {product.color_count || product.color_options.length}종 · 사이즈 {product.size_options.length}종</dt>
          <dd className="mt-1 flex flex-wrap gap-1">
            {[...product.color_options.slice(0, 4), ...product.size_options.slice(0, 6)].map((option, index) => (
              <span key={`${option}-${index}`} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">{option}</span>
            ))}
          </dd>
        </div>
        <div><dt className="text-stone-400">실결제 주문</dt><dd className="font-bold tabular-nums">{num(product.real_paid_orders)}건 · {won(product.real_amount)}</dd></div>
        <div><dt className="text-stone-400">리뷰</dt><dd className="inline-flex items-center gap-1 font-bold"><Star className="h-3 w-3 fill-[#741b2b] text-[#741b2b]" />{product.review_count ? `${Number(product.average_rating).toFixed(1)} (${product.review_count})` : "-"}</dd></div>
      </dl>
      {product.status === "rejected" && product.admin_comment && <Notice>반려 사유: {product.admin_comment}</Notice>}
      <div className="mt-auto grid grid-cols-2 gap-2">
        {product.can_edit ? (
          <Button asChild size="sm" variant="outline">
            <Link to={`/fundings/${product.id}/edit`}><PencilLine className="mr-1 h-3.5 w-3.5" />정보 · 가격 · 옵션</Link>
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled title="운영 중단 · 종료된 상품은 수정할 수 없습니다"><PencilLine className="mr-1 h-3.5 w-3.5" />수정 불가</Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to={`/fundings/${product.id}/colors`}><ImagePlus className="mr-1 h-3.5 w-3.5" />컬러 · 이미지</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to={`/fundings/${product.id}/detail-page`}><FileText className="mr-1 h-3.5 w-3.5" />상세페이지</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to={`/seller/orders?funding=${product.id}`}><Users className="mr-1 h-3.5 w-3.5" />주문자</Link>
        </Button>
        <Button asChild size="sm" variant="ghost" className="col-span-2 text-xs text-stone-500">
          <Link to={`/fundings/${product.id}`} target="_blank">상품 페이지 보기 <ExternalLink className="ml-1 h-3 w-3" /></Link>
        </Button>
      </div>
    </div>
  </article>
);

const ProductsPage = () => {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const { data, loading, error, reload } = useAdminQuery(fetchSellerProducts, []);

  const rows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("ko-KR");
    return (data ?? []).filter((p) => (filter === "all" || groupOf(p) === filter)
      && (!keyword || p.product_name.toLocaleLowerCase("ko-KR").includes(keyword)));
  }, [data, filter, search]);
  const count = (f: Exclude<Filter, "all">) => (data ?? []).filter((p) => groupOf(p) === f).length;

  return (
    <div>
      <PageHeader
        eyebrow="Products"
        title="상품 관리"
        description="상품 정보 · 가격 · 옵션 · 컬러와 사이즈 · 이미지를 관리합니다. 판매 중인 상품의 변경은 운영 정책에 따라 서버에서 다시 검증됩니다."
        actions={<Button asChild size="sm" className="bg-[#741b2b] hover:bg-[#5c1522]"><Link to="/design-quote"><Plus className="mr-1 h-4 w-4" />새 상품 등록</Link></Button>}
      />
      <Notice tone="stone">
        새 상품은 <b>디자인 견적</b>에서 디자인과 제작 견적을 확인한 뒤 펀딩 상품으로 등록합니다. 등록 후 관리자 승인을 받으면 펀딩이 시작됩니다.
        이미지 업로드는 본인 폴더에만 저장되며 JPG · PNG · WEBP 형식만 허용됩니다.
      </Notice>
      <Panel className="mt-4" bodyClassName="p-4" title={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="상품명 검색" />
          <FilterChips<Filter> value={filter} onChange={setFilter} options={[
            { value: "all", label: "전체", count: data?.length },
            { value: "draft", label: "작성 · 승인 대기", count: count("draft") },
            { value: "selling", label: "판매 중", count: count("selling") },
            { value: "ended", label: "종료 · 제작", count: count("ended") },
          ]} />
        </div>
      }>
        {error && <ErrorBanner message={error} onRetry={reload} />}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? (
          <EmptyState title={data?.length ? "조건에 맞는 상품이 없습니다" : "아직 등록한 상품이 없습니다"} description="디자인 견적에서 첫 상품을 만들어보세요." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {rows.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default ProductsPage;
