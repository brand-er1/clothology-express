
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const useAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setIsAdmin(false);
          return;
        }

        const { data: adminData } = await supabase
          .rpc('is_admin', {
            user_id: data.session.user.id
          });

        setIsAdmin(adminData || false);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdminStatus();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, isLoading };
};
