
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditableFieldsProps {
  username: string;
  height: string;
  weight: string;
  usualSize: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const EditableFields = ({
  username,
  height,
  weight,
  usualSize,
  onChange,
}: EditableFieldsProps) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="username">닉네임</Label>
        <Input
          id="username"
          name="username"
          value={username}
          onChange={onChange}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="height">키 (cm)</Label>
        <Input
          id="height"
          name="height"
          type="number"
          value={height}
          onChange={onChange}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="weight">몸무게 (kg)</Label>
        <Input
          id="weight"
          name="weight"
          type="number"
          value={weight}
          onChange={onChange}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="usualSize">평소 사이즈</Label>
        <Input
          id="usualSize"
          name="usualSize"
          value={usualSize}
          onChange={onChange}
          placeholder="예: M, 95 등"
        />
      </div>
    </>
  );
};
