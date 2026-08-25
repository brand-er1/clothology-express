const GUEST_SESSION_KEY = "brander-guest-session-id";

/**
 * A stable per-browser id for visitors without an account, so designs/outfits they create can be
 * saved server-side (not just in local React state) and later claimed into their account on login.
 * Never generated per-request — the same id must survive a refresh for the guest flow to work at all.
 */
export const getGuestSessionId = (): string => {
  try {
    const existing = localStorage.getItem(GUEST_SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(GUEST_SESSION_KEY, created);
    return created;
  } catch {
    // localStorage unavailable (private mode, quota) — still return a usable id for this call,
    // though it won't survive a reload.
    return crypto.randomUUID();
  }
};

export const clearGuestSessionId = () => {
  try {
    localStorage.removeItem(GUEST_SESSION_KEY);
  } catch {
    // Best-effort only.
  }
};
