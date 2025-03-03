
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorOption } from "@/lib/customize-constants";

interface ColorSelectProps {
  selectedColor: string;
  colorOptions: ColorOption[];
  onColorSelect: (value: string) => void;
}

export const ColorSelect = ({ selectedColor, colorOptions, onColorSelect }: ColorSelectProps) => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">색상</h3>
      <Select value={selectedColor} onValueChange={onColorSelect}>
        <SelectTrigger>
          <SelectValue placeholder="색상 선택" />
        </SelectTrigger>
        <SelectContent>
          {colorOptions.map((color) => (
            <SelectItem key={color.value} value={color.value}>
              <div className="flex items-center space-x-2">
                <div 
                  className="w-4 h-4 rounded-full border border-gray-200"
                  style={{ backgroundColor: color.hex }}
                />
                <span>{color.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
};
