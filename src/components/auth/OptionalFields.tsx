
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormData } from "@/types/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OptionalFieldsProps {
  formData: AuthFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleGenderChange: (value: string) => void;
}

export const OptionalFields = ({ formData, handleChange, handleGenderChange }: OptionalFieldsProps) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="height">키 (cm)</Label>
        <Input
          id="height"
          name="height"
          type="number"
          value={formData.height}
          onChange={handleChange}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="weight">몸무게 (kg)</Label>
        <Input
          id="weight"
          name="weight"
          type="number"
          value={formData.weight}
          onChange={handleChange}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gender">성별</Label>
        <Select value={formData.gender} onValueChange={handleGenderChange}>
          <SelectTrigger id="gender">
            <SelectValue placeholder="성별을 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="남성">남성</SelectItem>
            <SelectItem value="여성">여성</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
};
