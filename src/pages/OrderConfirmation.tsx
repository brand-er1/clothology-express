
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const OrderConfirmation = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <Card className="max-w-3xl mx-auto p-8 shadow-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">주문이 완료되었습니다</h1>
            <div className="w-24 h-1 bg-brand mx-auto mb-6" />
            
            <div className="text-lg text-gray-700 space-y-4 mb-8">
              <p>고객님의 주문이 성공적으로 접수되었습니다.</p>
              <p>담당 관리자가 주문 내용을 확인 후 <span className="font-semibold">하루~이틀 내로</span> 연락드릴 예정입니다.</p>
              <p>가격은 상담 후 최종 협의됩니다.</p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 mb-8">
              <h2 className="text-xl font-semibold mb-4">다음 절차</h2>
              <ol className="text-left space-y-3">
                <li className="flex gap-3">
                  <div className="bg-brand text-white rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0">1</div>
                  <p>관리자가 주문 내용을 검토합니다.</p>
                </li>
                <li className="flex gap-3">
                  <div className="bg-brand text-white rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0">2</div>
                  <p>등록된 전화번호나 카카오톡으로 연락드립니다.</p>
                </li>
                <li className="flex gap-3">
                  <div className="bg-brand text-white rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0">3</div>
                  <p>상담 후 디자인 및 가격을 최종 협의합니다.</p>
                </li>
              </ol>
            </div>
          </div>
          
          <div className="flex justify-center">
            <Button 
              onClick={() => navigate('/orders')}
              className="bg-brand hover:bg-brand-dark"
            >
              내 주문 확인하기
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default OrderConfirmation;
