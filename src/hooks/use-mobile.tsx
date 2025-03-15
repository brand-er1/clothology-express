
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const checkIsMobile = () => {
      // 화면 너비로 모바일 여부 체크
      const widthCheck = window.innerWidth < MOBILE_BREAKPOINT
      
      // 유저 에이전트로 모바일 기기 체크
      const userAgentCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
      
      // 터치 지원 여부 체크 (대부분의 모바일 기기는 터치 지원)
      const touchCheck = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      
      // 픽셀 비율 체크 (대부분의 모바일 기기는 픽셀 비율이 높음)
      const pixelRatioCheck = window.devicePixelRatio >= 2
      
      // iframe 내부에서 실행 중인지 확인
      const isInIframe = window !== window.parent
      
      // 디버깅을 위한 콘솔 로그
      console.log("Mobile Detection:", {
        width: window.innerWidth,
        widthCheck,
        userAgentCheck,
        touchCheck,
        pixelRatioCheck,
        isInIframe
      })
      
      // 최종 결정 (하나라도 true면 모바일로 간주)
      const result = widthCheck || userAgentCheck
      setIsMobile(result)
      
      // iframe 내부에서 실행 중이라면 부모 창에게 크기 정보 전달
      if (isInIframe) {
        try {
          window.parent.postMessage({
            type: 'IFRAME_MOBILE_STATE',
            isMobile: result,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight
          }, '*')
        } catch (e) {
          console.error("Error posting message to parent:", e)
        }
      }
    }
    
    // 초기 체크
    checkIsMobile()
    
    // 리사이즈 이벤트에 대한 리스너 추가
    window.addEventListener("resize", checkIsMobile)
    
    // 부모 창으로부터 메시지 수신 핸들러
    const handleParentMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PARENT_WINDOW_SIZE') {
        console.log("Received parent window size:", event.data)
        
        // 부모가 전송한 모바일 상태 값 사용
        if (event.data.isMobile !== undefined) {
          setIsMobile(event.data.isMobile)
        }
      }
    }
    
    // 메시지 이벤트 리스너 추가
    window.addEventListener('message', handleParentMessage)
    
    return () => {
      window.removeEventListener("resize", checkIsMobile)
      window.removeEventListener('message', handleParentMessage)
    }
  }, [])

  return isMobile
}
