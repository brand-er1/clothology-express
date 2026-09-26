import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasPermission, ROLE_PERMISSIONS, type AdminRole } from "./permissions";
import { ADMIN_NAV } from "@/components/admin/shell/navigation";

// 서버 권한 매트릭스(public.admin_role_permissions)와 프런트 메뉴용 매트릭스가 어긋나지 않게 고정한다.
// 가장 마지막으로 admin_role_permissions 를 정의한 마이그레이션이 운영 기준이다.
const migrationsDir = resolve(__dirname, "../../../supabase/migrations");
const sql = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(resolve(migrationsDir, file), "utf8"))
  .filter((content) => content.includes("function public.admin_role_permissions"))
  .pop()!;

const sqlPermissions = (role: AdminRole) => {
  const match = sql.match(new RegExp(`when '${role}' then array\\[([\\s\\S]*?)\\]`));
  if (!match) throw new Error(`role ${role} not found in SQL`);
  return Array.from(match[1].matchAll(/'([a-z_.]+)'/g), (m) => m[1]).sort();
};

const visibleMenus = (role: AdminRole) =>
  ADMIN_NAV.flatMap((g) => g.items).filter((item) => item.anyOf.some((p) => hasPermission(ROLE_PERMISSIONS[role], p))).map((i) => i.label);

describe("admin RBAC matrix", () => {
  it.each(["super_admin", "operations_admin", "cs_admin"] as AdminRole[])("%s matches SQL", (role) => {
    expect([...ROLE_PERMISSIONS[role]].sort()).toEqual(sqlPermissions(role));
  });

  it("CS admin sees member/order/CS menus but not admin management or settings", () => {
    const menus = visibleMenus("cs_admin");
    expect(menus).toEqual(expect.arrayContaining(["회원 관리", "주문 관리", "배송 관리", "환불 관리", "콘텐츠/신고"]));
    expect(menus).not.toContain("관리자 관리");
    expect(menus).not.toContain("시스템 설정");
    expect(menus).not.toContain("결제 관리");
    expect(menus).not.toContain("정산 관리");
  });

  it("Operations admin manages fundings/production/orders but not super-admin settings", () => {
    const menus = visibleMenus("operations_admin");
    expect(menus).toEqual(expect.arrayContaining(["펀딩 관리", "제작 관리", "주문 관리", "배송 관리"]));
    for (const hidden of ["관리자 관리", "시스템 설정", "Audit Log", "결제 관리", "정산 관리", "AI 사용량"]) expect(menus).not.toContain(hidden);
  });

  it("Super admin sees every menu", () => {
    expect(visibleMenus("super_admin")).toHaveLength(ADMIN_NAV.flatMap((g) => g.items).length);
  });

  it("unknown role has no permissions", () => {
    expect(hasPermission(undefined, "dashboard.view")).toBe(false);
  });
});
