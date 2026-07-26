
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormData } from "@/types/auth";
import { AddressFields } from "./AddressFields";
import { OptionalFields } from "./OptionalFields";
import { Check, ShoppingBag, Store } from "lucide-react";
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
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-semibold text-stone-900">어떻게 브랜더를 이용하시나요?</Label>
          <p className="mt-1 text-xs leading-5 text-stone-500">선택한 유형에 맞춰 첫 화면과 기능을 구성해드려요.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleAccountTypeChange("seller")}
            className={`relative rounded-2xl border p-4 text-left transition-all ${
              formData.accountType === "seller"
                ? "border-brand bg-[#fff9f7] shadow-[0_10px_35px_rgba(113,16,17,0.08)] ring-1 ring-brand"
                : "border-stone-200 bg-white hover:border-brand/40"
            }`}
          >
            {formData.accountType === "seller" && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                <Check className="h-3 w-3" />
              </span>
            )}
            <Store className="h-6 w-6 text-brand" />
            <p className="mt-4 font-bold">브랜드 메이커</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">디자인·견적·펀딩 시작</p>
          </button>
          <button
            type="button"
            onClick={() => handleAccountTypeChange("buyer")}
            className={`relative rounded-2xl border p-4 text-left transition-all ${
              formData.accountType === "buyer"
                ? "border-brand bg-[#fff9f7] shadow-[0_10px_35px_rgba(113,16,17,0.08)] ring-1 ring-brand"
                : "border-stone-200 bg-white hover:border-brand/40"
            }`}
          >
            {formData.accountType === "buyer" && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                <Check className="h-3 w-3" />
              </span>
            )}
            <ShoppingBag className="h-6 w-6 text-brand" />
            <p className="mt-4 font-bold">서포터</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">새로운 디자인 발견·참여</p>
          </button>
        </div>
      </div>
      {formData.accountType === "seller" && (
        <div className="space-y-2">
          <Label htmlFor="brandName">브랜드명</Label>
          <Input
            id="brandName"
            name="brandName"
            type="text"
            value={formData.brandName}
            onChange={handleChange}
            placeholder="예: BRAND-ER STUDIO"
            maxLength={40}
            required
            className="h-12 rounded-xl bg-[#fbfaf8]"
          />
          <p className="text-xs leading-5 text-stone-500">펀딩과 프로필에 표시할 이름이며, 상표권 보유 인증을 의미하지는 않습니다.</p>
        </div>
      )}
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
            placeholder="name@example.com"
            className="h-12 rounded-xl bg-[#fbfaf8]"
          />
          <Button
            type="button"
            onClick={checkEmail}
            className="h-12 whitespace-nowrap rounded-xl bg-stone-950 px-4 hover:bg-brand"
          >
            중복 확인
          </Button>
        </div>
        {isEmailAvailable !== null && (
          <p className={`flex items-center gap-1 text-xs ${isEmailAvailable ? "text-emerald-700" : "text-red-600"}`}>
            {isEmailAvailable && <Check className="h-3.5 w-3.5" />}
            {isEmailAvailable ? "사용 가능한 이메일입니다." : "다른 이메일을 입력해주세요."}
          </p>
        )}
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
          placeholder="6자 이상 입력"
          className="h-12 rounded-xl bg-[#fbfaf8]"
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
          placeholder="비밀번호 다시 입력"
          className={`h-12 rounded-xl bg-[#fbfaf8] ${!passwordMatch && formData.confirmPassword ? "border-red-500" : ""}`}
        />
        {!passwordMatch && formData.confirmPassword && (
          <p className="text-sm text-red-500">비밀번호가 일치하지 않습니다.</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">공개 닉네임</Label>
        <div className="flex gap-2">
          <Input
            id="username"
            name="username"
            type="text"
            value={formData.username}
            onChange={handleChange}
            required
            maxLength={20}
            placeholder="커뮤니티에서 사용할 이름"
            className="h-12 rounded-xl bg-[#fbfaf8]"
          />
          <Button
            type="button"
            onClick={checkUsername}
            className="h-12 whitespace-nowrap rounded-xl bg-stone-950 px-4 hover:bg-brand"
          >
            중복 확인
          </Button>
        </div>
        <p className="text-xs leading-5 text-stone-500">댓글과 펀딩 활동에 표시됩니다.</p>
        {isUsernameAvailable !== null && (
          <p className={`flex items-center gap-1 text-xs ${isUsernameAvailable ? "text-emerald-700" : "text-red-600"}`}>
            {isUsernameAvailable && <Check className="h-3.5 w-3.5" />}
            {isUsernameAvailable ? "사용 가능한 닉네임입니다." : "다른 닉네임을 입력해주세요."}
          </p>
        )}
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
          placeholder="실명 입력"
          className="h-12 rounded-xl bg-[#fbfaf8]"
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
          placeholder="010-0000-0000"
          className="h-12 rounded-xl bg-[#fbfaf8]"
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
      <Button type="submit" className="h-14 w-full rounded-full bg-brand text-base font-bold hover:bg-brand-dark" disabled={isLoading}>
        {isLoading ? "브랜더 계정 만드는 중..." : "브랜더 시작하기"}
      </Button>
    </>
  );
};
