import type { CSSProperties, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { DetailImageView } from "@/components/detail-page/DetailImageView";
import { DEFAULT_IMAGE_RATIO } from "@/lib/detail-page/artDirection";
import { cn } from "@/lib/utils";
import type { DetailFact, DetailImage, DetailItem, DetailSection } from "@/types/detailPage";
import { BODY_STACK, GRAIN_URL, captionStyle, labelStyle, displayStyle, pad, ratioToCss, useEd } from "./tokens";

/**
 * A photo at its own aspect ratio. Generated shots keep their native ratio (never cropped), the
 * creator's design renders sit uncropped on a quiet frame, uploads fill the frame.
 */
export const EdImage = ({
  image,
  ratio,
  className,
  fit,
  style,
}: {
  image: DetailImage;
  /** Frame ratio when the image has none of its own ("4:5"). */
  ratio?: string;
  className?: string;
  fit?: "contain" | "cover";
  style?: CSSProperties;
}) => {
  const { direction, watermark, imageStatus } = useEd();
  const generated = image.source === "generated";
  const frameRatio = (generated && image.ratio) || ratio || (image.slot ? image.ratio ?? DEFAULT_IMAGE_RATIO[image.slot] : undefined) || "4:5";
  const resolvedFit = fit ?? (image.source === "design" ? "contain" : "cover");
  const slotStatus = image.slot && image.source === "design" ? imageStatus?.[image.slot] : undefined;
  return (
    <div className={cn("relative w-full overflow-hidden", className)} style={{ aspectRatio: ratioToCss(frameRatio), ...style }}>
      <DetailImageView
        image={image}
        fit={resolvedFit}
        watermark={watermark && image.source !== "upload"}
        // Design renders are multiplied onto their frame; a light studio frame keeps the garment's
        // true color on every surface (a dark frame would darken the product).
        className={cn("h-full w-full", image.source === "design" ? "bg-[#efeee9]" : "bg-[color:var(--ed-frame)]")}
      />
      {generated && direction.grain && (
        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-multiply" style={{ backgroundImage: GRAIN_URL }} />
      )}
      {slotStatus && slotStatus !== "completed" && (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 bg-black/70 px-2 py-1 font-sans text-[11px] font-medium normal-case tracking-normal text-white">
          {slotStatus === "failed" ? "원본 디자인 · AI 생성 실패" : (<><Loader2 className="h-3 w-3 animate-spin" /> AI 이미지 {slotStatus === "pending" ? "대기" : "제작 중"}</>)}
        </span>
      )}
    </div>
  );
};

export const Caption = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn("text-[color:var(--ed-muted)]", className)} style={captionStyle}>
    {children}
  </p>
);

/** "03 — DETAIL" section label with a hairline. */
export const SectionLabel = ({ index, section, className }: { index: number; section: DetailSection; className?: string }) => (
  <div className={cn("flex items-center gap-3", className)}>
    <Caption className="shrink-0 tabular-nums">{pad(index + 1)}</Caption>
    <span className="h-px w-6 shrink-0 bg-[color:var(--ed-rule)]" />
    {section.eyebrow && <Caption className="min-w-0 truncate">{section.eyebrow}</Caption>}
  </div>
);

export const Title = ({
  text,
  level = "section",
  as: Tag = "h2",
  className,
}: {
  text: string;
  level?: "hero" | "section" | "quote";
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
}) => {
  const { direction } = useEd();
  if (!text.trim()) return null;
  return (
    <Tag className={className} style={displayStyle(direction, level, text)}>
      {text}
    </Tag>
  );
};

export const Body = ({ text, className, size = "base" }: { text: string; className?: string; size?: "base" | "small" }) => {
  if (!text.trim()) return null;
  return (
    <div
      className={cn("space-y-4 whitespace-pre-line break-keep text-wrap-anywhere", size === "small" ? "text-[13px] leading-6" : "text-[15px] leading-[1.8]", className)}
      style={{ fontFamily: BODY_STACK, color: "color-mix(in srgb, var(--ed-ink) 80%, var(--ed-bg))" }}
    >
      {text
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block, index) => (
          <p key={index}>{block}</p>
        ))}
    </div>
  );
};

/** Specification cells separated by hairlines — never boxed cards. */
export const Specs = ({ facts, columns = 2, className }: { facts: DetailFact[]; columns?: 2 | 3; className?: string }) => {
  if (!facts.length) return null;
  return (
    <dl className={cn("grid grid-cols-2 border-t border-[color:var(--ed-rule)]", columns === 3 && "dp-md:grid-cols-3", className)}>
      {facts.map((fact, index) => (
        <div key={`${fact.label}-${index}`} className="min-w-0 border-b border-[color:var(--ed-rule)] py-3.5 pr-4">
          <dt style={labelStyle} className="text-[color:var(--ed-muted)]">{fact.label}</dt>
          <dd className="mt-1.5 text-[14px] font-medium leading-6 text-wrap-anywhere" style={{ fontFamily: BODY_STACK }}>
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};

/** Numbered short lines (design highlights, callouts). */
export const Lines = ({ items, className, numbered = true }: { items: DetailItem[]; className?: string; numbered?: boolean }) => {
  if (!items.length) return null;
  return (
    <ol className={cn("border-t border-[color:var(--ed-rule)]", className)}>
      {items.map((item, index) => (
        <li key={item.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2 border-b border-[color:var(--ed-rule)] py-3.5">
          <span style={captionStyle} className="pt-1 tabular-nums text-[color:var(--ed-muted)]">{numbered ? pad(index + 1) : "—"}</span>
          <div className="min-w-0" style={{ fontFamily: BODY_STACK }}>
            {item.title && <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-wrap-anywhere">{item.title}</p>}
            {item.text && <p className={cn("text-[14px] leading-6 text-wrap-anywhere", item.title && "mt-1 text-[color:var(--ed-muted)]")}>{item.text}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
};

/** Horizontal snap strip on phones, grid from `dp-md`. */
export const Strip = ({ children, columns = 3, className }: { children: ReactNode; columns?: 2 | 3 | 4; className?: string }) => (
  <div
    className={cn(
      "-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] dp-md:mx-0 dp-md:grid dp-md:gap-5 dp-md:overflow-visible dp-md:px-0 dp-md:pb-0 [&>*]:w-[72%] [&>*]:shrink-0 [&>*]:snap-start dp-md:[&>*]:w-auto",
      columns === 2 && "dp-md:grid-cols-2",
      columns === 3 && "dp-md:grid-cols-3",
      columns === 4 && "dp-md:grid-cols-4",
      className,
    )}
  >
    {children}
  </div>
);
