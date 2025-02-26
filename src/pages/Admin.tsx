
import { Header } from "@/components/Header";
import { UserInfo } from "../App";

interface AdminProps {
  userInfo: UserInfo;
}

const Admin = ({ userInfo }: AdminProps) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-24">
        <h1 className="text-3xl font-bold text-center mb-8">관리자 페이지</h1>
      </main>
    </div>
  );
};

export default Admin;
