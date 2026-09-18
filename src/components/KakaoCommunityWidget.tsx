import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const KAKAO_COMMUNITY_URL = "https://open.kakao.com/o/gswRryoh";
const BUBBLE_DISMISSED_KEY = "brand-er:kakao-community-bubble-dismissed";
const BUBBLE_SHOW_DELAY_MS = 1500;

const communityHighlights = [
  "의류 브랜드 창업 정보",
  "원단·샘플·생산 정보 공유",
  "브랜드 운영 및 마케팅 이야기",
  "제작 경험 및 노하우 공유",
  "예비 창업자 / 브랜드 운영자 네트워킹",
];

const openKakaoCommunity = () => {
  window.open(KAKAO_COMMUNITY_URL, "_blank", "noopener,noreferrer");
};

const KakaoChip = ({ className = "h-9 w-9" }: { className?: string }) => (
  <span className={`flex shrink-0 items-center justify-center rounded-full bg-[#FEE500] ${className}`}>
    <MessageCircle className="h-[55%] w-[55%] text-[#3C1E1E]" strokeWidth={2.3} />
  </span>
);

/**
 * 모든 페이지 우측 하단에 고정되는 '의류 브랜드 창업자 커뮤니티' 카카오톡 오픈채팅 진입 위젯.
 * 제작 상담이 아니라 브랜드 창업 정보를 나누는 커뮤니티라는 포지셔닝을 말풍선/팝업에서 반복 전달한다.
 */
export const KakaoCommunityWidget = () => {
  const [isBubbleVisible, setIsBubbleVisible] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(BUBBLE_DISMISSED_KEY) === "1") return;
    const timer = window.setTimeout(() => setIsBubbleVisible(true), BUBBLE_SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const dismissBubble = () => {
    setIsBubbleVisible(false);
    sessionStorage.setItem(BUBBLE_DISMISSED_KEY, "1");
  };

  const openIntro = () => setIsDialogOpen(true);

  return (
    <>
      {/* Bottom offset clears the brand mascot's docked corner spot (bottom-24/right-4 mobile,
          bottom-6/right-6 desktop in BrandGuide) so the two floating elements never overlap. */}
      <div className="pointer-events-none fixed right-4 z-50 flex flex-col items-end gap-3 bottom-[calc(176px+env(safe-area-inset-bottom))] sm:bottom-28 sm:right-6">
        {isBubbleVisible && (
          <div className="pointer-events-auto relative max-w-[220px] animate-fadeIn rounded-2xl border border-stone-200 bg-white p-4 pr-8 shadow-lg sm:max-w-[240px]">
            <button
              type="button"
              onClick={dismissBubble}
              aria-label="말풍선 닫기"
              className="absolute right-2 top-2 rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={openIntro} className="block text-left">
              <p className="text-[13px] font-bold leading-5 text-stone-800">
                내 브랜드를 만들고 싶으신가요?
              </p>
              <p className="mt-1 text-[12px] leading-5 text-stone-500">
                예비 브랜드 창업자들과 함께 이야기해보세요.
              </p>
            </button>
            <span className="absolute -bottom-1.5 right-8 h-3 w-3 rotate-45 border-b border-r border-stone-200 bg-white" />
          </div>
        )}

        <button
          type="button"
          onClick={openIntro}
          className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-brand/15 bg-brand py-2.5 pl-2.5 pr-4 text-white shadow-[0_8px_24px_rgba(116,27,43,0.35)] transition hover:bg-brand-dark hover:shadow-[0_10px_28px_rgba(116,27,43,0.45)] active:scale-[0.97] sm:py-3 sm:pl-3 sm:pr-5"
        >
          <KakaoChip className="h-8 w-8 sm:h-9 sm:w-9" />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[13px] font-bold sm:text-sm">의류 브랜드 커뮤니티</span>
            <span className="hidden text-[11px] font-medium text-white/80 sm:block">
              브랜드를 만들고 싶다면 참여해보세요
            </span>
          </span>
        </button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md overflow-hidden rounded-2xl border-stone-200 bg-white p-0">
          <div className="bg-[#f7f3ef] px-6 pb-5 pt-7">
            <div className="flex items-center gap-2.5">
              <KakaoChip />
              <DialogHeader className="space-y-0 text-left">
                <DialogTitle className="text-base font-bold tracking-[0.08em] text-brand">
                  BRAND-ER COMMUNITY
                </DialogTitle>
              </DialogHeader>
            </div>
            <DialogDescription className="mt-4 text-sm leading-6 text-stone-600">
              의류 브랜드를 준비하거나 운영하고 있는 사람들이
              자유롭게 정보를 나누는 커뮤니티입니다.
            </DialogDescription>
          </div>

          <div className="px-6 py-5">
            <ul className="space-y-2.5">
              {communityHighlights.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-stone-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  {item}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={openKakaoCommunity}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(116,27,43,0.3)] transition hover:bg-brand-dark active:scale-[0.98]"
            >
              <KakaoChip className="h-5 w-5" />
              카카오톡 커뮤니티 참여하기
            </button>
            <p className="mt-3 text-center text-[11px] text-stone-400">
              제작 상담이 아닌, 브랜드 정보 공유를 위한 커뮤니티입니다.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
