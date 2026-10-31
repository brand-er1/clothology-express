// AI 상세 컷 · 디테일 컷 운영 테스트 (GitHub Actions: .github/workflows/prod-product-shots.yml, 수동 실행)
//
// 실제 운영 Edge Function 으로 의류 디자인을 하나 만들고(generate-optimized-image → save_design), 그 디자인을 원본 참조
// 이미지로 상세 컷(기본 상품 촬영 세트 5장) · 사용자 지정 영역 디테일 컷 · 다시 생성을 실제 AI API 로 생성한다.
// 원본에 없는 부자재 컷 거부, 비로그인 · 외부 URL 거부, 본인만 조회(RLS), 원본-추가 이미지 연결 · 비용 기록을 확인하고
// 결과 이미지는 artifact 로 올려 사람이 원본과 같은 디자인인지 눈으로도 확인할 수 있게 한다.
// 마지막에 테스트로 만든 컷 기록은 삭제한다(디자인 행은 비공개 · 목록 미노출이며 사용자가 지울 수 없어 남는다).
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
  expect(response.ok, `이미지 다운로드 실패 ${response.status}: ${url}`);
  const type = response.headers.get("content-type") || "image/png";
  expect(type.startsWith("image/"), `이미지가 아님: ${type}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  expect(bytes.length > 10_000, `이미지가 너무 작음(${bytes.length}B)`);
  fs.writeFileSync(`${OUT}/${name}.${type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png"}`, bytes);
  return bytes.length;
};

const created = { shotIds: new Set() };
const ctx = { designId: null, sourceUrl: null, analysis: null, shots: {} };

const checkShot = (shot, type) => {
  expect(shot?.id, "컷 기록이 반환되지 않음");
  created.shotIds.add(shot.id);
  expect(shot.status === "succeeded", `상태 ${shot.status}: ${shot.error_message ?? ""}`);
  expect(shot.shot_type === type, `컷 유형 불일치 ${shot.shot_type}`);
  expect(shot.design_id === ctx.designId, "원본 디자인 연결(design_id) 누락");
  expect(shot.source_image_url === ctx.sourceUrl, "원본 이미지 URL 연결 누락");
  expect(/^https:\/\/.+\/storage\/v1\/object\/public\/generated_images\/shots\//.test(shot.image_url ?? ""), `결과 URL 이 Storage 가 아님: ${shot.image_url}`);
  expect(shot.api_calls >= 2, `AI 호출 수 기록 누락(${shot.api_calls})`);
  expect(Number(shot.estimated_cost_usd) > 0, "예상 비용 기록 누락");
  expect(typeof shot.prompt === "undefined" || shot.prompt === null || shot.prompt.includes("DESIGN LOCK"), "프롬프트에 디자인 고정 규칙 없음");
};

await step("원본 의류 디자인 생성 + 디자인 저장", async () => {
  const data = await invoke("generate-optimized-image", {
    prompt: "기모 면 후드티, 색상: 버건디, 핏: 오버핏, 포켓: 캥거루 포켓, 추가 설명: 왼쪽 가슴에 작은 흰색 나뭇잎 모양 자수 엠블럼(글자 없음), 소매와 밑단 시보리, 고해상도, 프로덕트 이미지",
    brandLogo: "none",
  });
  ctx.sourceUrl = data?.storedImageUrls?.[0];
  expect(ctx.sourceUrl, "원본 이미지 URL 없음");
  await save("00-original", ctx.sourceUrl);
  const { data: designId, error } = await client.rpc("save_design", {
    p_front_image_url: ctx.sourceUrl,
    p_image_path: data.imagePaths?.[0] ?? null,
    p_product_type: "hoodie",
    p_color: "burgundy",
    p_fabric: "brushed-cotton",
    p_fit: "oversized",
    p_prompt: data.optimizedPrompt ?? null,
    p_detail: "E2E 상세 컷 테스트",
    p_source: "customize",
  });
  expect(!error && designId, `save_design 실패: ${error?.message}`);
  ctx.designId = designId;
  return `design ${designId}`;
});

await step("권한: 비로그인 · 외부 URL · 남의 컷 접근 거부", async () => {
  try {
    await invoke("generate-product-shot", { action: "generate", sourceImageUrl: ctx.sourceUrl, shotType: "front" }, anon);
    throw new Error("비로그인 호출이 허용됨");
  } catch (error) {
    expect(error.status === 401, `비로그인 응답 ${error.status}: ${error.message}`);
  }
  try {
    await invoke("generate-product-shot", { action: "generate", sourceImageUrl: "https://example.com/a.png", shotType: "front" });
    throw new Error("외부 URL 이 허용됨");
  } catch (error) {
    expect(error.status === 400, `외부 URL 응답 ${error.status}: ${error.message}`);
  }
  try {
    await invoke("generate-product-shot", { action: "generate", shotId: "00000000-0000-4000-8000-000000000000" });
    throw new Error("없는 컷 재생성이 허용됨");
  } catch (error) {
    expect(error.status === 404, `없는 컷 응답 ${error.status}: ${error.message}`);
  }
});

await step("원본 디자인 분석(보이는 디자인 요소)", async () => {
  const data = await invoke("generate-product-shot", { action: "analyze", designId: ctx.designId, sourceImageUrl: ctx.sourceUrl });
  ctx.analysis = data.analysis;
  expect(ctx.analysis?.elements, "분석 결과 없음");
  fs.writeFileSync(`${OUT}/analysis.json`, JSON.stringify(ctx.analysis, null, 2));
  const present = Object.entries(ctx.analysis.elements).filter(([, value]) => value.present).map(([key]) => key);
  const again = await invoke("generate-product-shot", { action: "analyze", designId: ctx.designId, sourceImageUrl: ctx.sourceUrl });
  expect(again.cached === true, "두 번째 분석이 캐시를 쓰지 않음");
  return `layout=${ctx.analysis.layout} back=${ctx.analysis.backVisible} present=[${present.join(", ")}] main=${ctx.analysis.mainDesignDetail?.kind}`;
});

const generate = async (shotType, extra = {}) => {
  const data = await invoke("generate-product-shot", { action: "generate", designId: ctx.designId, sourceImageUrl: ctx.sourceUrl, shotType, ...extra });
  return data.shot;
};

// 기본 상품 촬영 세트(정면 · 후면 · 측면 · 원단 · 로고/주요 디자인 디테일). 화면과 같이 2장씩 동시에.
const basicSet = ["front", "back", "side", "fabric", ctx.analysis?.mainDesignDetail?.present ? "design_detail" : "stitching"];
const batchId = crypto.randomUUID();
for (let index = 0; index < basicSet.length; index += 2) {
  await Promise.all(
    basicSet.slice(index, index + 2).map((type) =>
      step(`상세 컷 생성: ${type}`, async () => {
        let shot;
        try {
          shot = await generate(type, { batchId });
        } catch (error) {
          // 응답 시간 초과(게이트웨이)면 한 번 다시(화면의 "실패한 컷 다시 시도"와 같은 동작)
          if (error.payload?.shot?.id) created.shotIds.add(error.payload.shot.id);
          if (!error.payload?.timedOut && error.status !== 546 && error.status !== 504) throw error;
          shot = error.payload?.shot?.id ? (await invoke("generate-product-shot", { action: "generate", shotId: error.payload.shot.id })).shot : await generate(type, { batchId });
        }
        checkShot(shot, type);
        ctx.shots[type] = shot;
        const size = await save(`${String(basicSet.indexOf(type) + 1).padStart(2, "0")}-${type}`, shot.image_url);
        const qa = shot.qa ? `qa.match=${shot.qa.matchesReference}${shot.qa.designDifferences?.length ? ` diff=${shot.qa.designDifferences.join("/")}` : ""}` : "qa=none";
        return `${shot.model} · ${(size / 1024).toFixed(0)}KB · calls=${shot.api_calls} · $${Number(shot.estimated_cost_usd).toFixed(3)} · inferred=${shot.is_inferred} · ${qa}`;
      }),
    ),
  );
}

await step("원본에 없는 부자재 컷은 만들지 않음", async () => {
  const missing = Object.entries(ctx.analysis?.elements ?? {}).find(([key, value]) => !value.present && ["closure", "print", "pocket", "embroidery"].includes(key));
  if (!missing) return "분석상 모든 부자재가 있어 건너뜀";
  const type = missing[0];
  try {
    const shot = await generate(type);
    created.shotIds.add(shot?.id);
    throw new Error(`${type} 컷이 생성됨`);
  } catch (error) {
    expect(error.status === 422 && error.payload?.code === "element_missing", `응답 ${error.status}: ${error.message}`);
  }
  return `${type} → 422 element_missing`;
});

await step("사용자 지정 영역 디테일 컷(가슴 로고 부분)", async () => {
  const box = ctx.analysis?.mainDesignDetail?.box ?? ctx.analysis?.elements?.logo?.box;
  const region = box
    ? { x: box[1] / 1000, y: box[0] / 1000, width: (box[3] - box[1]) / 1000, height: (box[2] - box[0]) / 1000 }
    : { x: 0.12, y: 0.25, width: 0.18, height: 0.18 };
  const shot = await generate("custom_region", { region, note: "가슴 자수 엠블럼 실 질감" });
  checkShot(shot, "custom_region");
  expect(shot.region && Math.abs(shot.region.x - region.x) < 0.01, "선택 영역이 저장되지 않음");
  await save("10-custom-region", shot.image_url);
  return `region=${JSON.stringify(region)} · qa.match=${shot.qa?.matchesReference}`;
});

await step("선택한 컷만 다시 생성(정면)", async () => {
  const front = ctx.shots.front;
  expect(front, "정면 컷이 없어 건너뜀");
  const { shot } = await invoke("generate-product-shot", { action: "generate", shotId: front.id });
  checkShot(shot, "front");
  expect(shot.id === front.id, "다시 생성이 새 행을 만듦");
  expect(shot.attempt_count === front.attempt_count + 1, `attempt_count ${front.attempt_count} → ${shot.attempt_count}`);
  expect(shot.previous_image_urls.includes(front.image_url), "이전 결과 URL 이 보관되지 않음");
  expect(shot.image_url !== front.image_url, "새 이미지가 저장되지 않음");
  await save("11-front-regenerated", shot.image_url);
  return `attempts=${shot.attempt_count} · 누적 calls=${shot.api_calls} · 누적 $${Number(shot.estimated_cost_usd).toFixed(3)}`;
});

await step("저장 · 조회: 원본 디자인별 목록, 본인만 조회, 옷장 저장 표시, 한도 조회", async () => {
  const { data: rows, error } = await client.from("design_shots").select("id, shot_type, status, design_id").eq("design_id", ctx.designId);
  expect(!error, error?.message);
  expect(rows.length >= Object.keys(ctx.shots).length, `목록 ${rows.length}건`);
  const { data: anonRows } = await anon.from("design_shots").select("id").eq("design_id", ctx.designId);
  expect(!anonRows?.length, "비로그인 사용자가 컷 기록을 조회함");
  const target = rows[0].id;
  const { error: savedError } = await client.from("design_shots").update({ saved_to_closet_at: new Date().toISOString() }).eq("id", target);
  expect(!savedError, `옷장 저장 표시 실패: ${savedError?.message}`);
  const { error: forbidden } = await client.from("design_shots").update({ image_url: "https://example.com/x.png" }).eq("id", target);
  expect(forbidden, "사용자가 결과 URL 을 바꿀 수 있음");
  const { data: quota, error: quotaError } = await client.rpc("get_my_product_shot_quota");
  expect(!quotaError && quota?.limit > 0, `한도 조회 실패: ${quotaError?.message}`);
  return `${rows.length}건 · 오늘 ${quota.used}/${quota.limit}`;
});

await step("정리: 테스트 컷 기록 삭제", async () => {
  const ids = [...created.shotIds].filter(Boolean);
  if (!ids.length) return "정리할 데이터 없음";
  const { error } = await client.from("design_shots").delete().in("id", ids);
  expect(!error, error?.message);
  return `${ids.length}건 삭제`;
});

fs.writeFileSync(`${OUT}/results.txt`, results.join("\n") + "\n");
console.log("\n" + results.join("\n"));
process.exit(failed ? 1 : 0);
