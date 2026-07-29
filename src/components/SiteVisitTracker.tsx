import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const VISITOR_STORAGE_KEY = "brander_visitor_id";
const SESSION_STORAGE_KEY = "brander_visit_session_id";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (character) =>
    (
      Number(character) ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(character) / 4)))
    ).toString(16),
  );
};

const getStoredId = (storage: Storage, key: string) => {
  const saved = storage.getItem(key);
  if (saved) return saved;

  const created = createId();
  storage.setItem(key, created);
  return created;
};

const getDeviceType = () => {
  const agent = navigator.userAgent;
  if (/iPad|Tablet|PlayBook|Silk/i.test(agent)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(agent)) return "mobile";
  return "desktop";
};

const getBrowser = () => {
  const agent = navigator.userAgent;
  if (/Edg\//i.test(agent)) return "Edge";
  if (/SamsungBrowser/i.test(agent)) return "Samsung Internet";
  if (/Firefox\//i.test(agent)) return "Firefox";
  if (/CriOS|Chrome\//i.test(agent)) return "Chrome";
  if (/Safari\//i.test(agent)) return "Safari";
  return "기타";
};

const getSafeReferrer = () => {
  if (!document.referrer) return null;

  try {
    const referrer = new URL(document.referrer);
    return `${referrer.origin}${referrer.pathname}`.slice(0, 500);
  } catch {
    return null;
  }
};

export const SiteVisitTracker = () => {
  const location = useLocation();
  const latestPathRef = useRef(location.pathname);

  useEffect(() => {
    latestPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const visitorId = getStoredId(localStorage, VISITOR_STORAGE_KEY);
    const sessionId = getStoredId(sessionStorage, SESSION_STORAGE_KEY);

    const track = async (isPageView: boolean) => {
      const { error } = await supabase.rpc("track_site_visit", {
        p_session_id: sessionId,
        p_visitor_id: visitorId,
        p_path: latestPathRef.current,
        p_referrer: getSafeReferrer(),
        p_device_type: getDeviceType(),
        p_browser: getBrowser(),
        p_is_page_view: isPageView,
      });

      if (error) {
        console.debug("Visit tracking is not available:", error.message);
      }
    };

    void track(true);
    const heartbeat = window.setInterval(() => void track(false), 60_000);

    return () => window.clearInterval(heartbeat);
  }, [location.pathname]);

  return null;
};
