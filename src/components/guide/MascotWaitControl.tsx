import { useEffect, useState } from "react";
import { MASCOT_WAIT_EVENT, MASCOT_WAIT_STORAGE_KEY } from "./useMascotRoam";

const readWaiting = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MASCOT_WAIT_STORAGE_KEY) === "1";
};

export const MascotWaitControl = () => {
  const [waiting, setWaiting] = useState(readWaiting);

  useEffect(() => {
    const sync = () => setWaiting(readWaiting());
    window.addEventListener("storage", sync);
    window.addEventListener(MASCOT_WAIT_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(MASCOT_WAIT_EVENT, sync);
    };
  }, []);

  if (window.location.pathname.startsWith("/admin")) return null;

  const toggle = () => {
    const next = !waiting;
    window.localStorage.setItem(MASCOT_WAIT_STORAGE_KEY, next ? "1" : "0");
    setWaiting(next);
    window.dispatchEvent(new Event(MASCOT_WAIT_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={waiting}
      title={waiting ? "브랜더 캐릭터를 다시 움직이게 합니다." : "브랜더 캐릭터를 현재 위치에서 멈춥니다."}
      className="fixed bottom-4 left-4 z-[61] rounded-full border border-black/10 bg-white/95 px-3.5 py-2 text-xs font-bold text-stone-700 shadow-lg backdrop-blur transition hover:bg-stone-50 sm:bottom-6 sm:left-6"
    >
      {waiting ? "▶ 다시 움직여" : "⏸ 기다려"}
    </button>
  );
};
