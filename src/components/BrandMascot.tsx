import { useId } from "react";

type BrandMascotProps = {
  className?: string;
  size?: number;
  /** "dark" = ink line on cream shirt, for light backgrounds. "light" = cream line on dark shirt, for dark backgrounds. */
  tone?: "dark" | "light";
  /** Raises the right sleeve in a wave instead of resting both sleeves down. */
  wave?: boolean;
};

/**
 * BRAND-ER's mascot: a little hanging sweater with a quiet, confident face —
 * a nod to the brand's own product (clothing on a hanger) rather than a generic icon.
 * Shaded with gradients + a drop shadow so it reads with some volume, not flat line art.
 */
export const BrandMascot = ({ className, size = 96, tone = "dark", wave = false }: BrandMascotProps) => {
  const uid = useId().replace(/:/g, "");
  const palette =
    tone === "dark"
      ? {
          bodyFrom: "#fbf7f1",
          bodyTo: "#e2d9cd",
          sleeveFrom: "#f1ece4",
          sleeveTo: "#d6ccbe",
          line: "#741b2b",
          ink: "#251d1e",
          cheek: "#c999a4",
          shadow: "#3a1016",
        }
      : {
          bodyFrom: "#3d2d31",
          bodyTo: "#1c1517",
          sleeveFrom: "#332628",
          sleeveTo: "#170f11",
          line: "#e8d3d8",
          ink: "#f1ece4",
          cheek: "#c999a4",
          shadow: "#000000",
        };

  return (
    <svg
      viewBox="0 0 100 120"
      width={size}
      height={(size * 120) / 100}
      className={className}
      role="img"
      aria-label="BRAND-ER 마스코트"
    >
      <defs>
        <linearGradient id={`${uid}-body`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor={palette.bodyFrom} />
          <stop offset="100%" stopColor={palette.bodyTo} />
        </linearGradient>
        <linearGradient id={`${uid}-sleeve`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor={palette.sleeveFrom} />
          <stop offset="100%" stopColor={palette.sleeveTo} />
        </linearGradient>
        <filter id={`${uid}-lift`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor={palette.shadow} floodOpacity="0.32" />
        </filter>
      </defs>

      <g filter={`url(#${uid}-lift)`}>
        <path
          d="M50,38 C50,26 41,25 41,16 C41,10 47,7 53,10"
          fill="none"
          stroke={palette.line}
          strokeWidth={3}
          strokeLinecap="round"
        />

        <path
          d={
            wave
              ? "M62,42 L91,22 Q98,19 97,28 L85,45 L67,53 Z"
              : "M62,42 L89,37 Q95,39 93,47 L82,57 L67,53 Z"
          }
          fill={`url(#${uid}-sleeve)`}
          stroke={palette.line}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {wave && (
          <circle cx={93} cy={23} r={4} fill={`url(#${uid}-sleeve)`} stroke={palette.line} strokeWidth={2.5} />
        )}

        <path
          d="M38,42 L11,37 Q5,39 7,47 L18,57 L33,53 Z"
          fill={`url(#${uid}-sleeve)`}
          stroke={palette.line}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />

        <rect
          x={25}
          y={38}
          width={50}
          height={56}
          rx={13}
          fill={`url(#${uid}-body)`}
          stroke={palette.line}
          strokeWidth={3}
        />

        <path
          d="M31,45 Q28,64 33,86"
          fill="none"
          stroke="#ffffff"
          strokeWidth={4}
          strokeLinecap="round"
          opacity={tone === "dark" ? 0.35 : 0.12}
        />

        <path
          d="M37,38 L50,49 L63,38"
          fill="none"
          stroke={palette.line}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <rect x={45} y={12} width={10} height={12} rx={2.5} fill={`url(#${uid}-sleeve)`} stroke={palette.line} strokeWidth={2} />
        <circle cx={50} cy={16.5} r={1.4} fill={palette.line} />

        <circle cx={37.5} cy={73} r={3} fill={palette.cheek} opacity={0.55} />
        <circle cx={62.5} cy={73} r={3} fill={palette.cheek} opacity={0.55} />

        <circle cx={43} cy={65} r={2.6} fill={palette.ink} />
        <circle cx={57} cy={65} r={2.6} fill={palette.ink} />

        <path
          d="M43,77 Q50,83 57,77"
          fill="none"
          stroke={palette.ink}
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        <path
          d="M35,88 L65,88"
          stroke={palette.line}
          strokeWidth={2}
          strokeDasharray="3 3"
          strokeLinecap="round"
          opacity={0.6}
        />
      </g>
    </svg>
  );
};
