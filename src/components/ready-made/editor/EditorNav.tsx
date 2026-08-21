import { LayoutTemplate, Palette, Image, Printer, Rows3, Receipt, type LucideIcon } from "lucide-react";

export type EditorPanelKey = "product" | "color" | "design" | "print" | "quantity" | "quote";

export const EDITOR_PANELS: { key: EditorPanelKey; label: string; icon: LucideIcon }[] = [
  { key: "product", label: "상품", icon: LayoutTemplate },
  { key: "color", label: "색상", icon: Palette },
  { key: "design", label: "디자인", icon: Image },
  { key: "print", label: "인쇄", icon: Printer },
  { key: "quantity", label: "사이즈/수량", icon: Rows3 },
  { key: "quote", label: "견적", icon: Receipt },
];

interface EditorNavProps {
  active: EditorPanelKey;
  onSelect: (panel: EditorPanelKey) => void;
  orientation: "vertical" | "horizontal";
}

export const EditorNav = ({ active, onSelect, orientation }: EditorNavProps) => (
  <nav
    className={
      orientation === "vertical"
        ? "flex w-20 shrink-0 flex-col gap-1 border-r border-stone-200 bg-white py-3"
        : "flex w-full items-stretch justify-between border-t border-stone-200 bg-white px-1 py-1.5"
    }
  >
    {EDITOR_PANELS.map(({ key, label, icon: Icon }) => {
      const isActive = active === key;
      return (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(key)}
          className={
            orientation === "vertical"
              ? `flex flex-col items-center gap-1 px-1 py-3 text-[11px] font-bold transition ${
                  isActive ? "text-brand" : "text-stone-400 hover:text-stone-600"
                }`
              : `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition ${
                  isActive ? "bg-brand/10 text-brand" : "text-stone-400"
                }`
          }
        >
          <Icon className={orientation === "vertical" ? "h-5 w-5" : "h-[18px] w-[18px]"} />
          {label}
        </button>
      );
    })}
  </nav>
);
