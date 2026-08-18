import { useEffect, useRef, useState } from "react";
import type { MascotPose } from "@/components/BrandMascot";
import { RUN_POSES, SAFE_ZONE_SELECTOR } from "./mascotConfig";

const ROAM_MIN_PCT = 8;
const ROAM_MAX_PCT = 80;
const ROAM_MIN_BOTTOM_PCT = 4;
const ROAM_MAX_BOTTOM_PCT = 20;
const ENTRY_START_PCT = 108;
const RUN_FRAME_MS = 110;
const MOVE_DURATION_MS = 1700;

type RoamOptions = {
  /** Desktop-only: mobile keeps the character docked in the corner instead of roaming. */
  enabled: boolean;
  /** Freezes movement in place (bubble or quick menu open) without losing roam eligibility. */
  paused: boolean;
};

type RoamState = {
  xPercent: number;
  bottomPercent: number;
  pose: MascotPose;
  flip: boolean;
  isMoving: boolean;
  isEntering: boolean;
  safeZoneActive: boolean;
};

export const useMascotRoam = ({ enabled, paused }: RoamOptions): RoamState => {
  const [xPercent, setXPercent] = useState(ENTRY_START_PCT);
  const [bottomPercent, setBottomPercent] = useState(ROAM_MIN_BOTTOM_PCT);
  const [isMoving, setIsMoving] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [flip, setFlip] = useState(false);
  const [runFrame, setRunFrame] = useState(0);
  const [safeZoneActive, setSafeZoneActive] = useState(false);
  const xRef = useRef(ENTRY_START_PCT);

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
      let next = xRef.current;
      while (Math.abs(next - xRef.current) < 18) {
        next = ROAM_MIN_PCT + Math.random() * (ROAM_MAX_PCT - ROAM_MIN_PCT);
      }
      setFlip(next < xRef.current);
      xRef.current = next;
      setXPercent(next);
      setBottomPercent(ROAM_MIN_BOTTOM_PCT + Math.random() * (ROAM_MAX_BOTTOM_PCT - ROAM_MIN_BOTTOM_PCT));
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
        if (!cancelled) scheduleNext(2500 + Math.random() * 3500);
      }, MOVE_DURATION_MS);
    };

    const scheduleNext = (delay: number) => {
      idleTimer = setTimeout(startMove, delay);
    };

    scheduleNext(600);

    return () => {
      cancelled = true;
      clearAll();
    };
  }, [enabled, paused, safeZoneActive]);

  return {
    xPercent,
    bottomPercent,
    pose: isMoving ? RUN_POSES[runFrame] : "idle",
    flip,
    isMoving,
    isEntering,
    safeZoneActive,
  };
};
