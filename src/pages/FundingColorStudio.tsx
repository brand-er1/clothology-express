import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, ImageUp, Loader2, Plus, RefreshCw, Sparkles, Star, Trash2, X,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { ColorOrderSummary } from "@/components/funding/ColorOrderSummary";
import { cn } from "@/lib/utils";
import { COLOR_PRESETS, VIEW_LABEL, colorHexOf, guessColorHex, type ColorView, type FundingColor } from "@/lib/funding-colors";
import { fetchFunding } from "@/services/funding";
import {
  canManageFunding, colorErrorMessage, deleteFundingColor, fetchFundingColors, generateFundingColorImage, reorderFundingColors,
  replaceFundingColorImage, reviewFundingColorImage, saveFundingColor, setBaseFundingColor,
} from "@/services/fundingColors";
import type { Funding } from "@/types/funding";

const VIEWS: ColorView[] = ["front", "back"];
const jobKey = (colorId: string, view: ColorView) => `${colorId}:${view}`;

/**
 * 컬러 옵션 관리 (제작자 / fundings.manage 관리자 공통)
 * 컬러 추가 → AI 컬러 이미지 생성(앞/뒤) → 결과 미리보기 → 승인 → 펀딩 상단 슬라이드·상세페이지 COLOR 섹션에 반영.
 * 진행 중인 펀딩에도 사용할 수 있고, 기존 주문 데이터는 바뀌지 않는다.
 */
const FundingColorStudio = () => {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const requestedReturn = params.get("returnTo");
  const returnTo = requestedReturn?.startsWith("/") && !requestedReturn.startsWith("//") ? requestedReturn : `/fundings/${id}/manage`;

  const [funding, setFunding] = useState<Funding | null>(null);
  const [colors, setColors] = useState<FundingColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<Record<string, boolean>>({});
  const [newName, setNewName] = useState("");
  const [newHex, setNewHex] = useState("#6D1F2F");
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<FundingColor | null>(null);
  const [summaryKey, setSummaryKey] = useState(0);

  const reload = useCallback(async () => {
    setColors(await fetchFundingColors(id));
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [allowed, fundingRow] = await Promise.all([canManageFunding(id), fetchFunding(id).catch(() => null)]);
        if (cancelled) return;
        if (!allowed) {
          setDenied(true);
          return;
        }
        setFunding(fundingRow);
        await reload();
      } catch (error) {
        toast({ title: "컬러 정보를 불러오지 못했습니다", description: colorErrorMessage(error), variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, reload]);

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await reload();
      setSummaryKey((key) => key + 1);
      return true;
    } catch (error) {
      toast({ title: label, description: colorErrorMessage(error), variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const generate = useCallback(async (color: FundingColor, view: ColorView) => {
    const key = jobKey(color.id, view);
    setJobs((current) => ({ ...current, [key]: true }));
    try {
      await generateFundingColorImage(color.id, view);
      toast({ title: `${color.name} ${VIEW_LABEL[view]} 이미지가 생성됐어요`, description: "미리보기를 확인하고 승인하면 고객에게 표시됩니다." });
    } catch (error) {
      toast({ title: `${color.name} ${VIEW_LABEL[view]} 생성 실패`, description: colorErrorMessage(error), variant: "destructive" });
    } finally {
      setJobs((current) => ({ ...current, [key]: false }));
      await reload().catch(() => undefined);
    }
  }, [reload]);

  const addColor = async (name: string, hex: string | null) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ok = await run("컬러를 추가하지 못했습니다", () => saveFundingColor(id, { name: trimmed, hex }));
    if (!ok) return;
    setNewName("");
    toast({ title: `${trimmed} 컬러를 추가했어요` });
    if (autoGenerate) {
      const latest = await fetchFundingColors(id);
      setColors(latest);
      const created = latest.find((color) => color.name.toLowerCase() === trimmed.toLowerCase());
      if (created) for (const view of VIEWS) await generate(created, view);
    }
  };

  const move = async (index: number, offset: number) => {
    const next = [...colors];
    const [item] = next.splice(index, 1);
    next.splice(index + offset, 0, item);
    setColors(next);
    await run("순서를 바꾸지 못했습니다", () => reorderFundingColors(id, next.map((color) => color.id)));
  };

  const generateMissing = async () => {
    for (const color of colors) {
      for (const view of VIEWS) {
        const hasImage = color.approved[view]?.url || color.candidates.some((image) => image.view === view && image.status === "preview");
        if (!hasImage && !color.isBase) await generate(color, view);
      }
    }
  };

  const usedNames = new Set(colors.map((color) => color.name.toLowerCase()));
  const presets = COLOR_PRESETS.filter((preset) => !usedNames.has(preset.name.toLowerCase()));

  if (loading) {
    return <div className="min-h-screen bg-[#f4f0ea]"><Header /><div className="flex min-h-screen items-center justify-center text-stone-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />컬러 정보를 불러오는 중</div></div>;
  }
  if (denied) {
    return (
      <div className="min-h-screen bg-[#f4f0ea]"><Header />
        <main className="mx-auto max-w-lg px-4 pt-32 text-center">
          <p className="text-lg font-bold">이 펀딩의 컬러를 관리할 권한이 없습니다.</p>
          <Button asChild variant="outline" className="mt-6 rounded-full"><Link to={`/fundings/${id}`}>펀딩으로 돌아가기</Link></Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f4f0ea] text-[#211b1c]">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-24 sm:px-6">
        <Link to={returnTo} className="inline-flex items-center text-sm text-stone-500 hover:text-brand"><ArrowLeft className="mr-1 h-4 w-4" />돌아가기</Link>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Color options</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">컬러별 상품 이미지</h1>
            <p className="mt-2 text-sm text-stone-500">
              {funding?.product_name ?? "펀딩"} · 디자인·핏·로고/프린팅 위치는 그대로 두고 컬러만 바꾼 AI 이미지를 만들어요. 승인한 이미지만 고객에게 보입니다.
            </p>
          </div>
          <Button type="button" variant="outline" className="shrink-0 rounded-full bg-white" disabled={busy || Object.values(jobs).some(Boolean)} onClick={() => void generateMissing()}>
            <Sparkles className="mr-1.5 h-4 w-4" />이미지 없는 컬러 모두 AI 생성
          </Button>
        </div>

        <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            {/* 컬러 추가 */}
            <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5" aria-labelledby="add-color-title">
              <h2 id="add-color-title" className="flex items-center gap-2 text-base font-bold"><Plus className="h-4 w-4 text-brand" />컬러 추가</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {presets.slice(0, 12).map((preset) => (
                  <button key={preset.name} type="button" disabled={busy} onClick={() => void addColor(preset.name, preset.hex)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-2.5 py-1.5 text-xs font-semibold hover:border-brand hover:text-brand disabled:opacity-50">
                    <span className="h-3.5 w-3.5 rounded-full border border-black/15" style={{ backgroundColor: preset.hex }} />{preset.name}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="color-name">직접 입력</Label>
                  <Input id="color-name" value={newName} maxLength={30} placeholder="예: DUSTY PINK"
                    onChange={(event) => { setNewName(event.target.value); const guess = guessColorHex(event.target.value); if (guess) setNewHex(guess); }}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addColor(newName, newHex); } }}
                    className="h-11" />
                </div>
                <label className="flex h-11 items-center gap-2 rounded-md border border-input px-2 text-xs text-stone-500">
                  <input type="color" value={newHex} onChange={(event) => setNewHex(event.target.value.toUpperCase())} className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0" aria-label="컬러 색상 선택" />
                  {newHex}
                </label>
                <Button type="button" className="h-11 rounded-md bg-brand hover:bg-brand-dark" disabled={busy || !newName.trim()} onClick={() => void addColor(newName, newHex)}>추가</Button>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-stone-600">
                <Checkbox checked={autoGenerate} onCheckedChange={(value) => setAutoGenerate(value === true)} />
                추가하면 AI 이미지(앞면·뒷면)를 바로 생성
              </label>
            </section>

            {colors.map((color, index) => (
              <ColorCard
                key={color.id}
                color={color}
                index={index}
                count={colors.length}
                busy={busy}
                jobs={jobs}
                onGenerate={(view) => void generate(color, view)}
                onApprove={(imageId) => void run("승인하지 못했습니다", () => reviewFundingColorImage(imageId, "approve"))}
                onReject={(imageId) => void run("처리하지 못했습니다", () => reviewFundingColorImage(imageId, "reject"))}
                onReplace={(view, file) => void run("이미지를 교체하지 못했습니다", () => replaceFundingColorImage(color.id, view, file))}
                onRename={(name, hex) => void run("컬러를 수정하지 못했습니다", () => saveFundingColor(id, { colorId: color.id, name, hex }))}
                onMove={(offset) => void move(index, offset)}
                onSetBase={() => void run("기준 컬러를 바꾸지 못했습니다", () => setBaseFundingColor(color.id))}
                onDelete={() => setPendingDelete(color)}
              />
            ))}
          </div>

          <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:h-fit">
            <section className="rounded-2xl border border-stone-200 bg-white p-4">
              <h2 className="text-sm font-bold">원본 디자인</h2>
              {funding?.image_url && <img src={funding.image_url} alt="원본 디자인" className="mt-3 aspect-square w-full rounded-lg bg-stone-100 object-contain" />}
              <p className="mt-2 text-xs leading-5 text-stone-500">
                ★ 기준 컬러는 원본 이미지의 컬러예요. 다른 컬러는 기준 컬러 이미지(앞/뒤)를 참고해 AI 가 컬러만 바꿔 만듭니다.
              </p>
            </section>
            <section className="rounded-2xl border border-stone-200 bg-white p-4">
              <h2 className="text-sm font-bold">컬러별 주문 수량</h2>
              <ColorOrderSummary fundingId={id} className="mt-2" refreshKey={summaryKey} />
            </section>
          </aside>
        </div>
      </main>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingDelete?.name} 컬러를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              새 주문에서 이 컬러를 고를 수 없게 되고 상품 이미지·상세페이지 컬러 섹션에서 빠집니다. 이미 받은 주문의 컬러 정보는 그대로 보존됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={() => {
              const target = pendingDelete;
              setPendingDelete(null);
              if (target) void run("컬러를 삭제하지 못했습니다", async () => {
                const result = await deleteFundingColor(target.id);
                toast({ title: `${target.name} 컬러를 삭제했어요`, description: result.existingOrders ? `기존 주문 ${result.existingOrders}건은 그대로 유지됩니다.` : undefined });
              });
            }}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

type CardProps = {
  color: FundingColor;
  index: number;
  count: number;
  busy: boolean;
  jobs: Record<string, boolean>;
  onGenerate: (view: ColorView) => void;
  onApprove: (imageId: string) => void;
  onReject: (imageId: string) => void;
  onReplace: (view: ColorView, file: File) => void;
  onRename: (name: string, hex: string | null) => void;
  onMove: (offset: number) => void;
  onSetBase: () => void;
  onDelete: () => void;
};

const ColorCard = ({ color, index, count, busy, jobs, onGenerate, onApprove, onReject, onReplace, onRename, onMove, onSetBase, onDelete }: CardProps) => {
  const [name, setName] = useState(color.name);
  const [hex, setHex] = useState(colorHexOf(color));
  const fileInputs = useRef<Partial<Record<ColorView, HTMLInputElement | null>>>({});
  useEffect(() => { setName(color.name); setHex(colorHexOf(color)); }, [color]);
  const dirty = name.trim() !== color.name || (color.hex ?? colorHexOf(color)) !== hex;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5" data-testid={`color-card-${color.name}`}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-full border border-black/15" style={{ backgroundColor: hex }}>
          <input type="color" value={hex} onChange={(event) => setHex(event.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`${color.name} 색상 변경`} />
        </label>
        <Input value={name} maxLength={30} onChange={(event) => setName(event.target.value)} className="h-9 w-40 min-w-0 font-bold sm:w-52" aria-label="컬러명" />
        {dirty && <Button size="sm" className="h-9 bg-brand hover:bg-brand-dark" disabled={busy || !name.trim()} onClick={() => onRename(name, hex)}><Check className="mr-1 h-3.5 w-3.5" />저장</Button>}
        {color.isBase ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700"><Star className="h-3 w-3" />기준 컬러</span>
        ) : (
          <button type="button" className="text-[11px] font-semibold text-stone-400 hover:text-brand" disabled={busy} onClick={onSetBase}>기준 컬러로 지정</button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy || index === 0} onClick={() => onMove(-1)} aria-label="위로"><ArrowUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy || index === count - 1} onClick={() => onMove(1)} aria-label="아래로"><ArrowDown className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" disabled={busy || count <= 1} onClick={onDelete} aria-label={`${color.name} 삭제`}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {VIEWS.map((view) => {
          const approved = color.approved[view];
          const preview = color.candidates.find((image) => image.view === view && image.status === "preview");
          const failed = color.candidates.find((image) => image.view === view && image.status === "failed");
          const running = jobs[jobKey(color.id, view)] || color.candidates.some((image) => image.view === view && image.status === "generating");
          return (
            <div key={view} className="min-w-0 rounded-xl border border-stone-200 p-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>{VIEW_LABEL[view]}</span>
                {approved && <span className="text-emerald-600">{approved.source === "original" ? "원본" : approved.source === "upload" ? "직접 등록" : "AI"} · 노출 중</span>}
              </div>
              <div className={cn("mt-2 grid gap-2", preview ? "grid-cols-2" : "grid-cols-1")}>
                <figure className="min-w-0">
                  <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg bg-stone-100">
                    {approved?.url ? <img src={approved.url} alt={`${color.name} ${VIEW_LABEL[view]}`} className="h-full w-full object-contain" />
                      : <span className="px-2 text-center text-[11px] text-stone-400">등록된 이미지 없음</span>}
                    {running && !preview && (
                      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/80 text-xs font-semibold text-stone-700"><Loader2 className="h-5 w-5 animate-spin text-brand" />AI 생성 중…</span>
                    )}
                  </div>
                  {preview && <figcaption className="mt-1 text-center text-[10px] text-stone-400">현재</figcaption>}
                </figure>
                {preview?.url && (
                  <figure className="min-w-0">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-stone-100 ring-2 ring-brand">
                      <img src={preview.url} alt={`${color.name} ${VIEW_LABEL[view]} AI 미리보기`} className="h-full w-full object-contain" />
                    </div>
                    <figcaption className="mt-1 text-center text-[10px] font-bold text-brand">AI 결과 미리보기</figcaption>
                  </figure>
                )}
              </div>
              {failed && !preview && !running && <p className="mt-2 line-clamp-2 text-[11px] text-rose-600" title={failed.errorMessage ?? ""}>생성 실패: {failed.errorMessage}</p>}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {preview ? (
                  <>
                    <Button size="sm" className="h-8 bg-brand text-xs hover:bg-brand-dark" disabled={busy} onClick={() => onApprove(preview.id)}><Check className="mr-1 h-3.5 w-3.5" />승인해서 등록</Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => onReject(preview.id)}><X className="mr-1 h-3.5 w-3.5" />거절</Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy || running} onClick={() => onGenerate(view)}><RefreshCw className="mr-1 h-3.5 w-3.5" />다시 생성</Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy || running} onClick={() => onGenerate(view)}>
                    {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
                    {approved ? "AI 재생성" : "AI 생성"}
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={busy} onClick={() => fileInputs.current[view]?.click()}><ImageUp className="mr-1 h-3.5 w-3.5" />이미지 교체</Button>
                <input ref={(node) => { fileInputs.current[view] = node; }} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onReplace(view, file); }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default FundingColorStudio;
