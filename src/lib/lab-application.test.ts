import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLabCsv, type LabExportRow } from "./lab-export";
import { hasPermission, ROLE_PERMISSIONS } from "./admin/permissions";
import { LAB_CONSENT_DOCUMENTS, LAB_CONSENT_VERSION, labStatusStages, validateLabApplication } from "../../supabase/functions/_shared/labApplication";

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
  purpose: "brand_launch",
  future_production: "yes",
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

  it("includes review / selection / production stages, purpose and future production intent", () => {
    expect(header).toContain("검토 상태,선정 여부,제작 진행 상태");
    expect(line).toContain("선정,검토 완료,선정,제작 대기");
    expect(line).toContain("브랜드 창업 준비");
    expect(line).toContain("추가 생산 의향 있음");
  });

  it("leaves optional legacy fields blank instead of printing null", () => {
    const legacy = buildLabCsv([{ ...row, instagram_id: null, size: null, size_other: null, purpose: null, future_production: null }]);
    expect(legacy).not.toContain("null");
  });

  it("keeps multi-line descriptions inside one quoted cell", () => {
    expect(csv).toContain('"검은색 후드티, ""큰"" 그래픽\n앞면 자수"');
  });
});

describe("BRAND-ER LAB form rules (v2)", () => {
  const base = {
    applicantName: "홍길동", phone: "010-1234-5678", email: "a@b.co", instagramId: "", garmentTypes: ["hoodie"], garmentTypeOther: "",
    designDescription: "검은색 오버핏 후드티에 등판 그래픽", size: "", sizeOther: "", purpose: "personal", reason: "", futureProduction: "",
  };

  it("requires email and purpose, keeps instagram / size / future production optional", () => {
    expect(validateLabApplication(base).ok).toBe(true);
    const missing = validateLabApplication({ ...base, email: "", purpose: "" });
    expect(missing.ok).toBe(false);
    expect(Object.keys(missing.errors).sort()).toEqual(["email", "purpose"]);
  });

  it("maps a single status onto review / selection / production views", () => {
    expect(labStatusStages("received")).toEqual({ review: "미검토", selection: "대기", production: "-" });
    expect(labStatusStages("not_selected")).toEqual({ review: "검토 완료", selection: "미선정", production: "-" });
    expect(labStatusStages("in_production")).toEqual({ review: "검토 완료", selection: "선정", production: "제작 진행 중" });
  });
});

describe("phone helpers", () => {
  it("accepts Korean mobile numbers and formats them", async () => {
    const { normalizeMobilePhone, formatMobilePhone, isPhoneMissing } = await import("@/utils/phone");
    expect(normalizeMobilePhone("010 1234 5678")).toBe("01012345678");
    expect(normalizeMobilePhone("02-123-4567")).toBeNull();
    expect(formatMobilePhone("01012345678")).toBe("010-1234-5678");
    expect(isPhoneMissing("")).toBe(true);
    expect(isPhoneMissing(null)).toBe(true);
    expect(isPhoneMissing("010-1234-5678")).toBe(false);
  });
});
