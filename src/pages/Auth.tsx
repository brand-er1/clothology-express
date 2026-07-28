
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { useAuthForm } from "@/hooks/useAuthForm";
import { useAddressSearch } from "@/hooks/useAddressSearch";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import { getAppPath } from "@/utils/appUrl";

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
    handleAccountTypeChange,
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
  }, [formData.password, formData.confirmPassword, setPasswordMatch]);

  return (
    <div className="min-h-screen bg-[#f4f0ea]">
      <Header />
      <main className="mx-auto grid min-h-screen max-w-[1440px] gap-0 px-0 pt-16 sm:pt-[72px] lg:grid-cols-[0.9fr_1.1fr] lg:px-6 lg:pb-6">
        <section className="relative hidden overflow-hidden bg-[#201819] px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between lg:rounded-[2rem]">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand/40 blur-3xl" />
          <div className="relative">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-white/55">
              <Sparkles className="h-4 w-4 text-[#e4b5b0]" /> Brand launch workspace
            </p>
            <h1 className="mt-7 max-w-lg text-5xl font-semibold leading-[1.06] tracking-[-0.05em]">
              아이디어를 브랜드로,
              <br />첫 제품을 현실로.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/60">
              디자인 생성부터 자동 견적, 펀딩과 생산까지 한 계정에서 이어집니다.
            </p>
          </div>

          <div className="relative">
            <div className="mb-8 overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 p-3 backdrop-blur">
              <div className="flex items-center justify-between rounded-t-[1.25rem] bg-[#eee9e2] px-5 py-3 text-[10px] font-bold tracking-[0.16em] text-stone-500">
                <span>BRAND-ER AI STUDIO</span>
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <div className="h-52 bg-[#eee9e2] p-5">
                <img
                  src={getAppPath("/lovable-uploads/jacket.png")}
                  alt="브랜더 의류 디자인 예시"
                  className="h-full w-full object-contain drop-shadow-xl"
                />
              </div>
            </div>
            <div className="grid gap-3 text-sm text-white/70">
              {["브랜드명과 닉네임으로 나만의 프로필", "유명 상표 자동 검수와 안전한 제작", "MOQ 20장부터 시작하는 프리오더"].map((item) => (
                <p key={item} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
                    <Check className="h-3 w-3 text-[#e4b5b0]" />
                  </span>
                  {item}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-start justify-center px-3 py-8 sm:px-8 sm:py-10 lg:px-14 lg:py-16">
          <Card className={`w-full border-0 bg-white shadow-[0_24px_80px_rgba(36,26,24,0.09)] ${isSignUp ? "max-w-2xl" : "max-w-lg"} rounded-[2rem]`}>
            <CardHeader className="space-y-3 px-5 pb-4 pt-7 sm:px-10 sm:pt-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand sm:text-xs sm:tracking-[0.2em]">
                {isSignUp ? "Create your identity" : "Welcome back"}
              </p>
              <CardTitle className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                {isSignUp ? "나만의 브랜드를 시작하세요" : "브랜더에 로그인"}
              </CardTitle>
              <p className="text-[15px] leading-6 text-stone-500 sm:text-sm">
                {isSignUp
                  ? "브랜드명과 닉네임을 정하고 첫 디자인을 만들어보세요."
                  : "진행 중인 디자인과 펀딩을 이어서 관리하세요."}
              </p>
              <div className="rounded-xl bg-[#f8f5f1] px-4 py-3 text-[13px] leading-5 text-stone-500 sm:text-xs">
                BRAND-ER 쇼핑몰 계정과 별도로 가입해야 합니다.
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-7 sm:px-10 sm:pb-10">
              <form onSubmit={handleAuth} className="space-y-5">
              {isSignUp ? (
                <SignUpForm
                  formData={formData}
                  handleChange={handleChange}
                  handleGenderChange={handleGenderChange}
                  handleAccountTypeChange={handleAccountTypeChange}
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
                className="w-full text-stone-600 hover:text-brand"
                onClick={resetForm}
              >
                {isSignUp
                  ? "이미 계정이 있으신가요? 로그인하기"
                  : "계정이 없으신가요? 회원가입하기"}
              </Button>
              </form>
            
              {!isSignUp && (
                <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-xs font-medium text-stone-400">간편 로그인</span>
                  </div>
                </div>
                
                <div className="grid gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="h-12 rounded-full border-0 bg-[#FEE500] text-black hover:bg-[#FEE500]/90"
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
                    className="h-12 rounded-full border-stone-200 bg-white text-slate-700 hover:bg-stone-50"
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
        </section>
      </main>
    </div>
  );
};

export default Auth;
