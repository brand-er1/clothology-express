
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthFormData } from "@/types/auth";

interface LoginFormProps {
  formData: AuthFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
}

export const LoginForm = ({ formData, handleChange, isLoading }: LoginFormProps) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="email">아이디 또는 이메일</Label>
        <Input
          id="email"
          name="email"
          type="text"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "처리 중..." : "로그인"}
      </Button>
    </>
  );
};
