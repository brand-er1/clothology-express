import { createContext, useContext, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import type {
  DetailFundingStats,
  DetailImage,
  DetailImageJobStatus,
  DetailImageType,
  DetailPageDocument,
  DetailPageSource,
  DetailPageTemplateId,
  DetailSection,
  DetailLayoutId,
  DetailSectionLayout,
} from "@/types/detailPage";
import { FundingSizeGuide } from "@/components/funding/FundingSizeGuide";
import { DetailImageView } from "@/components/detail-page/DetailImageView";
import { DETAIL_THEMES, type DetailTheme } from "@/components/detail-page/templateThemes";
import { colorOptions } from "@/lib/customize-constants";
import { cn } from "@/lib/utils";
import { getLayoutTemplate } from "@/lib/detail-page/templates";

type RenderContext = {
  /** Base layout (vintage → luxury, y2k → street, emotional → casual, lookbook → minimal). */
  template: DetailLayoutId;
  t: DetailTheme;
  document: DetailPageDocument;
  source: DetailPageSource;
  stats: DetailFundingStats;
  watermark: boolean;
  imageStatus?: Partial<Record<DetailImageType, DetailImageJobStatus>>;
};

const Ctx = createContext<RenderContext | null>(null);
const useRender = () => {
  const value = useContext(Ctx);
  if (!value) throw new Error("DetailPageRenderer context missing");
  return value;
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
const pad = (value: number) => String(value).padStart(2, "0");

const Paragraphs = ({ text, className }: { text: string; className?: string }) => {
  if (!text.trim()) return null;
  return (
    <div className={cn("space-y-4 whitespace-pre-line text-wrap-anywhere", className)}>
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

const Img = ({ image, className, fit }: { image: DetailImage; className?: string; fit?: "contain" | "cover" }) => {
  const { t, watermark, imageStatus } = useRender();
  const resolvedFit = fit ?? (image.source === "design" ? "contain" : "cover");
  // Editor only: an AI slot still showing the creator's design is labelled honestly.
  const slotStatus = image.slot && image.source === "design" ? imageStatus?.[image.slot] : undefined;
  return (
    <div className={cn("relative", className)}>
      <DetailImageView
        image={image}
        fit={resolvedFit}
        watermark={watermark && image.source !== "upload"}
        className={cn(t.frame, "h-full w-full")}
      />
      {slotStatus && slotStatus !== "completed" && (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 bg-black/75 px-2 py-1 font-sans text-[11px] font-semibold not-italic normal-case tracking-normal text-white">
          {slotStatus === "failed" ? (
            "원본 디자인 · AI 생성 실패"
          ) : (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> AI 이미지 {slotStatus === "pending" ? "대기 중" : "생성 중"}
            </>
          )}
        </span>
      )}
    </div>
  );
};

const Facts = ({ facts, className }: { facts: DetailSection["facts"]; className?: string }) => {
  const { t, template } = useRender();
  if (!facts.length) return null;
  if (template === "sports") {
    return (
      <dl className={cn("grid grid-cols-2 gap-px bg-[#11161c]/10 dp-md:grid-cols-3", className)}>
        {facts.map((fact, index) => (
          <div key={`${fact.label}-${index}`} className="min-w-0 bg-white px-4 py-3">
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#11161c]/45">{fact.label}</dt>
            <dd className="mt-1 text-wrap-anywhere text-sm font-bold">{fact.value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (template === "casual") {
    return (
      <ul className={cn("flex flex-wrap gap-2", className)}>
        {facts.map((fact, index) => (
          <li key={`${fact.label}-${index}`} className="max-w-full rounded-full bg-white px-3.5 py-1.5 text-sm text-wrap-anywhere">
            <span className="text-[#2d2a26]/50">{fact.label}</span> <strong className="font-bold">{fact.value}</strong>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <dl className={cn("border-t", t.rule, template === "luxury" && "font-sans", className)}>
      {facts.map((fact, index) => (
        <div
          key={`${fact.label}-${index}`}
          className={cn("grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-b py-3 text-sm", t.rule)}
        >
          <dt className={cn("text-xs font-semibold uppercase tracking-[0.1em]", t.muted)}>{fact.label}</dt>
          <dd className="text-wrap-anywhere font-medium">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
};

const Heading = ({ section, index, align = "left" }: { section: DetailSection; index: number; align?: "left" | "center" }) => {
  const { t, template } = useRender();
  return (
    <header className={cn(align === "center" && "text-center")}>
      {template === "street" ? (
        <p className={t.eyebrow}>
          {pad(index + 1)} / {section.eyebrow}
        </p>
      ) : template === "sports" ? (
        <p className={t.eyebrow}>
          SEC.{pad(index + 1)} — {section.eyebrow}
        </p>
      ) : (
        section.eyebrow && <p className={t.eyebrow}>{section.eyebrow}</p>
      )}
      {section.title && <h2 className={cn(t.h2, "mt-3 text-wrap-anywhere")}>{section.title}</h2>}
    </header>
  );
};

/* ───────────────────────────── HERO ───────────────────────────── */

const Hero = ({ section }: { section: DetailSection }) => {
  const { t, template, document } = useRender();
  const image = section.images[0];
  const title = section.title || document.productName;
  const oneLiner = section.description || document.subtitle;

  if (template === "street") {
    return (
      <section className="overflow-hidden pb-10 pt-8 dp-md:pb-14">
        <div className={t.inner}>
          <p className={t.eyebrow}>{section.eyebrow}</p>
          <h1 className={cn(t.h1, "mt-4 text-wrap-anywhere")}>{document.productNameEn || title}</h1>
        </div>
        {image && <Img image={image} className="mt-6 aspect-[3/4] w-full dp-md:aspect-[16/10]" />}
        <div className={cn(t.inner, "mt-6 grid gap-3 border-t-4 border-current pt-5 dp-md:grid-cols-[1fr_1.2fr]")}>
          <p className="text-xl font-black leading-tight text-wrap-anywhere dp-md:text-3xl">{title}</p>
          <p className={t.body}>{oneLiner}</p>
        </div>
        {document.productNameEn && (
          <div className="mt-8 overflow-hidden whitespace-nowrap border-y-2 border-current py-2" aria-hidden>
            <div className="inline-block animate-marquee text-sm font-black uppercase tracking-[0.1em]">
              {Array.from({ length: 8 }, () => `${document.productNameEn} ✕ `).join("")}
            </div>
          </div>
        )}
      </section>
    );
  }

  if (template === "luxury") {
    return (
      <section className="py-16 dp-md:py-28">
        <div className={cn(t.inner, "text-center")}>
          <p className={t.eyebrow}>{section.eyebrow}</p>
          {image && <Img image={image} className="mx-auto mt-10 aspect-[2/3] w-full max-w-[420px] dp-md:mt-14" />}
          <h1 className={cn(t.h1, "mt-10 text-wrap-anywhere dp-md:mt-14")}>{title}</h1>
          {document.productNameEn && (
            <p className="mt-4 font-sans text-[11px] uppercase tracking-[0.36em] text-[#2a2522]/55">{document.productNameEn}</p>
          )}
          {oneLiner && <p className="mx-auto mt-8 max-w-md text-lg italic leading-8 text-[#2a2522]/70">{oneLiner}</p>}
        </div>
      </section>
    );
  }

  if (template === "sports") {
    return (
      <section className="py-8 dp-md:py-12">
        <div className={cn(t.inner, "grid gap-6 dp-md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] dp-md:items-end")}>
          <div className="order-2 dp-md:order-1">
            <p className={t.eyebrow}>{section.eyebrow}</p>
            <h1 className={cn(t.h1, "mt-3 text-wrap-anywhere")}>{document.productNameEn || title}</h1>
            <p className="mt-3 text-lg font-bold text-wrap-anywhere">{title}</p>
            {oneLiner && <p className={cn(t.body, "mt-4")}>{oneLiner}</p>}
            <div className="mt-6 h-1.5 w-24 bg-brand" />
          </div>
          {image && (
            <div className="relative order-1 dp-md:order-2">
              <Img image={image} className="aspect-square w-full" />
              <span className="absolute left-0 top-0 bg-[#11161c] px-3 py-1.5 text-[11px] font-extrabold uppercase italic tracking-[0.12em] text-white">
                Drop 01
              </span>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (template === "casual") {
    return (
      <section className="pb-10 pt-8 dp-md:pb-14">
        <div className={t.inner}>
          {image && <Img image={image} className="aspect-square w-full dp-md:aspect-[4/3]" />}
          <span className="mt-7 inline-block rounded-full bg-[#c2703d] px-3 py-1 text-xs font-bold text-white">NEW</span>
          <h1 className={cn(t.h1, "mt-3 text-wrap-anywhere")}>{title}</h1>
          {oneLiner && <p className="mt-3 text-lg leading-8 text-[#2d2a26]/75">{oneLiner}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="pb-12 pt-6 dp-md:pb-20 dp-md:pt-10">
      <div className={cn(t.inner, "grid gap-8 dp-md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] dp-md:items-end dp-md:gap-12")}>
        {image && <Img image={image} className="aspect-[4/5] w-full" />}
        <div className="pb-2">
          <p className={t.eyebrow}>{section.eyebrow}</p>
          <h1 className={cn(t.h1, "mt-3 text-wrap-anywhere")}>{title}</h1>
          {document.productNameEn && <p className={cn("mt-2 text-xs uppercase tracking-[0.2em]", t.muted)}>{document.productNameEn}</p>}
          {oneLiner && <p className={cn(t.body, "mt-6 border-t pt-6", t.rule)}>{oneLiner}</p>}
        </div>
      </div>
    </section>
  );
};

/* ─────────────────────── TEXT-LED SECTIONS ─────────────────────── */

/** story / fabric / fit / color / custom_text: heading + body + facts + items + optional image. */
const InfoSection = ({ section, index }: { section: DetailSection; index: number }) => {
  const { t, template, source } = useRender();
  const image = section.images[0];
  const colorHex =
    section.type === "color"
      ? colorOptions.find((option) => option.label === source.color || option.value === source.colorId)?.hex
      : undefined;
  const swatch = colorHex ? (
    <span className="mb-5 inline-flex items-center gap-3">
      <span className="h-10 w-10 border border-black/10" style={{ backgroundColor: colorHex, borderRadius: template === "casual" ? 999 : 0 }} />
      <span className="text-sm font-semibold">{section.facts[0]?.value}</span>
    </span>
  ) : null;
  const itemList = section.items.length > 0 && (
    <ul className={cn("mt-6 space-y-2", template === "luxury" && "font-sans")}>
      {section.items.map((item) => (
        <li key={item.id} className={cn("flex gap-3 text-[15px] leading-7", template === "street" && "font-bold")}>
          <span className={cn("mt-[11px] h-1 w-3 shrink-0", template === "casual" ? "rounded-full bg-[#c2703d]" : "bg-current opacity-40")} />
          <span className="min-w-0 text-wrap-anywhere">
            {item.title && <strong className="mr-1.5">{item.title}</strong>}
            {item.text}
          </span>
        </li>
      ))}
    </ul>
  );

  if (template === "luxury") {
    return (
      <div className="mx-auto max-w-[560px] text-center">
        <Heading section={section} index={index} align="center" />
        <div className="mx-auto my-8 h-10 w-px bg-[#2a2522]/25" />
        {image && <Img image={image} className="mx-auto mb-10 aspect-[3/4] w-full max-w-[360px]" />}
        {swatch}
        <Paragraphs text={section.description} className={t.body} />
        {itemList && <div className="text-left">{itemList}</div>}
        <Facts facts={section.facts} className="mt-10 text-left" />
      </div>
    );
  }

  if (template === "street") {
    return (
      <div className="grid gap-6 dp-md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] dp-md:gap-12">
        <Heading section={section} index={index} />
        <div>
          {swatch}
          <Paragraphs text={section.description} className={cn(t.body, "text-lg dp-md:text-xl")} />
          {itemList}
          <Facts facts={section.facts} className="mt-8" />
          {image && <Img image={image} className="mt-8 aspect-[4/5] w-full" />}
        </div>
      </div>
    );
  }

  if (template === "sports") {
    return (
      <div className="border-l-4 border-brand pl-5 dp-md:pl-8">
        <Heading section={section} index={index} />
        <div className={cn("mt-6 grid gap-6", image && "dp-md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]")}>
          <div>
            {swatch}
            <Paragraphs text={section.description} className={t.body} />
            {itemList}
            <Facts facts={section.facts} className="mt-6" />
          </div>
          {image && <Img image={image} className="aspect-square w-full" />}
        </div>
      </div>
    );
  }

  if (template === "casual") {
    return (
      <div>
        <Heading section={section} index={index} />
        {image && <Img image={image} className="mt-6 aspect-[4/3] w-full" />}
        <div className="mt-6">
          {swatch}
          <Paragraphs text={section.description} className={t.body} />
          {itemList}
          <Facts facts={section.facts} className="mt-6" />
        </div>
      </div>
    );
  }

  // minimal: label column + content column
  return (
    <div className="grid gap-5 dp-md:grid-cols-[200px_minmax(0,1fr)] dp-md:gap-12">
      <Heading section={section} index={index} />
      <div>
        {image && <Img image={image} className="mb-8 aspect-square w-full dp-md:aspect-[4/3]" />}
        {swatch}
        <Paragraphs text={section.description} className={t.body} />
        {itemList}
        <Facts facts={section.facts} className="mt-8" />
      </div>
    </div>
  );
};

/* ───────────────────────────── DESIGN ───────────────────────────── */

const imageLabel = (image: DetailImage, index: number) =>
  image.crop === "left" ? "FRONT" : image.crop === "right" ? "BACK" : `VIEW ${pad(index + 1)}`;

const DesignSection = ({ section, index }: { section: DetailSection; index: number }) => {
  const { t, template } = useRender();
  const images = section.images;
  const text = (
    <>
      <Paragraphs text={section.description} className={t.body} />
      <Facts facts={section.facts} className="mt-8" />
    </>
  );

  if (template === "street") {
    return (
      <div>
        <Heading section={section} index={index} />
        <div className="-mx-4 mt-8 space-y-1 dp-md:-mx-8">
          {images.map((image, imageIndex) => (
            <div key={image.id} className="relative">
              <Img image={image} className="aspect-[4/5] w-full dp-md:aspect-[16/10]" />
              <span className="absolute bottom-3 left-4 text-5xl font-black uppercase leading-none text-[#0c0c0c] dp-md:bottom-6 dp-md:left-8 dp-md:text-8xl">
                {imageLabel(image, imageIndex)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-8 max-w-2xl">{text}</div>
      </div>
    );
  }

  if (template === "luxury") {
    return (
      <div>
        <Heading section={section} index={index} align="center" />
        <div className="mt-14 grid grid-cols-1 gap-10 dp-sm:grid-cols-2 dp-sm:gap-8">
          {images.map((image, imageIndex) => (
            <figure key={image.id} className={cn(imageIndex % 2 === 1 && "dp-sm:mt-24")}>
              <Img image={image} className="aspect-[2/3] w-full" />
              <figcaption className="mt-3 font-sans text-[10px] uppercase tracking-[0.4em] text-[#2a2522]/50">
                {imageLabel(image, imageIndex)}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mx-auto mt-14 max-w-[560px] text-center">{text}</div>
      </div>
    );
  }

  if (template === "sports") {
    return (
      <div>
        <Heading section={section} index={index} />
        <div className="mt-8 grid gap-4 dp-md:grid-cols-2 dp-lg:grid-cols-[1fr_1fr_0.9fr]">
          {images.map((image, imageIndex) => (
            <div key={image.id} className="relative">
              <Img image={image} className="aspect-square w-full" />
              <span className="absolute left-0 top-0 bg-brand px-2.5 py-1 text-[10px] font-extrabold uppercase italic tracking-[0.12em] text-white">
                {imageLabel(image, imageIndex)}
              </span>
            </div>
          ))}
          <div className="dp-md:col-span-2 dp-lg:col-span-1">{text}</div>
        </div>
      </div>
    );
  }

  if (template === "casual") {
    return (
      <div>
        <Heading section={section} index={index} />
        <Paragraphs text={section.description} className={cn(t.body, "mt-5")} />
        <div className="mt-6 grid grid-cols-2 gap-3">
          {images.map((image, imageIndex) => (
            <figure key={image.id}>
              <Img image={image} className="aspect-[3/4] w-full" />
              <figcaption className="mt-2 text-center text-sm font-bold">
                {image.crop === "left" ? "앞" : image.crop === "right" ? "뒤" : `컷 ${imageIndex + 1}`}
              </figcaption>
            </figure>
          ))}
        </div>
        <Facts facts={section.facts} className="mt-6" />
      </div>
    );
  }

  return (
    <div>
      <Heading section={section} index={index} />
      <div className="mt-8 grid grid-cols-1 gap-3 dp-sm:grid-cols-2">
        {images.map((image, imageIndex) => (
          <figure key={image.id}>
            <Img image={image} className="aspect-square w-full" />
            <figcaption className={cn("mt-2 text-[11px] uppercase tracking-[0.2em]", t.muted)}>{imageLabel(image, imageIndex)}</figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-10 grid gap-8 dp-md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Paragraphs text={section.description} className={t.body} />
        <Facts facts={section.facts} />
      </div>
    </div>
  );
};

/* ───────────────────────────── DETAIL ───────────────────────────── */

const DetailSectionView = ({ section, index }: { section: DetailSection; index: number }) => {
  const { t, template } = useRender();
  const image = section.images[0];

  const points =
    template === "street" ? (
      <div className="grid gap-3 dp-md:grid-cols-2">
        {section.items.map((item, itemIndex) => (
          <div key={item.id} className="border-2 border-current p-5">
            <p className="text-5xl font-black leading-none">{pad(itemIndex + 1)}</p>
            <h3 className={cn(t.h3, "mt-6 text-wrap-anywhere")}>{item.title}</h3>
            <p className={cn(t.body, "mt-2")}>{item.text}</p>
          </div>
        ))}
      </div>
    ) : template === "luxury" ? (
      <ol className="mx-auto max-w-[560px] space-y-12 text-center">
        {section.items.map((item, itemIndex) => (
          <li key={item.id}>
            <p className="text-sm tracking-[0.3em] text-[#8a6d4b]">{ROMAN[itemIndex] ?? itemIndex + 1}</p>
            <h3 className="mt-3 text-2xl text-wrap-anywhere">{item.title}</h3>
            <p className={cn(t.body, "mt-3")}>{item.text}</p>
          </li>
        ))}
      </ol>
    ) : template === "sports" ? (
      <div className="grid gap-3 dp-sm:grid-cols-2">
        {section.items.map((item, itemIndex) => (
          <div key={item.id} className="border-t-4 border-brand bg-white p-5">
            <p className="text-xs font-extrabold italic tracking-[0.14em] text-brand">P.{pad(itemIndex + 1)}</p>
            <h3 className={cn(t.h3, "mt-3 text-wrap-anywhere")}>{item.title}</h3>
            <p className={cn(t.body, "mt-2")}>{item.text}</p>
          </div>
        ))}
      </div>
    ) : template === "casual" ? (
      <ul className="space-y-3">
        {section.items.map((item) => (
          <li key={item.id} className="flex gap-3 rounded-2xl bg-white p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c2703d] text-white">
              <Check className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className={cn(t.h3, "text-wrap-anywhere")}>{item.title}</h3>
              <p className="mt-1 text-[15px] leading-7 text-[#2d2a26]/75">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <ol className={cn("border-t", t.rule)}>
        {section.items.map((item, itemIndex) => (
          <li key={item.id} className={cn("grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 border-b py-5", t.rule)}>
            <span className={cn("text-sm font-semibold", t.muted)}>{pad(itemIndex + 1)}</span>
            <div>
              <h3 className={cn(t.h3, "text-wrap-anywhere")}>{item.title}</h3>
              <p className={cn(t.body, "mt-1")}>{item.text}</p>
            </div>
          </li>
        ))}
      </ol>
    );

  return (
    <div>
      <Heading section={section} index={index} align={template === "luxury" ? "center" : "left"} />
      {image && (
        <Img
          image={image}
          className={cn(
            "mt-8 w-full",
            template === "luxury" ? "mx-auto aspect-[4/3] max-w-[640px]" : template === "street" ? "aspect-[16/10]" : "aspect-[16/9]",
          )}
        />
      )}
      {section.description && <Paragraphs text={section.description} className={cn(t.body, "mt-8", template === "luxury" && "mx-auto max-w-[560px] text-center")} />}
      <div className="mt-10">{points}</div>
    </div>
  );
};

/* ───────────────────────────── SIZE ───────────────────────────── */

const SizeSection = ({ section, index }: { section: DetailSection; index: number }) => {
  const { t, template, stats } = useRender();
  const hasTable = Boolean(stats.measurements) && stats.sizeOptions.length > 0;
  return (
    <div className={cn(template === "luxury" && "mx-auto max-w-[680px]")}>
      <Heading section={section} index={index} align={template === "luxury" ? "center" : "left"} />
      <Paragraphs text={section.description} className={cn(t.body, "mt-6", template === "luxury" && "text-center")} />
      <Facts facts={section.facts} className="mt-6" />
      {hasTable && (
        <div id="size-guide" className="mt-8 scroll-mt-24 bg-white/60 font-sans text-stone-900">
          <FundingSizeGuide measurements={stats.measurements} sizeOptions={stats.sizeOptions} />
        </div>
      )}
      {section.items.length > 0 && (
        <div className={cn("mt-8 border-t pt-6", t.rule, template === "luxury" && "font-sans")}>
          <p className={cn("text-xs font-bold uppercase tracking-[0.16em]", t.muted)}>Care</p>
          <ul className="mt-3 space-y-2 text-[15px] leading-7">
            {section.items.map((item) => (
              <li key={item.id} className="text-wrap-anywhere">
                · {item.title && <strong className="mr-1">{item.title}</strong>}
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/* ───────────────────────────── BRAND ───────────────────────────── */

const BrandSection = ({ section, index }: { section: DetailSection; index: number }) => {
  const { t, template, source } = useRender();
  const avatar = source.brandLogoUrl || source.creatorImageUrl;
  const centered = template === "luxury";
  return (
    <div className={cn("grid gap-6", !centered && "dp-md:grid-cols-[200px_minmax(0,1fr)] dp-md:gap-12", centered && "mx-auto max-w-[560px] text-center")}>
      <header>
        <p className={t.eyebrow}>{section.eyebrow}</p>
        {avatar && (
          <img
            src={avatar}
            alt={source.brandName || source.creatorName}
            className={cn(
              "mt-5 h-20 w-20 object-cover",
              template === "casual" || template === "luxury" ? "rounded-full" : "",
              centered && "mx-auto",
            )}
          />
        )}
      </header>
      <div className="min-w-0">
        <h2 className={cn(t.h2, "text-wrap-anywhere")}>{section.title || source.brandName}</h2>
        {source.creatorName && (
          <p className={cn("mt-2 text-sm", t.muted, template === "luxury" && "font-sans")}>Designed by {source.creatorName}</p>
        )}
        <Paragraphs text={section.description} className={cn(t.body, "mt-5")} />
        {source.brandId && (
          <Link
            to={`/brands/${source.brandId}`}
            className={cn("mt-6 inline-block border-b border-current pb-0.5 text-sm font-semibold", template === "luxury" && "font-sans")}
          >
            브랜드 페이지 보기
          </Link>
        )}
      </div>
    </div>
  );
};

/* ───────────────────────────── FUNDING ───────────────────────────── */

const formatWon = (value: number | null) => (value === null ? "가격 준비 중" : `${value.toLocaleString("ko-KR")}원`);

const FundingSection = ({ section, index }: { section: DetailSection; index: number }) => {
  const { t, template, stats } = useRender();
  const target = stats.targetQuantity ?? 0;
  const progress = target > 0 ? Math.min(100, Math.round((stats.currentQuantity / target) * 100)) : 0;
  const endLabel = stats.endDate
    ? stats.endDate.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    : stats.fundingDays
      ? `승인 후 ${stats.fundingDays}일간`
      : "승인 후 확정";
  const rows: Array<[string, string]> = [
    ["목표 수량", target ? `${target.toLocaleString("ko-KR")}장` : "펀딩 등록 시 확정"],
    ["현재 참여", `${stats.currentQuantity.toLocaleString("ko-KR")}장`],
    ["가격", formatWon(stats.price)],
    ["펀딩 종료", endLabel],
  ];
  const bar = (
    <div className={cn("h-1.5 w-full overflow-hidden", template === "street" ? "[background-color:color-mix(in_srgb,currentColor_20%,transparent)]" : "bg-black/10", template === "casual" && "rounded-full")}>
      <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
    </div>
  );

  if (template === "street" || template === "sports") {
    return (
      <div>
        <Heading section={section} index={index} />
        <p className={cn("mt-8 font-black italic leading-none", template === "street" ? "text-7xl dp-md:text-9xl" : "text-6xl text-brand dp-md:text-8xl")}>
          {progress}%
        </p>
        <div className="mt-4">{bar}</div>
        <dl className="mt-8 grid grid-cols-2 gap-px dp-md:grid-cols-4">
          {rows.map(([label, value]) => (
            <div key={label} className={cn("min-w-0 border p-4", t.rule, template === "sports" && "bg-white")}>
              <dt className={cn("text-[10px] font-extrabold uppercase tracking-[0.14em]", t.muted)}>{label}</dt>
              <dd className="mt-1 text-wrap-anywhere text-base font-extrabold">{value}</dd>
            </div>
          ))}
        </dl>
        <Paragraphs text={section.description} className={cn(t.body, "mt-6 max-w-2xl")} />
      </div>
    );
  }

  return (
    <div className={cn(template === "luxury" && "mx-auto max-w-[560px] text-center", template === "casual" && "rounded-3xl bg-white p-6 dp-md:p-8")}>
      <Heading section={section} index={index} align={template === "luxury" ? "center" : "left"} />
      <div className="mt-8 flex items-end justify-between gap-4">
        <span className={cn("text-4xl font-semibold text-brand", template === "luxury" && "mx-auto")}>{progress}%</span>
        {template !== "luxury" && (
          <span className={cn("text-sm", t.muted)}>
            {stats.currentQuantity} / {target || "-"}장
          </span>
        )}
      </div>
      <div className="mt-3">{bar}</div>
      <dl className={cn("mt-6 border-t text-sm", t.rule, template === "luxury" && "font-sans text-left")}>
        {rows.map(([label, value]) => (
          <div key={label} className={cn("flex justify-between gap-4 border-b py-3", t.rule)}>
            <dt className={t.muted}>{label}</dt>
            <dd className="text-wrap-anywhere text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <Paragraphs text={section.description} className={cn(t.body, "mt-6")} />
    </div>
  );
};

/* ───────────────────────────── PRODUCTION ───────────────────────────── */

const ProductionSection = ({ section, index }: { section: DetailSection; index: number }) => {
  const { t, template } = useRender();
  const horizontal = template === "street" || template === "sports";
  return (
    <div className={cn(template === "luxury" && "mx-auto max-w-[560px]")}>
      <Heading section={section} index={index} align={template === "luxury" ? "center" : "left"} />
      {horizontal ? (
        <ol className="mt-8 grid grid-cols-2 gap-2 dp-md:grid-cols-3 dp-lg:grid-cols-6">
          {section.items.map((item, itemIndex) => (
            <li
              key={item.id}
              className={cn(
                "min-w-0 p-4",
                template === "street" ? "border-2 border-current" : "border-t-4 border-[#11161c] bg-white",
                template === "sports" && itemIndex === 0 && "border-brand",
              )}
            >
              <p className="text-xs font-extrabold italic">{pad(itemIndex + 1)} →</p>
              <h3 className="mt-3 text-sm font-extrabold text-wrap-anywhere">{item.title}</h3>
              <p className={cn("mt-1 text-xs leading-5", t.muted)}>{item.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <ol className={cn("relative mt-8 space-y-0", template === "luxury" && "font-sans")}>
          {section.items.map((item, itemIndex) => (
            <li key={item.id} className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-4 pb-6 last:pb-0">
              {itemIndex < section.items.length - 1 && (
                <span className={cn("absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px", template === "casual" ? "bg-[#c2703d]/40" : "bg-current opacity-20")} />
              )}
              <span
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center text-xs font-bold",
                  template === "casual" ? "rounded-full bg-[#c2703d] text-white" : template === "luxury" ? "rounded-full border border-[#2a2522]/40" : "bg-stone-900 text-white",
                )}
              >
                {itemIndex + 1}
              </span>
              <div className="pt-1">
                <h3 className="text-[15px] font-semibold text-wrap-anywhere">{item.title}</h3>
                <p className={cn("mt-1 text-sm leading-6", t.muted)}>{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <Paragraphs text={section.description} className={cn(t.body, "mt-8", template === "luxury" && "text-center")} />
    </div>
  );
};

/* ───────────────────────────── NOTICE ───────────────────────────── */

const NoticeSection = ({ section, index }: { section: DetailSection; index: number }) => {
  const { t, template } = useRender();
  return (
    <div className={cn(template === "luxury" && "mx-auto max-w-[680px] font-sans")}>
      <Heading section={section} index={index} align={template === "luxury" ? "center" : "left"} />
      <div className={cn("mt-8 border-t", t.rule)}>
        {section.description && <p className={cn("border-b py-4 text-sm leading-6", t.rule)}>{section.description}</p>}
        <ul>
          {section.items.map((item) => (
            <li key={item.id} className={cn("border-b py-3 text-[13px] leading-6 text-wrap-anywhere", t.rule)}>
              <span className={t.muted}>※</span> {item.title && <strong className="mr-1">{item.title}</strong>}
              {item.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

/* ───────────────────────────── GALLERY ───────────────────────────── */

const GallerySection = ({ section, index }: { section: DetailSection; index: number }) => {
  const { t, template } = useRender();
  const images = section.images;
  return (
    <div>
      <Heading section={section} index={index} align={template === "luxury" ? "center" : "left"} />
      {section.description && <Paragraphs text={section.description} className={cn(t.body, "mt-5")} />}
      {images.length > 0 ? (
        <div className={cn("mt-8 grid gap-3", images.length > 1 && "dp-sm:grid-cols-2", template === "street" && "-mx-4 gap-1 dp-md:-mx-8")}>
          {images.map((image, imageIndex) => (
            <Img
              key={image.id}
              image={image}
              className={cn(
                "w-full",
                template === "luxury" ? "aspect-[2/3]" : template === "sports" ? "aspect-video" : "aspect-[4/5]",
                images.length % 2 === 1 && imageIndex === 0 && images.length > 1 && "dp-sm:col-span-2 dp-sm:aspect-[16/9]",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

/* ───────────────────────────── ROOT ───────────────────────────── */

const BACKGROUND_CLASS: Record<string, string> = {
  white: "bg-white text-stone-900",
  light: "bg-[#f4f2ee] text-stone-900",
  dark: "bg-[#141414] text-[#f5f5f0]",
  brand: "bg-brand text-white",
};

/** Editor overrides (배경 / 정렬). "default" keeps the template's own look. */
const sectionLayoutClass = (layout?: DetailSectionLayout) => ({
  background: layout?.background && layout.background !== "default" ? BACKGROUND_CLASS[layout.background] : "",
  align: layout?.align === "center" ? "text-center [&_h2]:mx-auto [&_p]:mx-auto" : layout?.align === "left" ? "text-left" : "",
});

const renderSection = (section: DetailSection, index: number): ReactNode => {
  switch (section.type) {
    case "hero":
      return null;
    case "design":
      return <DesignSection section={section} index={index} />;
    case "detail":
      return <DetailSectionView section={section} index={index} />;
    case "size":
      return <SizeSection section={section} index={index} />;
    case "brand":
      return <BrandSection section={section} index={index} />;
    case "funding":
      return <FundingSection section={section} index={index} />;
    case "production":
      return <ProductionSection section={section} index={index} />;
    case "notice":
      return <NoticeSection section={section} index={index} />;
    case "custom_image":
      return <GallerySection section={section} index={index} />;
    default:
      return <InfoSection section={section} index={index} />;
  }
};

export type DetailPageRendererProps = {
  document: DetailPageDocument;
  source: DetailPageSource;
  stats: DetailFundingStats;
  /** Watermark design images (public funding pages). */
  watermark?: boolean;
  /** Editor only: generation status per AI image slot. */
  imageStatus?: Partial<Record<DetailImageType, DetailImageJobStatus>>;
  selectedSectionId?: string | null;
  onSelectSection?: (sectionId: string) => void;
  className?: string;
};

export const DetailPageRenderer = ({
  document,
  source,
  stats,
  watermark = false,
  imageStatus,
  selectedSectionId,
  onSelectSection,
  className,
}: DetailPageRendererProps) => {
  const template = getLayoutTemplate(document.template);
  const t = DETAIL_THEMES[document.template] ?? DETAIL_THEMES[template];
  const visible = document.sections.filter((section) => section.visible);
  let contentIndex = -1;

  return (
    <Ctx.Provider value={{ template, t, document, source, stats, watermark, imageStatus }}>
      <article
        className={cn("[container-name:detail-page] [container-type:inline-size] w-full overflow-hidden", t.root, className)}
        data-template={document.template}
      >
        {visible.map((section) => {
          const isHero = section.type === "hero";
          if (!isHero) contentIndex += 1;
          const override = sectionLayoutClass(section.layout);
          const alt = !isHero && t.altSection && contentIndex % 2 === 0 && !override.background;
          const body = isHero ? (
            <Hero section={section} />
          ) : (
            <section className={cn(t.section, alt && t.altSection, override.background)}>
              <div className={cn(t.inner, override.align)}>{renderSection(section, contentIndex)}</div>
            </section>
          );
          if (!onSelectSection) return <div key={section.id}>{body}</div>;
          return (
            <div
              key={section.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectSection(section.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSelectSection(section.id);
              }}
              className={cn(
                "relative cursor-pointer outline-none transition",
                selectedSectionId === section.id
                  ? "ring-2 ring-inset ring-brand"
                  : "hover:ring-1 hover:ring-inset hover:ring-brand/40",
              )}
            >
              {body}
            </div>
          );
        })}
      </article>
    </Ctx.Provider>
  );
};
