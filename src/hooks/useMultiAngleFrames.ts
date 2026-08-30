import { useCallback, useEffect, useRef, useState } from "react";
import { generateMultiAngle, type MultiAngleFrame, type MultiAngleMode } from "@/services/multiAngle";

interface UseMultiAngleFramesResult {
  /** Angle frames for the current source image, sorted ascending by angle. Empty until `ensure()` resolves. */
  frames: MultiAngleFrame[];
  loading: boolean;
  error: string | null;
  /**
   * Lazily kicks off (once per source image) the one-time AI multi-angle generation for the
   * *currently worn* garment/fitting image. Rotating the viewer afterwards only swaps between the
   * cached frames it returns — it never regenerates or re-requests AI images on drag.
   */
  ensure: () => void;
}

/**
 * Loads and caches the 8-angle frame set for a single source image (a garment render or a virtual
 * fitting render). The underlying `generateMultiAngle` service also session-caches by URL, so
 * re-mounting a viewer for an image that was already resolved elsewhere (e.g. the inline mannequin
 * viewer and the fullscreen modal sharing the same fitting image) resolves instantly.
 */
export const useMultiAngleFrames = (
  sourceImageUrl: string | null | undefined,
  mode: MultiAngleMode,
): UseMultiAngleFramesResult => {
  const [frames, setFrames] = useState<MultiAngleFrame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestedForRef = useRef<string | null>(null);

  useEffect(() => {
    setFrames([]);
    setError(null);
    setLoading(false);
    requestedForRef.current = null;
  }, [sourceImageUrl, mode]);

  // Preload every resolved frame's bitmap once so the first few drag steps never show a blank flash.
  useEffect(() => {
    if (!frames.length) return;
    const images = frames.map((frame) => {
      const image = new Image();
      image.src = frame.imageUrl;
      return image;
    });
    return () => {
      images.forEach((image) => {
        image.src = "";
      });
    };
  }, [frames]);

  const ensure = useCallback(() => {
    if (!sourceImageUrl) return;
    if (requestedForRef.current === sourceImageUrl) return;
    requestedForRef.current = sourceImageUrl;
    setLoading(true);
    setError(null);
    void generateMultiAngle(sourceImageUrl, mode)
      .then((result) => {
        setFrames(result.frames);
      })
      .catch((err) => {
        requestedForRef.current = null;
        setError(err instanceof Error ? err.message : "다각면 이미지를 만들지 못했습니다.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sourceImageUrl, mode]);

  return { frames, loading, error, ensure };
};
