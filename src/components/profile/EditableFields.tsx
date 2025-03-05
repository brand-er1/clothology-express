
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EditableFieldsProps {
  username: string;
  phoneNumber: string;
  height: string;
  weight: string;
  gender: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenderChange: (value: string) => void;
}

export const EditableFields = ({
  username,
  phoneNumber,
  height,
  weight,
  gender,
  onChange,
  onGenderChange,
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
        <Label htmlFor="phoneNumber">전화번호</Label>
        <Input
          id="phoneNumber"
          name="phoneNumber"
          value={phoneNumber}
          onChange={onChange}
          placeholder="전화번호를 입력하세요"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="gender">성별</Label>
        <Select value={gender} onValueChange={onGenderChange}>
          <SelectTrigger id="gender">
            <SelectValue placeholder="성별을 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="남성">남성</SelectItem>
            <SelectItem value="여성">여성</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="height">키 (cm)</Label>
        <Input
          id="height"
          name="height"
          type="number"
          value={height}
          onChange={onChange}
          required
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
          required
        />
      </div>
    </>
  );
};
