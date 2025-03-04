
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ElasticityOption } from "@/lib/customize-constants";

interface ElasticitySelectProps {
  selectedElasticity: string;
  elasticityOptions: ElasticityOption[];
  onElasticitySelect: (value: string) => void;
}

export const ElasticitySelect = ({ selectedElasticity, elasticityOptions, onElasticitySelect }: ElasticitySelectProps) => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">신축성</h3>
      <Select value={selectedElasticity} onValueChange={onElasticitySelect}>
        <SelectTrigger>
          <SelectValue placeholder="신축성 선택" />
        </SelectTrigger>
        <SelectContent>
          {elasticityOptions.map((elasticity) => (
            <SelectItem key={elasticity.value} value={elasticity.value}>
              {elasticity.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
};
