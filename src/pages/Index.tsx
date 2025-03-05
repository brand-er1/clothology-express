import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { useAuth } from "@/providers/AuthProvider";
import { useProfileCheck } from "@/hooks/useProfileCheck";
import { ProfileInfoModal } from "@/components/auth/ProfileInfoModal";

const Index = () => {
  const { isAuthenticated } = useAuth();
  const { isProfileComplete, profileData, isLoading } = useProfileCheck();
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    // Show profile modal if authenticated user has incomplete profile
    if (!isLoading && isAuthenticated && !isProfileComplete) {
      setShowProfileModal(true);
    }
  }, [isLoading, isAuthenticated, isProfileComplete]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <h1 className="text-3xl font-bold mb-6">BRAND-ER 쇼핑몰</h1>
        <p className="text-lg mb-4">
          맞춤형 의류 제작 서비스에 오신 것을 환영합니다.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {/* 상품 카드 1 */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <img
              src="https://via.placeholder.com/300x200"
              alt="상품 이미지"
              className="w-full h-48 object-cover rounded-md mb-4"
            />
            <h2 className="text-xl font-semibold mb-2">상품명 1</h2>
            <p className="text-gray-600">상품 설명 1</p>
            <p className="text-brand font-bold mt-2">₩30,000</p>
          </div>

          {/* 상품 카드 2 */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <img
              src="https://via.placeholder.com/300x200"
              alt="상품 이미지"
              className="w-full h-48 object-cover rounded-md mb-4"
            />
            <h2 className="text-xl font-semibold mb-2">상품명 2</h2>
            <p className="text-gray-600">상품 설명 2</p>
            <p className="text-brand font-bold mt-2">₩45,000</p>
          </div>

          {/* 상품 카드 3 */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <img
              src="https://via.placeholder.com/300x200"
              alt="상품 이미지"
              className="w-full h-48 object-cover rounded-md mb-4"
            />
            <h2 className="text-xl font-semibold mb-2">상품명 3</h2>
            <p className="text-gray-600">상품 설명 3</p>
            <p className="text-brand font-bold mt-2">₩50,000</p>
          </div>
        </div>
      </main>
      
      {isAuthenticated && (
        <ProfileInfoModal 
          open={showProfileModal} 
          onOpenChange={setShowProfileModal}
          profileData={profileData}
        />
      )}
    </div>
  );
};

export default Index;
