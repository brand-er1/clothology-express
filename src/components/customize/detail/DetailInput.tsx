
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

interface DetailInputProps {
  detailInput: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export const DetailInput = ({ detailInput, onChange }: DetailInputProps) => {
  const isMobile = useIsMobile();
  
  return (
    <Card className="p-4 md:p-6">
      <div className="space-y-3 md:space-y-4">
        <div className="space-y-2">
          <p className="text-xs md:text-sm text-gray-500">
            추가적인 디테일을 더 입력하세요. 아래 옵션들을 선택하거나 직접 입력할 수 있습니다.
          </p>
          <textarea
            value={detailInput}
            onChange={onChange}
            placeholder="추가 디테일을 자유롭게 입력해주세요"
            className="w-full h-20 md:h-32 p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-brand/20 text-sm md:text-base"
            style={{ 
              fontSize: '16px', // iOS에서 확대 방지를 위해 16px 이상으로 설정
              lineHeight: '1.5',
              WebkitAppearance: 'none', // 모바일 브라우저의 기본 스타일 제거
              borderRadius: '8px' 
            }}
          />
        </div>
      </div>
    </Card>
  );
};
