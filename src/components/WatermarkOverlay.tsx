interface WatermarkOverlayProps {
  text?: string;
  className?: string;
}

/**
 * Tiled diagonal watermark for public product images (funding
 * listings/detail pages, visible to anyone before they order). Screen
 * captures can't be blocked outright, so this makes captured images
 * unusable for reselling or reproducing the design elsewhere.
 */
export const WatermarkOverlay = ({
  text = "BRAND-ER",
  className = "",
}: WatermarkOverlayProps) => {
  const tileSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="150">
    <text x="-10" y="95" font-family="Arial, sans-serif" font-size="24" font-weight="700"
      letter-spacing="1" fill="rgba(60,45,42,0.16)" transform="rotate(-28 110 75)">${text}</text>
  </svg>`;
  const backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(tileSvg)}")`;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 select-none ${className}`}
      style={{
        backgroundImage,
        backgroundRepeat: "repeat",
        backgroundSize: "220px 150px",
      }}
    />
  );
};
