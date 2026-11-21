import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAdminContext } from "@/components/admin/shell/AdminContext";
import { getLabSummary, type LabSummary } from "@/services/labAdmin";

/**
 * BRAND-ER LAB 신청 건수. lab.view 권한이 있을 때만 불러오고,
 * 관리자 화면을 이동할 때와 1분마다 새로 고쳐 처리한 건이 바로 빠지게 한다.
 */
export const useLabSummary = () => {
  const { can } = useAdminContext();
  const allowed = can("lab.view");
  const { pathname } = useLocation();
  const [summary, setSummary] = useState<LabSummary | null>(null);

  useEffect(() => {
    if (!allowed) { setSummary(null); return; }
    let active = true;
    const load = () => { getLabSummary().then((data) => { if (active) setSummary(data); }).catch(() => undefined); };
    load();
    const timer = window.setInterval(load, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [allowed, pathname]);

  return summary;
};
