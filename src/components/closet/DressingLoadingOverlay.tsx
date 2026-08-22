import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const loadingMessages = [
  "브랜더 캐릭터가 옷을 입고 있어요...",
  "핏을 확인하고 있어요... ✨",
  "거의 다 입었어요!",
];

export const DressingLoadingOverlay = ({ active }: { active: boolean }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % loadingMessages.length);
    }, 1400);
    return () => window.clearInterval(timer);
  }, [active]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[1.75rem] bg-white/85 backdrop-blur-sm">
      <Loader2 className="h-8 w-8 animate-spin text-brand" />
      <p className="text-sm font-bold text-stone-950">{loadingMessages[index]}</p>
    </div>
  );
};
