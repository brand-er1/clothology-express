import { useSyncExternalStore } from "react";
import type {
  CharacterGender,
  ClosetGarment,
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
  const entry: MyWardrobeGarment = { ...garment, createdAt: new Date().toISOString() };
  const next = normalizeMyWardrobe([
    entry,
    ...loadMyWardrobe().filter((item) => item.id !== garment.id),
  ]);
  persistMyWardrobe(next);
  return next;
};
