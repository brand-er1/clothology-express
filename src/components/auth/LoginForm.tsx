
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
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="이메일 주소"
          value={formData.email}
          onChange={handleChange}
          required
          className="h-12 rounded-xl bg-[#fbfaf8]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="비밀번호"
          value={formData.password}
          onChange={handleChange}
          required
          className="h-12 rounded-xl bg-[#fbfaf8]"
        />
      </div>
      <Button type="submit" className="h-14 w-full rounded-full bg-brand text-base font-bold hover:bg-brand-dark" disabled={isLoading}>
        {isLoading ? "로그인 중..." : "브랜더 시작하기"}
      </Button>
    </>
  );
};
