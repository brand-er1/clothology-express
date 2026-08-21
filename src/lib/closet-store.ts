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

// --- My wardrobe (AI-created garments this session, browsable for quick re-equip) ---

export interface MyWardrobeGarment extends ClosetGarment {
  createdAt: string;
}

const MY_WARDROBE_KEY = "brander-my-wardrobe-v1";

export const loadMyWardrobe = (): MyWardrobeGarment[] => {
  try {
    const raw = sessionStorage.getItem(MY_WARDROBE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MyWardrobeGarment[];
  } catch {
    return [];
  }
};

export const addToMyWardrobe = (garment: ClosetGarment): MyWardrobeGarment[] => {
  const entry: MyWardrobeGarment = { ...garment, createdAt: new Date().toISOString() };
  const next = [entry, ...loadMyWardrobe()].slice(0, 30);
  try {
    sessionStorage.setItem(MY_WARDROBE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort — the item is still usable this turn even if it can't persist.
  }
  return next;
};
