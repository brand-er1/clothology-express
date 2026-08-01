export interface CustomerOverview {
  registered_customers: number;
  today_visitors: number;
  active_now: number;
  repeat_visitors: number;
  confirmed_today: number;
  lead_today: number;
  anonymous_today: number;
}

export interface AdminCustomer {
  user_id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  phone_number: string | null;
  account_type: string;
  brand_name: string | null;
  address: string | null;
  signed_up_at: string;
  last_sign_in_at: string | null;
  last_seen_at: string | null;
  last_path: string | null;
  session_count: number;
  page_view_count: number;
  generated_image_count: number;
  order_count: number;
  funding_count: number;
  participation_count: number;
}

export interface AdminVisitSession {
  session_id: string;
  visitor_id: string;
  user_id: string | null;
  email: string | null;
  display_name: string;
  account_type: string | null;
  identity_status: "confirmed" | "lead" | "anonymous";
  lead_code: string | null;
  lead_name: string | null;
  lead_channel: string | null;
  started_at: string;
  last_seen_at: string;
  entry_path: string;
  last_path: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  device_type: string;
  browser: string;
  page_view_count: number;
  event_count: number;
  last_event_name: string | null;
  journey: VisitJourneyEvent[];
  is_active: boolean;
}

export interface VisitJourneyEvent {
  event_name: string;
  path: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type VisitPeriod = "today" | "7d" | "all";

export interface SalesTrackingLink {
  id: string;
  lead_code: string;
  lead_name: string;
  channel: string;
  destination_path: string;
  created_at: string;
  is_active: boolean;
  click_count: number;
  last_clicked_at: string | null;
}
