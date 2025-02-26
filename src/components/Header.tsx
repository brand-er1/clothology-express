
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/lib/supabase";

export const Header = () => {
  const { isAdmin } = useAdmin();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

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
          </nav>
        </div>
      </div>
    </header>
  );
};
