import { useEffect, useRef, useState } from "react";
import type { MascotPose } from "@/components/BrandMascot";
import { RUN_POSES, SAFE_ZONE_SELECTOR } from "./mascotConfig";

const ROAM_MIN_PCT = 8;
const ROAM_MAX_PCT = 80;
const ROAM_MIN_BOTTOM_PCT = 4;
const ROAM_MAX_BOTTOM_PCT = 20;
// Mobile screens are narrower and shorter, so the roam band is tighter and stays low,
// out of the way of page content, while still visibly moving around.
const COMPACT_MIN_PCT = 18;
const COMPACT_MAX_PCT = 70;
const COMPACT_MIN_BOTTOM_PCT = 4;
const COMPACT_MAX_BOTTOM_PCT = 12;
const ENTRY_START_PCT = 108;
const RUN_FRAME_MS = 110;
const MOVE_DURATION_MS = 1700;
const INITIAL_IDLE_DELAY_MS = 2500;
const IDLE_MOVE_MIN_MS = 10000;
const IDLE_MOVE_MAX_MS = 18000;
// A dragged-and-dropped character isn't idle wandering — it goes wherever the visitor puts it,
// almost the full viewport, just short of clipping off an edge.
const DRAG_MIN_PCT = 3;
const DRAG_MAX_PCT = 97;
const DRAG_MIN_BOTTOM_PCT = 2;
// Bottom-anchored, so this is how far the character's own anchor point may rise — capped short
// of 100vh so the character (and most of an opened bubble) stays on screen instead of clipping
// above the viewport.
const DRAG_MAX_BOTTOM_PCT = 82;

type RoamOptions = {
  enabled: boolean;
  /** Freezes movement in place (bubble or quick menu open) without losing roam eligibility. */
  paused: boolean;
  /** Mobile: tighter roam band and lower max height, per the "narrower range on mobile" rule. */
  compact: boolean;
};

type RoamState = {
  xPercent: number;
  bottomPercent: number;
  pose: MascotPose;
  flip: boolean;
  isMoving: boolean;
  isEntering: boolean;
  safeZoneActive: boolean;
  /** Moves the character to an exact spot (drag-and-drop) and anchors future roaming from there. */
  setManualPosition: (xPercent: number, bottomPercent: number) => void;
};

export const useMascotRoam = ({ enabled, paused, compact }: RoamOptions): RoamState => {
  const minPct = compact ? COMPACT_MIN_PCT : ROAM_MIN_PCT;
  const maxPct = compact ? COMPACT_MAX_PCT : ROAM_MAX_PCT;
  const minBottomPct = compact ? COMPACT_MIN_BOTTOM_PCT : ROAM_MIN_BOTTOM_PCT;
  const maxBottomPct = compact ? COMPACT_MAX_BOTTOM_PCT : ROAM_MAX_BOTTOM_PCT;
  const [xPercent, setXPercent] = useState(ENTRY_START_PCT);
  const [bottomPercent, setBottomPercent] = useState(minBottomPct);
  const [isMoving, setIsMoving] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [flip, setFlip] = useState(false);
  const [runFrame, setRunFrame] = useState(0);
  const [safeZoneActive, setSafeZoneActive] = useState(false);
  const xRef = useRef(ENTRY_START_PCT);
  // Once a visitor has dragged the character anywhere, it keeps wandering that whole space
  // afterwards instead of being pulled back into the narrow default band on the next idle move.
  const hasBeenDraggedRef = useRef(false);

  // Docks the mascot when a checkout/order/nav/form element (marked data-mascot-safezone)
  // is on screen, so it never roams over something the visitor needs to click.
  useEffect(() => {
    const visible = new Set<Element>();
    const observedElements = new Set<Element>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        });
        setSafeZoneActive(visible.size > 0);
      },
      { threshold: 0.15 }
    );

    const observeAll = () => {
      document.querySelectorAll(SAFE_ZONE_SELECTOR).forEach((el) => {
        if (!observedElements.has(el)) {
          observedElements.add(el);
          observer.observe(el);
        }
      });
    };
    observeAll();

    const mutationObserver = new MutationObserver(observeAll);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let moveTimer: ReturnType<typeof setTimeout> | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let frameInterval: ReturnType<typeof setInterval> | undefined;

    const clearAll = () => {
      if (moveTimer) clearTimeout(moveTimer);
      if (idleTimer) clearTimeout(idleTimer);
      if (frameInterval) clearInterval(frameInterval);
    };

    if (!enabled || paused || safeZoneActive) {
      clearAll();
      setIsMoving(false);
      return () => clearAll();
    }

    const startMove = () => {
      if (cancelled) return;
      const curMinPct = hasBeenDraggedRef.current ? DRAG_MIN_PCT : minPct;
      const curMaxPct = hasBeenDraggedRef.current ? DRAG_MAX_PCT : maxPct;
      const curMinBottomPct = hasBeenDraggedRef.current ? DRAG_MIN_BOTTOM_PCT : minBottomPct;
      const curMaxBottomPct = hasBeenDraggedRef.current ? DRAG_MAX_BOTTOM_PCT : maxBottomPct;

      let next = xRef.current;
      while (Math.abs(next - xRef.current) < 18) {
        next = curMinPct + Math.random() * (curMaxPct - curMinPct);
      }
      setFlip(next < xRef.current);
      xRef.current = next;
      setXPercent(next);
      setBottomPercent(curMinBottomPct + Math.random() * (curMaxBottomPct - curMinBottomPct));
      setIsMoving(true);
      setIsEntering(false);

      let frame = 0;
      frameInterval = setInterval(() => {
        frame = (frame + 1) % RUN_POSES.length;
        setRunFrame(frame);
      }, RUN_FRAME_MS);

      moveTimer = setTimeout(() => {
        if (frameInterval) clearInterval(frameInterval);
        setIsMoving(false);
        if (!cancelled) {
          scheduleNext(IDLE_MOVE_MIN_MS + Math.random() * (IDLE_MOVE_MAX_MS - IDLE_MOVE_MIN_MS));
        }
      }, MOVE_DURATION_MS);
    };

    const scheduleNext = (delay: number) => {
      idleTimer = setTimeout(startMove, delay);
    };

    scheduleNext(INITIAL_IDLE_DELAY_MS);

    return () => {
      cancelled = true;
      clearAll();
    };
  }, [enabled, paused, safeZoneActive, minPct, maxPct, minBottomPct, maxBottomPct]);

  const setManualPosition = (nextXPercent: number, nextBottomPercent: number) => {
    hasBeenDraggedRef.current = true;
    const clampedX = Math.min(DRAG_MAX_PCT, Math.max(DRAG_MIN_PCT, nextXPercent));
    const clampedBottom = Math.min(DRAG_MAX_BOTTOM_PCT, Math.max(DRAG_MIN_BOTTOM_PCT, nextBottomPercent));
    xRef.current = clampedX;
    setXPercent(clampedX);
    setBottomPercent(clampedBottom);
    setIsMoving(false);
    setIsEntering(false);
  };

  return {
    xPercent,
    bottomPercent,
    pose: isMoving ? RUN_POSES[runFrame] : "idle",
    flip,
    isMoving,
    isEntering,
    safeZoneActive,
    setManualPosition,
  };
};
