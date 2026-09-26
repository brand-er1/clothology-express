import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

const NOTICE_STORAGE_KEY = "brander_visit_notice_seen";

export const VisitDataNotice = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem(NOTICE_STORAGE_KEY) !== "1");
  }, []);

  if (!visible) return null;

  const close = () => {
    localStorage.setItem(NOTICE_STORAGE_KEY, "1");
    setVisible(false);
  };

  return (
    <aside
      data-mascot-safezone
      data-floating-widget
      className="fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom)+var(--mobile-cta-h,0px))] z-[70] mx-auto flex max-w-md items-center gap-2 rounded-full border border-stone-200 bg-white/95 py-1 pl-3.5 pr-1 shadow-lg backdrop-blur md:bottom-5"
    >
      <p className="min-w-0 flex-1 truncate text-[11px] leading-4 text-stone-500">
        <span className="font-bold text-stone-900">방문정보 수집 안내</span>{" "}
        <Link to="/visit-data-policy" className="underline decoration-stone-300 underline-offset-2 hover:text-brand">
          자세히
        </Link>
      </p>
      <button type="button" onClick={close} className="flex min-h-9 shrink-0 items-center rounded-[3px] bg-stone-950 px-3.5 text-xs font-bold text-white hover:bg-brand">
        확인
      </button>
      <button type="button" onClick={close} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100" aria-label="안내 닫기">
        <X className="h-3.5 w-3.5" />
      </button>
    </aside>
  );
};

