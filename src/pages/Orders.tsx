
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { OrderList } from "@/components/orders/OrderList";
import { Button } from "@/components/ui/button";
import { fetchUserOrders, deleteOrder } from "@/services/orderHistory";
import { Order } from "@/types/order";
import { ShoppingBag, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const loadOrders = async () => {
    setLoading(true);
    const fetchedOrders = await fetchUserOrders();
    if (fetchedOrders) {
      setOrders(fetchedOrders);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleNewOrder = () => {
    navigate('/customize');
  };

  const handleDeleteOrder = async (orderId: string) => {
    const success = await deleteOrder(orderId);
    if (success) {
      // Refresh orders list after successful deletion
      loadOrders();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-20 md:pt-24 pb-12">
        <div className={`flex ${isMobile ? 'flex-col' : 'justify-between'} items-center mb-6 md:mb-8 gap-4`}>
          <h1 className="text-2xl md:text-3xl font-bold">내 주문 내역</h1>
          <Button 
            onClick={handleNewOrder}
            className={`bg-brand hover:bg-brand-dark ${isMobile ? 'w-full h-12 text-base' : ''}`}
          >
            <ShoppingBag className="mr-2 h-5 w-5" />
            새 주문 만들기
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <span className="ml-2 text-lg">주문 내역을 불러오는 중...</span>
          </div>
        ) : (
          <OrderList orders={orders} onDeleteOrder={handleDeleteOrder} />
        )}
      </main>
    </div>
  );
};

export default Orders;
