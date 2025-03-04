
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeasonOption } from "@/lib/customize-constants";

interface SeasonSelectProps {
  selectedSeason: string;
  seasonOptions: SeasonOption[];
  onSeasonSelect: (value: string) => void;
}

export const SeasonSelect = ({ selectedSeason, seasonOptions, onSeasonSelect }: SeasonSelectProps) => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">계절</h3>
      <Select value={selectedSeason} onValueChange={onSeasonSelect}>
        <SelectTrigger>
          <SelectValue placeholder="계절 선택" />
        </SelectTrigger>
        <SelectContent>
          {seasonOptions.map((season) => (
            <SelectItem key={season.value} value={season.value}>
              {season.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
};
