import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDownUp, Download, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  DataTable, EmptyState, ErrorBanner, FilterChips, LoadingBlock, Notice, PageHeader, Pager, Panel, SearchInput, StatusBadge, Td,
} from "@/components/admin/shell/ui";
import { ReasonDialog, type ReasonDialogState } from "@/components/admin/shell/ReasonDialog";
import { useAdminQuery } from "@/components/admin/shell/useAdminQuery";
import { LabApplicationDetail } from "@/components/admin/lab/LabApplicationDetail";
import { LAB_STATUS_TONE } from "@/components/admin/lab/labAdminFormat";
import { dateOnly, dateTime, errorMessage } from "@/lib/admin/format";
import { buildLabCsv, labGarmentText, labSizeText, type LabConsentSnapshot } from "@/lib/lab-export";
import { exportFileDate } from "@/lib/order-export";
import {
  deleteLabApplications, exportLabApplications, listLabApplications, signLabImages, type LabListFilter, type LabListRow,
} from "@/services/labAdmin";
import { formatLabPhone, LAB_STATUSES, labStatusLabel, type LabStatus } from "../../../supabase/functions/_shared/labApplication";

const PAGE_SIZE = 30;

const ConsentCell = ({ consents, keys }: { consents: LabConsentSnapshot; keys: string[] }) => {
  const entries = keys.map((key) => consents[key]);
  const agreed = entries.every((entry) => entry?.agreed);
  const withdrawn = entries.some((entry) => entry?.action === "withdraw" && !entry.agreed);
  const at = entries.map((entry) => entry?.at).filter(Boolean).sort().pop();
  return (
    <div className="whitespace-nowrap text-xs">
      <StatusBadge tone={agreed ? "green" : withdrawn ? "red" : "neutral"}>{agreed ? "동의" : withdrawn ? "철회" : "미동의"}</StatusBadge>
      <p className="mt-1 text-[11px] tabular-nums text-stone-400">{at ? dateTime(at) : "-"}</p>
    </div>
  );
};

/** BRAND-ER LAB 무료 의류 제작 신청 관리 */
const LabApplicationsPage = () => {
  // 대시보드 카드 · 사이드바에서 ?status=received, ?retention=expired 로 바로 들어올 수 있다.
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<LabListFilter>(() => {
    const status = searchParams.get("status");
    return {
      status: LAB_STATUSES.some((item) => item.value === status) ? status as LabStatus : "all",
      search: "",
      sort: "newest",
      retention: searchParams.get("retention") === "expired" ? "expired" : "all",
    };
  });
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, LabListRow>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState>(null);
  useEffect(() => { setPage(0); setChecked({}); }, [filter]);

  const { data, loading, error, reload } = useAdminQuery(() => listLabApplications(filter, page, PAGE_SIZE), [filter, page]);
  const rows = data?.rows ?? [];
  const canManage = Boolean(data?.can_manage);

  // 목록의 대표 이미지(첫 장)만 서명 URL 로 한 번에 받는다.
  useEffect(() => {
    const paths = (data?.rows ?? []).map((row) => row.image_paths[0]).filter(Boolean);
    if (!paths.length) { setThumbs({}); return; }
    let active = true;
    signLabImages(paths).then((urls) => { if (active) setThumbs(urls); }).catch(() => { if (active) setThumbs({}); });
    return () => { active = false; };
  }, [data]);

  const update = (patch: Partial<LabListFilter>) => setFilter((current) => ({ ...current, ...patch }));
  const checkedRows = Object.values(checked);
  const allOnPageChecked = rows.length > 0 && rows.every((row) => checked[row.id]);

  const toggleAll = () => setChecked((current) => {
    if (allOnPageChecked) { const next = { ...current }; rows.forEach((row) => delete next[row.id]); return next; }
    return { ...current, ...Object.fromEntries(rows.map((row) => [row.id, row])) };
  });

  const downloadCsv = async () => {
    setExporting(true);
    try {
      const exportRows = await exportLabApplications(filter);
      if (exportRows.length === 0) { toast({ title: "내려받을 신청이 없습니다" }); return; }
      const blob = new Blob([buildLabCsv(exportRows)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `brander-lab-applications-${exportFileDate()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({ title: `${exportRows.length.toLocaleString("ko-KR")}건을 내려받았습니다`, description: exportRows.length >= 5000 ? "한 번에 최대 5,000건까지 내려받습니다. 필터로 나눠 받아주세요." : "개인정보가 포함된 파일입니다. 업무 목적 외 사용을 금지하며 사용 후 안전하게 삭제해주세요." });
    } catch (err) {
      toast({ title: "CSV 를 만들지 못했습니다", description: errorMessage(err), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const askBulkDelete = () => setReasonDialog({
    title: `신청 정보 ${checkedRows.length}건 삭제`, destructive: true, confirmLabel: "영구 삭제",
    description: <>선택한 신청서와 참고 이미지 {checkedRows.reduce((sum, row) => sum + row.image_paths.length, 0)}장, 동의 · 처리 이력을 영구 삭제합니다. 되돌릴 수 없습니다.</>,
    reasonLabel: "삭제 사유", placeholder: "예: 개인정보 보유 기간(접수일로부터 1년) 만료",
    onConfirm: (reason) => deleteLabApplications(checkedRows, reason), successMessage: "삭제했습니다",
  });

  return (
    <div>
      <PageHeader eyebrow="BRAND-ER LAB" title="무료 제작 신청"
        description="무료 의류 제작 프로젝트 신청 목록입니다. 상세에서 디자인 · 참고 이미지 · 동의 이력을 확인하고 상태와 메모를 관리합니다."
        actions={<Button variant="outline" size="sm" onClick={() => void downloadCsv()} disabled={exporting}>
          {exporting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}CSV 다운로드
        </Button>} />

      <div className="mb-4 space-y-2">
        <Notice tone="stone">신청자 개인정보는 선정 · 연락 목적 외로 사용하지 마세요. 상세 열람 · CSV 다운로드 · 변경 · 삭제는 모두 Audit Log 에 기록됩니다.</Notice>
        {data && data.expired_count > 0 && (
          <Notice tone="amber">
            보유 기한이 지난 신청 {data.expired_count.toLocaleString("ko-KR")}건이 있습니다.{" "}
            <button type="button" className="font-bold underline underline-offset-2" onClick={() => update({ retention: "expired", status: "all" })}>만료 건 보기</button>
            {canManage && " → 확인 후 선택해 삭제해주세요."}
          </Notice>
        )}
        {data && !canManage && <Notice tone="stone">조회 전용 권한입니다. 상태 변경 · 삭제는 lab.manage 권한이 필요합니다.</Notice>}
      </div>

      <Panel bodyClassName="p-0" title={
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput value={filter.search} onChange={(search) => update({ search })} placeholder="이름 · 연락처 · 인스타그램 · 접수번호 · 디자인" />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => update({ sort: filter.sort === "newest" ? "oldest" : "newest" })}>
                <ArrowDownUp className="mr-1 h-3.5 w-3.5" />{filter.sort === "newest" ? "최신 접수순" : "오래된 접수순"}
              </Button>
              <FilterChips<"all" | "expired"> value={filter.retention} onChange={(retention) => update({ retention })} options={[
                { value: "all", label: "전체 보유" },
                { value: "expired", label: "보유 기한 만료", count: data?.expired_count },
              ]} />
            </div>
          </div>
          <FilterChips<LabStatus | "all"> value={filter.status} onChange={(status) => update({ status })} options={[
            { value: "all", label: "전체", count: data?.counts.all ?? 0 },
            ...LAB_STATUSES.map((item) => ({ value: item.value, label: item.label, count: data?.counts[item.value] ?? 0 })),
          ]} />
        </div>
      } actions={canManage && checkedRows.length > 0 ? (
        <Button size="sm" variant="outline" className="h-8 text-xs text-rose-700" onClick={askBulkDelete}>
          <Trash2 className="mr-1 h-3.5 w-3.5" />선택 {checkedRows.length}건 삭제
        </Button>
      ) : undefined}>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="해당하는 신청이 없습니다" /> : (
          <>
            <DataTable minWidth={1240} head={[
              canManage ? <input type="checkbox" aria-label="이 페이지 전체 선택" checked={allOnPageChecked} onChange={toggleAll} className="h-4 w-4 accent-[#741b2b]" /> : "",
              "접수일", "상태", "신청자", "희망 의류 · 사이즈", "디자인 설명", "이미지", "촬영·게시 동의", "개인정보 동의", "보유 기한",
            ]}>
              {rows.map((row) => {
                const expired = new Date(row.retention_until) <= new Date();
                const thumb = row.image_paths[0] ? thumbs[row.image_paths[0]] : undefined;
                return (
                  <tr key={row.id} className="cursor-pointer align-top hover:bg-stone-50" onClick={() => setSelectedId(row.id)}>
                    <Td>{canManage && (
                      <input type="checkbox" aria-label={`${row.application_no} 선택`} checked={Boolean(checked[row.id])} className="h-4 w-4 accent-[#741b2b]"
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => setChecked((current) => { const next = { ...current }; if (next[row.id]) delete next[row.id]; else next[row.id] = row; return next; })} />
                    )}</Td>
                    <Td className="whitespace-nowrap text-xs">
                      <p className="tabular-nums">{dateTime(row.created_at)}</p>
                      <p className="text-[11px] text-stone-400">{row.application_no}</p>
                    </Td>
                    <Td>
                      <StatusBadge tone={LAB_STATUS_TONE[row.status]}>{labStatusLabel(row.status)}</StatusBadge>
                      {row.has_memo && <p className="mt-1 text-[10px] text-stone-400">메모 있음</p>}
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      <p className="font-semibold text-stone-800">{row.applicant_name}</p>
                      <p className="tabular-nums text-stone-500">{formatLabPhone(row.phone)}</p>
                      <p className="text-stone-500">@{row.instagram_id}</p>
                    </Td>
                    <Td className="text-xs">
                      <p className="max-w-[180px] font-semibold text-stone-800">{labGarmentText(row.garment_types, row.garment_type_other)}</p>
                      <p className="text-stone-500">{labSizeText(row.size, row.size_other)}</p>
                    </Td>
                    <Td><p className="line-clamp-3 max-w-[280px] text-xs leading-5 text-stone-600">{row.design_description}</p></Td>
                    <Td>
                      {row.image_paths.length === 0 ? <span className="text-xs text-stone-300">-</span> : (
                        <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                          {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ImageIcon className="m-auto mt-3.5 h-4 w-4 text-stone-300" />}
                          {row.image_paths.length > 1 && <span className="absolute bottom-0 right-0 bg-stone-900/75 px-1 text-[10px] font-bold text-white">+{row.image_paths.length - 1}</span>}
                        </div>
                      )}
                    </Td>
                    <Td><ConsentCell consents={row.consents} keys={["filming"]} /></Td>
                    <Td><ConsentCell consents={row.consents} keys={["privacy"]} /></Td>
                    <Td className="whitespace-nowrap text-xs">
                      <p className={expired ? "font-bold text-rose-700" : "text-stone-500"}>{dateOnly(row.retention_until)}</p>
                      {expired && <p className="text-[10px] text-rose-600">만료</p>}
                    </Td>
                  </tr>
                );
              })}
            </DataTable>
            <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Panel>

      <LabApplicationDetail applicationId={selectedId} onClose={() => setSelectedId(null)} onChanged={() => void reload()} />
      <ReasonDialog state={reasonDialog} onClose={() => setReasonDialog(null)} onDone={() => { setChecked({}); void reload(); }} />
    </div>
  );
};

export default LabApplicationsPage;
