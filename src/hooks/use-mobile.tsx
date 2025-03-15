
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

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(
    typeof window !== 'undefined' ? getBestWindowWidth() < MOBILE_BREAKPOINT : false
  )
  
  // Store whether we're in an iframe
  const [isInIframeContext] = React.useState<boolean>(
    typeof window !== 'undefined' ? isInIframe() : false
  )

  React.useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(getBestWindowWidth() < MOBILE_BREAKPOINT)
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
        if (typeof parentWidth === 'number') {
          setIsMobile(parentWidth < MOBILE_BREAKPOINT);
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
  }, [isInIframeContext])

  return isMobile
}
