import { useEffect, useState } from "react";

type Props = {
  src: string | null;
  publisher: string;
  alt: string;
  className?: string;
  eager?: boolean;
};

/** 기사 이미지. 주소가 없거나 로드에 실패하면 BRAND-ER 기본 이미지(워드마크 + 언론사명)로 대체한다. */
export const MagazineThumbnail = ({ src, publisher, alt, className = "", eager = false }: Props) => {
  const [failed, setFailed] = useState(!src);
  useEffect(() => setFailed(!src), [src]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${publisher} 기사 기본 이미지`}
        className={`flex w-full flex-col items-center justify-center gap-2 bg-[#efe6e3] ${className}`}
      >
        <span className="font-logo text-xl text-brand sm:text-2xl">BRAND-ER</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand/70">Newsroom · {publisher}</span>
      </div>
    );
  }

  return (
    <img
      src={src ?? undefined}
      alt={alt}
      className={`w-full object-cover ${className}`}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
};
