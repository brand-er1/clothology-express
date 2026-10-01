// 상세페이지 AI 이미지 운영 테스트: 얼굴 없음 · 의류 중심 · 로고/글자 없음 · 원본 디자인 유지
// (GitHub Actions: .github/workflows/prod-detail-image-faces.yml, 수동 실행)
//
// 운영 generate-detail-image 로 이미지 유형별(착용 컷은 여러 번) 실제 생성하고,
//  - 함수가 생성 직후 수행한 비전 검수 결과(qa: 얼굴/머리/사람 수/글자/로고/원본 일치)와
//  - 상표 검수 AI(screen-trademark-image)가 읽은 글자·로고형 영역(독립 2차 확인)
// 으로 판정한다. 결과 이미지는 artifact 로 올린다. 테스트 상세페이지와 업로드 이미지는 마지막에 삭제한다.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import crypto from "node:crypto";

const SUPABASE_URL = "https://jwmzjszdjlrqrhadbggr.supabase.co";
const ANON_KEY = fs.readFileSync(new URL("../../src/lib/supabase.ts", import.meta.url), "utf8").match(/supabaseAnonKey = '([^']+)'/)[1];
const SITE = process.env.E2E_SITE_URL || "https://brand-er1.github.io/clothology-express";
const OUT = process.env.E2E_SHOTS || "e2e-shots";
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

const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
  email: process.env.E2E_CREATOR_EMAIL ?? "",
  password: process.env.E2E_CREATOR_PASSWORD ?? "",
});
if (signInError) {
  console.log(`로그인 실패: ${signInError.message}`);
  process.exit(1);
}
const userId = signIn.session.user.id;

const invoke = async (name, body) => {
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) {
    const payload = error.context && typeof error.context.json === "function" ? await error.context.json().catch(() => null) : null;
    throw new Error(payload?.error || error.message);
  }
  return data;
};

const created = { pageIds: [], storagePaths: [] };

// 원본 디자인: 그래픽이 있는 앞/뒤 합성 이미지 대신 템플릿 후드(글자 없음)를 프로젝트 Storage 에 올려 사용
const template = await fetch(`${SITE}/clothing-templates/hoodie-black.png.png`);
const storagePath = `${userId}/e2e/${crypto.randomUUID()}.png`;
await client.storage.from("creator-assets").upload(storagePath, Buffer.from(await template.arrayBuffer()), { contentType: "image/png" });
created.storagePaths.push(storagePath);
const designUrl = client.storage.from("creator-assets").getPublicUrl(storagePath).data.publicUrl;

const { data: page, error: pageError } = await client
  .from("product_detail_pages")
  .insert({
    user_id: userId, template: "lookbook", title: "E2E 얼굴 정책 테스트", status: "draft",
    source: {
      imageUrl: designUrl, isFrontBackComposite: false, clothType: "후드티", material: "코튼 기모", color: "블랙", fit: "오버핏",
      designDescription: "무지 블랙 오버핏 후드티", sizeOptions: ["M", "L"], decorations: [], accessories: [], constructionFeatures: [], userProvided: {},
    },
  })
  .select("id")
  .single();
if (pageError) {
  console.log(`상세페이지 생성 실패: ${pageError.message}`);
  process.exit(1);
}
created.pageIds.push(page.id);

const inspectText = async (url) => {
  const data = await invoke("screen-trademark-image", { imageUrl: url, source: "final_design", selectedType: "후드티", selectedMaterial: "" });
  const screening = data?.screening ?? {};
  const texts = (screening.recognized_text ?? []).map(String).filter((text) => text.trim());
  const regions = (screening.candidate_regions ?? []).filter((region) => ["text", "symbol", "combined"].includes(region.candidateType) && Number(region.confidence ?? 0) >= 0.6);
  return { texts, regions };
};

const summary = { total: 0, faces: 0, retries: 0, worn: 0, people: 0 };
const PLAN = [
  ["lifestyle", 3], // 착용 컷(핏) — 여러 번
  ["editorial", 2], // 착용 룩북 컷
  ["hero", 2],
  ["mood", 1],
  ["product_front", 1],
  ["product_back", 1],
  ["detail", 1],
  ["fabric", 1],
  ["flat_lay", 1],
];
const WORN = new Set(["lifestyle", "editorial"]);

for (const [imageType, times] of PLAN) {
  for (let round = 1; round <= times; round += 1) {
    await step(`${imageType} #${round}`, async () => {
      const data = await invoke("generate-detail-image", { detailPageId: page.id, imageType, style: "lookbook" });
      summary.total += 1;
      if (data.attempts > 1) summary.retries += 1;
      const image = await fetch(data.url);
      fs.writeFileSync(`${OUT}/${imageType}-${round}.png`, Buffer.from(await image.arrayBuffer()));
      const qa = data.qa;
      expect(qa, "함수 비전 검수 결과 없음(검수 실패)");
      if (qa.faceVisible || qa.headVisible) summary.faces += 1;
      if (WORN.has(imageType)) summary.worn += 1;
      if (qa.personCount > 0) summary.people += 1;
      expect(!qa.faceVisible, "1 얼굴이 보임");
      expect(!qa.headVisible, "2 머리가 프레임 안에 있음");
      expect(qa.personCount <= (WORN.has(imageType) ? 1 : 0), `사람 수 ${qa.personCount} (허용 ${WORN.has(imageType) ? 1 : 0})`);
      expect(qa.garmentIsMainSubject, "4 의류가 주인공이 아님");
      expect(!qa.brandErVisible, "5 BRAND-ER 표기");
      expect(!qa.logoOrBrandMark && qa.visibleText.length === 0, `6 로고/글자: ${qa.visibleText.join(", ")}`);
      expect(qa.matchesReference, `7 원본 디자인과 다름: ${qa.designDifferences.join("; ")}`);
      const second = await inspectText(data.url);
      expect(second.texts.length === 0 && second.regions.length === 0, `6 (2차 확인) 글자[${second.texts.join(", ")}] 로고형영역 ${second.regions.length}`);
      return `사람 ${qa.personCount} · 얼굴 없음 · 생성 ${data.attempts}회${qa.designDifferences.length ? ` · 참고: ${qa.designDifferences.join("; ")}` : ""}`;
    });
  }
}

await step("정리: 테스트 상세페이지 · 업로드 이미지 삭제", async () => {
  for (const id of created.pageIds) {
    const { error } = await client.from("product_detail_pages").delete().eq("id", id);
    expect(!error, error?.message);
  }
  const { error } = await client.storage.from("creator-assets").remove(created.storagePaths);
  expect(!error, error?.message);
});

results.push(
  `SUMMARY 이미지 ${summary.total}장 · 얼굴/머리 노출 ${summary.faces}장 · 착용 컷 ${summary.worn}장 · 사람 포함 ${summary.people}장 · 얼굴 감지로 재구도 재생성 ${summary.retries}회`,
);
fs.writeFileSync(`${OUT}/results.txt`, results.join("\n") + "\n");
console.log("\n" + results.join("\n"));
process.exit(failed ? 1 : 0);
