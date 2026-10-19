// AI 이미지 브랜딩 정책 운영 테스트 (GitHub Actions: .github/workflows/prod-ai-image-branding.yml, 수동 실행)
//
// 실제 운영 Edge Function 으로 이미지를 만들고, 기존 상표 검수 AI(screen-trademark-image)가 읽어낸
// 이미지 속 글자(recognized_text)와 로고형 영역(candidate_regions)으로 "로고/글자 없음"을 판정한다.
// 결과 이미지는 artifact 로 올려 사람이 눈으로도 확인할 수 있게 한다.
// 테스트 펀딩/상세페이지는 마지막에 삭제한다(승인 요청을 하지 않는 draft 라 고객에게 노출되지 않음).
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const SUPABASE_URL = "https://jwmzjszdjlrqrhadbggr.supabase.co";
const ANON_KEY = fs.readFileSync(new URL("../../src/lib/supabase.ts", import.meta.url), "utf8").match(/supabaseAnonKey = '([^']+)'/)[1];
const OUT = process.env.E2E_SHOTS || "e2e-shots";
const EMAIL = process.env.E2E_CREATOR_EMAIL;
const PASSWORD = process.env.E2E_CREATOR_PASSWORD;
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let failed = false;
const step = async (name, fn) => {
  const started = Date.now();
  try {
    const note = await fn();
    results.push(`PASS  ${name}${note ? ` — ${note}` : ""} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  } catch (error) {
    failed = true;
    results.push(`FAIL  ${name} — ${String(error?.message ?? error).split("\n")[0]}`);
  }
  console.log(results.at(-1));
};
const expect = (cond, message) => {
  if (!cond) throw new Error(message);
};

if (!EMAIL || !PASSWORD) {
  console.log("E2E_CREATOR_EMAIL / E2E_CREATOR_PASSWORD 시크릿이 필요합니다.");
  process.exit(1);
}

const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (signInError) {
  console.log(`로그인 실패: ${signInError.message}`);
  process.exit(1);
}
const userId = signIn.session.user.id;
const { data: brand } = await client.from("brands").select("id, brand_name, brand_logo_url, status").eq("owner_user_id", userId).maybeSingle();

const invoke = async (name, body, who = client) => {
  const { data, error } = await who.functions.invoke(name, { body });
  if (error) {
    const context = error.context;
    const payload = context && typeof context.json === "function" ? await context.json().catch(() => null) : null;
    const wrapped = new Error(payload?.error || error.message);
    wrapped.status = context?.status;
    wrapped.payload = payload;
    throw wrapped;
  }
  return data;
};

const save = async (name, url) => {
  const response = await fetch(url);
  const type = response.headers.get("content-type") || "image/png";
  fs.writeFileSync(`${OUT}/${name}.${type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png"}`, Buffer.from(await response.arrayBuffer()));
};

/** 상표 검수 AI 로 이미지 속 글자/로고를 읽는다. */
const inspect = async (url, clothType) => {
  const data = await invoke("screen-trademark-image", { imageUrl: url, source: "final_design", selectedType: clothType, selectedMaterial: "" });
  const screening = data?.screening ?? {};
  const texts = (screening.recognized_text ?? []).map(String).filter((text) => text.trim());
  const regions = (screening.candidate_regions ?? []).filter(
    (region) => ["text", "symbol", "combined"].includes(region.candidateType) && Number(region.confidence ?? 0) >= 0.6,
  );
  return {
    id: screening.id,
    texts,
    regions,
    brandEr: texts.some((text) => /brand\s*-?\s*er|브랜더/i.test(text)),
    clean: texts.length === 0 && regions.length === 0,
    summary: `글자[${texts.join(", ") || "없음"}] 로고형영역 ${regions.length}개`,
  };
};

const generateDesign = async (prompt, brandLogo = "none") => {
  const data = await invoke("generate-optimized-image", { prompt, brandLogo });
  expect(data?.storedImageUrls?.[0] || data?.imageUrls?.[0], "이미지가 반환되지 않음");
  return data.storedImageUrls?.[0] ?? data.imageUrls[0];
};

const created = { fundingId: null, pageIds: [] };
const designs = {};

for (const [key, label, clothType, prompt] of [
  ["tee", "1 일반 반팔", "반팔 티셔츠", "면 반팔 티셔츠, 색상: 화이트, 핏: 레귤러핏, 계절감: 여름, 고해상도, 프로덕트 이미지"],
  ["hoodie", "2 후드", "후드티", "기모 후드티, 색상: 블랙, 핏: 오버핏, 포켓: 캥거루 포켓, 고해상도, 프로덕트 이미지"],
  ["jacket", "3 자켓", "자켓", "나일론 자켓, 스타일: 바시티, 색상: 카키, 핏: 세미오버핏, 고해상도, 프로덕트 이미지"],
]) {
  await step(`${label} 생성 → 앞/뒤 모두 로고·글자 없음 (4 앞/뒤 이미지 포함)`, async () => {
    const url = await generateDesign(prompt);
    designs[key] = { url, clothType };
    await save(`${key}-design`, url);
    const result = await inspect(url, clothType);
    designs[key].screeningId = result.id;
    expect(!result.brandEr, `BRAND-ER 표기 발견: ${result.summary}`);
    expect(result.clean, `로고/글자 발견: ${result.summary}`);
    return result.summary;
  });
}

await step("5 컬러 추가 → 새 컬러 이미지에도 로고·글자 없음", async () => {
  const base = designs.hoodie;
  expect(base?.url && base.screeningId, "후드 디자인이 없어 건너뜀");
  expect(brand?.id, "테스트 계정에 브랜드가 없음");
  const { data: funding, error } = await client
    .from("fundings")
    .insert({
      creator_id: userId, brand_id: brand.id, product_name: `E2E 브랜딩 테스트 ${Date.now()}`, cloth_type: "후드티", material: "기모",
      color: "블랙", size: "M", color_options: ["블랙"], size_options: ["M", "L"], measurements: null, image_url: base.url, image_path: null,
      trademark_screening_id: base.screeningId, trademark_screening_required: true, description: "운영 테스트", moq: 50, current_orders: 0,
      funding_days: 30, status: "draft", fabric_unit_cost: 0,
    })
    .select("id")
    .single();
  expect(!error, `테스트 펀딩 생성 실패: ${error?.message}`);
  created.fundingId = funding.id;
  const { error: colorError } = await client.rpc("save_funding_color", { p_funding_id: funding.id, p_color_id: null, p_name: "NAVY", p_hex: "#1F2A44" });
  expect(!colorError, `컬러 추가 실패: ${colorError?.message}`);
  const { data: colors } = await client.from("funding_colors").select("id, name").eq("funding_id", funding.id).eq("name", "NAVY");
  expect(colors?.length, "추가한 컬러를 찾지 못함");
  const generated = await invoke("generate-color-image", { colorId: colors[0].id, view: "front" });
  await save("color-navy-front", generated.url);
  const result = await inspect(generated.url, "후드티");
  expect(!result.brandEr, `BRAND-ER 표기 발견: ${result.summary}`);
  expect(result.clean, `로고/글자 발견: ${result.summary}`);
  return result.summary;
});

await step("6 상세페이지 AI 이미지(대표 이미지) → BRAND-ER 로고 없음", async () => {
  const base = designs.tee;
  expect(base?.url, "반팔 디자인이 없어 건너뜀");
  const { data: page, error } = await client
    .from("product_detail_pages")
    .insert({
      user_id: userId, template: "minimal", title: "E2E 브랜딩 테스트", status: "draft",
      source: { imageUrl: base.url, isFrontBackComposite: true, clothType: "반팔 티셔츠", material: "면", color: "화이트", fit: "레귤러핏", sizeOptions: ["M", "L"], decorations: [], accessories: [], constructionFeatures: [], userProvided: {} },
    })
    .select("id")
    .single();
  expect(!error, `상세페이지 생성 실패: ${error?.message}`);
  created.pageIds.push(page.id);
  const generated = await invoke("generate-detail-image", { detailPageId: page.id, imageType: "hero", style: "minimal" });
  await save("detail-hero", generated.url);
  const result = await inspect(generated.url, "반팔 티셔츠");
  expect(!result.brandEr, `BRAND-ER 표기 발견: ${result.summary}`);
  expect(result.clean, `로고/글자 발견: ${result.summary}`);
  return result.summary;
});

await step("7 기존 이미지 → AI 이미지 수정 → 로고 제거", async () => {
  // 사용자가 명시적으로 요청한 레터링 로고는 들어가야 하고(정책상 허용), 로고 제거 후에는 없어야 한다.
  const url = await generateDesign("면 반팔 티셔츠, 색상: 화이트, 추가 설명: 가슴 중앙에 크고 굵은 'SEOUL CLUB' 레터링 로고 프린트, 고해상도, 프로덕트 이미지");
  await save("logo-before", url);
  const before = await inspect(url, "반팔 티셔츠");
  expect(before.texts.length > 0 || before.regions.length > 0, `사전 조건 실패: 요청한 로고가 생성되지 않음 (${before.summary})`);
  const edited = await invoke("edit-ai-image", { imageUrl: url, preset: "remove_logo", aspectRatio: "4:3" });
  await save("logo-after-remove", edited.url);
  const after = await inspect(edited.url, "반팔 티셔츠");
  expect(!after.texts.some((text) => /seoul|club/i.test(text)), `로고 글자가 남음: ${after.summary}`);
  expect(after.clean, `로고/글자 남음: ${after.summary}`);
  return `전 ${before.summary} → 후 ${after.summary}`;
});

await step("8 내 브랜드 로고 적용 → 제작자 브랜드 로고만 (BRAND-ER 없음)", async () => {
  if (!brand?.brand_logo_url) {
    try {
      await generateDesign("면 반팔 티셔츠, 색상: 화이트, 고해상도, 프로덕트 이미지", "creator");
      throw new Error("로고 미등록인데 생성이 허용됨");
    } catch (error) {
      expect(error.payload?.code === "brand_logo_missing", `예상과 다른 오류: ${error.message}`);
      return "테스트 브랜드에 로고가 없어 서버가 '로고 등록 필요'로 거부함(정상). 로고 등록 후 다시 실행하면 적용 결과를 확인함";
    }
  }
  const url = await generateDesign("면 반팔 티셔츠, 색상: 화이트, 고해상도, 프로덕트 이미지", "creator");
  await save("creator-logo", url);
  const result = await inspect(url, "반팔 티셔츠");
  // 제작자 본인 브랜드명이 BRAND-ER 인 테스트 계정이면 그 로고가 곧 "내 브랜드 로고"이므로 허용한다.
  const ownBrandIsPlatformName = /brand\s*-?\s*er/i.test(brand.brand_name ?? "");
  expect(ownBrandIsPlatformName || !result.brandEr, `BRAND-ER 표기 발견: ${result.summary}`);
  expect(result.texts.length > 0 || result.regions.length > 0, `내 브랜드 로고가 적용되지 않음: ${result.summary}`);
  return `${brand.brand_name}: ${result.summary}${ownBrandIsPlatformName ? " (테스트 계정 브랜드명이 BRAND-ER 라 해당 로고가 정상 적용됨)" : ""}`;
});

await step("보안: 비로그인 AI 이미지 수정 거부 / 외부 URL 거부", async () => {
  try {
    await invoke("edit-ai-image", { imageUrl: designs.tee?.url ?? "https://example.com/a.png", preset: "remove_logo" }, anon);
    throw new Error("비로그인 호출이 허용됨");
  } catch (error) {
    expect(error.status === 401, `비로그인 응답 ${error.status}: ${error.message}`);
  }
  try {
    await invoke("edit-ai-image", { imageUrl: "https://example.com/a.png", preset: "remove_logo" });
    throw new Error("외부 URL 이 허용됨");
  } catch (error) {
    expect(error.status === 400, `외부 URL 응답 ${error.status}: ${error.message}`);
  }
});

await step("정리: 테스트 펀딩·상세페이지 삭제", async () => {
  const notes = [];
  if (created.fundingId) {
    const { error } = await client.functions.invoke("delete-funding", { body: { fundingId: created.fundingId, reason: "운영 E2E 테스트 데이터 정리" } });
    notes.push(error ? `펀딩 삭제 실패: ${error.message}` : "펀딩 삭제");
  }
  for (const id of created.pageIds) {
    const { error } = await client.from("product_detail_pages").delete().eq("id", id);
    notes.push(error ? `페이지 삭제 실패: ${error.message}` : "페이지 삭제");
  }
  expect(!notes.some((note) => note.includes("실패")), notes.join(", "));
  return notes.join(", ") || "정리할 데이터 없음";
});

fs.writeFileSync(`${OUT}/results.txt`, results.join("\n") + "\n");
console.log("\n" + results.join("\n"));
process.exit(failed ? 1 : 0);
