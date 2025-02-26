
import { useEffect } from "react";
import { toast } from "@/components/ui/use-toast";

declare global {
  interface Window {
    daum: any;
  }
}

export const useAddressSearch = (onComplete: (data: any) => void) => {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const handleAddressSearch = () => {
    if (window.daum) {
      new window.daum.Postcode({
        oncomplete: onComplete,
      }).open();
    } else {
      toast({
        title: "오류 발생",
        description: "주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  return handleAddressSearch;
};
