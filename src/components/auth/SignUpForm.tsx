
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { AuthFormData } from "@/types/auth";

interface SignUpFormProps {
  formData: AuthFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  isIdAvailable: boolean | null;
  isCheckingId: boolean;
  passwordMatch: boolean;
  handleAddressSearch: () => void;
  checkUserId: () => Promise<void>;
}

export const SignUpForm = ({
  formData,
  handleChange,
  isLoading,
  isIdAvailable,
  isCheckingId,
  passwordMatch,
  handleAddressSearch,
  checkUserId,
}: SignUpFormProps) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="userId">아이디</Label>
        <div className="flex gap-2">
          <Input
            id="userId"
            name="userId"
            type="text"
            value={formData.userId}
            onChange={handleChange}
            required
          />
          <Button
            type="button"
            onClick={checkUserId}
            disabled={isCheckingId}
            className="whitespace-nowrap"
          >
            {isCheckingId ? "확인 중..." : "중복 확인"}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          name="email"
          type="email"
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
        <Input
          id="username"
          name="username"
          type="text"
          value={formData.username}
          onChange={handleChange}
          required
        />
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
      <OptionalFields formData={formData} handleChange={handleChange} />
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "처리 중..." : "회원가입"}
      </Button>
    </>
  );
};
