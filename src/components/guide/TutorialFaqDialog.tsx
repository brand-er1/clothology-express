import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { faqItems } from "./tutorials";

interface TutorialFaqDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TutorialFaqDialog = ({ open, onOpenChange }: TutorialFaqDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[80vh] overflow-y-auto rounded-2xl sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-lg font-bold">자주 묻는 질문</DialogTitle>
      </DialogHeader>
      <div className="mt-2 space-y-4">
        {faqItems.map((item) => (
          <div key={item.q} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-bold text-stone-900">Q. {item.q}</p>
            <p className="mt-1.5 text-[13px] leading-6 text-stone-600">A. {item.a}</p>
          </div>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);
