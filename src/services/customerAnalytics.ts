import { supabase } from "@/lib/supabase";
import type {
  AdminCustomer,
  AdminVisitSession,
  CustomerOverview,
  SalesTrackingLink,
  VisitPeriod,
} from "@/types/customerAnalytics";

const EMPTY_OVERVIEW: CustomerOverview = {
  registered_customers: 0,
  today_visitors: 0,
  active_now: 0,
  repeat_visitors: 0,
  confirmed_today: 0,
  lead_today: 0,
  anonymous_today: 0,
};

export const fetchCustomerAnalytics = async (period: VisitPeriod = "today") => {
  const [overviewResult, customersResult, visitsResult, linksResult] = await Promise.all([
    supabase.rpc("get_admin_customer_overview"),
    supabase.rpc("get_admin_customers"),
    supabase.rpc("get_admin_visit_sessions", { p_limit: 500, p_period: period }),
    supabase.rpc("get_admin_sales_tracking_links"),
  ]);

  if (overviewResult.error) throw overviewResult.error;
  if (customersResult.error) throw customersResult.error;
  if (visitsResult.error) throw visitsResult.error;
  if (linksResult.error) throw linksResult.error;

  return {
    overview: {
      ...EMPTY_OVERVIEW,
      ...(overviewResult.data as CustomerOverview | null),
    },
    customers: (customersResult.data || []) as AdminCustomer[],
    visits: (visitsResult.data || []) as AdminVisitSession[],
    links: (linksResult.data || []) as SalesTrackingLink[],
  };
};

export const createSalesTrackingLink = async (input: {
  leadName: string;
  channel: string;
  destinationPath: string;
}) => {
  const { data, error } = await supabase.rpc("create_admin_sales_tracking_link", {
    p_lead_name: input.leadName,
    p_channel: input.channel,
    p_destination_path: input.destinationPath,
  });

  if (error) throw error;
  return (data?.[0] || null) as SalesTrackingLink | null;
};

export const setSalesTrackingLinkActive = async (id: string, isActive: boolean) => {
  const { error } = await supabase.rpc("set_admin_sales_tracking_link_active", {
    p_id: id,
    p_is_active: isActive,
  });

  if (error) throw error;
};
