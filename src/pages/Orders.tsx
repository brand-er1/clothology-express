
import { Header } from "@/components/Header";
import { UserInfo } from "../App";

interface OrdersProps {
  userInfo: UserInfo;
}

const Orders = ({ userInfo }: OrdersProps) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-24">
        <h1 className="text-3xl font-bold text-center mb-8">My Orders</h1>
        <p className="text-center text-gray-600">
          Order management interface coming in the next update
        </p>
        {/* userInfo를 사용하여 필요한 기능 구현 */}
      </main>
    </div>
  );
};

export default Orders;
