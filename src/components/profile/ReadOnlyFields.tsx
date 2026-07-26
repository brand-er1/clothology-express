
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReadOnlyFieldsProps {
  email: string;
  fullName: string;
}

export const ReadOnlyFields = ({
  email,
  fullName,
}: ReadOnlyFieldsProps) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          value={email}
          readOnly
          className="h-12 rounded-xl bg-stone-100 text-stone-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">이름</Label>
        <Input
          id="fullName"
          name="fullName"
          value={fullName}
          readOnly
          className="h-12 rounded-xl bg-stone-100 text-stone-500"
        />
      </div>
    </>
  );
};
