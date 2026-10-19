import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const normalize = (raw: string, multiline: boolean) => {
  const text = raw.replace(/\u00a0/g, " ");
  if (!multiline) return text.replace(/\s*\n\s*/g, " ");
  // 빈 contentEditable 은 "\n" 하나를 돌려준다.
  return text.trim() ? text.replace(/\n$/, "") : "";
};

type InlineTextProps = {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  className?: string;
};

/**
 * 상세페이지 미리보기 안에서 바로 고치는 텍스트(인라인 편집).
 * 편집 중에는 DOM 이 내용을 갖고 있고, React 는 포커스가 없을 때만(예: AI 재작성 결과) 값을 다시 넣는다
 * — 그래서 입력 중 커서가 튀지 않는다. 붙여넣기는 서식 없이 텍스트만 받는다.
 */
export const InlineText = ({ value, onChange, onFocus, multiline = false, placeholder = "내용 입력", maxLength = 3000, className }: InlineTextProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const focused = useRef(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || focused.current) return;
    if (normalize(node.innerText, multiline) !== value) node.innerText = value;
  }, [value, multiline]);

  const commit = (node: HTMLElement) => {
    const next = normalize(node.innerText, multiline).slice(0, maxLength);
    if (next !== value) onChange(next);
  };

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={multiline}
      aria-label={placeholder}
      spellCheck={false}
      data-inline-edit=""
      data-placeholder={placeholder}
      className={cn(
        "-mx-1 cursor-text rounded-[2px] px-1 outline-none transition-shadow",
        "hover:shadow-[0_0_0_1px_rgba(116,27,43,0.35)] focus:shadow-[0_0_0_2px_rgba(116,27,43,0.75)]",
        "empty:before:pointer-events-none empty:before:opacity-40 empty:before:content-[attr(data-placeholder)]",
        multiline ? "block min-h-[1.5em] whitespace-pre-wrap" : "inline-block min-w-[2ch] max-w-full",
        className,
      )}
      onFocus={() => {
        focused.current = true;
        onFocus?.();
      }}
      onBlur={(event) => {
        focused.current = false;
        commit(event.currentTarget);
      }}
      onInput={(event) => commit(event.currentTarget)}
      onKeyDown={(event) => {
        // 섹션 선택(Enter) 같은 바깥 단축키로 새지 않게 한다.
        event.stopPropagation();
        if ((event.key === "Enter" && !multiline) || event.key === "Escape") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onPaste={(event) => {
        event.preventDefault();
        const text = event.clipboardData.getData("text/plain");
        window.document.execCommand("insertText", false, multiline ? text : text.replace(/\s*\n\s*/g, " "));
      }}
      onDrop={(event) => event.preventDefault()}
    />
  );
};
