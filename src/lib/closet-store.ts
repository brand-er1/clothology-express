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
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* best effort */ }
};
const emit = () => listeners.forEach((listener) => listener());

export const getWardrobeState = () => state;
export const subscribeWardrobe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setCharacter = (character: CharacterGender) => {
  state = { ...state, character, renderedCharacterImage: null };
  persist(); emit();
};
export const setGarment = (slot: ClosetSlot, garment: ClosetGarment | null) => {
  state = { ...state, outfit: { ...state.outfit, [slot]: garment } };
  persist(); emit();
};
export const clearOutfit = () => {
  state = { ...state, outfit: emptyOutfit(), renderedCharacterImage: null };
  persist(); emit();
};
export const setRenderedCharacterImage = (imageUrl: string | null) => {
  state = { ...state, renderedCharacterImage: imageUrl };
  persist(); emit();
};
export const getWornDesignGarments = () => Object.values(state.outfit).filter(
  (garment): garment is ClosetGarment => Boolean(garment && garment.source !== "preset"),
);
export const useWardrobeState = () => useSyncExternalStore(subscribeWardrobe, getWardrobeState, getWardrobeState);

export const loadSavedLooks = (): SavedBrandErLook[] => {
  try {
    const raw = localStorage.getItem(SAVED_LOOKS_KEY);
    return raw ? JSON.parse(raw) as SavedBrandErLook[] : [];
  } catch { return []; }
};
export const saveCurrentLook = (): SavedBrandErLook => {
  const look: SavedBrandErLook = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
    savedAt: new Date().toISOString(), character: state.character, outfit: state.outfit,
    renderedCharacterImage: state.renderedCharacterImage,
  };
  try { localStorage.setItem(SAVED_LOOKS_KEY, JSON.stringify([look, ...loadSavedLooks()].slice(0, 20))); } catch { /* best effort */ }
  return look;
};

export interface MyWardrobeGarment extends ClosetGarment { createdAt: string; }
const MY_WARDROBE_KEY = "brander-my-wardrobe-v1";

export const loadMyWardrobe = (): MyWardrobeGarment[] => {
  try {
    const raw = sessionStorage.getItem(MY_WARDROBE_KEY);
    return raw ? JSON.parse(raw) as MyWardrobeGarment[] : [];
  } catch { return []; }
};

const persistMyWardrobe = (items: MyWardrobeGarment[]) => {
  try { sessionStorage.setItem(MY_WARDROBE_KEY, JSON.stringify(items)); } catch { /* best effort */ }
  return items;
};

export const addToMyWardrobe = (garment: ClosetGarment): MyWardrobeGarment[] => {
  const entry: MyWardrobeGarment = { ...garment, createdAt: new Date().toISOString() };
  const withoutSameId = loadMyWardrobe().filter((item) => item.id !== garment.id);
  return persistMyWardrobe([entry, ...withoutSameId].slice(0, 30));
};

/** Replace an authored garment after an AI edit while keeping its wardrobe identity and position. */
export const replaceMyWardrobeGarment = (garment: MyWardrobeGarment): MyWardrobeGarment[] => {
  const current = loadMyWardrobe();
  const next = current.some((item) => item.id === garment.id)
    ? current.map((item) => item.id === garment.id ? garment : item)
    : [garment, ...current];
  return persistMyWardrobe(next.slice(0, 30));
};
