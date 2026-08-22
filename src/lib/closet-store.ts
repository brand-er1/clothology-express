import { useSyncExternalStore } from "react";
import type {
  CharacterGender,
  ClosetGarment,
  ClosetGarmentRevision,
  ClosetSlot,
  SavedBrandErLook,
  WardrobeState,
} from "@/types/closet";

const STORAGE_KEY = "brander-wardrobe-state-v2";
const SAVED_LOOKS_KEY = "brander-saved-looks-v2";

const emptyOutfit = (): WardrobeState["outfit"] => ({
  top: null,
  bottom: null,
  outer: null,
  shoes: null,
  accessory: null,
});

const loadState = (): WardrobeState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { character: "male", outfit: emptyOutfit(), renderedCharacterImage: null };
    const parsed = JSON.parse(raw) as WardrobeState;
    return {
      character: parsed.character === "female" ? "female" : "male",
      outfit: { ...emptyOutfit(), ...parsed.outfit },
      renderedCharacterImage: parsed.renderedCharacterImage || null,
    };
  } catch {
    return { character: "male", outfit: emptyOutfit(), renderedCharacterImage: null };
  }
};

let state: WardrobeState = loadState();
const listeners = new Set<() => void>();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable (private mode, quota) — in-memory state still works for this tab.
  }
};

const emit = () => listeners.forEach((listener) => listener());

export const getWardrobeState = () => state;

export const subscribeWardrobe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Switching character keeps the currently-equipped outfit — only the stale AI render is cleared. */
export const setCharacter = (character: CharacterGender) => {
  state = { ...state, character, renderedCharacterImage: null };
  persist();
  emit();
};

/** Keep the last verified render until a replacement also passes the strict preservation gate. */
export const setGarment = (slot: ClosetSlot, garment: ClosetGarment | null) => {
  state = { ...state, outfit: { ...state.outfit, [slot]: garment } };
  persist();
  emit();
};

export const clearOutfit = () => {
  state = { ...state, outfit: emptyOutfit(), renderedCharacterImage: null };
  persist();
  emit();
};

export const setRenderedCharacterImage = (imageUrl: string | null) => {
  state = { ...state, renderedCharacterImage: imageUrl };
  persist();
  emit();
};

/** Garments the visitor actually authored (AI design or upload) — what quoting/funding can act on. */
export const getWornDesignGarments = () =>
  Object.values(state.outfit).filter(
    (garment): garment is ClosetGarment => Boolean(garment && garment.source !== "preset"),
  );

export const useWardrobeState = () =>
  useSyncExternalStore(subscribeWardrobe, getWardrobeState, getWardrobeState);

// --- Saved looks (MY BRAND-ER LOOK) ---

export const loadSavedLooks = (): SavedBrandErLook[] => {
  try {
    const raw = localStorage.getItem(SAVED_LOOKS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedBrandErLook[];
  } catch {
    return [];
  }
};

export const saveCurrentLook = (): SavedBrandErLook => {
  const look: SavedBrandErLook = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`,
    savedAt: new Date().toISOString(),
    character: state.character,
    outfit: state.outfit,
    renderedCharacterImage: state.renderedCharacterImage,
  };
  try {
    const looks = [look, ...loadSavedLooks()].slice(0, 20);
    localStorage.setItem(SAVED_LOOKS_KEY, JSON.stringify(looks));
  } catch {
    // Best-effort — the look is still visible for the rest of this session even if it can't persist.
  }
  return look;
};

// --- My wardrobe (AI-created and uploaded garments, browsable for quick replacement) ---

export interface MyWardrobeGarment extends ClosetGarment {
  createdAt: string;
}

const MY_WARDROBE_KEY = "brander-my-wardrobe-v2";
const LEGACY_MY_WARDROBE_KEY = "brander-my-wardrobe-v1";

const normalizeMyWardrobe = (items: MyWardrobeGarment[]) => {
  const seenIds = new Set<string>();
  return items
    .filter((item) => {
      if (!item?.id || seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return item.source !== "preset";
    })
    .slice(0, 30);
};

const persistMyWardrobe = (items: MyWardrobeGarment[]) => {
  const serialized = JSON.stringify(items);
  try {
    // Keep authored garments available after a reload so the user can swap back to them later.
    localStorage.setItem(MY_WARDROBE_KEY, serialized);
    return;
  } catch {
    // Large uploaded data URLs can exceed localStorage quota. Session storage is a useful fallback.
  }
  try {
    sessionStorage.setItem(MY_WARDROBE_KEY, serialized);
  } catch {
    // Best-effort — the caller still receives the in-memory list for this render.
  }
};

export const loadMyWardrobe = (): MyWardrobeGarment[] => {
  try {
    const raw =
      localStorage.getItem(MY_WARDROBE_KEY) ||
      sessionStorage.getItem(MY_WARDROBE_KEY) ||
      sessionStorage.getItem(LEGACY_MY_WARDROBE_KEY);
    if (!raw) return [];
    const items = normalizeMyWardrobe(JSON.parse(raw) as MyWardrobeGarment[]);
    persistMyWardrobe(items);
    return items;
  } catch {
    return [];
  }
};

export const addToMyWardrobe = (garment: ClosetGarment): MyWardrobeGarment[] => {
  const existing = loadMyWardrobe().find((item) => item.id === garment.id);
  const entry: MyWardrobeGarment = { ...garment, createdAt: existing?.createdAt || new Date().toISOString() };
  const next = normalizeMyWardrobe([
    entry,
    ...loadMyWardrobe().filter((item) => item.id !== garment.id),
  ]);
  persistMyWardrobe(next);
  return next;
};

export const removeFromMyWardrobe = (garmentId: string): MyWardrobeGarment[] => {
  const next = loadMyWardrobe().filter((item) => item.id !== garmentId);
  persistMyWardrobe(next);
  return next;
};

// --- Garment revision history ("수정하기" trail) ---

/** Every garment always has at least one revision — the original — even if it predates this field. */
export const ensureGarmentRevisions = (garment: ClosetGarment): ClosetGarmentRevision[] =>
  garment.revisions?.length
    ? garment.revisions
    : [
        {
          id: `${garment.id}-original`,
          promptLabel: "",
          imageUrl: garment.imageUrl,
          designRef: garment.designRef,
          createdAt: new Date().toISOString(),
        },
      ];

/** Appends a new revision (the result of an "수정하기" edit) and makes it the current one. */
export const withNewGarmentRevision = (
  garment: ClosetGarment,
  next: { imageUrl: string; designRef?: ClosetGarment["designRef"]; promptLabel: string },
): ClosetGarment => {
  const baseRevisions = ensureGarmentRevisions(garment);
  const revision: ClosetGarmentRevision = {
    id: `${garment.id}-rev-${baseRevisions.length}-${Date.now()}`,
    promptLabel: next.promptLabel,
    imageUrl: next.imageUrl,
    designRef: next.designRef,
    createdAt: new Date().toISOString(),
  };
  return {
    ...garment,
    imageUrl: next.imageUrl,
    designRef: next.designRef ?? garment.designRef,
    revisions: [...baseRevisions, revision],
    activeRevisionId: revision.id,
  };
};

/** Restores an earlier revision as the current one, without discarding any newer revisions. */
export const withRestoredGarmentRevision = (garment: ClosetGarment, revisionId: string): ClosetGarment => {
  const revisions = ensureGarmentRevisions(garment);
  const target = revisions.find((revision) => revision.id === revisionId);
  if (!target) return garment;
  return {
    ...garment,
    imageUrl: target.imageUrl,
    designRef: target.designRef ?? garment.designRef,
    revisions,
    activeRevisionId: target.id,
  };
};
