
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { ArrowRight } from "lucide-react";
import { WelcomeNotification } from "@/components/WelcomeNotification";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <WelcomeNotification />
      
      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative h-[90vh] flex items-center justify-center bg-gradient-to-b from-white to-gray-50">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 animate-fadeIn">
              맞춤형 의류, <span className="text-brand">당신을 위한 디자인</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto animate-fadeIn">
              직관적인 맞춤 도구로 완벽한 의상을 디자인하세요. 스타일과 소재를 선택하고 나만을 위한 맞춤 제작을 경험하세요.
            </p>
            <Link to="/customize">
              <Button
                size="lg"
                className="bg-brand hover:bg-brand-dark text-white rounded-full px-8 animate-slideUp"
              >
                디자인 시작하기 <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-brand"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">맞춤 디자인</h3>
                <p className="text-gray-600">
                  쉽게 사용할 수 있는 디자인 도구로 완벽한 의상을 만들어보세요
                </p>
              </div>

              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-brand"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">프리미엄 소재</h3>
                <p className="text-gray-600">
                  다양한 고품질 원단 중에서 선택하세요
                </p>
              </div>

              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-brand"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">완벽한 핏</h3>
                <p className="text-gray-600">
                  정확한 치수에 맞게 제작된 의류를 만나보세요
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
