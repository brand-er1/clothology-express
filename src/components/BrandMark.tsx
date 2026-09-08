import { getAppPath } from "@/utils/appUrl";

interface BrandMarkProps {
  className?: string;
  /** "white" for dark/colored backgrounds where the maroon mark would lack contrast. */
  variant?: "default" | "white";
}

/** The BRAND-ER "R" logomark, cropped from the official lockup — a drop-in replacement for the
 * generic lucide "Sparkles" icon everywhere it stood in for AI/brand accents across the site, so
 * those spots carry the actual brand mark instead of a generic sparkle glyph. */
export const BrandMark = ({ className = "h-4 w-4", variant = "default" }: BrandMarkProps) => (
  <img
    src={getAppPath(variant === "white" ? "/lovable-uploads/brand-mark-white.png" : "/lovable-uploads/brand-mark.png")}
    alt=""
    aria-hidden="true"
    className={`inline-block shrink-0 object-contain ${className}`}
  />
);
