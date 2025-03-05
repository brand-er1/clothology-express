
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { 
  sendMessageToParentWindow, 
  isProfileComplete, 
  storeSessionData 
} from "@/utils/authUtils";

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        console.log("AuthCallback: Starting authentication check");
        
        // Get the URL fragments
        const hashParams = new URLSearchParams(location.hash.substring(1));
        const errorDescriptionFromHash = hashParams.get('error_description');
        
        // If there's an error in the hash, handle it
        if (errorDescriptionFromHash) {
          console.error("Auth Error in URL:", errorDescriptionFromHash);
          throw new Error(errorDescriptionFromHash);
        }
        
        // 1. Check for code parameter (pkce flow)
        const searchParams = new URLSearchParams(location.search);
        const code = searchParams.get('code');
        const errorDescription = searchParams.get('error_description');
        
        // If there's an error in the query parameters, handle it
        if (errorDescription) {
          console.error("Auth Error in Query:", errorDescription);
          throw new Error(errorDescription);
        }
        
        if (code) {
          console.log("AuthCallback: Found code parameter, exchanging for session");
          
          // Exchange the code for a session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error("AuthCallback: Error exchanging code for session:", error);
            throw error;
          }
          
          console.log("AuthCallback: Code successfully exchanged for session");
          
          // If in popup window, send session data to parent window and store locally
          if (window.opener && data.session) {
            storeSessionData({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token
            });
            
            sendMessageToParentWindow({ 
              type: 'SESSION_DATA',
              data: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token
              }
            });
          }
        } 
        // 2. Fallback for hash parameters (legacy implicit flow)
        else if (location.hash && location.hash.includes('access_token')) {
          console.log("AuthCallback: Found access_token in hash (legacy flow)");
          
          // Handle the legacy flow with hash parameters
          const hashParams = new URLSearchParams(location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            console.log("AuthCallback: Setting session from hash parameters");
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) {
              console.error("AuthCallback: Error setting session:", error);
              throw error;
            }
            
            console.log("AuthCallback: Session set successfully from hash parameters");
            
            // If in popup window, send session data to parent window and store locally
            if (window.opener) {
              storeSessionData({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              sendMessageToParentWindow({ 
                type: 'SESSION_DATA',
                data: {
                  access_token: accessToken,
                  refresh_token: refreshToken
                }
              });
            }
          }
        }
        
        // 3. Check if we have a session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (!data.session) {
          console.log("AuthCallback: No session found, redirecting to auth");
          
          // If this is in a popup window, send error message to parent
          if (window.opener) {
            sendMessageToParentWindow({ 
              type: 'SOCIAL_LOGIN_ERROR', 
              data: { message: "인증 세션을 찾을 수 없습니다" } 
            });
            window.close();
          } else {
            navigate("/auth");
          }
          return;
        }
        
        // Get user profile to check if it's complete
        if (window.opener && data.session) {
          const { data: userData } = await supabase.auth.getUser();
          
          if (userData && userData.user) {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userData.user.id)
              .single();
              
            if (!profileError && profileData) {
              // Check if profile is complete
              if (!isProfileComplete(profileData)) {
                console.log("Profile is incomplete, notifying parent window");
                sendMessageToParentWindow({ type: 'PROFILE_INCOMPLETE' });
                window.close();
                return;
              }
            }
          }
        }
        
        // Send success message to parent window and close popup
        if (window.opener) {
          sendMessageToParentWindow({ type: 'SOCIAL_LOGIN_SUCCESS' });
          window.close();
        } else {
          navigate("/");
        }
      } catch (error: any) {
        console.error("Auth callback error:", error);
        
        // If this is in a popup window, send error message to parent and close
        if (window.opener) {
          sendMessageToParentWindow({ 
            type: 'SOCIAL_LOGIN_ERROR', 
            data: { message: error.message || "로그인 과정에서 오류가 발생했습니다" } 
          });
          window.close();
        } else {
          toast({
            title: "인증 오류",
            description: "로그인 과정에서 오류가 발생했습니다. 다시 시도해주세요.",
            variant: "destructive",
          });
          navigate("/auth");
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    checkUser();
  }, [navigate, location]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg animate-pulse">로그인 처리 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-lg">로그인 처리 중...</p>
    </div>
  );
};

export default AuthCallback;
