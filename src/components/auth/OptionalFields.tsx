
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormData } from "@/types/auth";

interface OptionalFieldsProps {
  formData: AuthFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const OptionalFields = ({ formData, handleChange }: OptionalFieldsProps) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="height">키 (cm, 선택사항)</Label>
        <Input
          id="height"
          name="height"
          type="number"
          value={formData.height}
          onChange={handleChange}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="weight">몸무게 (kg, 선택사항)</Label>
        <Input
          id="weight"
          name="weight"
          type="number"
          value={formData.weight}
          onChange={handleChange}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="usualSize">평소 사이즈 (선택사항)</Label>
        <Input
          id="usualSize"
          name="usualSize"
          type="text"
          value={formData.usualSize}
          onChange={handleChange}
          placeholder="예: M, 95 등"
        />
      </div>
    </>
  );
};
