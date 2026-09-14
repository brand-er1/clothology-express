import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import type { NavLinkItem } from "./navigationData";

/**
 * Desktop-only hover mega menu for MAKE. A custom hover/click panel (rather than Radix
 * NavigationMenu's viewport primitive) keeps full control over the icon+description grid layout
 * the design calls for, while staying simple to reason about.
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

  return (
    <div ref={wrapperRef} className="relative" onMouseEnter={open} onMouseLeave={scheduleClose}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        className={`flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
          isOpen ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"
        }`}
      >
        MAKE
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-1/2 top-full z-50 mt-3 w-[560px] -translate-x-1/2 rounded-3xl border border-stone-200 bg-white p-3 shadow-2xl">
          <p className="px-4 pb-2 pt-2 text-xs font-bold uppercase tracking-[0.22em] text-brand">
            Make your clothes
          </p>
          <div className="grid grid-cols-2 gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsOpen(false)}
                  className="flex items-start gap-3 rounded-2xl p-3 transition hover:bg-stone-50"
                >
                  {Icon && (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                      <Icon className="h-5 w-5" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-stone-900">{item.label}</span>
                    {item.description && (
                      <span className="mt-0.5 block text-xs leading-5 text-stone-500">{item.description}</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
