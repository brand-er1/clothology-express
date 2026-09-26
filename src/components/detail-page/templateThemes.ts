import type { DetailPageTemplateId } from "@/types/detailPage";

/**
 * Typography / spacing / surface tokens per template. Layout differences (section
 * arrangement, image ratios) live in the section components, keyed by template id.
 * `dp-*` variants are container-width breakpoints (see tailwind.config.ts).
 */
export type DetailTheme = {
  root: string;
  inner: string;
  section: string;
  eyebrow: string;
  h1: string;
  h2: string;
  h3: string;
  body: string;
  muted: string;
  rule: string;
  frame: string;
  /** Alternate surface for every other section (street/sports rhythm). */
  altSection: string;
};

export const DETAIL_THEMES: Record<DetailPageTemplateId, DetailTheme> = {
  minimal: {
    root: "bg-white text-stone-900",
    inner: "mx-auto w-full max-w-[1080px] px-5 dp-md:px-10",
    section: "py-14 dp-md:py-20",
    eyebrow: "text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400",
    h1: "text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] dp-md:text-5xl",
    h2: "text-xl font-semibold tracking-[-0.01em] dp-md:text-2xl",
    h3: "text-[15px] font-semibold",
    body: "text-[15px] leading-7 text-stone-600",
    muted: "text-stone-400",
    rule: "border-stone-200",
    frame: "bg-[#f4f4f2]",
    altSection: "",
  },
  street: {
    root: "bg-[#0c0c0c] text-[#f5f5f0] font-['Manrope',_Pretendard,_sans-serif]",
    inner: "w-full px-4 dp-md:px-8",
    section: "py-12 dp-md:py-16",
    eyebrow: "text-xs font-extrabold uppercase tracking-[0.08em] opacity-60",
    h1: "text-[44px] font-black uppercase leading-[0.86] tracking-[-0.045em] dp-sm:text-7xl dp-lg:text-[112px]",
    h2: "text-[38px] font-black uppercase leading-[0.9] tracking-[-0.04em] dp-md:text-6xl",
    h3: "text-lg font-black uppercase tracking-[-0.01em]",
    body: "text-[15px] font-semibold leading-7 opacity-80",
    muted: "opacity-50",
    rule: "[border-color:color-mix(in_srgb,currentColor_22%,transparent)]",
    frame: "bg-[#e9e8e3]",
    altSection: "bg-[#f5f5f0] text-[#0c0c0c]",
  },
  luxury: {
    root: "bg-[#f6f2ea] text-[#2a2522] font-serif",
    inner: "mx-auto w-full max-w-[920px] px-6 dp-md:px-12",
    section: "py-20 dp-md:py-32",
    eyebrow: "font-sans text-[10px] font-medium uppercase tracking-[0.42em] text-[#8a6d4b]",
    h1: "text-[34px] font-normal leading-[1.15] tracking-[-0.01em] dp-md:text-6xl",
    h2: "text-[26px] font-normal leading-snug dp-md:text-4xl",
    h3: "text-lg font-normal italic",
    body: "font-sans text-[15px] font-light leading-8 text-[#2a2522]/75",
    muted: "text-[#2a2522]/45",
    rule: "border-[#2a2522]/15",
    frame: "bg-[#ece6da]",
    altSection: "",
  },
  sports: {
    root: "bg-[#eef0f2] text-[#11161c] font-['Manrope',_Pretendard,_sans-serif]",
    inner: "mx-auto w-full max-w-[1200px] px-4 dp-md:px-8",
    section: "py-12 dp-md:py-16",
    eyebrow: "text-[11px] font-extrabold uppercase italic tracking-[0.14em] text-brand",
    h1: "text-[40px] font-extrabold uppercase italic leading-[0.92] tracking-[-0.03em] dp-md:text-7xl",
    h2: "text-[30px] font-extrabold uppercase italic leading-none tracking-[-0.02em] dp-md:text-5xl",
    h3: "text-base font-extrabold uppercase",
    body: "text-[15px] font-medium leading-7 text-[#11161c]/70",
    muted: "text-[#11161c]/45",
    rule: "border-[#11161c]/15",
    frame: "bg-white",
    altSection: "bg-white",
  },
  casual: {
    root: "bg-[#fbf7f0] text-[#2d2a26]",
    inner: "mx-auto w-full max-w-[860px] px-5 dp-md:px-8",
    section: "py-12 dp-md:py-16",
    eyebrow: "text-[13px] font-bold text-[#c2703d]",
    h1: "text-[30px] font-extrabold leading-[1.22] tracking-[-0.02em] dp-md:text-5xl",
    h2: "text-2xl font-extrabold tracking-[-0.02em] dp-md:text-3xl",
    h3: "text-base font-bold",
    body: "text-base leading-8 text-[#2d2a26]/75",
    muted: "text-[#2d2a26]/45",
    rule: "border-[#2d2a26]/10",
    frame: "bg-[#f1e6d6] rounded-2xl",
    altSection: "",
  },
  vintage: {
    root: "bg-[#efe6d6] text-[#3b2f25] font-serif",
    inner: "mx-auto w-full max-w-[920px] px-6 dp-md:px-12",
    section: "py-16 dp-md:py-28",
    eyebrow: "font-sans text-[10px] font-semibold uppercase tracking-[0.36em] text-[#9c5b2e]",
    h1: "text-[34px] font-normal leading-[1.12] tracking-[-0.01em] dp-md:text-6xl",
    h2: "text-[26px] font-normal leading-snug dp-md:text-4xl",
    h3: "text-lg font-normal italic",
    body: "font-sans text-[15px] leading-8 text-[#3b2f25]/80",
    muted: "text-[#3b2f25]/50",
    rule: "border-[#3b2f25]/20",
    frame: "bg-[#e3d6c0] sepia-[.15]",
    altSection: "",
  },
  y2k: {
    root: "bg-[#1a0b2e] text-[#fdf2ff] font-['Manrope',_Pretendard,_sans-serif]",
    inner: "w-full px-4 dp-md:px-8",
    section: "py-12 dp-md:py-16",
    eyebrow: "text-xs font-extrabold uppercase tracking-[0.12em] text-[#ff4fd8]",
    h1: "text-[42px] font-black uppercase leading-[0.9] tracking-[-0.04em] dp-sm:text-7xl dp-lg:text-[104px]",
    h2: "text-[34px] font-black uppercase leading-[0.92] tracking-[-0.03em] dp-md:text-6xl",
    h3: "text-lg font-black uppercase",
    body: "text-[15px] font-semibold leading-7 opacity-85",
    muted: "opacity-55",
    rule: "[border-color:color-mix(in_srgb,currentColor_25%,transparent)]",
    frame: "bg-[#2b1648]",
    altSection: "bg-[#fdf2ff] text-[#1a0b2e]",
  },
  emotional: {
    root: "bg-[#f7f1f3] text-[#3d3438]",
    inner: "mx-auto w-full max-w-[800px] px-6 dp-md:px-10",
    section: "py-14 dp-md:py-20",
    eyebrow: "text-[13px] font-semibold text-[#b07a8c]",
    h1: "text-[30px] font-bold leading-[1.3] tracking-[-0.02em] dp-md:text-5xl",
    h2: "text-2xl font-bold leading-snug tracking-[-0.02em] dp-md:text-3xl",
    h3: "text-base font-semibold",
    body: "text-base leading-8 text-[#3d3438]/75",
    muted: "text-[#3d3438]/45",
    rule: "border-[#3d3438]/10",
    frame: "bg-[#efe3e7] rounded-3xl",
    altSection: "",
  },
  lookbook: {
    root: "bg-[#f2f1ee] text-[#141414]",
    inner: "mx-auto w-full max-w-[1200px] px-4 dp-md:px-10",
    section: "py-12 dp-md:py-20",
    eyebrow: "text-[10px] font-semibold uppercase tracking-[0.3em] text-stone-500",
    h1: "text-[30px] font-light uppercase leading-[1.05] tracking-[0.02em] dp-md:text-6xl",
    h2: "text-xl font-light uppercase tracking-[0.06em] dp-md:text-3xl",
    h3: "text-sm font-semibold uppercase tracking-[0.1em]",
    body: "text-[14px] leading-7 text-stone-600",
    muted: "text-stone-400",
    rule: "border-stone-300",
    frame: "bg-[#e7e5e0]",
    altSection: "",
  },
};
