import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

const NOTICE_STORAGE_KEY = "brander_visit_notice_seen";

export const VisitDataNotice = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem(NOTICE_STORAGE_KEY) !== "1");
  }, []);

  if (!visible) return null;

  const close = () => {
    localStorage.setItem(NOTICE_STORAGE_KEY, "1");
    setVisible(false);
  };

  return (
    <aside
      data-mascot-safezone
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-2xl backdrop-blur sm:bottom-5 sm:flex sm:items-center sm:gap-4 sm:px-5"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-stone-900">방문정보 수집 안내</p>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          서비스 개선과 고객 문의 연결을 위해 방문 페이지·유입경로·기기·서비스 이용기록을 수집합니다. IP주소는 별도로 저장하지 않습니다.
        </p>
      </div>
      <div className="mt-3 flex items-center gap-2 sm:mt-0">
        <Link to="/visit-data-policy" className="rounded-full px-3 py-2 text-xs font-bold text-brand hover:bg-brand/5">
          자세히 보기
        </Link>
        <button type="button" onClick={close} className="rounded-full bg-stone-950 px-4 py-2 text-xs font-bold text-white hover:bg-brand">
          확인
        </button>
        <button type="button" onClick={close} className="rounded-full p-2 text-stone-400 hover:bg-stone-100" aria-label="안내 닫기">
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
};

