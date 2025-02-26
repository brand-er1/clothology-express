
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthFormData } from "@/types/auth";

interface AddressFieldsProps {
  formData: AuthFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAddressSearch: () => void;
}

export const AddressFields = ({
  formData,
  handleChange,
  handleAddressSearch,
}: AddressFieldsProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="address">주소</Label>
      <div className="flex gap-2">
        <Input
          id="postcode"
          name="postcode"
          type="text"
          value={formData.postcode}
          placeholder="우편번호"
          readOnly
          required
        />
        <Button
          type="button"
          onClick={handleAddressSearch}
          className="whitespace-nowrap"
        >
          주소 검색
        </Button>
      </div>
      <Input
        id="address"
        name="address"
        type="text"
        value={formData.address}
        placeholder="기본주소"
        readOnly
        required
      />
      <Input
        id="addressDetail"
        name="addressDetail"
        type="text"
        value={formData.addressDetail}
        onChange={handleChange}
        placeholder="상세주소를 입력해주세요"
      />
    </div>
  );
};
