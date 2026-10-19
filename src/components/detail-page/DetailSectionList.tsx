import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, MoreHorizontal, Plus, Trash2 } from "lucide-react";
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
  onDuplicate: (id: string) => void;
  onAdd: (type: DetailSectionType) => void;
};

/**
 * Section order editor. The grip handle uses pointer events (mouse, pen and touch alike), so
 * drag & drop also works on phones where HTML5 drag events never fire. ↑/↓ stay as a
 * keyboard / precise alternative.
 */
export const DetailSectionList = ({ sections, selectedId, onSelect, onMove, onToggle, onRemove, onDuplicate, onAdd }: DetailSectionListProps) => {
  const [drag, setDrag] = useState<{ from: number; over: number; offset: number } | null>(null);
  const rows = useRef<Array<HTMLLIElement | null>>([]);
  const startY = useRef(0);
  const pointerY = useRef(0);
  const list = useRef<HTMLOListElement>(null);

  // 긴 목록: 끌고 있는 동안 포인터가 화면/패널 가장자리에 있으면 자동으로 스크롤한다.
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    const scroller = (() => {
      let node = list.current?.parentElement ?? null;
      while (node) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
        node = node.parentElement;
      }
      return null;
    })();
    const tick = () => {
      const top = scroller ? scroller.getBoundingClientRect().top : 0;
      const bottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight;
      const y = pointerY.current;
      const delta = y < top + 64 ? -10 : y > bottom - 64 ? 10 : 0;
      if (delta) {
        if (scroller) scroller.scrollTop += delta;
        else window.scrollBy(0, delta);
        startY.current -= delta;
        setDrag((current) => (current ? { ...current, offset: y - startY.current, over: indexAt(y) } : current));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // indexAt only reads refs/props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);
  const missingStandard = DEFAULT_SECTION_ORDER.filter((type) => !sections.some((section) => section.type === type));

  const indexAt = (clientY: number) => {
    let over = sections.length - 1;
    for (let index = 0; index < rows.current.length; index += 1) {
      const rect = rows.current[index]?.getBoundingClientRect();
      if (rect && clientY < rect.top + rect.height / 2) {
        over = index;
        break;
      }
    }
    return over;
  };

  return (
    <div>
      <ol ref={list} className={cn("border-t border-stone-200", drag && "select-none")} aria-label="섹션 순서">
        {sections.map((section, index) => {
          const meta = SECTION_META[section.type];
          const selected = section.id === selectedId;
          const dragging = drag?.from === index;
          const showDropLine = drag && drag.from !== index && drag.over === index;
          return (
            <li
              key={section.id}
              ref={(node) => (rows.current[index] = node)}
              data-section-row={section.type}
              style={dragging ? { transform: `translateY(${drag.offset}px)`, zIndex: 10, position: "relative" } : undefined}
              className={cn(
                "flex items-center gap-0.5 border-b border-stone-200 bg-white pr-1",
                selected && "bg-brand/5",
                dragging && "shadow-lg ring-1 ring-brand/40",
                showDropLine && (drag.from < index ? "border-b-2 border-b-brand" : "border-t-2 border-t-brand"),
              )}
            >
              <button
                type="button"
                aria-label={`${meta.label} 섹션 끌어서 이동`}
                className="flex h-12 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-stone-400 active:cursor-grabbing"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  startY.current = event.clientY;
                  pointerY.current = event.clientY;
                  setDrag({ from: index, over: index, offset: 0 });
                }}
                onPointerMove={(event) => {
                  if (!drag) return;
                  pointerY.current = event.clientY;
                  setDrag({ ...drag, offset: event.clientY - startY.current, over: indexAt(event.clientY) });
                }}
                onPointerUp={() => {
                  if (drag && drag.over !== drag.from) onMove(drag.from, drag.over);
                  setDrag(null);
                }}
                onPointerCancel={() => setDrag(null)}
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onSelect(section.id)} className="min-w-0 flex-1 py-3 text-left">
                <span className="block text-[10px] font-bold tracking-[0.14em] text-stone-400">
                  {String(index + 1).padStart(2, "0")} · {meta.eyebrow}
                </span>
                <span className={cn("block truncate text-sm font-semibold", !section.visible && "text-stone-400 line-through", selected && "text-brand")}>
                  {section.type === "hero" ? meta.label : section.title || meta.label}
                </span>
              </button>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-8 shrink-0" onClick={() => onMove(index, index - 1)} disabled={index === 0} aria-label="위로 이동">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-8 shrink-0" onClick={() => onMove(index, index + 1)} disabled={index === sections.length - 1} aria-label="아래로 이동">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-8 shrink-0" onClick={() => onToggle(section.id)} aria-label={section.visible ? "숨기기" : "보이기"}>
                {section.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-stone-400" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-10 w-8 shrink-0" aria-label={`${meta.label} 섹션 더보기`}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onDuplicate(section.id)}>
                    <Copy className="mr-2 h-4 w-4" /> 섹션 복제
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={() => onRemove(section.id)}>
                    <Trash2 className="mr-2 h-4 w-4" /> 섹션 삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
