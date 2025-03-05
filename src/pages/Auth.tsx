
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { useAuthForm } from "@/hooks/useAuthForm";
import { useAddressSearch } from "@/hooks/useAddressSearch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Info } from "lucide-react";

const Auth = () => {
  const {
    isLoading,
    isSignUp,
    passwordMatch,
    isEmailAvailable,
    isUsernameAvailable,
    formData,
    handleChange,
    handleGenderChange,
    checkEmail,
    checkUsername,
    handleAuth,
    resetForm,
    setPasswordMatch,
    handleSocialLogin
  } = useAuthForm();

  const handleAddressSearch = useAddressSearch((data) => {
    handleChange({
      target: {
        name: 'postcode',
        value: data.zonecode
      }
    } as React.ChangeEvent<HTMLInputElement>);
    
    handleChange({
      target: {
        name: 'address',
        value: data.address
      }
    } as React.ChangeEvent<HTMLInputElement>);
  });

  useEffect(() => {
    if (formData.password || formData.confirmPassword) {
      setPasswordMatch(formData.password === formData.confirmPassword);
    }
  }, [formData.password, formData.confirmPassword]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>{isSignUp ? "회원가입" : "로그인"}</CardTitle>
            <CardDescription>
              {isSignUp
                ? "새로운 계정을 만들어주세요"
                : "기존 계정으로 로그인하세요"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4 bg-brand/10 border-brand/20">
              <Info className="h-4 w-4 text-brand" />
              <AlertDescription className="text-sm">
                의류 맞춤 제작을 위해서는 BRAND-ER 쇼핑몰과 별개로 회원가입이 필요합니다.
              </AlertDescription>
            </Alert>
            <form onSubmit={handleAuth} className="space-y-4">
              {isSignUp ? (
                <SignUpForm
                  formData={formData}
                  handleChange={handleChange}
                  handleGenderChange={handleGenderChange}
                  isLoading={isLoading}
                  passwordMatch={passwordMatch}
                  handleAddressSearch={handleAddressSearch}
                  checkEmail={checkEmail}
                  isEmailAvailable={isEmailAvailable}
                  isUsernameAvailable={isUsernameAvailable}
                  checkUsername={checkUsername}
                />
              ) : (
                <LoginForm
                  formData={formData}
                  handleChange={handleChange}
                  isLoading={isLoading}
                />
              )}
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={resetForm}
              >
                {isSignUp
                  ? "이미 계정이 있으신가요? 로그인하기"
                  : "계정이 없으신가요? 회원가입하기"}
              </Button>
            </form>
            
            {!isSignUp && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-2 text-sm text-muted-foreground">소셜 로그인</span>
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="bg-[#FEE500] text-black hover:bg-[#FEE500]/90"
                    onClick={() => handleSocialLogin('kakao')}
                    disabled={isLoading}
                  >
                    <svg 
                      className="w-5 h-5 mr-2" 
                      viewBox="0 0 24 24" 
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.84 5.16 4.56 6.48-.16.48-.36 1.68-.4 2.16-.08.52.2.52.48.36.2-.12 2.72-1.88 3.84-2.64.48.08.96.12 1.52.12 5.52 0 10-3.48 10-7.8S17.52 3 12 3z" />
                    </svg>
                    카카오로 시작하기
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
