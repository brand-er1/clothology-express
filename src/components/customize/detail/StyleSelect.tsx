
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StyleOption } from "@/lib/customize-constants";

interface StyleSelectProps {
  selectedStyle: string;
  styleOptions: StyleOption[];
  onStyleSelect: (value: string) => void;
}

export const StyleSelect = ({ selectedStyle, styleOptions, onStyleSelect }: StyleSelectProps) => {
  return (
    <Card className="p-4 md:p-6">
      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">스타일</h3>
      <Select value={selectedStyle} onValueChange={onStyleSelect}>
        <SelectTrigger className="text-sm md:text-base">
          <SelectValue placeholder="스타일 선택" />
        </SelectTrigger>
        <SelectContent>
          {styleOptions.map((style) => (
            <SelectItem key={style.value} value={style.value} className="text-sm md:text-base">
              {style.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
};
