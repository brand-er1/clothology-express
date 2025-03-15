import * as React from "react"

const MOBILE_BREAKPOINT = 768

// Helper function to check if in iframe
const isInIframe = (): boolean => {
  try {
    return window !== window.parent;
  } catch (e) {
    return true; // If there's an error accessing parent, assume we're in a cross-origin iframe
  }
}

// Check URL parameters for mobile flag
const checkUrlForMobileParam = (): boolean | null => {
  if (typeof window === 'undefined') return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  const isMobileParam = urlParams.get('isMobile');
  
  if (isMobileParam === 'true') return true;
  if (isMobileParam === 'false') return false;
  
  return null; // No explicit parameter
}

// Helper function to get the best available window width
const getBestWindowWidth = (): number => {
  // If in iframe, try to use the parent window's width if available (same origin)
  if (isInIframe()) {
    try {
      // Try to access parent window size (will work if same origin)
      return window.parent.innerWidth;
    } catch (e) {
      // If cross-origin, fall back to message passing or just use the iframe width
      return window.innerWidth;
    }
  }
  
  // Not in iframe, just use the window width
  return window.innerWidth;
}

// Check if user agent is mobile
const isMobileUserAgent = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
}

export function useIsMobile() {
  // First check URL parameter, then fallback to window width detection
  const mobileParamValue = React.useMemo(() => checkUrlForMobileParam(), []);
  
  const [isMobile, setIsMobile] = React.useState<boolean>(
    typeof window !== 'undefined' 
      ? (mobileParamValue !== null 
          ? mobileParamValue 
          : getBestWindowWidth() < MOBILE_BREAKPOINT || isMobileUserAgent()) 
      : false
  )
  
  // Store whether we're in an iframe
  const [isInIframeContext] = React.useState<boolean>(
    typeof window !== 'undefined' ? isInIframe() : false
  )

  React.useEffect(() => {
    // If we have explicit mobile parameter, don't need to listen for resize
    if (mobileParamValue !== null) return;
    
    const checkIsMobile = () => {
      setIsMobile(getBestWindowWidth() < MOBILE_BREAKPOINT || isMobileUserAgent())
    }
    
    // 초기 체크
    checkIsMobile()
    
    // 리사이즈 이벤트에 대한 리스너 추가
    window.addEventListener("resize", checkIsMobile)
    
    // Setup message listener for iframe communication
    const handleMessage = (event: MessageEvent) => {
      // Check for parent window size information
      if (isInIframeContext && event.data && event.data.type === 'PARENT_WINDOW_SIZE') {
        const parentWidth = event.data.width;
        const explicitMobile = event.data.isMobile;
        const parentUserAgent = event.data.userAgent;
        
        if (typeof explicitMobile === 'boolean') {
          // If parent explicitly tells us if it's mobile, use that
          setIsMobile(explicitMobile);
        } else if (typeof parentWidth === 'number') {
          // Otherwise use width and check user agent
          const isMobileUA = parentUserAgent ? 
            /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(parentUserAgent.toLowerCase()) : 
            false;
          setIsMobile(parentWidth < MOBILE_BREAKPOINT || isMobileUA);
        }
      }
    };
    
    // Add message listener if in iframe
    if (isInIframeContext) {
      window.addEventListener('message', handleMessage);
      
      // Send a message to parent window requesting its size (if parent listens for this)
      try {
        window.parent.postMessage({ type: 'REQUEST_PARENT_SIZE' }, '*');
      } catch (e) {
        // Ignore cross-origin errors
      }
    }
    
    return () => {
      window.removeEventListener("resize", checkIsMobile)
      if (isInIframeContext) {
        window.removeEventListener('message', handleMessage);
      }
    }
  }, [isInIframeContext, mobileParamValue])

  // 외부에서 모바일 상태를 확인할 수 있도록 콘솔에 출력
  React.useEffect(() => {
    console.log('Current mobile state:', isMobile);
  }, [isMobile]);

  return isMobile
}
