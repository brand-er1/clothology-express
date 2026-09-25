import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_SECTION_ORDER, SECTION_META } from "@/lib/detail-page/document";
import type { DetailSection, DetailSectionType } from "@/types/detailPage";
import { cn } from "@/lib/utils";

type DetailSectionListProps = {
  sections: DetailSection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (type: DetailSectionType) => void;
};

/**
 * Section order editor. Desktop: drag the handle. Touch devices: the ↑/↓ buttons (HTML5
 * drag & drop does not fire on most mobile browsers).
 */
export const DetailSectionList = ({ sections, selectedId, onSelect, onMove, onToggle, onRemove, onAdd }: DetailSectionListProps) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const missingStandard = DEFAULT_SECTION_ORDER.filter((type) => !sections.some((section) => section.type === type));

  return (
    <div>
      <ol className="border-t border-stone-200">
        {sections.map((section, index) => {
          const meta = SECTION_META[section.type];
          const selected = section.id === selectedId;
          return (
            <li
              key={section.id}
              draggable
              onDragStart={(event) => {
                setDragIndex(index);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", section.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (overIndex !== index) setOverIndex(index);
              }}
              onDragLeave={() => setOverIndex((current) => (current === index ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex !== null && dragIndex !== index) onMove(dragIndex, index);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={cn(
                "flex items-center gap-1 border-b border-stone-200 bg-white pr-1 transition",
                selected && "bg-brand/5",
                dragIndex === index && "opacity-40",
                overIndex === index && dragIndex !== null && dragIndex !== index && "border-t-2 border-t-brand",
              )}
            >
              <span className="hidden cursor-grab px-1.5 text-stone-400 active:cursor-grabbing sm:block" aria-hidden>
                <GripVertical className="h-4 w-4" />
              </span>
              <button
                type="button"
                onClick={() => onSelect(section.id)}
                className="min-w-0 flex-1 py-3 pl-3 text-left sm:pl-0"
              >
                <span className="block text-[10px] font-bold tracking-[0.14em] text-stone-400">
                  {String(index + 1).padStart(2, "0")} · {meta.eyebrow}
                </span>
                <span className={cn("block truncate text-sm font-semibold", !section.visible && "text-stone-400 line-through", selected && "text-brand")}>
                  {section.type === "hero" ? meta.label : section.title || meta.label}
                </span>
              </button>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-9 shrink-0" onClick={() => onMove(index, index - 1)} disabled={index === 0} aria-label="위로 이동">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-9 shrink-0" onClick={() => onMove(index, index + 1)} disabled={index === sections.length - 1} aria-label="아래로 이동">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-9 shrink-0" onClick={() => onToggle(section.id)} aria-label={section.visible ? "숨기기" : "보이기"}>
                {section.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-stone-400" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-9 shrink-0 text-stone-400 hover:text-red-600"
                onClick={() => onRemove(section.id)}
                aria-label="섹션 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ol>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="mt-3 h-11 w-full rounded-md border-dashed">
            <Plus className="mr-1.5 h-4 w-4" /> 섹션 추가
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {missingStandard.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs text-stone-500">기본 섹션</DropdownMenuLabel>
              {missingStandard.map((type) => (
                <DropdownMenuItem key={type} onSelect={() => onAdd(type)}>
                  <span className="font-medium">{SECTION_META[type].label}</span>
                  <span className="ml-auto text-[11px] text-stone-400">{SECTION_META[type].eyebrow}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel className="text-xs text-stone-500">자유 섹션</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onAdd("custom_text")}>텍스트 섹션</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onAdd("custom_image")}>이미지 섹션 (룩북)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
