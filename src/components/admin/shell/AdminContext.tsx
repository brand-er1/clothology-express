import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAdminContext, type AdminContext } from "@/services/adminApi";
import { hasPermission, type AdminPermission } from "@/lib/admin/permissions";

type AdminContextValue = {
  context: AdminContext | null;
  loading: boolean;
  can: (permission: AdminPermission) => boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AdminContextValue>({
  context: null,
  loading: true,
  can: () => false,
  refresh: async () => undefined,
});

export const AdminContextProvider = ({ children }: { children: ReactNode }) => {
  const [context, setContext] = useState<AdminContext | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setContext({ is_admin: false });
        return;
      }
      setContext(await fetchAdminContext());
    } catch (error) {
      console.error("관리자 권한 확인 실패:", error);
      setContext({ is_admin: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void refresh(); });
    return () => subscription.unsubscribe();
  }, [refresh]);

  const can = useCallback((permission: AdminPermission) => hasPermission(context?.permissions, permission), [context]);

  return <Ctx.Provider value={{ context, loading, can, refresh }}>{children}</Ctx.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAdminContext = () => useContext(Ctx);
