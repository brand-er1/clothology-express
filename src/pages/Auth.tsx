
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
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    onClick={() => handleSocialLogin('google')}
                    disabled={isLoading}
                  >
                    <svg 
                      className="w-5 h-5 mr-2" 
                      viewBox="0 0 24 24" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google로 시작하기
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
