import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { BrandMascot } from "@/components/BrandMascot";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f1f0ed] px-5 text-[#211b1c]">
      <div className="flex flex-col items-center text-center">
        <BrandMascot size={104} />
        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.24em] text-brand">404</p>
        <h1 className="mt-3 font-serif text-4xl font-normal tracking-[-0.03em] sm:text-5xl">
          찾으시는 페이지가<br />보이지 않아요.
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-7 text-stone-600 sm:text-base">
          주소가 바뀌었거나 존재하지 않는 페이지예요. 홈에서 다시 둘러봐 주세요.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex h-12 items-center justify-center gap-2 bg-brand px-7 text-sm font-bold text-white transition hover:bg-brand-dark"
        >
          <ArrowLeft className="h-4 w-4" /> 홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
