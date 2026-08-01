import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  ATTRIBUTION_STORAGE_KEY,
  getStoredAnalyticsId,
  SESSION_STORAGE_KEY,
  type VisitAttribution,
  VISITOR_STORAGE_KEY,
} from "@/lib/site-analytics";

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

const sanitizeParameter = (value: string | null, maxLength: number) => {
  if (!value) return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
};

const readAttribution = () => {
  const params = new URLSearchParams(window.location.search);
  const incoming: VisitAttribution = {
    leadCode: sanitizeParameter(params.get("lead"), 64),
    utmSource: sanitizeParameter(params.get("utm_source"), 100),
    utmMedium: sanitizeParameter(params.get("utm_medium"), 100),
    utmCampaign: sanitizeParameter(params.get("utm_campaign"), 150),
    utmContent: sanitizeParameter(params.get("utm_content"), 150),
  };

  const hasIncoming = Object.values(incoming).some(Boolean);
  if (hasIncoming) {
    sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(incoming));
    return incoming;
  }

  try {
    const saved = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!saved) return incoming;
    const parsed = JSON.parse(saved) as Partial<VisitAttribution>;
    return {
      leadCode: sanitizeParameter(parsed.leadCode || null, 64),
      utmSource: sanitizeParameter(parsed.utmSource || null, 100),
      utmMedium: sanitizeParameter(parsed.utmMedium || null, 100),
      utmCampaign: sanitizeParameter(parsed.utmCampaign || null, 150),
      utmContent: sanitizeParameter(parsed.utmContent || null, 150),
    };
  } catch {
    sessionStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
    return incoming;
  }
};

export const SiteVisitTracker = () => {
  const location = useLocation();
  const latestPathRef = useRef(location.pathname);

  useEffect(() => {
    latestPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const visitorId = getStoredAnalyticsId(localStorage, VISITOR_STORAGE_KEY);
    const sessionId = getStoredAnalyticsId(sessionStorage, SESSION_STORAGE_KEY);

    const track = async (isPageView: boolean) => {
      const attribution = readAttribution();
      const { error } = await supabase.rpc("track_site_visit", {
        p_session_id: sessionId,
        p_visitor_id: visitorId,
        p_path: latestPathRef.current,
        p_referrer: getSafeReferrer(),
        p_device_type: getDeviceType(),
        p_browser: getBrowser(),
        p_is_page_view: isPageView,
        p_lead_code: attribution.leadCode,
        p_utm_source: attribution.utmSource,
        p_utm_medium: attribution.utmMedium,
        p_utm_campaign: attribution.utmCampaign,
        p_utm_content: attribution.utmContent,
      });

      if (error) {
        console.debug("Visit tracking is not available:", error.message);
      }
    };

    void track(true);
    const heartbeat = window.setInterval(() => void track(false), 60_000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void track(false);
    });

    return () => {
      window.clearInterval(heartbeat);
      subscription.unsubscribe();
    };
  }, [location.pathname]);

  return null;
};
