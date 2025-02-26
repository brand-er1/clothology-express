
import { Header } from "@/components/Header";
import { UserInfo } from "../App";

interface CustomizeProps {
  userInfo: UserInfo;
}

const Customize = ({ userInfo }: CustomizeProps) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-24">
        <h1 className="text-3xl font-bold text-center mb-8">
          {userInfo.userName ? `${userInfo.userName}님의 ` : ""}커스터마이즈
        </h1>
      </main>
    </div>
  );
};

export default Customize;
