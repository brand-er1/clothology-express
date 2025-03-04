
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThicknessOption } from "@/lib/customize-constants";

interface ThicknessSelectProps {
  selectedThickness: string;
  thicknessOptions: ThicknessOption[];
  onThicknessSelect: (value: string) => void;
}

export const ThicknessSelect = ({ selectedThickness, thicknessOptions, onThicknessSelect }: ThicknessSelectProps) => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">두께</h3>
      <Select value={selectedThickness} onValueChange={onThicknessSelect}>
        <SelectTrigger>
          <SelectValue placeholder="두께 선택" />
        </SelectTrigger>
        <SelectContent>
          {thicknessOptions.map((thickness) => (
            <SelectItem key={thickness.value} value={thickness.value}>
              {thickness.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
};
