
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReadOnlyFieldsProps {
  userId: string;
  email: string;
  fullName: string;
  phoneNumber: string;
}

export const ReadOnlyFields = ({
  userId,
  email,
  fullName,
  phoneNumber,
}: ReadOnlyFieldsProps) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="userId">아이디</Label>
        <Input
          id="userId"
          value={userId}
          readOnly
          className="bg-gray-100"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          value={email}
          readOnly
          className="bg-gray-100"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">이름</Label>
        <Input
          id="fullName"
          name="fullName"
          value={fullName}
          readOnly
          className="bg-gray-100"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">전화번호</Label>
        <Input
          id="phoneNumber"
          name="phoneNumber"
          value={phoneNumber}
          readOnly
          className="bg-gray-100"
        />
      </div>
    </>
  );
};
