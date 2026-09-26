import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import type { NavLinkItem } from "./navigationData";

/**
 * Desktop-only hover menu for 제작하기. A custom hover/click panel (rather than Radix
 * NavigationMenu's viewport primitive) keeps full control over the numbered editorial list,
 * while staying simple to reason about.
 */
export const MakeMegaMenu = ({ items }: { items: NavLinkItem[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeout = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const open = () => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    setIsOpen(true);
  };
  const scheduleClose = () => {
    closeTimeout.current = setTimeout(() => setIsOpen(false), 150);
  };

  useEffect(() => setIsOpen(false), [location.pathname]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (items.length === 0) return null;

  const isMakeRoute = items.some((item) => location.pathname === item.to);

  return (
    <div ref={wrapperRef} className="relative" onMouseEnter={open} onMouseLeave={scheduleClose}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        className={`relative flex items-center gap-1 py-2 text-[14px] font-medium tracking-[-0.01em] transition-colors duration-300 after:absolute after:inset-x-0 after:-bottom-px after:h-px after:origin-left after:bg-brand after:transition-transform after:duration-300 ${
          isOpen || isMakeRoute ? "text-brand after:scale-x-100" : "text-stone-600 after:scale-x-0 hover:text-[#211b1c]"
        }`}
      >
        제작하기
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-5 w-[520px] animate-in fade-in-0 slide-in-from-top-1 border border-black/[0.07] bg-[#fbfaf8] px-7 pb-6 pt-6 shadow-[0_24px_60px_rgba(33,27,28,0.10)] duration-300">
          <p className="eyebrow">Make your clothes</p>
          <div className="mt-4 grid grid-cols-2 gap-x-8">
            {items.map((item, index) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setIsOpen(false)}
                className="group flex items-baseline gap-3 border-t border-black/[0.07] py-4"
              >
                <span className="font-display text-[11px] font-medium text-stone-400">{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="link-draw text-[15px] font-semibold text-[#211b1c] transition-colors group-hover:text-brand">{item.label}</span>
                  {item.description && (
                    <span className="mt-1 block text-xs leading-5 text-stone-500">{item.description}</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
