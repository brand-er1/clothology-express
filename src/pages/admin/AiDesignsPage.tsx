import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Download, ImageOff, Loader2, Sparkles, Upload, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { adminRpc } from "@/services/adminApi";
import { FUNDING_PHASE, dateOnly, dateTime, errorMessage, num } from "@/lib/admin/format";
import {
  DefinitionGrid, EmptyState, ErrorBanner, FilterChips, LoadingBlock, Notice, PageHeader, Panel, SearchInput, StatusBadge,
} from "@/components/admin/shell/ui";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";

type Kind = "all" | "ai" | "upload";
type FundingFilter = "all" | "linked" | "unlinked";
type Sort = "latest" | "oldest";

type LinkedFunding = {
  id: string;
  name: string;
  status: string;
  phase: string;
  funding_status: string | null;
  early_closed: boolean | null;
  current_orders: number | null;
  moq: number | null;
  created_at: string;
};

type DesignRow = {
  key: string;
  kind: "ai" | "upload";
  source_table: "generated_images" | "designs" | "orders";
  source_id: string;
  design_source: string | null;
  user_id: string;
  username: string | null;
  user_name: string | null;
  created_at: string;
  image_url: string | null;
  image_path: string | null;
  category: string | null;
  prompt_excerpt: string | null;
  funding: LinkedFunding | null;
};

type DesignList = { total: number; counts: Record<Kind, number>; rows: DesignRow[] };

type DesignDetail = Omit<DesignRow, "prompt_excerpt"> & {
  design_id: string | null;
  prompt: string | null;
  generation_prompt: string | null;
  detail: string | null;
  fabric: string | null;
  fit: string | null;
  color: string | null;
  extra: { reference_image_paths?: string[]; request_title?: string | null; requested_quantity?: number | null; order_status?: string };
};

const PAGE_SIZE = 40;

// 이미지가 만들어진 경로(DB 의 출처 컬럼 그대로). 모르는 값은 원문을 보여준다.
const SOURCE_LABEL: Record<string, string> = {
  generated_images: "AI 생성",
  customize: "AI 생성 · 디자인 만들기",
  closet: "AI 생성 · 옷장",
  final_design: "AI 생성 · 디자인 수정 결과",
  design_upload: "직접 업로드 · 제작 의뢰",
};

const sourceLabel = (row: Pick<DesignRow, "source_table" | "design_source">) =>
  (row.design_source && SOURCE_LABEL[row.design_source]) || row.design_source || SOURCE_LABEL[row.source_table] || row.source_table;

// 기존 이미지는 generated_images 버킷(공개)에 있다. 저장된 URL 이 없으면 경로로 공개 URL 을 만든다(복사하지 않음).
const resolveImage = (url: string | null, path: string | null) =>
  url || (path ? supabase.storage.from("generated_images").getPublicUrl(path).data.publicUrl : null);

const displayName = (row: Pick<DesignRow, "username" | "user_name">) => row.username || row.user_name || "이름 없음";

const downloadImage = async (url: string, filename: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  } catch {
    // 교차 출처 등으로 바로 받을 수 없으면 새 탭에서 원본을 연다.
    window.open(url, "_blank", "noopener");
    toast({ title: "새 탭에서 원본을 열었습니다", description: "이미지를 길게 누르거나 우클릭해 저장해주세요." });
  }
};

const FundingBadge = ({ funding }: { funding: LinkedFunding | null }) => funding
  ? <StatusBadge tone={FUNDING_PHASE[funding.phase]?.tone ?? "wine"}>펀딩 · {FUNDING_PHASE[funding.phase]?.label ?? funding.phase}</StatusBadge>
  : <StatusBadge>펀딩 미등록</StatusBadge>;

const GalleryCard = ({ row, onOpen }: { row: DesignRow; onOpen: (row: DesignRow) => void }) => {
  const [failed, setFailed] = useState(false);
  const src = resolveImage(row.image_url, row.image_path);
  return (
    <button type="button" onClick={() => onOpen(row)}
      className="group mb-3 block w-full overflow-hidden rounded-2xl border border-stone-200/80 bg-white text-left shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition hover:border-[#741b2b]/40">
      <div className="relative bg-[#f1ede8]">
        {src && !failed ? (
          <img src={src} alt={row.prompt_excerpt || `${displayName(row)}님의 의류 이미지`} loading="lazy" decoding="async"
            onError={() => setFailed(true)} className="block h-auto w-full transition group-hover:opacity-95" />
        ) : (
          <div className="flex aspect-square items-center justify-center text-stone-400"><ImageOff className="h-6 w-6" /></div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-stone-700 backdrop-blur">
          {row.kind === "upload" ? <Upload className="h-3 w-3" /> : <Sparkles className="h-3 w-3 text-[#741b2b]" />}
          {row.kind === "upload" ? "직접 업로드" : "AI 생성"}
        </span>
      </div>
      <div className="grid gap-1 p-2.5">
        <p className="truncate text-xs font-bold text-stone-900">{displayName(row)}</p>
        <p className="flex items-center justify-between gap-2 text-[11px] text-stone-400">
          <span>{dateOnly(row.created_at)}</span>
          {row.category && <span className="truncate">{row.category}</span>}
        </p>
        {row.funding && <div><FundingBadge funding={row.funding} /></div>}
      </div>
    </button>
  );
};

const DesignDetailDialog = ({ itemKey, onClose, onFilterUser }: {
  itemKey: string | null; onClose: () => void; onFilterUser: (userId: string, label: string) => void;
}) => {
  const { data, loading, error, reload } = useAdminQuery(
    () => (itemKey ? adminRpc<DesignDetail>("admin_get_ai_design", { p_key: itemKey }) : Promise.resolve(null)),
    [itemKey],
  );
  const src = data ? resolveImage(data.image_url, data.image_path) : null;
  const references = (data?.extra.reference_image_paths ?? []).filter((path) => path !== data?.image_path);

  return (
    <Dialog open={Boolean(itemKey)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>이미지 상세</DialogTitle>
          <DialogDescription>생성자, 디자인 정보와 연결된 펀딩</DialogDescription>
        </DialogHeader>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : data && (
          <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="flex items-center justify-center bg-[#f1ede8] p-3 md:min-h-[520px]">
              {src ? <img src={src} alt={data.prompt || "의류 이미지 원본"} className="max-h-[80vh] w-auto max-w-full object-contain" />
                : <ImageOff className="h-8 w-8 text-stone-400" />}
            </div>
            <div className="grid content-start gap-5 p-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge tone={data.kind === "upload" ? "blue" : "wine"}>{data.kind === "upload" ? "직접 업로드" : "AI 생성"}</StatusBadge>
                <StatusBadge>{sourceLabel(data)}</StatusBadge>
                <FundingBadge funding={data.funding} />
              </div>
              <DefinitionGrid items={[
                { label: "생성자 닉네임", value: data.username ?? "-" },
                { label: "회원 이름", value: data.user_name ?? "-" },
                { label: "회원 ID", value: <span className="break-all font-mono text-xs">{data.user_id}</span> },
                { label: "생성 날짜 · 시간", value: dateTime(data.created_at) },
                { label: "의류 카테고리", value: data.category ?? "-" },
                { label: "선택한 원단", value: data.fabric ?? "-" },
                { label: "선택한 핏", value: data.fit ?? "-" },
                { label: "컬러", value: data.color ?? "-" },
              ]} />
              <div>
                <p className="text-[11px] font-bold text-stone-400">입력한 프롬프트 · 키워드</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-stone-800">{data.prompt || data.detail || "-"}</p>
                {data.prompt && data.detail && data.detail !== data.prompt && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-xs text-stone-500">상세: {data.detail}</p>
                )}
                {data.generation_prompt && (
                  <details className="mt-2 text-xs text-stone-500">
                    <summary className="cursor-pointer font-semibold">AI 생성에 사용된 최종 프롬프트</summary>
                    <p className="mt-1 whitespace-pre-wrap break-words">{data.generation_prompt}</p>
                  </details>
                )}
              </div>
              {data.source_table === "orders" && (
                <DefinitionGrid items={[
                  { label: "제작 의뢰 제목", value: data.extra.request_title ?? "-" },
                  { label: "요청 수량", value: data.extra.requested_quantity ? `${num(data.extra.requested_quantity)}장` : "-" },
                ]} />
              )}
              {references.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-stone-400">함께 업로드한 참고 이미지</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {references.map((path) => {
                      const url = resolveImage(null, path);
                      return url && <a key={path} href={url} target="_blank" rel="noreferrer"><img src={url} alt="참고 이미지" loading="lazy" className="h-20 w-20 rounded-lg border border-stone-200 object-cover" /></a>;
                    })}
                  </div>
                </div>
              )}
              <div className="rounded-2xl border border-stone-200 p-4">
                <p className="text-[11px] font-bold text-stone-400">연결된 펀딩</p>
                {data.funding ? (
                  <div className="mt-2 grid gap-1">
                    <Link to={`/fundings/${data.funding.id}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-bold text-[#741b2b] hover:underline">
                      {data.funding.name}<ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                    <p className="text-xs text-stone-500">
                      진행 상태 {FUNDING_PHASE[data.funding.phase]?.label ?? data.funding.phase}
                      {data.funding.moq ? ` · 참여 ${num(data.funding.current_orders)}/${num(data.funding.moq)}장` : ""}
                      {data.funding.early_closed ? " · 조기 마감" : ""}
                    </p>
                  </div>
                ) : <p className="mt-2 text-sm text-stone-500">이 이미지로 등록된 펀딩이 없습니다.</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {src && (
                  <Button size="sm" className="bg-[#741b2b] hover:bg-[#5d1622]" onClick={() => void downloadImage(src, `brand-er-${data.key.replace(":", "-")}.${src.split("?")[0].split(".").pop()?.slice(0, 4) || "png"}`)}>
                    <Download className="mr-1 h-3.5 w-3.5" />이미지 다운로드
                  </Button>
                )}
                {src && <Button size="sm" variant="outline" asChild><a href={src} target="_blank" rel="noreferrer">원본 새 탭에서 보기</a></Button>}
                <Button size="sm" variant="outline" onClick={() => onFilterUser(data.user_id, displayName(data))}><UserRound className="mr-1 h-3.5 w-3.5" />이 회원 이미지만 보기</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// 화면 폭별 열 수: 모바일 2 · 태블릿 3 · PC 4 · 넓은 PC 5
const columnsFor = (width: number) => (width < 768 ? 2 : width < 1024 ? 3 : width < 1536 ? 4 : 5);

const useColumnCount = () => {
  const [count, setCount] = useState(() => columnsFor(typeof window === "undefined" ? 1280 : window.innerWidth));
  useEffect(() => {
    const update = () => setCount(columnsFor(window.innerWidth));
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return count;
};

const AiDesignsPage = () => {
  const [params, setParams] = useSearchParams();
  const kind = (["ai", "upload"].includes(params.get("kind") ?? "") ? params.get("kind") : "all") as Kind;
  const [fundingFilter, setFundingFilter] = useState<FundingFilter>("all");
  const [sort, setSort] = useState<Sort>("latest");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [member, setMember] = useState<{ id: string; label: string } | null>(null);
  const [rows, setRows] = useState<DesignRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<Kind, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const requestId = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  const options = useAdminQuery(() => adminRpc<{ categories: string[] }>("admin_ai_design_filter_options"), []);
  // 핀터레스트형 배치: 순서대로 열에 하나씩 나눠 담아(왼쪽→오른쪽) 다음 페이지가 붙어도 기존 카드가 움직이지 않는다.
  const columnCount = useColumnCount();
  const columns = useMemo(() => {
    const result: DesignRow[][] = Array.from({ length: columnCount }, () => []);
    rows.forEach((row, index) => result[index % columnCount].push(row));
    return result;
  }, [rows, columnCount]);

  const fetchPage = useCallback((offset: number) => adminRpc<DesignList>("admin_list_ai_designs", {
    p_kind: kind,
    p_funding: fundingFilter,
    p_sort: sort,
    p_user_id: member?.id ?? null,
    p_category: category || null,
    p_search: search || null,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  }), [kind, fundingFilter, sort, member, category, search]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPage(0);
      if (id !== requestId.current) return;
      setRows(result.rows);
      setTotal(result.total);
      setCounts(result.counts);
    } catch (loadError) {
      if (id === requestId.current) setError(errorMessage(loadError));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => { void load(); }, [load]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || rows.length >= total) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const result = await fetchPage(rows.length);
      if (id !== requestId.current) return;
      setRows((current) => [...current, ...result.rows]);
      setTotal(result.total);
    } catch (moreError) {
      toast({ title: "이미지를 더 불러오지 못했습니다", description: errorMessage(moreError), variant: "destructive" });
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loading, loadingMore, rows.length, total]);

  // 무한 스크롤: 목록 끝이 화면 아래 600px 안으로 들어오면 다음 40개를 불러온다.
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "600px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  const setKind = (value: Kind) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("kind"); else next.set("kind", value);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader eyebrow="AI Designs" title="AI 디자인 관리"
        description="회원이 AI로 생성하거나 직접 업로드한 의류 이미지를 한곳에서 확인합니다. 이미지는 기존 저장소를 그대로 불러오며, DB 에 저장된 정보만 표시합니다." />
      <Panel className="mb-4" title={
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChips value={kind} onChange={(value) => setKind(value as Kind)} options={[
              { value: "all", label: "전체 이미지", count: counts?.all },
              { value: "ai", label: "AI 생성", count: counts?.ai },
              { value: "upload", label: "직접 업로드", count: counts?.upload },
            ]} />
            <FilterChips value={fundingFilter} onChange={(value) => setFundingFilter(value as FundingFilter)} options={[
              { value: "all", label: "펀딩 전체" }, { value: "linked", label: "펀딩 등록" }, { value: "unlinked", label: "펀딩 미등록" },
            ]} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="키워드 · 프롬프트 · 회원 닉네임 · 회원 ID" className="col-span-2 sm:w-80" />
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="카테고리별"
              className="h-9 rounded-xl border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700">
              <option value="">전체 카테고리</option>
              {options.data?.categories.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="정렬"
              className="h-9 rounded-xl border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700">
              <option value="latest">최신순</option>
              <option value="oldest">오래된순</option>
            </select>
            {member && (
              <button type="button" onClick={() => setMember(null)}
                className="col-span-2 inline-flex items-center gap-1 justify-self-start rounded-full bg-[#741b2b]/10 px-3 py-1.5 text-xs font-bold text-[#741b2b]">
                <UserRound className="h-3.5 w-3.5" />{member.label}님의 이미지<X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      }>
        <p className="text-xs text-stone-500">
          검색 결과 {num(total)}개 · 이미지를 누르면 원본과 프롬프트, 연결된 펀딩을 볼 수 있습니다.
        </p>
      </Panel>

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      {loading ? <LoadingBlock /> : rows.length === 0 ? (
        <Panel><EmptyState title="조건에 맞는 이미지가 없습니다" /></Panel>
      ) : (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
            {columns.map((column, index) => (
              <div key={index} className="min-w-0">
                {column.map((row) => <GalleryCard key={row.key} row={row} onOpen={(item) => setOpenKey(item.key)} />)}
              </div>
            ))}
          </div>
          <div ref={sentinel} className="flex justify-center py-6">
            {loadingMore ? <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
              : rows.length < total ? <Button variant="outline" size="sm" onClick={() => void loadMore()}>더 보기 ({num(rows.length)}/{num(total)})</Button>
                : <span className="text-xs text-stone-400">마지막 이미지입니다</span>}
          </div>
        </>
      )}
      <div className="mt-2"><Notice tone="stone">
        기성품 단체복 빠른 제작 의뢰 이미지는 업로드/AI 구분 정보가 DB 에 없어 이 갤러리에 포함하지 않았습니다. 브라우저에만 있던 임시 이미지(data: URL)도 제외됩니다.
      </Notice></div>

      <DesignDetailDialog itemKey={openKey} onClose={() => setOpenKey(null)}
        onFilterUser={(id, label) => { setMember({ id, label }); setOpenKey(null); }} />
    </div>
  );
};

export default AiDesignsPage;
