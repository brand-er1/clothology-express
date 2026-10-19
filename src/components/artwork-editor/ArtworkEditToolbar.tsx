import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  FlipHorizontal2,
  FlipVertical2,
  Link2,
  Link2Off,
  RotateCcw,
  RotateCw,
  Trash2,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { normalizeRotation, ROTATION_STEP_OPTIONS } from "@/lib/artwork-transform";

interface ArtworkEditToolbarProps {
  rotation: number;
  onRotationChange: (rotation: number) => void;
  widthPercent: number;
  minWidthPercent: number;
  maxWidthPercent: number;
  onWidthChange: (widthPercent: number) => void;
  keepAspect: boolean;
  onKeepAspectChange: (keepAspect: boolean) => void;
  /** Shown only when the artwork was stretched with the aspect lock off. */
  onResetProportions?: () => void;
  flipX: boolean;
  flipY: boolean;
  onToggleFlip: (axis: "x" | "y") => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  canBringForward?: boolean;
  canSendBackward?: boolean;
  onDuplicate?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
}

const formatNumber = (value: number, digits = 1) => {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  return String(rounded);
};

const toolButton =
  "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-bold text-stone-700 transition hover:border-brand/40 hover:text-brand disabled:pointer-events-none disabled:opacity-40";

/** A number field that lets the user type freely and only commits valid values. */
const NumberField = ({
  value,
  onCommit,
  min,
  max,
  step,
  suffix,
  label,
  disabled,
  testId,
}: {
  value: number;
  onCommit: (value: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
  label: string;
  disabled?: boolean;
  testId?: string;
}) => {
  const [draft, setDraft] = useState(formatNumber(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatNumber(value));
  }, [value, focused]);

  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(parsed)) return;
    onCommit(parsed);
  };

  return (
    <label className="flex h-9 items-center rounded-lg border border-stone-200 bg-white pr-2 focus-within:border-brand">
      <span className="sr-only">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        data-testid={testId}
        className="h-full w-16 min-w-0 rounded-lg bg-transparent px-2 text-right text-sm font-bold text-stone-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={draft}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          setDraft(event.target.value);
          commit(event.target.value);
        }}
        onBlur={() => {
          setFocused(false);
          setDraft(formatNumber(value));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
      />
      <span className="text-xs font-bold text-stone-400">{suffix}</span>
    </label>
  );
};

/**
 * Edit menu for the selected artwork: rotation (free input, slider, step buttons, reset), size
 * with an aspect-ratio lock, flips, paint order, duplicate and delete. Purely controlled — the
 * owning editor decides how each change is stored.
 */
export const ArtworkEditToolbar = ({
  rotation,
  onRotationChange,
  widthPercent,
  minWidthPercent,
  maxWidthPercent,
  onWidthChange,
  keepAspect,
  onKeepAspectChange,
  onResetProportions,
  flipX,
  flipY,
  onToggleFlip,
  onBringForward,
  onSendBackward,
  canBringForward = false,
  canSendBackward = false,
  onDuplicate,
  onDelete,
  canDelete = true,
  disabled = false,
  title = "선택한 이미지 편집",
  className = "",
}: ArtworkEditToolbarProps) => {
  const [step, setStep] = useState<number>(15);
  const normalized = normalizeRotation(rotation);
  const clampWidth = (value: number) => Math.min(maxWidthPercent, Math.max(minWidthPercent, value));

  return (
    <div
      data-testid="artwork-edit-toolbar"
      className={`rounded-xl border border-brand/20 bg-white p-3 shadow-sm ${className}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <p className="text-xs font-bold text-stone-800">{title}</p>

      {/* Two columns only when each can fit its controls on one row, whatever the host width. */}
      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
        <section aria-label="회전">
          <p className="mb-1.5 text-[11px] font-bold text-stone-500">회전</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <NumberField
              label="회전 각도"
              testId="artwork-rotation-input"
              value={normalized}
              min={0}
              max={360}
              step={1}
              suffix="°"
              disabled={disabled}
              onCommit={(value) => onRotationChange(normalizeRotation(value))}
            />
            <button
              type="button"
              className={toolButton}
              onClick={() => onRotationChange(normalizeRotation(normalized - step))}
              disabled={disabled}
              aria-label={`반시계 방향 ${step}도 회전`}
            >
              <RotateCcw className="h-3.5 w-3.5" />-{step}°
            </button>
            <button
              type="button"
              className={toolButton}
              onClick={() => onRotationChange(normalizeRotation(normalized + step))}
              disabled={disabled}
              aria-label={`시계 방향 ${step}도 회전`}
            >
              <RotateCw className="h-3.5 w-3.5" />+{step}°
            </button>
            <button
              type="button"
              className={toolButton}
              onClick={() => onRotationChange(0)}
              disabled={disabled || normalized === 0}
              aria-label="회전 0도로 초기화"
            >
              0°
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="회전 단위">
            <span className="mr-1 text-[11px] font-semibold text-stone-400">단위</span>
            {ROTATION_STEP_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={step === option}
                onClick={() => setStep(option)}
                disabled={disabled}
                className={`h-7 rounded-full px-2.5 text-[11px] font-bold transition ${
                  step === option ? "bg-brand text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                }`}
              >
                {option}°
              </button>
            ))}
          </div>
          <Slider
            className="mt-3"
            min={0}
            max={359}
            step={1}
            value={[Math.round(normalized) % 360]}
            onValueChange={([value]) => onRotationChange(normalizeRotation(value))}
            disabled={disabled}
            aria-label="회전 각도 슬라이더"
          />
        </section>

        <section aria-label="크기">
          <p className="mb-1.5 text-[11px] font-bold text-stone-500">크기 (캔버스 폭 대비)</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <NumberField
              label="이미지 폭"
              testId="artwork-width-input"
              value={widthPercent}
              min={minWidthPercent}
              max={maxWidthPercent}
              step={minWidthPercent < 1 ? 0.1 : 1}
              suffix="%"
              disabled={disabled}
              onCommit={(value) => onWidthChange(clampWidth(value))}
            />
            <button
              type="button"
              className={`${toolButton} ${keepAspect ? "border-brand/40 bg-brand/5 text-brand" : ""}`}
              onClick={() => onKeepAspectChange(!keepAspect)}
              disabled={disabled}
              aria-pressed={keepAspect}
            >
              {keepAspect ? <Link2 className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />}
              비율 유지
            </button>
            {onResetProportions && (
              <button type="button" className={toolButton} onClick={onResetProportions} disabled={disabled}>
                원래 비율
              </button>
            )}
          </div>
          <Slider
            className="mt-3"
            min={minWidthPercent}
            max={maxWidthPercent}
            step={minWidthPercent < 1 ? 0.1 : 0.5}
            value={[clampWidth(widthPercent)]}
            onValueChange={([value]) => onWidthChange(clampWidth(value))}
            disabled={disabled}
            aria-label="이미지 크기 슬라이더"
          />
        </section>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-stone-100 pt-3">
        <button
          type="button"
          className={`${toolButton} ${flipX ? "border-brand/40 bg-brand/5 text-brand" : ""}`}
          onClick={() => onToggleFlip("x")}
          disabled={disabled}
          aria-pressed={flipX}
        >
          <FlipHorizontal2 className="h-3.5 w-3.5" />
          좌우 반전
        </button>
        <button
          type="button"
          className={`${toolButton} ${flipY ? "border-brand/40 bg-brand/5 text-brand" : ""}`}
          onClick={() => onToggleFlip("y")}
          disabled={disabled}
          aria-pressed={flipY}
        >
          <FlipVertical2 className="h-3.5 w-3.5" />
          상하 반전
        </button>
        {onBringForward && (
          <button
            type="button"
            className={toolButton}
            onClick={onBringForward}
            disabled={disabled || !canBringForward}
          >
            <ArrowUpToLine className="h-3.5 w-3.5" />
            앞으로
          </button>
        )}
        {onSendBackward && (
          <button
            type="button"
            className={toolButton}
            onClick={onSendBackward}
            disabled={disabled || !canSendBackward}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            뒤로
          </button>
        )}
        {onDuplicate && (
          <button type="button" className={toolButton} onClick={onDuplicate} disabled={disabled}>
            <Copy className="h-3.5 w-3.5" />
            복제
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className={`${toolButton} hover:border-red-300 hover:text-red-500`}
            onClick={onDelete}
            disabled={disabled || !canDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            삭제
          </button>
        )}
      </div>
    </div>
  );
};
