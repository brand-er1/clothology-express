
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const Header = () => {
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const isMobile = useIsMobile();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  useEffect(() => {
    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
    });

    // 초기 인증 상태 확인
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(!!data.session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const renderMenuItems = () => (
    <>
      {isAuthenticated ? (
        <>
          <Link to="/customize">
            <Button variant="ghost">맞춤 주문</Button>
          </Link>
          <Link to="/orders">
            <Button variant="ghost">주문 내역</Button>
          </Link>
          {isAdmin && (
            <Link to="/admin">
              <Button variant="ghost">관리자</Button>
            </Link>
          )}
          <Link to="/profile">
            <Button variant="ghost">마이페이지</Button>
          </Link>
          <Button variant="ghost" onClick={handleSignOut}>
            로그아웃
          </Button>
        </>
      ) : (
        <Link to="/auth">
          <Button variant="ghost">로그인</Button>
        </Link>
      )}
    </>
  );

  const renderMobileMenu = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="메뉴">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[250px] sm:w-[300px]">
        <div className="flex flex-col gap-4 py-4">
          {isAuthenticated ? (
            <>
              <Link to="/customize" className="w-full">
                <Button variant="ghost" className="w-full justify-start">맞춤 주문</Button>
              </Link>
              <Link to="/orders" className="w-full">
                <Button variant="ghost" className="w-full justify-start">주문 내역</Button>
              </Link>
              {isAdmin && (
                <Link to="/admin" className="w-full">
                  <Button variant="ghost" className="w-full justify-start">관리자</Button>
                </Link>
              )}
              <Link to="/profile" className="w-full">
                <Button variant="ghost" className="w-full justify-start">마이페이지</Button>
              </Link>
              <Button variant="ghost" onClick={handleSignOut} className="w-full justify-start">
                로그아웃
              </Button>
            </>
          ) : (
            <Link to="/auth" className="w-full">
              <Button variant="ghost" className="w-full justify-start">로그인</Button>
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold">
            <img 
              src="/lovable-uploads/40adfb8c-d6e9-4e33-899e-0e9db51c50f1.png" 
              alt="BRAND-ER Logo"
              className="h-8"
            />
          </Link>
          <nav className="flex items-center gap-4">
            {isMobile ? renderMobileMenu() : renderMenuItems()}
          </nav>
        </div>
      </div>
    </header>
  );
};
