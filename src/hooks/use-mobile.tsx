
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

// Force mobile mode in specific conditions
const shouldForceMobileMode = (): boolean => {
  // If screen is narrow enough (common for mobile devices)
  if (window.innerWidth < 480) return true;
  
  // Check if device pixel ratio is high (common for mobile devices)
  if (window.devicePixelRatio > 2) return true;
  
  // Additional check for mobile user agent
  return isMobileUserAgent();
}

export function useIsMobile() {
  // First check URL parameter, then fallback to window width detection
  const mobileParamValue = React.useMemo(() => checkUrlForMobileParam(), []);
  
  // Store whether we're in an iframe
  const [isInIframeContext] = React.useState<boolean>(
    typeof window !== 'undefined' ? isInIframe() : false
  )
  
  // Set initial mobile state with more aggressive detection for iframes
  const [isMobile, setIsMobile] = React.useState<boolean>(
    typeof window !== 'undefined' 
      ? (mobileParamValue !== null 
          ? mobileParamValue 
          : isInIframeContext 
            ? shouldForceMobileMode() || getBestWindowWidth() < MOBILE_BREAKPOINT
            : getBestWindowWidth() < MOBILE_BREAKPOINT || isMobileUserAgent()) 
      : false
  )

  React.useEffect(() => {
    // If we have explicit mobile parameter, don't need to listen for resize
    if (mobileParamValue !== null) return;
    
    const checkIsMobile = () => {
      // More aggressive detection in iframe context
      if (isInIframeContext) {
        setIsMobile(shouldForceMobileMode() || getBestWindowWidth() < MOBILE_BREAKPOINT);
      } else {
        setIsMobile(getBestWindowWidth() < MOBILE_BREAKPOINT || isMobileUserAgent());
      }
    }
    
    // 초기 체크
    checkIsMobile()
    
    // 리사이즈 이벤트에 대한 리스너 추가
    window.addEventListener("resize", checkIsMobile)
    
    // Setup message listener for iframe communication
    const handleMessage = (event: MessageEvent) => {
      // Check for parent window size information
      if (isInIframeContext && event.data && event.data.type === 'PARENT_WINDOW_SIZE') {
        console.log('Received parent window size message:', event.data);
        
        const parentWidth = event.data.width;
        const explicitMobile = event.data.isMobile;
        const parentUserAgent = event.data.userAgent;
        const pixelRatio = event.data.pixelRatio;
        
        if (typeof explicitMobile === 'boolean') {
          // If parent explicitly tells us if it's mobile, use that
          console.log('Setting mobile state from parent explicit value:', explicitMobile);
          setIsMobile(explicitMobile);
        } else if (typeof parentWidth === 'number') {
          // Otherwise use width and check user agent
          const isMobileUA = parentUserAgent ? 
            /android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(parentUserAgent) : 
            false;
          
          const isMobileSize = parentWidth < MOBILE_BREAKPOINT;
          const isMobilePixelRatio = pixelRatio && pixelRatio > 2;
          
          const newMobileState = isMobileSize || isMobileUA || isMobilePixelRatio;
          console.log('Determining mobile state from parent data:', {
            width: parentWidth,
            isMobileUA,
            isMobileSize,
            isMobilePixelRatio,
            result: newMobileState
          });
          
          setIsMobile(newMobileState);
        }
      }
    };
    
    // Add message listener if in iframe
    if (isInIframeContext) {
      window.addEventListener('message', handleMessage);
      
      // Send a message to parent window requesting its size (if parent listens for this)
      try {
        console.log('Requesting parent window size...');
        window.parent.postMessage({ type: 'REQUEST_PARENT_SIZE' }, '*');
      } catch (e) {
        // Ignore cross-origin errors
        console.error('Error requesting parent size:', e);
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
    console.log('Current mobile state:', isMobile, 'In iframe:', isInIframeContext);
  }, [isMobile, isInIframeContext]);

  return isMobile
}
