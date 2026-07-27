
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getAccountType, type AccountType } from "@/utils/accountRouting";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredAccountType?: AccountType;
}

export const AuthGuard = ({ children, requiredAccountType }: AuthGuardProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      
      if (!data.session) {
        const returnTo = `${location.pathname}${location.search}`;
        navigate(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }

      if (requiredAccountType && getAccountType(data.session.user) !== requiredAccountType) {
        navigate("/fundings", { replace: true });
        return;
      }
      
      setIsLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        const returnTo = `${location.pathname}${location.search}`;
        navigate(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [location.pathname, location.search, navigate, requiredAccountType]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return <>{children}</>;
};
