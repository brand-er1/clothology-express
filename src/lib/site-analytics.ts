import { supabase } from "@/lib/supabase";

export const VISITOR_STORAGE_KEY = "brander_visitor_id";
export const SESSION_STORAGE_KEY = "brander_visit_session_id";
export const ATTRIBUTION_STORAGE_KEY = "brander_visit_attribution";

export type SiteEventName =
  | "design_generated"
  | "design_modified"
  | "funding_draft_created"
  | "production_request_submitted"
  | "design_quote_submitted"
  | "fabric_swatch_submitted"
  | "funding_checkout_started";

export type VisitAttribution = {
  leadCode: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
};

const createId = () => {
  const browserCrypto = globalThis.crypto;
  if (browserCrypto?.randomUUID) {
    return browserCrypto.randomUUID();
  }

  const values = new Uint8Array(16);
  if (browserCrypto?.getRandomValues) {
    browserCrypto.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1) {
      values[index] = Math.floor(Math.random() * 256);
    }
  }
  values[6] = (values[6] & 0x0f) | 0x40;
  values[8] = (values[8] & 0x3f) | 0x80;
  const hex = Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const getStoredAnalyticsId = (storage: Storage, key: string) => {
  const saved = storage.getItem(key);
  if (saved) return saved;

  const created = createId();
  storage.setItem(key, created);
  return created;
};

const safeMetadata = (metadata: Record<string, unknown>) => {
  const entries = Object.entries(metadata)
    .filter(([, value]) =>
      value === null || ["string", "number", "boolean"].includes(typeof value),
    )
    .slice(0, 12)
    .map(([key, value]) => [key.slice(0, 50), typeof value === "string" ? value.slice(0, 200) : value]);

  return Object.fromEntries(entries);
};

export const trackSiteEvent = async (
  eventName: SiteEventName,
  metadata: Record<string, unknown> = {},
) => {
  if (typeof window === "undefined") return;

  const sessionId = getStoredAnalyticsId(sessionStorage, SESSION_STORAGE_KEY);
  const visitorId = getStoredAnalyticsId(localStorage, VISITOR_STORAGE_KEY);
  const { error } = await supabase.rpc("track_site_event", {
    p_session_id: sessionId,
    p_visitor_id: visitorId,
    p_event_name: eventName,
    p_path: window.location.pathname.slice(0, 300),
    p_metadata: safeMetadata(metadata),
  });

  if (error) {
    console.debug("Site event tracking is not available:", error.message);
  }
};
