
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransparencyOption } from "@/lib/customize-constants";

interface TransparencySelectProps {
  selectedTransparency: string;
  transparencyOptions: TransparencyOption[];
  onTransparencySelect: (value: string) => void;
}

export const TransparencySelect = ({ selectedTransparency, transparencyOptions, onTransparencySelect }: TransparencySelectProps) => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">비침</h3>
      <Select value={selectedTransparency} onValueChange={onTransparencySelect}>
        <SelectTrigger>
          <SelectValue placeholder="비침 선택" />
        </SelectTrigger>
        <SelectContent>
          {transparencyOptions.map((transparency) => (
            <SelectItem key={transparency.value} value={transparency.value}>
              {transparency.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
};
