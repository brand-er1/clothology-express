
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StyleOption } from "@/lib/customize-constants";
import { useIsMobile } from "@/hooks/use-mobile";

interface StyleSelectProps {
  selectedStyle: string;
  styleOptions: StyleOption[];
  onStyleSelect: (value: string) => void;
}

export const StyleSelect = ({ selectedStyle, styleOptions, onStyleSelect }: StyleSelectProps) => {
  const isMobile = useIsMobile();
  
  return (
    <Card className="p-4 md:p-6">
      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">스타일</h3>
      <Select value={selectedStyle} onValueChange={onStyleSelect}>
        <SelectTrigger className={`text-sm md:text-base ${isMobile ? 'h-12' : ''}`}>
          <SelectValue placeholder="스타일 선택" />
        </SelectTrigger>
        <SelectContent>
          {styleOptions.map((style) => (
            <SelectItem 
              key={style.value} 
              value={style.value} 
              className={`text-sm md:text-base ${isMobile ? 'h-10 py-2' : ''}`}
            >
              {style.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
};
