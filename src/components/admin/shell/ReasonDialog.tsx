import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { errorMessage } from "@/lib/admin/format";

export type ReasonDialogState = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  reasonLabel?: string;
  reasonRequired?: boolean;
  placeholder?: string;
  extra?: ReactNode;
  onConfirm: (reason: string) => Promise<unknown>;
  successMessage?: string;
} | null;

// 모든 중요한 관리자 조치는 사유를 받아 서버(Audit Log)에 함께 기록한다.
export const ReasonDialog = ({ state, onClose, onDone }: { state: ReasonDialogState; onClose: () => void; onDone?: () => void }) => {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setReason(""); }, [state]);

  const required = state?.reasonRequired ?? true;
  const invalid = required && reason.trim().length < 2;

  const submit = async () => {
    if (!state || invalid) return;
    setSaving(true);
    try {
      const result = await state.onConfirm(reason.trim());
      const warning = (result as { warning?: string } | undefined)?.warning;
      toast({ title: state.successMessage ?? "처리했습니다", description: warning });
      onClose();
      onDone?.();
    } catch (error) {
      toast({ title: "처리하지 못했습니다", description: errorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{state?.title}</DialogTitle>
          {state?.description && <DialogDescription asChild><div className="text-sm text-stone-500">{state.description}</div></DialogDescription>}
        </DialogHeader>
        {state?.extra}
        <div className="grid gap-1.5">
          <label className="text-xs font-bold text-stone-600">{state?.reasonLabel ?? "처리 사유"}{required && <span className="text-rose-600"> *</span>}</label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000}
            placeholder={state?.placeholder ?? "Audit Log 에 기록됩니다. 2자 이상 입력해주세요."} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
          <Button onClick={submit} disabled={saving || invalid}
            className={state?.destructive ? "bg-rose-600 hover:bg-rose-700" : "bg-[#741b2b] hover:bg-[#551220]"}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{state?.confirmLabel ?? "확인"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
