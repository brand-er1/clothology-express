
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, ShoppingBag, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { useAdmin } from "@/hooks/useAdmin";

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    // 초기 사용자 상태 확인
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/");
      toast({
        title: "로그아웃 성공",
        description: "다음에 또 만나요!",
      });
    } catch (error: any) {
      toast({
        title: "오류 발생",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <img
              src="/lovable-uploads/5304023e-d41c-43be-b7de-127153b5afc9.png"
              alt="Brand-er Logo"
              className="h-8"
            />
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            {user && (
              <>
                <Link
                  to="/customize"
                  className="text-gray-700 hover:text-brand transition-colors"
                >
                  Customize
                </Link>
                <Link
                  to="/orders"
                  className="text-gray-700 hover:text-brand transition-colors"
                >
                  My Orders
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="text-gray-700 hover:text-brand transition-colors"
                  >
                    Admin
                  </Link>
                )}
              </>
            )}
          </nav>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Button variant="ghost" size="icon" className="hidden md:flex">
                  <ShoppingBag className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="hidden md:flex"
                >
                  로그아웃
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                className="hidden md:flex"
                onClick={() => navigate("/auth")}
              >
                로그인
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-white z-40 animate-fadeIn">
          <nav className="container mx-auto px-4 py-8 flex flex-col space-y-4">
            {user ? (
              <>
                <Link
                  to="/customize"
                  className="text-lg text-gray-700 hover:text-brand transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Customize
                </Link>
                <Link
                  to="/orders"
                  className="text-lg text-gray-700 hover:text-brand transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  My Orders
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="text-lg text-gray-700 hover:text-brand transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Admin
                  </Link>
                )}
                <Button
                  variant="ghost"
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                >
                  로그아웃
                </Button>
              </>
            ) : (
              <Link
                to="/auth"
                className="text-lg text-gray-700 hover:text-brand transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                로그인
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};
