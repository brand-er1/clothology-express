
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PocketOption } from "@/lib/customize-constants";

interface PocketSelectProps {
  selectedPocket: string;
  pocketOptions: PocketOption[];
  onPocketSelect: (value: string) => void;
}

export const PocketSelect = ({ selectedPocket, pocketOptions, onPocketSelect }: PocketSelectProps) => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">포켓</h3>
      <Select value={selectedPocket} onValueChange={onPocketSelect}>
        <SelectTrigger>
          <SelectValue placeholder="포켓 선택" />
        </SelectTrigger>
        <SelectContent>
          {pocketOptions.map((pocket) => (
            <SelectItem key={pocket.value} value={pocket.value}>
              {pocket.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
};
