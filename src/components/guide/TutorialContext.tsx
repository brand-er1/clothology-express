import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface TutorialContextValue {
  /** Tutorial id currently running (see tutorials.ts), or null when no tutorial is active. */
  activeKey: string | null;
  stepIndex: number;
  /** Set when "처음부터 둘러보기" is chosen from a page other than home — the actual navigation
   * (Link to="/") happens in BrandGuide; TutorialOverlay starts the tour once it detects the
   * route has actually become "/". */
  pendingKey: string | null;
  start: (key: string) => void;
  requestTour: (key: string) => void;
  clearPending: () => void;
  stop: () => void;
  goNext: () => void;
  goPrev: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export const TutorialProvider = ({ children }: { children: ReactNode }) => {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const value = useMemo<TutorialContextValue>(
    () => ({
      activeKey,
      stepIndex,
      pendingKey,
      start: (key) => {
        setActiveKey(key);
        setStepIndex(0);
      },
      requestTour: (key) => setPendingKey(key),
      clearPending: () => setPendingKey(null),
      stop: () => {
        setActiveKey(null);
        setStepIndex(0);
      },
      goNext: () => setStepIndex((current) => current + 1),
      goPrev: () => setStepIndex((current) => Math.max(0, current - 1)),
    }),
    [activeKey, stepIndex, pendingKey],
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
};

export const useTutorial = () => {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within a TutorialProvider");
  return ctx;
};

const DONE_KEY_PREFIX = "brander_tutorial_done_";

export const hasTutorialBeenSeen = (key: string) => {
  try {
    return localStorage.getItem(DONE_KEY_PREFIX + key) === "1";
  } catch {
    return false;
  }
};

export const markTutorialSeen = (key: string) => {
  try {
    localStorage.setItem(DONE_KEY_PREFIX + key, "1");
  } catch {
    // localStorage unavailable (private mode etc.) — just won't be remembered next visit.
  }
};
