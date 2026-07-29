import { supabase } from "@/lib/supabase";
import type {
  AdminCustomer,
  AdminVisitSession,
  CustomerOverview,
} from "@/types/customerAnalytics";

const EMPTY_OVERVIEW: CustomerOverview = {
  registered_customers: 0,
  today_visitors: 0,
  active_now: 0,
  repeat_visitors: 0,
};

export const fetchCustomerAnalytics = async () => {
  const [overviewResult, customersResult, visitsResult] = await Promise.all([
    supabase.rpc("get_admin_customer_overview"),
    supabase.rpc("get_admin_customers"),
    supabase.rpc("get_admin_visit_sessions", { p_limit: 300 }),
  ]);

  if (overviewResult.error) throw overviewResult.error;
  if (customersResult.error) throw customersResult.error;
  if (visitsResult.error) throw visitsResult.error;

  return {
    overview: {
      ...EMPTY_OVERVIEW,
      ...(overviewResult.data as CustomerOverview | null),
    },
    customers: (customersResult.data || []) as AdminCustomer[],
    visits: (visitsResult.data || []) as AdminVisitSession[],
  };
};
