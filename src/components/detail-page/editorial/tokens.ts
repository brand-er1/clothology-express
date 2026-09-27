import { createContext, useContext, type CSSProperties } from "react";
import type {
  DetailArtDirection,
  DetailFundingStats,
  DetailImageJobStatus,
  DetailImageType,
  DetailPageDocument,
  DetailPageSource,
  DetailSectionBackground,
  DetailTypeFace,
} from "@/types/detailPage";
import type { FundingColor } from "@/lib/funding-colors";
import { contrastRatio } from "@/lib/detail-page/artDirection";

export type EditorialContext = {
  direction: DetailArtDirection;
  document: DetailPageDocument;
  source: DetailPageSource;
  stats: DetailFundingStats;
  watermark: boolean;
  editing: boolean;
  imageStatus?: Partial<Record<DetailImageType, DetailImageJobStatus>>;
  colors?: FundingColor[];
};

export const EdCtx = createContext<EditorialContext | null>(null);

export const useEd = () => {
  const value = useContext(EdCtx);
  if (!value) throw new Error("Editorial renderer context missing");
  return value;
};

/* ───────── Typography ───────── */

export const FONT_STACK: Record<DetailTypeFace, string> = {
  grotesk: "Manrope, Pretendard, 'Apple SD Gothic Neo', sans-serif",
  serif: "'Cormorant Garamond', 'Noto Serif KR', 'Nanum Myeongjo', serif",
  condensed: "'Barlow Condensed', Pretendard, 'Apple SD Gothic Neo', sans-serif",
  rounded: "Pretendard, Manrope, 'Apple SD Gothic Neo', sans-serif",
};

export const BODY_STACK = "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
export const CAPTION_STACK = "Manrope, Pretendard, sans-serif";

const FACE_WEIGHT: Record<DetailTypeFace, number> = { grotesk: 500, serif: 400, condensed: 600, rounded: 600 };
/** Condensed and serif faces are visually smaller at the same size. */
const FACE_SCALE: Record<DetailTypeFace, number> = { grotesk: 1, serif: 1.12, condensed: 1.22, rounded: 0.96 };

/**
 * Display type style. Sizes follow the container width (cqi) with hard caps, so a title never
 * takes over a phone screen; long titles step down automatically.
 */
export const displayStyle = (
  direction: DetailArtDirection,
  level: "hero" | "section" | "quote",
  text = "",
): CSSProperties => {
  const face = direction.typography.display;
  const factor = FACE_SCALE[face] * (text.length > 28 ? 0.72 : text.length > 16 ? 0.86 : 1);
  const [min, fluid, max] =
    level === "hero" ? [25, 5, 58] : level === "quote" ? [21, 3.4, 40] : [19, 2.6, 32];
  const size = (value: number) => Math.round(value * factor * 10) / 10;
  return {
    fontFamily: FONT_STACK[face],
    fontWeight: FACE_WEIGHT[face],
    // Hangul has no true italic (browsers slant it synthetically), so italics are Latin-only.
    fontStyle: direction.typography.italic && face !== "grotesk" && level !== "section" && !/[\u3131-\uD79D]/.test(text) ? "italic" : undefined,
    fontSize: `clamp(${size(min)}px, ${size(fluid)}cqi, ${size(max)}px)`,
    lineHeight: face === "condensed" ? 0.98 : face === "serif" ? 1.12 : 1.16,
    letterSpacing: face === "condensed" ? "-0.005em" : face === "serif" ? "-0.01em" : "-0.025em",
    textTransform: direction.typography.uppercase ? "uppercase" : undefined,
    wordBreak: "keep-all",
    overflowWrap: "anywhere",
  };
};

export const captionStyle: CSSProperties = {
  fontFamily: CAPTION_STACK,
  fontSize: "10.5px",
  fontWeight: 600,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
};

/** Labels that may be Korean (spec names): no wide tracking, which breaks Hangul rhythm. */
export const labelStyle: CSSProperties = {
  fontFamily: CAPTION_STACK,
  fontSize: "11.5px",
  fontWeight: 600,
  letterSpacing: "0.02em",
};

/* ───────── Spacing ───────── */

export const SECTION_PAD: Record<DetailArtDirection["spacing"], string> = {
  airy: "py-[72px] dp-md:py-[120px]",
  regular: "py-[56px] dp-md:py-[96px]",
  tight: "py-[44px] dp-md:py-[72px]",
};

export const GUTTER = "px-5 dp-md:px-10 dp-lg:px-14";
export const INNER = `mx-auto w-full max-w-[1240px] ${GUTTER}`;

/* ───────── Surfaces ───────── */

const mix = (color: string, base: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, ${base})`;

/** CSS variables + colors for a section surface (배경 변경 options map onto the page palette). */
export const surfaceStyle = (direction: DetailArtDirection, background: DetailSectionBackground | undefined): CSSProperties => {
  const p = direction.palette;
  const pick = (): [string, string] => {
    switch (background) {
      case "light":
        return [p.alt, p.ink];
      case "dark":
        return [p.inverse, p.inverseInk];
      case "white":
        return ["#ffffff", contrastRatio("#ffffff", p.ink) >= 4.5 ? p.ink : "#161616"];
      case "brand":
        return [p.accent, contrastRatio(p.accent, "#ffffff") >= 4.5 ? "#ffffff" : "#161616"];
      default:
        return [p.bg, p.ink];
    }
  };
  const [bg, ink] = pick();
  return {
    backgroundColor: bg,
    color: ink,
    ["--ed-bg" as string]: bg,
    ["--ed-ink" as string]: ink,
    ["--ed-muted" as string]: background && background !== "default" ? mix(ink, bg, 62) : p.muted,
    ["--ed-rule" as string]: background && background !== "default" ? mix(ink, bg, 18) : p.rule,
    ["--ed-frame" as string]: mix(ink, bg, 6),
    ["--ed-accent" as string]: p.accent,
  };
};

/* ───────── Images ───────── */

export const ratioToCss = (ratio: string | undefined, fallback = "4 / 5") => {
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(ratio ?? "");
  return match ? `${match[1]} / ${match[2]}` : fallback;
};

/** Fine film grain (SVG turbulence), laid over generated photos on concepts that use it. */
export const GRAIN_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export const pad = (value: number) => String(value).padStart(2, "0");

/** YouTube / Vimeo page URL → embeddable URL; mp4/webm → null (use <video>). */
export const toEmbedUrl = (url: string): { kind: "iframe" | "video"; src: string } | null => {
  const value = url.trim();
  if (!/^https:\/\//i.test(value)) return null;
  const youtube = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i.exec(value);
  if (youtube) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${youtube[1]}?rel=0` };
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(value);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/\.(mp4|webm|mov)(\?.*)?$/i.test(value)) return { kind: "video", src: value };
  return null;
};

const FONT_LINK_ID = "detail-editorial-fonts";

/** Loads the editorial display faces once, only on pages that use them. */
export const ensureEditorialFonts = () => {
  if (typeof document === "undefined" || document.getElementById(FONT_LINK_ID)) return;
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,500;0,600;1,600&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Noto+Serif+KR:wght@400;500&display=swap";
  document.head.appendChild(link);
};
