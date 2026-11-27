import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAdminContext } from "@/components/admin/shell/AdminContext";
import {
  getProductionRequestSummary, PRODUCTION_SUMMARY_REFRESH_EVENT, type ProductionRequestSummary,
} from "@/services/productionRequestAdmin";

/**
 * '제작 의뢰' 메뉴의 미확인 접수 건수. orders.view 권한이 있을 때만 불러오고,
 * 화면 이동 · 1분마다 · 상세를 열거나 상태를 바꿀 때 다시 센다.
 */
export const useProductionRequestSummary = () => {
  const { can } = useAdminContext();
  const allowed = can("orders.view");
  const { pathname } = useLocation();
  const [summary, setSummary] = useState<ProductionRequestSummary | null>(null);

  useEffect(() => {
    if (!allowed) { setSummary(null); return; }
    let active = true;
    const load = () => { getProductionRequestSummary().then((data) => { if (active) setSummary(data); }).catch(() => undefined); };
    load();
    const timer = window.setInterval(load, 60_000);
    window.addEventListener(PRODUCTION_SUMMARY_REFRESH_EVENT, load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener(PRODUCTION_SUMMARY_REFRESH_EVENT, load); };
  }, [allowed, pathname]);

  return summary;
};
