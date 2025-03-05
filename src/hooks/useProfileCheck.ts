
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

export const useProfileCheck = () => {
  const { userId, isAuthenticated, isLoading } = useAuth();
  const [isProfileComplete, setIsProfileComplete] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [checkLoading, setCheckLoading] = useState(true);

  useEffect(() => {
    const checkProfileCompleteness = async () => {
      if (isLoading || !isAuthenticated || !userId) {
        setCheckLoading(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) throw error;

        // Check if profile has required information
        const hasRequiredInfo = !!(
          profile &&
          profile.height &&
          profile.weight &&
          profile.gender &&
          profile.phone_number
        );

        setIsProfileComplete(hasRequiredInfo);
        setProfileData(profile);
      } catch (error) {
        console.error("Error checking profile:", error);
        setIsProfileComplete(false);
      } finally {
        setCheckLoading(false);
      }
    };

    checkProfileCompleteness();
  }, [userId, isAuthenticated, isLoading]);

  return {
    isProfileComplete,
    profileData,
    isLoading: checkLoading
  };
};
