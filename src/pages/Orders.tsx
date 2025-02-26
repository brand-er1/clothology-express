
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
        <h1 className="text-3xl font-bold text-center mb-8">
          {userInfo.userName ? `${userInfo.userName}님의 ` : ""}주문 내역
        </h1>
      </main>
    </div>
  );
};

export default Orders;
