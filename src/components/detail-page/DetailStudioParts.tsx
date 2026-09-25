import { AlertCircle, Check, CloudOff, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DETAIL_TEMPLATES } from "@/lib/detail-page/templates";
import { getMissingInfoFields } from "@/lib/detail-page/source";
import type { AutosaveStatus } from "@/hooks/useDetailPageAutosave";
import type { DetailPageSource, DetailPageTemplateId, DetailUserProvidedInfo } from "@/types/detailPage";
import { cn } from "@/lib/utils";

/* ───────── Template picker: each card sketches that template's real layout ───────── */

const TemplateSketch = ({ id }: { id: DetailPageTemplateId }) => {
  const meta = DETAIL_TEMPLATES.find((template) => template.id === id)!;
  const [bg, ink, accent] = meta.swatch;
  const block = (className: string, color = ink, opacity = 0.14) => (
    <span className={cn("block", className)} style={{ backgroundColor: color, opacity }} />
  );
  return (
    <div className="flex aspect-[3/4] w-full flex-col gap-1.5 overflow-hidden p-2.5" style={{ backgroundColor: bg }}>
      {id === "minimal" && (
        <>
          <div className="flex gap-1.5">
            {block("h-14 flex-1")}
            <div className="flex flex-1 flex-col justify-end gap-1">{block("h-1.5 w-full", ink, 0.7)}{block("h-1 w-2/3")}</div>
          </div>
          {block("mt-2 h-px w-full", ink, 0.2)}
          <div className="flex gap-1.5">{block("h-1 w-1/4", ink, 0.4)}{block("h-5 flex-1")}</div>
          <div className="flex gap-1.5">{block("h-1 w-1/4", ink, 0.4)}{block("h-5 flex-1")}</div>
        </>
      )}
      {id === "street" && (
        <>
          {block("h-3 w-full", ink, 0.95)}
          {block("h-3 w-4/5", ink, 0.95)}
          {block("h-16 w-full", "#e9e8e3", 1)}
          {block("h-1 w-full", ink, 0.9)}
          {block("h-6 w-full", ink, 0.9)}
        </>
      )}
      {id === "luxury" && (
        <div className="flex flex-1 flex-col items-center gap-1.5 pt-2">
          {block("h-0.5 w-6", accent, 0.8)}
          {block("h-16 w-1/2")}
          {block("h-1.5 w-2/3", ink, 0.6)}
          {block("h-1 w-1/3", ink, 0.3)}
          {block("mt-2 h-4 w-px", ink, 0.4)}
        </div>
      )}
      {id === "sports" && (
        <>
          <div className="flex gap-1.5">
            <div className="flex flex-1 flex-col justify-end gap-1">{block("h-2.5 w-full skew-x-[-12deg]", ink, 0.9)}{block("h-1 w-1/3", accent, 1)}</div>
            {block("h-14 flex-1", "#ffffff", 1)}
          </div>
          <div className="grid grid-cols-3 gap-1">{block("h-4")}{block("h-4")}{block("h-4")}</div>
          <div className="grid grid-cols-2 gap-1">{block("h-5 border-t-2", "#ffffff", 1)}{block("h-5", "#ffffff", 1)}</div>
        </>
      )}
      {id === "casual" && (
        <>
          {block("h-14 w-full rounded-lg", "#f1e6d6", 1)}
          {block("h-1.5 w-8 rounded-full", accent, 1)}
          {block("h-2 w-3/4 rounded", ink, 0.7)}
          <div className="mt-1 flex items-center gap-1">{block("h-2 w-2 rounded-full", accent, 1)}{block("h-2 flex-1 rounded", "#ffffff", 1)}</div>
          <div className="flex items-center gap-1">{block("h-2 w-2 rounded-full", accent, 1)}{block("h-2 flex-1 rounded", "#ffffff", 1)}</div>
        </>
      )}
    </div>
  );
};

export const TemplatePicker = ({
  value,
  onChange,
  compact = false,
}: {
  value: DetailPageTemplateId;
  onChange: (template: DetailPageTemplateId) => void;
  compact?: boolean;
}) => (
  <div className={cn("grid gap-2", compact ? "grid-cols-5" : "grid-cols-2 sm:grid-cols-5")} role="radiogroup" aria-label="상세페이지 템플릿">
    {DETAIL_TEMPLATES.map((template) => {
      const selected = template.id === value;
      return (
        <button
          key={template.id}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(template.id)}
          className={cn(
            "group min-w-0 border text-left transition",
            selected ? "border-brand ring-1 ring-brand" : "border-stone-200 hover:border-stone-400",
          )}
        >
          <TemplateSketch id={template.id} />
          <div className={cn("border-t border-stone-200 bg-white", compact ? "px-1.5 py-1.5" : "p-2.5")}>
            <p className={cn("font-bold tracking-[0.08em]", compact ? "truncate text-[10px]" : "text-xs", selected && "text-brand")}>
              {template.number} {template.name}
            </p>
            {!compact && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-stone-500">{template.description}</p>}
          </div>
        </button>
      );
    })}
  </div>
);

/* ───────── Save status ───────── */

export const SaveStatusBadge = ({
  status,
  lastSavedAt,
  error,
}: {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
}) => {
  const time = lastSavedAt?.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const content =
    status === "saving" ? (
      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 저장 중...</>
    ) : status === "saved" ? (
      <><Check className="h-3.5 w-3.5 text-emerald-600" /> 저장 완료{time ? ` · ${time}` : ""}</>
    ) : status === "error" ? (
      <><CloudOff className="h-3.5 w-3.5 text-red-600" /> 저장 실패</>
    ) : status === "dirty" ? (
      <><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> 변경사항 있음</>
    ) : (
      <><Check className="h-3.5 w-3.5 text-stone-400" /> 저장됨</>
    );
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium", status === "error" ? "text-red-600" : "text-stone-500")}
      role="status"
      aria-live="polite"
      title={status === "error" ? error ?? undefined : undefined}
    >
      {content}
    </span>
  );
};

/* ───────── Auto-loaded data summary + missing info form ───────── */

export const LoadedInfoSummary = ({ source }: { source: DetailPageSource }) => {
  const rows: Array<[string, string]> = [
    ["디자인 이미지", source.imageUrl ? (source.isFrontBackComposite ? "앞면 · 뒷면" : "1장") : ""],
    ["의류 종류", source.clothType],
    ["원단", source.material],
    ["색상", source.color],
    ["핏", source.fit],
    ["디자인 설명", source.designDescription ? `${source.designDescription.slice(0, 40)}${source.designDescription.length > 40 ? "…" : ""}` : ""],
    ["프린팅 · 자수", source.decorations.map((decoration) => decoration.label).join(", ")],
    ["부자재", source.accessories.join(", ")],
    ["제작 방식", source.productionMethod],
    [
      "예상 제작비",
      source.estimateUnitMin
        ? `${source.estimateUnitMin.toLocaleString("ko-KR")}${source.estimateUnitMax && source.estimateUnitMax !== source.estimateUnitMin ? `~${source.estimateUnitMax.toLocaleString("ko-KR")}` : ""}원 / 장`
        : "",
    ],
    ["제작자", source.creatorName],
    ["브랜드", source.brandName],
  ];
  return (
    <dl className="grid grid-cols-1 border-t border-stone-200 text-sm sm:grid-cols-2 sm:gap-x-6">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 border-b border-stone-200 py-2.5">
          <dt className="text-xs font-semibold text-stone-500">{label}</dt>
          <dd className={cn("min-w-0 text-wrap-anywhere", value ? "font-medium text-stone-900" : "text-stone-400")}>
            {value || "정보 없음"}
          </dd>
        </div>
      ))}
    </dl>
  );
};

export const MissingInfoForm = ({
  source,
  onChange,
}: {
  source: DetailPageSource;
  onChange: (next: DetailUserProvidedInfo) => void;
}) => {
  const fields = getMissingInfoFields(source);
  const values = source.userProvided;
  const update = (key: keyof DetailUserProvidedInfo, raw: string) => {
    if (key === "price") {
      const digits = raw.replace(/[^\d]/g, "");
      onChange({ ...values, price: digits ? Math.min(Number(digits), 100_000_000) : null });
      return;
    }
    onChange({ ...values, [key]: raw.slice(0, 600) });
  };
  return (
    <div className="space-y-4">
      <p className="flex gap-2 text-xs leading-5 text-stone-500">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        비워둔 항목은 상세페이지에 표시하지 않습니다. AI는 혼용률·중량·기능성·인증 정보를 추측해서 쓰지 않습니다.
      </p>
      {fields.map((field) => {
        const id = `missing-${field.key}`;
        const value = field.key === "price" ? (values.price ?? "").toString() : (values[field.key] as string);
        return (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={id} className="text-xs font-semibold text-stone-700">
              {field.label}
            </Label>
            {field.multiline ? (
              <Textarea
                id={id}
                value={value}
                placeholder={field.placeholder}
                onChange={(event) => update(field.key, event.target.value)}
                className="min-h-[76px] rounded-md text-base sm:text-sm"
              />
            ) : (
              <Input
                id={id}
                value={field.key === "price" && values.price !== null ? values.price.toLocaleString("ko-KR") : value}
                inputMode={field.key === "price" ? "numeric" : undefined}
                placeholder={field.placeholder}
                onChange={(event) => update(field.key, event.target.value)}
                className="h-11 rounded-md text-base sm:text-sm"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
