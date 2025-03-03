
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FitOption } from "@/lib/customize-constants";

interface FitSelectProps {
  selectedFit: string;
  fitOptions: FitOption[];
  onFitSelect: (value: string) => void;
}

export const FitSelect = ({ selectedFit, fitOptions, onFitSelect }: FitSelectProps) => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">핏</h3>
      <Select value={selectedFit} onValueChange={onFitSelect}>
        <SelectTrigger>
          <SelectValue placeholder="핏 선택" />
        </SelectTrigger>
        <SelectContent>
          {fitOptions.map((fit) => (
            <SelectItem key={fit.value} value={fit.value}>
              {fit.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
};
