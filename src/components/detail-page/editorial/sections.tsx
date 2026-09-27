import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { pickVariant } from "@/lib/detail-page/artDirection";
import { colorHexOf, guessColorHex } from "@/lib/funding-colors";
import { parseSizeGuide } from "@/lib/size-guide-table";
import { cn } from "@/lib/utils";
import type { DetailImage, DetailSection } from "@/types/detailPage";
import { Body, Caption, EdImage, Lines, SectionLabel, Specs, Strip, Title } from "./kit";
import { BODY_STACK, CAPTION_STACK, INNER, captionStyle, labelStyle, displayStyle, pad, toEmbedUrl, useEd } from "./tokens";

type Props = { section: DetailSection; index: number };

const useVariant = (section: DetailSection, index: number) => {
  const { direction } = useEd();
  return section.layout?.variant || pickVariant(section.type, direction, index);
};

const alignClass = (section: DetailSection, fallback: "left" | "center") => {
  const align = section.layout?.align && section.layout.align !== "default" ? section.layout.align : fallback;
  return align === "center" ? "text-center [&_ol]:text-left [&_dl]:text-left" : "";
};

/* ─────────────────────────── HERO ─────────────────────────── */

const isPortrait = (image: DetailImage) => {
  const match = /^(\d+):(\d+)$/.exec(image.ratio ?? (image.source === "design" ? "4:5" : ""));
  return match ? Number(match[2]) > Number(match[1]) : image.source !== "generated";
};

export const EdHero = ({ section }: { section: DetailSection }) => {
  const { direction, document } = useEd();
  const variant = useVariant(section, 0);
  const image = section.images[0];
  const title = document.productName || section.title;
  const message = section.description || document.subtitle;
  const brand = section.eyebrow;
  const en = document.productNameEn;

  const meta = (
    <div className="flex items-center justify-between gap-4">
      {brand ? <Caption>{brand}</Caption> : <span />}
      {en && en !== title && <Caption className="truncate text-right">{en}</Caption>}
    </div>
  );

  if (variant === "fullbleed") {
    return (
      <section className="pb-12 dp-md:pb-20">
        {image && (
          // A portrait photo is never blown up to full desktop width (it would be taller than the screen).
          <div className={cn(isPortrait(image) && "dp-md:mx-auto dp-md:max-w-[680px] dp-md:pt-10")}>
            <EdImage image={image} />
          </div>
        )}
        <div className={cn(INNER, "mt-6 grid gap-5 border-t border-[color:var(--ed-rule)] pt-5 dp-md:mt-8 dp-md:grid-cols-12 dp-md:gap-8")}>
          <div className="dp-md:col-span-3">{brand && <Caption>{brand}</Caption>}</div>
          <Title as="h1" level="hero" text={title} className="dp-md:col-span-6" />
          <div className="dp-md:col-span-3 dp-md:pt-1">
            {en && <Caption>{en}</Caption>}
            <Body text={message} size="small" className="mt-3" />
          </div>
        </div>
      </section>
    );
  }

  if (variant === "typefirst") {
    return (
      <section className="pb-12 pt-8 dp-md:pb-20 dp-md:pt-12">
        <div className={INNER}>
          {meta}
          <Title as="h1" level="hero" text={en || title} className="mt-6 dp-md:mt-10 dp-md:max-w-[80%]" />
          {en && <p className="mt-3 text-[14px] font-medium" style={{ fontFamily: BODY_STACK }}>{title}</p>}
        </div>
        <div className={cn(INNER, "mt-8 grid gap-6 dp-md:mt-12 dp-md:grid-cols-12 dp-md:items-end dp-md:gap-8")}>
          <div className="order-2 dp-md:order-1 dp-md:col-span-4">
            <span className="block h-[3px] w-10" style={{ backgroundColor: direction.palette.accent }} />
            <Body text={message} className="mt-4" />
          </div>
          {image && (
            <div className="order-1 -mx-5 dp-md:order-2 dp-md:col-span-8 dp-md:mx-0">
              <EdImage image={image} />
            </div>
          )}
        </div>
      </section>
    );
  }

  if (variant === "centered") {
    return (
      <section className="pb-14 pt-10 dp-md:pb-24 dp-md:pt-16">
        <div className={cn(INNER, "text-center")}>
          {brand && <Caption>{brand}</Caption>}
          {image && <EdImage image={image} className="mx-auto mt-8 max-w-[440px] dp-md:mt-12" />}
          <Title as="h1" level="hero" text={title} className="mx-auto mt-8 max-w-[720px] dp-md:mt-12" />
          {en && en !== title && <Caption className="mt-3">{en}</Caption>}
          <Body text={message} className="mx-auto mt-6 max-w-[30em]" />
        </div>
      </section>
    );
  }

  // split
  return (
    <section className="pb-12 dp-md:pb-20 dp-md:pt-10">
      <div className="grid dp-md:mx-auto dp-md:max-w-[1240px] dp-md:grid-cols-12 dp-md:items-end dp-md:gap-10 dp-md:px-10 dp-lg:px-14">
        {image && (
          <div className="dp-md:col-span-7">
            <EdImage image={image} />
          </div>
        )}
        <div className="px-5 pt-7 dp-md:col-span-5 dp-md:px-0 dp-md:pb-2 dp-md:pt-0">
          {brand && <Caption>{brand}</Caption>}
          <Title as="h1" level="hero" text={title} className="mt-4" />
          {en && en !== title && <Caption className="mt-3">{en}</Caption>}
          <div className="mt-7 border-t border-[color:var(--ed-rule)] pt-5">
            <Body text={message} />
          </div>
        </div>
      </div>
    </section>
  );
};

/* ─────────────────────────── STORY / TEXT ─────────────────────────── */

export const EdStory = ({ section, index }: Props) => {
  const variant = useVariant(section, index);
  const image = section.images[0];
  const center = alignClass(section, "left");

  if (variant === "quote") {
    const quote = section.title || section.description.split(/(?<=[.!?])\s/)[0] || "";
    const rest = section.title ? section.description : section.description.slice(quote.length).trim();
    return (
      <div className={cn("dp-md:grid dp-md:grid-cols-12 dp-md:gap-8", center)}>
        <SectionLabel index={index} section={section} className="dp-md:col-span-12" />
        <Title level="quote" text={quote} className="mt-8 dp-md:col-span-9 dp-md:col-start-2 dp-md:mt-12" />
        <Body text={rest} className="mt-8 max-w-[34em] dp-md:col-span-5 dp-md:col-start-7 dp-md:mt-12" />
      </div>
    );
  }

  if (variant === "split" && image) {
    return (
      <div className="grid gap-8 dp-md:grid-cols-12 dp-md:items-center dp-md:gap-8">
        <div className="-mx-5 dp-md:col-span-6 dp-md:mx-0">
          <EdImage image={image} ratio="3:4" />
        </div>
        <div className={cn("dp-md:col-span-5 dp-md:col-start-8", center)}>
          <SectionLabel index={index} section={section} />
          <Title text={section.title} className="mt-6" />
          <Body text={section.description} className="mt-6" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-6 dp-md:grid-cols-12 dp-md:gap-8", center)}>
      <div className="dp-md:col-span-3">
        <SectionLabel index={index} section={section} />
      </div>
      <div className="dp-md:col-span-7 dp-md:col-start-5">
        <Title text={section.title} />
        <Body text={section.description} className={cn("max-w-[34em]", section.title && "mt-6")} />
        {image && <EdImage image={image} className="mt-10" />}
      </div>
    </div>
  );
};

/* ─────────────────────────── DESIGN / PRODUCT ─────────────────────────── */

const captionFor = (image: DetailImage, index: number) =>
  image.caption || (image.crop === "left" ? "FRONT" : image.crop === "right" ? "BACK" : `VIEW ${pad(index + 1)}`);

const Figure = ({ image, index, ratio, className }: { image: DetailImage; index: number; ratio?: string; className?: string }) => (
  <figure className={cn("min-w-0", className)}>
    <EdImage image={image} ratio={ratio} />
    <figcaption className="mt-2.5 flex items-center justify-between gap-2">
      <Caption>{captionFor(image, index)}</Caption>
      <Caption className="tabular-nums">{pad(index + 1)}</Caption>
    </figcaption>
  </figure>
);

export const EdDesign = ({ section, index }: Props) => {
  const variant = useVariant(section, index);
  const images = section.images;
  const text = (
    <>
      <Title text={section.title} />
      <Body text={section.description} className={cn(section.title && "mt-5")} />
      <Lines items={section.items} className="mt-8" />
      <Specs facts={section.facts} className="mt-8" />
    </>
  );

  if (variant === "stagger" && images.length >= 2) {
    return (
      <div>
        <SectionLabel index={index} section={section} />
        <div className="mt-8 grid gap-6 dp-md:mt-12 dp-md:grid-cols-12 dp-md:gap-8">
          <Figure image={images[0]} index={0} className="dp-md:col-span-7" />
          <div className="dp-md:col-span-5">
            <Figure image={images[1]} index={1} className="ml-auto w-[78%] dp-md:mt-[28%] dp-md:w-full" />
            <div className="mt-10">{text}</div>
          </div>
          {images.slice(2).map((image, extra) => (
            <Figure key={image.id} image={image} index={extra + 2} className="dp-md:col-span-5 dp-md:col-start-2" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "single" && images.length) {
    return (
      <div className="grid gap-8 dp-md:grid-cols-12 dp-md:gap-10">
        <div className="dp-md:col-span-7">
          <Figure image={images[0]} index={0} />
          {images.length > 1 && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {images.slice(1).map((image, extra) => (
                <Figure key={image.id} image={image} index={extra + 1} />
              ))}
            </div>
          )}
        </div>
        <div className="dp-md:sticky dp-md:top-24 dp-md:col-span-5 dp-md:self-start">
          <SectionLabel index={index} section={section} />
          <div className="mt-8">{text}</div>
        </div>
      </div>
    );
  }

  if (variant === "triptych" && images.length >= 3) {
    return (
      <div>
        <SectionLabel index={index} section={section} />
        <Strip columns={3} className="mt-8 dp-md:mt-12">
          {images.slice(0, 3).map((image, imageIndex) => (
            <Figure key={image.id} image={image} index={imageIndex} ratio="4:5" />
          ))}
        </Strip>
        <div className="mt-10 grid gap-8 dp-md:grid-cols-12 dp-md:gap-8">
          <div className="dp-md:col-span-5">
            <Title text={section.title} />
            <Body text={section.description} className={cn(section.title && "mt-5")} />
          </div>
          <div className="dp-md:col-span-6 dp-md:col-start-7">
            <Lines items={section.items} />
            <Specs facts={section.facts} className="mt-8" />
          </div>
        </div>
      </div>
    );
  }

  // pair
  return (
    <div>
      <SectionLabel index={index} section={section} />
      <div className={cn("mt-8 grid gap-3 dp-md:mt-12 dp-md:gap-6", images.length > 1 ? "grid-cols-2" : "grid-cols-1 dp-md:w-[58%]")}>
        {images.slice(0, 2).map((image, imageIndex) => (
          <Figure key={image.id} image={image} index={imageIndex} ratio="4:5" />
        ))}
      </div>
      <div className="mt-10 grid gap-8 dp-md:grid-cols-12 dp-md:gap-8">
        <div className="dp-md:col-span-5">
          <Title text={section.title} />
          <Body text={section.description} className={cn(section.title && "mt-5")} />
        </div>
        <div className="dp-md:col-span-6 dp-md:col-start-7">
          <Lines items={section.items} />
          <Specs facts={section.facts} className="mt-8" />
        </div>
      </div>
      {images.length > 2 && (
        <div className="mt-10 grid grid-cols-2 gap-3 dp-md:grid-cols-3 dp-md:gap-6">
          {images.slice(2).map((image, extra) => (
            <Figure key={image.id} image={image} index={extra + 2} />
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────── DETAIL ─────────────────────────── */

export const EdDetail = ({ section, index }: Props) => {
  const variant = useVariant(section, index);
  const images = section.images;
  const itemFor = (imageIndex: number) => section.items[imageIndex];

  if (variant === "strip" && images.length) {
    return (
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionLabel index={index} section={section} />
          <Title text={section.title} />
        </div>
        <Strip columns={images.length >= 3 ? 3 : 2} className="mt-8 dp-md:mt-12">
          {images.map((image, imageIndex) => (
            <figure key={image.id} className="min-w-0">
              <EdImage image={image} ratio="1:1" />
              <figcaption className="mt-3">
                <Caption>{pad(imageIndex + 1)} · {image.caption || itemFor(imageIndex)?.title || "DETAIL"}</Caption>
                {itemFor(imageIndex)?.text && (
                  <p className="mt-2 text-[13.5px] leading-6" style={{ fontFamily: BODY_STACK }}>{itemFor(imageIndex)!.text}</p>
                )}
              </figcaption>
            </figure>
          ))}
        </Strip>
        {section.items.length > images.length && <Lines items={section.items.slice(images.length)} className="mt-10 dp-md:w-1/2" />}
        <Body text={section.description} className="mt-8 max-w-[34em]" />
      </div>
    );
  }

  if (variant === "annotated" && images.length) {
    return (
      <div className="grid gap-8 dp-md:grid-cols-12 dp-md:gap-10">
        <div className="dp-md:col-span-7">
          <EdImage image={images[0]} ratio="1:1" />
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {images.slice(1).map((image) => (
                <div key={image.id}>
                  <EdImage image={image} ratio="1:1" />
                  <Caption className="mt-2">{image.caption || "DETAIL"}</Caption>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="dp-md:col-span-5">
          <SectionLabel index={index} section={section} />
          <Title text={section.title} className="mt-6" />
          <Lines items={section.items} className="mt-8" />
          <Body text={section.description} className="mt-8" />
        </div>
      </div>
    );
  }

  // mosaic (also the text-only fallback)
  return (
    <div>
      <SectionLabel index={index} section={section} />
      <Title text={section.title} className="mt-6" />
      {images.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-3 dp-md:mt-12 dp-md:grid-cols-3 dp-md:gap-5">
          {images.map((image, imageIndex) => (
            <figure key={image.id} className={cn("min-w-0", imageIndex === 0 && "col-span-2 dp-md:row-span-2")}>
              <EdImage image={image} ratio="1:1" />
              <Caption className="mt-2">{pad(imageIndex + 1)} · {image.caption || itemFor(imageIndex)?.title || "DETAIL"}</Caption>
            </figure>
          ))}
        </div>
      )}
      <div className="mt-10 grid gap-8 dp-md:grid-cols-12">
        <Lines items={section.items} className="dp-md:col-span-7" />
        <Body text={section.description} className="dp-md:col-span-4 dp-md:col-start-9" />
      </div>
    </div>
  );
};

/* ─────────────────────────── FABRIC ─────────────────────────── */

export const EdFabric = ({ section, index }: Props) => {
  const variant = useVariant(section, index);
  const image = section.images[0];
  const content = (
    <>
      <SectionLabel index={index} section={section} />
      <Title text={section.title} className="mt-6" />
      <Body text={section.description} className="mt-5 max-w-[34em]" />
      <Specs facts={section.facts} columns={3} className="mt-8" />
    </>
  );

  if (variant === "split" || !image) {
    return (
      <div className="grid gap-8 dp-md:grid-cols-12 dp-md:items-center dp-md:gap-10">
        {image && (
          <div className="dp-md:col-span-6">
            <EdImage image={image} ratio="1:1" fit={image.source === "design" ? "contain" : "cover"} />
          </div>
        )}
        <div className={image ? "dp-md:col-span-5 dp-md:col-start-8" : "dp-md:col-span-8"}>{content}</div>
      </div>
    );
  }

  // wide: a texture crop is not the garment silhouette, so it may be cropped to a band.
  return (
    <div>
      <div className="-mx-5 dp-md:-mx-10 dp-lg:-mx-14">
        <EdImage image={image} ratio="3:2" fit={image.source === "design" ? "contain" : "cover"} className="dp-md:!aspect-[21/9]" />
      </div>
      <div className="mt-10 grid gap-8 dp-md:grid-cols-12 dp-md:gap-8">
        <div className="dp-md:col-span-5">
          <SectionLabel index={index} section={section} />
          <Title text={section.title} className="mt-6" />
          <Body text={section.description} className="mt-5" />
        </div>
        <Specs facts={section.facts} columns={3} className="self-start dp-md:col-span-6 dp-md:col-start-7" />
      </div>
    </div>
  );
};

/* ─────────────────────────── FIT ─────────────────────────── */

export const EdFit = ({ section, index }: Props) => {
  const variant = useVariant(section, index);
  const images = section.images;
  const text = (
    <>
      <Title text={section.title} />
      <Body text={section.description} className={cn(section.title && "mt-5")} />
      <Specs facts={section.facts} className="mt-8" />
      {section.items.length > 0 && (
        <div className="mt-8">
          <Caption>Styling</Caption>
          <Lines items={section.items} numbered={false} className="mt-3" />
        </div>
      )}
    </>
  );

  if (variant === "portrait" && images.length) {
    return (
      <div className="grid gap-8 dp-md:grid-cols-12 dp-md:gap-10">
        <div className="-mx-5 dp-md:col-span-6 dp-md:mx-0">
          <EdImage image={images[0]} ratio="3:4" />
        </div>
        <div className="dp-md:col-span-5 dp-md:col-start-8 dp-md:self-end">
          <SectionLabel index={index} section={section} />
          <div className="mt-8">{text}</div>
          {images.length > 1 && (
            <div className="mt-8 grid grid-cols-2 gap-3">
              {images.slice(1, 3).map((image, imageIndex) => (
                <Figure key={image.id} image={image} index={imageIndex + 1} ratio="3:4" />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // views
  return (
    <div>
      <SectionLabel index={index} section={section} />
      {images.length > 0 && (
        <Strip columns={images.length >= 3 ? 3 : 2} className="mt-8 dp-md:mt-12">
          {images.slice(0, 3).map((image, imageIndex) => (
            <Figure key={image.id} image={image} index={imageIndex} ratio="3:4" />
          ))}
        </Strip>
      )}
      <div className="mt-10 dp-md:w-[58%]">{text}</div>
    </div>
  );
};

/* ─────────────────────────── LOOKBOOK / IMAGE ─────────────────────────── */

export const EdLookbook = ({ section, index }: Props) => {
  const variant = useVariant(section, index);
  const images = section.images;
  const heading = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <SectionLabel index={index} section={section} />
      {section.title && <Title text={section.title} />}
    </div>
  );
  const caption = section.description && <Body text={section.description} size="small" className="mt-6 max-w-[30em]" />;
  if (!images.length) return <div>{heading}{caption}</div>;

  if (variant === "full" || variant === "default") {
    return (
      <div>
        {heading}
        <div className="-mx-5 mt-8 space-y-1.5 dp-md:-mx-10 dp-md:mt-12 dp-lg:-mx-14">
          {images.map((image) => (
            <EdImage key={image.id} image={image} ratio="2:3" className="mx-auto dp-md:max-w-[62%]" />
          ))}
        </div>
        {caption}
      </div>
    );
  }

  if (variant === "grid" || variant === "pair") {
    return (
      <div>
        {heading}
        <div className={cn("mt-8 grid grid-cols-2 gap-3 dp-md:mt-12 dp-md:gap-5", variant === "grid" && images.length >= 3 && "dp-md:grid-cols-3")}>
          {images.map((image, imageIndex) => (
            <EdImage key={image.id} image={image} ratio="3:4" className={cn(images.length === 1 && "col-span-2", images.length === 3 && imageIndex === 0 && "col-span-2 dp-md:col-span-1")} />
          ))}
        </div>
        {caption}
      </div>
    );
  }

  // offset
  return (
    <div>
      {heading}
      <div className="mt-8 grid grid-cols-12 gap-3 dp-md:mt-12 dp-md:gap-8">
        {images.map((image, imageIndex) => (
          <div
            key={image.id}
            className={cn(
              images.length === 1
                ? "col-span-12 dp-md:col-span-8 dp-md:col-start-3"
                : imageIndex % 2 === 0
                  ? "col-span-12 dp-md:col-span-7"
                  : "col-span-9 col-start-4 dp-md:col-span-5 dp-md:col-start-auto dp-md:mt-[30%]",
            )}
          >
            <EdImage image={image} ratio="2:3" />
          </div>
        ))}
      </div>
      {caption}
    </div>
  );
};

/* ─────────────────────────── COLOR ─────────────────────────── */

export const EdColor = ({ section, index }: Props) => {
  const { colors, source } = useEd();
  const variant = useVariant(section, index);
  const list = colors ?? [];
  const names = list.length
    ? list.map((color) => ({ name: color.name, hex: colorHexOf(color) }))
    : (section.facts[0]?.value || source.userProvided.colorName || source.color)
        .split(/\s*[/,]\s*/)
        .filter(Boolean)
        .map((name) => ({ name, hex: guessColorHex(name) ?? "#d6d3ce" }));

  const swatches = (
    <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-5">
      {names.map((color) => (
        <li key={color.name} className="flex items-center gap-3">
          <span className="h-11 w-11 shrink-0 border border-[color:var(--ed-rule)]" style={{ backgroundColor: color.hex }} />
          <span className="text-[14px] font-medium" style={{ fontFamily: BODY_STACK }}>{color.name}</span>
        </li>
      ))}
    </ul>
  );

  const gallery = list.length > 0 && (
    <div className={cn("mt-10 grid gap-x-5 gap-y-8", list.length > 1 ? "grid-cols-2 dp-md:grid-cols-3" : "grid-cols-1 dp-md:w-1/2")}>
      {list.map((color) => {
        const view = color.approved.front?.url ? "front" : color.approved.back?.url ? "back" : null;
        return (
          <figure key={color.id} className="min-w-0">
            {view ? (
              <EdImage
                ratio="4:5"
                fit="contain"
                image={{
                  id: `${color.id}-${view}`,
                  url: color.approved[view]!.url!,
                  crop: "full",
                  alt: color.name,
                  source: color.approved[view]!.source === "original" ? "design" : "generated",
                }}
              />
            ) : (
              <div className="aspect-[4/5] w-full" style={{ backgroundColor: colorHexOf(color) }} aria-hidden />
            )}
            <figcaption className="mt-2.5 flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 border border-black/10" style={{ backgroundColor: colorHexOf(color) }} />
              <Caption>{color.name}</Caption>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );

  return (
    <div>
      <SectionLabel index={index} section={section} />
      <Title text={section.title} className="mt-6" />
      <Body text={section.description} className="mt-5 max-w-[34em]" />
      {variant === "gallery" && gallery ? gallery : (<>{swatches}{gallery}</>)}
    </div>
  );
};

/* ─────────────────────────── SIZE ─────────────────────────── */

export const EdSize = ({ section, index }: Props) => {
  const { stats } = useEd();
  const table = parseSizeGuide(stats.measurements, stats.sizeOptions);
  return (
    <div className="grid gap-8 dp-md:grid-cols-12 dp-md:gap-10">
      <div className="dp-md:col-span-4">
        <SectionLabel index={index} section={section} />
        <Title text={section.title} className="mt-6" />
        <Body text={section.description} size="small" className="mt-5" />
        <Specs facts={section.facts} className="mt-6" />
      </div>
      <div className="min-w-0 dp-md:col-span-8">
        {table && (
          <div id="size-guide" className="scroll-mt-24">
            <div className="-mx-5 overflow-x-auto overscroll-x-contain px-5 dp-md:mx-0 dp-md:px-0">
              <table className="w-full border-collapse text-[13.5px]" style={{ fontFamily: BODY_STACK, minWidth: table.sizes.length > 4 ? 520 : undefined }}>
                <thead>
                  <tr className="border-y border-[color:var(--ed-ink)]">
                    <th className="sticky left-0 bg-[color:var(--ed-bg)] py-3 pr-4 text-left font-normal" style={captionStyle}>cm</th>
                    {table.sizes.map((size) => (
                      <th key={size.key} className="px-3 py-3 text-center text-[14px] font-semibold" style={{ fontFamily: CAPTION_STACK }}>
                        {size.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <tr key={row.label} className="border-b border-[color:var(--ed-rule)]">
                      <th className="sticky left-0 whitespace-nowrap bg-[color:var(--ed-bg)] py-3 pr-4 text-left font-medium">{row.label}</th>
                      {row.values.map((value, valueIndex) => (
                        <td key={valueIndex} className="px-3 py-3 text-center tabular-nums">{value}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11.5px] leading-5 text-[color:var(--ed-muted)]" style={{ fontFamily: BODY_STACK }}>
              {table.note}. 제작 기준 초안이며 원단·패턴·샘플 과정에 따라 최종 실측이 조정될 수 있습니다.
            </p>
          </div>
        )}
        {section.items.length > 0 && (
          <div className={cn(table && "mt-10")}>
            <Caption>Care</Caption>
            <Lines items={section.items} numbered={false} className="mt-3" />
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────── PRODUCTION ─────────────────────────── */

export const EdProduction = ({ section, index }: Props) => {
  const { direction } = useEd();
  const variant = useVariant(section, index);
  if (variant === "timeline") {
    return (
      <div>
        <div className="grid gap-6 dp-md:grid-cols-12">
          <SectionLabel index={index} section={section} className="dp-md:col-span-4" />
          <Body text={section.description} size="small" className="dp-md:col-span-6 dp-md:col-start-7" />
        </div>
        <ol className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 dp-md:grid-cols-6 dp-md:gap-x-5">
          {section.items.map((item, itemIndex) => (
            <li key={item.id} className="min-w-0 border-t pt-4" style={{ borderColor: itemIndex === 0 ? direction.palette.accent : "var(--ed-rule)" }}>
              <Caption className="tabular-nums">{pad(itemIndex + 1)}</Caption>
              <p className="mt-2 text-[14px] font-semibold text-wrap-anywhere" style={{ fontFamily: BODY_STACK }}>{item.title}</p>
              <p className="mt-1 text-[12.5px] leading-5 text-[color:var(--ed-muted)]" style={{ fontFamily: BODY_STACK }}>{item.text}</p>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  return (
    <div className="grid gap-8 dp-md:grid-cols-12 dp-md:gap-10">
      <div className="dp-md:col-span-4">
        <SectionLabel index={index} section={section} />
        <Title text={section.title} className="mt-6" />
        <Body text={section.description} size="small" className="mt-5" />
      </div>
      <Lines items={section.items} className="dp-md:col-span-7 dp-md:col-start-6" />
    </div>
  );
};

/* ─────────────────────────── FUNDING ─────────────────────────── */

const won = (value: number | null) => (value === null ? "가격 준비 중" : `${value.toLocaleString("ko-KR")}원`);

export const EdFunding = ({ section, index }: Props) => {
  const { stats, direction } = useEd();
  const variant = useVariant(section, index);
  const target = stats.targetQuantity ?? 0;
  const progress = target > 0 ? Math.min(999, Math.round((stats.currentQuantity / target) * 100)) : 0;
  const end = stats.endDate
    ? stats.endDate.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    : stats.fundingDays
      ? `승인 후 ${stats.fundingDays}일간`
      : "승인 후 확정";
  const rows: Array<[string, string]> = [
    ["판매 가격", won(stats.price)],
    ["목표 수량", target ? `${target.toLocaleString("ko-KR")}장` : "펀딩 등록 시 확정"],
    ["현재 참여", `${stats.currentQuantity.toLocaleString("ko-KR")}장`],
    ["달성률", `${progress}%`],
    ["펀딩 종료", end],
    ...(stats.productionPeriod ? ([["예상 제작 기간", stats.productionPeriod]] as Array<[string, string]>) : []),
  ];
  const bar = (
    <div className="h-[3px] w-full bg-[color:var(--ed-rule)]" role="progressbar" aria-valuenow={Math.min(progress, 100)} aria-valuemin={0} aria-valuemax={100} aria-label="펀딩 달성률">
      <div className="h-full transition-all" style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: direction.palette.accent }} />
    </div>
  );
  const ledger = (
    <dl className="grid grid-cols-2 border-t border-[color:var(--ed-rule)] dp-md:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0 border-b border-[color:var(--ed-rule)] py-4 pr-3">
          <dt style={labelStyle} className="text-[color:var(--ed-muted)]">{label}</dt>
          <dd className="mt-1.5 text-[15px] font-semibold tabular-nums text-wrap-anywhere" style={{ fontFamily: BODY_STACK }}>{value}</dd>
        </div>
      ))}
    </dl>
  );

  if (variant === "bar") {
    return (
      <div>
        <SectionLabel index={index} section={section} />
        <p className="mt-8 tabular-nums" style={{ ...displayStyle(direction, "hero"), fontSize: "clamp(48px, 11cqi, 120px)", lineHeight: 0.9 }}>
          {progress}%
        </p>
        <div className="mt-6">{bar}</div>
        <div className="mt-8">{ledger}</div>
        <Body text={section.description} size="small" className="mt-6 max-w-[34em]" />
      </div>
    );
  }
  return (
    <div className="grid gap-8 dp-md:grid-cols-12 dp-md:gap-10">
      <div className="dp-md:col-span-4">
        <SectionLabel index={index} section={section} />
        <Title text={section.title && section.title !== "FUNDING" ? section.title : ""} className="mt-6" />
        <Body text={section.description} size="small" className="mt-5" />
      </div>
      <div className="dp-md:col-span-7 dp-md:col-start-6">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <Caption>Progress</Caption>
          <span className="text-[15px] font-semibold tabular-nums" style={{ fontFamily: CAPTION_STACK }}>{progress}%</span>
        </div>
        {bar}
        <div className="mt-6">{ledger}</div>
      </div>
    </div>
  );
};

/* ─────────────────────────── BRAND / NOTICE / TEXT / VIDEO ─────────────────────────── */

export const EdBrand = ({ section, index }: Props) => {
  const { source } = useEd();
  const variant = useVariant(section, index);
  const avatar = source.brandLogoUrl || source.creatorImageUrl;
  const centered = variant === "centered";
  return (
    <div className={cn("grid gap-6 dp-md:grid-cols-12 dp-md:gap-10", centered && "text-center")}>
      <div className={cn(centered ? "dp-md:col-span-12" : "dp-md:col-span-4")}>
        <SectionLabel index={index} section={section} className={cn(centered && "justify-center")} />
        {avatar && <img src={avatar} alt={source.brandName || source.creatorName} className={cn("mt-6 h-16 w-16 object-cover", centered && "mx-auto")} />}
      </div>
      <div className={cn("min-w-0", centered ? "mx-auto max-w-[36em] dp-md:col-span-12" : "dp-md:col-span-7 dp-md:col-start-6")}>
        <Title text={section.title || source.brandName} />
        {source.creatorName && <Caption className="mt-3">Designed by {source.creatorName}</Caption>}
        <Body text={section.description} className="mt-6" />
        {source.brandId && (
          <Link to={`/brands/${source.brandId}`} className="mt-6 inline-block border-b border-current pb-0.5 text-[13px] font-semibold" style={{ fontFamily: BODY_STACK }}>
            브랜드 페이지 보기
          </Link>
        )}
      </div>
    </div>
  );
};

export const EdNotice = ({ section, index }: Props) => (
  <div className="grid gap-6 dp-md:grid-cols-12 dp-md:gap-10">
    <div className="dp-md:col-span-4">
      <SectionLabel index={index} section={section} />
    </div>
    <div className="dp-md:col-span-7 dp-md:col-start-6" style={{ fontFamily: BODY_STACK }}>
      {section.description && <p className="border-t border-[color:var(--ed-rule)] py-4 text-[13px] leading-6">{section.description}</p>}
      <ul className="border-t border-[color:var(--ed-rule)]">
        {section.items.map((item) => (
          <li key={item.id} className="border-b border-[color:var(--ed-rule)] py-3 text-[12.5px] leading-6 text-[color:var(--ed-muted)] text-wrap-anywhere">
            {item.title && <strong className="mr-1 font-semibold text-[color:var(--ed-ink)]">{item.title}</strong>}
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export const EdVideo = ({ section, index }: Props) => {
  const { editing } = useEd();
  const embed = section.videoUrl ? toEmbedUrl(section.videoUrl) : null;
  if (!embed && !editing) return null;
  return (
    <div>
      <SectionLabel index={index} section={section} />
      <Title text={section.title} className="mt-6" />
      <div className="-mx-5 mt-8 aspect-video bg-black dp-md:mx-0">
        {embed?.kind === "iframe" ? (
          <iframe src={embed.src} title={section.title || "동영상"} className="h-full w-full" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        ) : embed?.kind === "video" ? (
          <video src={embed.src} controls playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/60">편집 패널에서 동영상 링크(YouTube · Vimeo · mp4)를 입력하세요</div>
        )}
      </div>
      <Body text={section.description} size="small" className="mt-5 max-w-[34em]" />
    </div>
  );
};

export const renderEditorialSection = (section: DetailSection, index: number): ReactNode => {
  switch (section.type) {
    case "story":
    case "custom_text":
      return <EdStory section={section} index={index} />;
    case "design":
      return <EdDesign section={section} index={index} />;
    case "detail":
      return <EdDetail section={section} index={index} />;
    case "fabric":
      return <EdFabric section={section} index={index} />;
    case "fit":
      return <EdFit section={section} index={index} />;
    case "lookbook":
    case "custom_image":
      return <EdLookbook section={section} index={index} />;
    case "color":
      return <EdColor section={section} index={index} />;
    case "size":
      return <EdSize section={section} index={index} />;
    case "production":
      return <EdProduction section={section} index={index} />;
    case "funding":
      return <EdFunding section={section} index={index} />;
    case "brand":
      return <EdBrand section={section} index={index} />;
    case "notice":
      return <EdNotice section={section} index={index} />;
    case "video":
      return <EdVideo section={section} index={index} />;
    default:
      return <EdStory section={section} index={index} />;
  }
};
