import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { formatProductionPhone } from "../../../../supabase/functions/_shared/productionRequest";

const copyText = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // 권한이 없거나 http 환경: 임시 textarea 로 복사
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
};

/**
 * 고객 전화번호 — 클릭하면 010-0000-0000 형식으로 복사한다.
 * 마스킹된 번호(orders.pii 권한 없음)는 복사하지 않고 그대로 보여 준다.
 */
export const CopyPhone = ({ phone, className }: { phone: string | null | undefined; className?: string }) => {
  const [copied, setCopied] = useState(false);
  if (!phone) return <span className={cn("text-stone-400", className)}>-</span>;
  const masked = phone.includes("*");
  const display = masked ? phone : formatProductionPhone(phone) || phone;
  if (masked) return <span className={cn("tabular-nums", className)}>{display}</span>;

  return (
    <button
      type="button"
      onClick={async (event) => {
        event.stopPropagation();
        const ok = await copyText(display);
        if (ok) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
          toast({ title: "전화번호를 복사했습니다", description: display });
        } else {
          toast({ title: "복사하지 못했습니다", description: "번호를 길게 눌러 직접 복사해주세요.", variant: "destructive" });
        }
      }}
      title="클릭하여 전화번호 복사"
      aria-label={`전화번호 ${display} 복사`}
      className={cn(
        "group inline-flex items-center gap-1 rounded-md px-1 -mx-1 font-semibold tabular-nums text-stone-800 transition hover:bg-[#741b2b]/[0.07] hover:text-[#741b2b]",
        className,
      )}
      data-testid="copy-phone"
    >
      {display}
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-stone-400 group-hover:text-[#741b2b]" />}
    </button>
  );
};
