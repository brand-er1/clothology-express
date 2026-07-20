
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormData } from "@/types/auth";
import { AddressFields } from "./AddressFields";
import { OptionalFields } from "./OptionalFields";
import { ShoppingBag, Store } from "lucide-react";
import type { AccountType } from "@/utils/accountRouting";

interface SignUpFormProps {
  formData: AuthFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  passwordMatch: boolean;
  handleAddressSearch: () => void;
  checkEmail: () => Promise<void>;
  isEmailAvailable: boolean | null;
  isUsernameAvailable: boolean | null;
  checkUsername: () => Promise<void>;
  handleGenderChange: (value: string) => void;
  handleAccountTypeChange: (value: AccountType) => void;
}

export const SignUpForm = ({
  formData,
  handleChange,
  isLoading,
  passwordMatch,
  handleAddressSearch,
  checkEmail,
  isEmailAvailable,
  isUsernameAvailable,
  checkUsername,
  handleGenderChange,
  handleAccountTypeChange,
}: SignUpFormProps) => {
  return (
    <>
      <div className="space-y-3">
        <div>
          <Label>회원 유형</Label>
          <p className="mt-1 text-xs text-gray-500">가입 후 이용할 서비스를 선택해주세요.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleAccountTypeChange("seller")}
            className={`rounded-xl border p-4 text-left transition-all ${
              formData.accountType === "seller"
                ? "border-brand bg-brand/5 ring-2 ring-brand/20"
                : "border-gray-200 hover:border-brand/40"
            }`}
          >
            <Store className="h-6 w-6 text-brand" />
            <p className="mt-3 font-bold">판매자</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">AI 디자인·펀딩 만들기</p>
          </button>
          <button
            type="button"
            onClick={() => handleAccountTypeChange("buyer")}
            className={`rounded-xl border p-4 text-left transition-all ${
              formData.accountType === "buyer"
                ? "border-brand bg-brand/5 ring-2 ring-brand/20"
                : "border-gray-200 hover:border-brand/40"
            }`}
          >
            <ShoppingBag className="h-6 w-6 text-brand" />
            <p className="mt-3 font-bold">구매자</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">펀딩 둘러보기·참여</p>
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <div className="flex gap-2">
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <Button
            type="button"
            onClick={checkEmail}
            className="whitespace-nowrap"
          >
            중복 확인
          </Button>
        </div>
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
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">비밀번호 확인</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
          className={!passwordMatch && formData.confirmPassword ? "border-red-500" : ""}
        />
        {!passwordMatch && formData.confirmPassword && (
          <p className="text-sm text-red-500">비밀번호가 일치하지 않습니다.</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">닉네임</Label>
        <div className="flex gap-2">
          <Input
            id="username"
            name="username"
            type="text"
            value={formData.username}
            onChange={handleChange}
            required
          />
          <Button
            type="button"
            onClick={checkUsername}
            className="whitespace-nowrap"
          >
            중복 확인
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="fullName">이름</Label>
        <Input
          id="fullName"
          name="fullName"
          type="text"
          value={formData.fullName}
          onChange={handleChange}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phoneNumber">전화번호</Label>
        <Input
          id="phoneNumber"
          name="phoneNumber"
          type="tel"
          value={formData.phoneNumber}
          onChange={handleChange}
          required
        />
      </div>
      <AddressFields
        formData={formData}
        handleChange={handleChange}
        handleAddressSearch={handleAddressSearch}
      />
      {formData.accountType === "seller" && (
        <OptionalFields
          formData={formData}
          handleChange={handleChange}
          handleGenderChange={handleGenderChange}
        />
      )}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "처리 중..." : "회원가입"}
      </Button>
    </>
  );
};
