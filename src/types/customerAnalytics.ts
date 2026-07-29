export interface CustomerOverview {
  registered_customers: number;
  today_visitors: number;
  active_now: number;
  repeat_visitors: number;
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
  started_at: string;
  last_seen_at: string;
  entry_path: string;
  last_path: string;
  referrer: string | null;
  device_type: string;
  browser: string;
  page_view_count: number;
  is_active: boolean;
}
