
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface AddressFieldsProps {
  postcode: string;
  address: string;
  addressDetail: string;
  onAddressSearch: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const AddressFields = ({
  postcode,
  address,
  addressDetail,
  onAddressSearch,
  onChange,
}: AddressFieldsProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="address">주소</Label>
      <div className="flex gap-2">
        <Input
          id="postcode"
          name="postcode"
          value={postcode}
          placeholder="우편번호"
          readOnly
          required
          className="h-12 rounded-xl bg-stone-100"
        />
        <Button
          type="button"
          onClick={onAddressSearch}
          className="h-12 whitespace-nowrap rounded-xl bg-stone-950 px-4 hover:bg-brand"
        >
          주소 검색
        </Button>
      </div>
      <Input
        id="address"
        name="address"
        value={address}
        placeholder="기본주소"
        readOnly
        required
        className="h-12 rounded-xl bg-stone-100"
      />
      <Input
        id="addressDetail"
        name="addressDetail"
        value={addressDetail}
        onChange={onChange}
        placeholder="상세주소를 입력해주세요"
        className="h-12 rounded-xl bg-[#fbfaf8]"
      />
    </div>
  );
};
