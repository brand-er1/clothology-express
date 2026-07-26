
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EditableFieldsProps {
  username: string;
  brandName: string;
  phoneNumber: string;
  height: string;
  weight: string;
  gender: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenderChange: (value: string) => void;
}

export const EditableFields = ({
  username,
  brandName,
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
        <Label htmlFor="brandName">브랜드명</Label>
        <Input
          id="brandName"
          name="brandName"
          value={brandName}
          onChange={onChange}
          placeholder="고객에게 보여줄 브랜드 이름"
          className="h-12 rounded-xl bg-[#fbfaf8]"
        />
        <p className="text-xs leading-5 text-stone-500">브랜드를 운영하지 않는 경우 비워두셔도 됩니다.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">공개 닉네임</Label>
        <Input
          id="username"
          name="username"
          value={username}
          onChange={onChange}
          required
          placeholder="커뮤니티와 펀딩에서 사용할 이름"
          className="h-12 rounded-xl bg-[#fbfaf8]"
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
          className="h-12 rounded-xl bg-[#fbfaf8]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="gender">성별</Label>
        <Select value={gender} onValueChange={onGenderChange}>
          <SelectTrigger id="gender" className="h-12 rounded-xl bg-[#fbfaf8]">
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
          className="h-12 rounded-xl bg-[#fbfaf8]"
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
          className="h-12 rounded-xl bg-[#fbfaf8]"
        />
      </div>
    </>
  );
};
