import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLabCsv, type LabExportRow } from "./lab-export";
import { hasPermission, ROLE_PERMISSIONS } from "./admin/permissions";
import { LAB_CONSENT_DOCUMENTS, LAB_CONSENT_VERSION } from "../../supabase/functions/_shared/labApplication";

// 화면에 보이는 동의 문구와 DB(lab_consent_documents)에 저장되는 문구가 같아야 동의 이력이 유효하다.
const migrationsDir = resolve(__dirname, "../../supabase/migrations");
const consentSql = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(resolve(migrationsDir, file), "utf8"))
  .filter((content) => content.includes("insert into public.lab_consent_documents"))
  .join("\n");

describe("BRAND-ER LAB consent documents", () => {
  it.each(LAB_CONSENT_DOCUMENTS.map((doc) => [doc.key, doc] as const))("%s text and version are seeded in a migration", (_key, doc) => {
    const row = `('${doc.key}', '${doc.version}', '${doc.title}',\n   '${doc.body}',\n   ${doc.required}, true)`;
    expect(consentSql).toContain(row);
  });

  it("all documents share the current version and only marketing is optional", () => {
    expect(new Set(LAB_CONSENT_DOCUMENTS.map((doc) => doc.version))).toEqual(new Set([LAB_CONSENT_VERSION]));
    expect(LAB_CONSENT_DOCUMENTS.filter((doc) => !doc.required).map((doc) => doc.key)).toEqual(["marketing"]);
  });
});

describe("BRAND-ER LAB admin permissions", () => {
  it("CS can view but not manage; operations and super can manage", () => {
    expect(hasPermission(ROLE_PERMISSIONS.cs_admin, "lab.view")).toBe(true);
    expect(hasPermission(ROLE_PERMISSIONS.cs_admin, "lab.manage")).toBe(false);
    expect(hasPermission(ROLE_PERMISSIONS.operations_admin, "lab.manage")).toBe(true);
    expect(hasPermission(ROLE_PERMISSIONS.super_admin, "lab.manage")).toBe(true);
  });
});

const row: LabExportRow = {
  application_no: "LAB-261121-00001",
  created_at: "2026-11-21T01:00:00Z",
  status: "selected",
  applicant_name: "=HYPERLINK(\"evil\")",
  phone: "01012345678",
  email: null,
  instagram_id: "gil.dong",
  garment_types: ["hoodie", "other"],
  garment_type_other: "조끼",
  size: "OTHER",
  size_other: "상의 XL",
  design_description: "검은색 후드티, \"큰\" 그래픽\n앞면 자수",
  reason: null,
  image_count: 2,
  admin_memo: "-메모",
  retention_until: "2027-11-21T01:00:00Z",
  consents: {
    participation: { agreed: true, at: "2026-11-21T01:00:00Z", version: "v1", action: "initial" },
    filming: { agreed: true, at: "2026-11-21T01:00:00Z", version: "v1", action: "initial" },
    privacy: { agreed: true, at: "2026-11-21T01:00:00Z", version: "v1", action: "initial" },
    marketing: { agreed: false, at: "2026-11-22T01:00:00Z", version: "v1", action: "withdraw" },
  },
};

describe("buildLabCsv", () => {
  const csv = buildLabCsv([row]);
  const [header, line] = csv.replace(/^\uFEFF/, "").split("\r\n");

  it("starts with a BOM so Excel reads Korean correctly", () => {
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(header.split(",")[0]).toBe("접수번호");
  });

  it("formats values for people and neutralizes spreadsheet formulas", () => {
    expect(line).toContain("LAB-261121-00001,2026-11-21 10:00,선정,");
    expect(line).toContain(`"'=HYPERLINK(""evil"")"`);
    expect(line).toContain("010-1234-5678");
    expect(line).toContain("\"후드티, 기타(조끼)\"");
    expect(line).toContain("기타(상의 XL)");
    expect(line).toContain("'-메모");
    expect(line).toContain("철회 2026-11-22 10:00");
  });

  it("keeps multi-line descriptions inside one quoted cell", () => {
    expect(csv).toContain('"검은색 후드티, ""큰"" 그래픽\n앞면 자수"');
  });
});
