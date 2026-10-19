import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMyBrand } from "@/services/brand";
import type { BrandLogoMode } from "@/services/aiImageEdit";
import { cn } from "@/lib/utils";

type Props = {
  value: BrandLogoMode;
  onChange: (value: BrandLogoMode) => void;
  className?: string;
  /** 로고 등록 후 돌아올 경로 */
  returnTo?: string;
};

/**
 * 브랜드 로고 적용 — 적용 안 함(기본) / 내 브랜드 로고 적용.
 * BRAND-ER 는 플랫폼 이름이라 어떤 경우에도 이미지에 들어가지 않는다. "내 브랜드 로고"는 제작자의
 * 브랜드 프로필에 등록된 로고이며, 서버가 직접 그 로고를 읽어 쓴다.
 */
export const BrandLogoOption = ({ value, onChange, className, returnTo }: Props) => {
  const [logo, setLogo] = useState<{ url: string | null; name: string } | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchMyBrand()
      .then((brand) => !cancelled && setLogo(brand ? { url: brand.brand_logo_url ?? null, name: brand.brand_name } : null))
      .catch(() => !cancelled && setLogo(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const hasLogo = Boolean(logo?.url);
  useEffect(() => {
    // 로고가 없는데 적용이 선택돼 있으면 기본값으로 되돌린다.
    if (logo !== undefined && !hasLogo && value === "creator") onChange("none");
  }, [logo, hasLogo, value, onChange]);

  const options: Array<{ value: BrandLogoMode; label: string; hint: string; disabled?: boolean }> = [
    { value: "none", label: "적용 안 함", hint: "로고·글자 없는 순수 디자인 (기본)" },
    {
      value: "creator",
      label: "내 브랜드 로고 적용",
      hint: hasLogo ? `${logo?.name} 로고를 왼쪽 가슴에 작게` : "내 브랜드에 로고를 먼저 등록해주세요",
      disabled: !hasLogo,
    },
  ];

  return (
    <fieldset className={cn("space-y-2", className)}>
      <legend className="text-sm font-bold">브랜드 로고 적용</legend>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="브랜드 로고 적용">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={option.disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex min-h-14 items-center gap-3 border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                active ? "border-brand bg-brand/5" : "border-stone-300 hover:border-stone-500",
              )}
            >
              <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", active ? "border-brand" : "border-stone-400")}>
                {active && <span className="h-2 w-2 rounded-full bg-brand" />}
              </span>
              {option.value === "creator" && hasLogo && (
                <img src={logo!.url!} alt="" className="h-9 w-9 shrink-0 border border-stone-200 bg-white object-contain" />
              )}
              <span className="min-w-0">
                <span className={cn("block text-sm font-semibold", active && "text-brand")}>{option.label}</span>
                <span className="block text-xs text-stone-500">{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] leading-4 text-stone-500">
        BRAND-ER 는 플랫폼 이름이라 생성 이미지에 넣지 않아요.
        {logo !== undefined && !hasLogo && (
          <>
            {" "}
            <Link to={`/my-brand${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`} className="font-semibold text-brand underline">
              내 브랜드 로고 등록하기
            </Link>
          </>
        )}
      </p>
    </fieldset>
  );
};
