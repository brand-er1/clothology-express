
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { useAuthForm } from "@/hooks/useAuthForm";
import { useAddressSearch } from "@/hooks/useAddressSearch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

const Auth = () => {
  const {
    isLoading,
    isSignUp,
    passwordMatch,
    isCheckingId,
    isIdAvailable,
    isEmailAvailable,
    formData,
    handleChange,
    handleGenderChange,
    checkUserId,
    checkEmail,
    handleAuth,
    resetForm,
    setPasswordMatch
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
                  isIdAvailable={isIdAvailable}
                  isCheckingId={isCheckingId}
                  passwordMatch={passwordMatch}
                  handleAddressSearch={handleAddressSearch}
                  checkUserId={checkUserId}
                  checkEmail={checkEmail}
                  isEmailAvailable={isEmailAvailable}
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
