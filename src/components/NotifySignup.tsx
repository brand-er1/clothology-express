import { useState } from "react";
import { Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { subscribeToHomepageNotify } from "@/services/notifySubscription";

export const NotifySignup = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await subscribeToHomepageNotify(email);
      toast({ title: "신청 완료", description: "마감임박·재입고 소식을 가장 먼저 보내드릴게요." });
      setEmail("");
    } catch (error) {
      toast({
        title: "신청 실패",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="border-t border-black/10 bg-[#e9e7e3]">
      <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12 xl:px-16">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand sm:text-xs">
              <Bell className="h-4 w-4" /> Notify me
            </div>
            <h2 className="mt-3 font-serif text-3xl font-normal tracking-[-0.03em] sm:text-5xl">
              마감임박·재입고 소식을<br />가장 먼저 받아보세요.
            </h2>
            <p className="mt-4 text-sm leading-7 text-stone-600 sm:text-base">
              선주문 마감이 얼마 남지 않았거나 품절됐던 컬렉션이 다시 열리면 이메일로 알려드려요.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="이메일 주소"
              aria-label="알림 받을 이메일 주소"
              className="h-12 border-black/15 bg-white sm:h-14"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-12 shrink-0 items-center justify-center bg-brand px-7 text-sm font-bold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60 sm:h-14"
            >
              {isSubmitting ? "신청 중..." : "알림 신청"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
