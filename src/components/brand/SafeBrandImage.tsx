import { useEffect, useState } from "react";
import { Store, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  alt: string;
  kind: "profile" | "logo";
  className?: string;
};

export const SafeBrandImage = ({ src, alt, kind, className }: Props) => {
  const [failed, setFailed] = useState(!src);
  useEffect(() => setFailed(!src), [src]);
  const Icon = kind === "profile" ? UserRound : Store;

  if (failed) {
    return (
      <span
        role="img"
        aria-label={`${alt} 기본 이미지`}
        className={cn(
          "inline-flex shrink-0 items-center justify-center bg-stone-200 text-stone-500",
          kind === "profile" ? "rounded-full" : "rounded-xl",
          className,
        )}
      >
        <Icon className="h-[45%] w-[45%]" />
      </span>
    );
  }

  return (
    <img
      src={src || undefined}
      alt={alt}
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 bg-stone-100 object-cover",
        kind === "profile" ? "rounded-full" : "rounded-xl",
        className,
      )}
    />
  );
};
