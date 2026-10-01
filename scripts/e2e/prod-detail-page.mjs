// AI 상세페이지 운영 E2E (GitHub Actions 에서 실행: .github/workflows/prod-detail-page-e2e.yml)
//
// Part A — 계정 없이: 공개 anon 키로 운영 Supabase 의 서버 차단(RLS · RPC 권한 · 마이그레이션 적용 여부)을 확인한다.
// Part B — E2E_CREATOR_EMAIL / E2E_CREATOR_PASSWORD 시크릿이 있을 때만: 운영 사이트에서 실제 AI(Gemini)로
//          생성 → 수정 → 부분 재작성 → 저장 → 새로고침 → 미리보기 → 펀딩 시작(=등록) → 반영 → 재수정을 돌리고,
//          만든 테스트 펀딩/상세페이지는 마지막에 삭제한다. 테스트 펀딩은 승인 요청을 하지 않아(draft) 고객에게 노출되지 않는다.
//
// 비밀번호 · 토큰은 코드에 넣지 않는다. anon 키는 프론트엔드에 이미 공개된 값이다(src/lib/supabase.ts).
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import fs from "node:fs";
import crypto from "node:crypto";

const SUPABASE_URL = "https://jwmzjszdjlrqrhadbggr.supabase.co";
const ANON_KEY = fs.readFileSync(new URL("../../src/lib/supabase.ts", import.meta.url), "utf8").match(/supabaseAnonKey = '([^']+)'/)[1];
const SITE = process.env.E2E_SITE_URL || "https://brand-er1.github.io/clothology-express";
const SHOTS = process.env.E2E_SHOTS || "e2e-shots";
const EMAIL = process.env.E2E_CREATOR_EMAIL;
const PASSWORD = process.env.E2E_CREATOR_PASSWORD;
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
let failed = false;
/** 실패 시 현재 화면 스크린샷 + 화면 토스트/오류 문구를 남긴다(Part B 에서 설정). */
let onFailure = async () => "";
let failureCount = 0;
const step = async (name, fn) => {
  const started = Date.now();
  try {
    const note = await fn();
    results.push(`PASS  ${name}${note ? ` — ${note}` : ""} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch (error) {
    failed = true;
    failureCount += 1;
    const context = await onFailure(`fail-${String(failureCount).padStart(2, "0")}`).catch(() => "");
    results.push(`FAIL  ${name} — ${String(error?.message ?? error).split("\n")[0]}${context ? ` | 화면: ${context}` : ""}`);
  }
  console.log(results.at(-1));
};
const expect = (cond, message) => {
  if (!cond) throw new Error(message);
};
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const randomId = () => crypto.randomUUID();

/* ───────────────────────── Part A: 비로그인 서버 차단 ───────────────────────── */

await step("A1 비로그인: 상세페이지 초안 테이블 조회 0건", async () => {
  const { data, error } = await anon.from("product_detail_pages").select("id, title, published_document").limit(5);
  expect(!error, error?.message);
  expect(data.length === 0, `${data.length}건 노출`);
});

await step("A2 비로그인: 섹션 테이블 조회 0건", async () => {
  const { data, error } = await anon.from("detail_page_sections").select("id, content").limit(5);
  expect(!error, error?.message);
  expect(data.length === 0, `${data.length}건 노출`);
});

await step("A3 비로그인: 공개 펀딩 목록에 승인 전/숨김 펀딩 없음", async () => {
  const { data, error } = await anon.from("fundings").select("id, status, is_hidden").limit(200);
  expect(!error, error?.message);
  const bad = data.filter((row) => !["approved", "closed"].includes(row.status) || row.is_hidden);
  expect(bad.length === 0, `비공개 펀딩 ${bad.length}건 노출`);
  return `공개 펀딩 ${data.length}건`;
});

await step("A4 마이그레이션 적용 확인: validate_detail_page_for_publish 존재 + 비로그인 실행 거부", async () => {
  const { error } = await anon.rpc("validate_detail_page_for_publish", { p_page_id: randomId() });
  expect(error, "비로그인 실행이 허용됨");
  expect(error.code !== "PGRST202", "함수가 없음 → 마이그레이션 미적용");
  return `거부 코드 ${error.code}`;
});

for (const [name, fn, args] of [
  ["publish_detail_page", "publish_detail_page", { p_page_id: randomId() }],
  ["save_product_detail_page", "save_product_detail_page", { p_page_id: randomId(), p_page: { title: "x" }, p_sections: [] }],
  ["list_detail_page_versions", "list_detail_page_versions", { p_page_id: randomId() }],
  ["restore_detail_page_version", "restore_detail_page_version", { p_page_id: randomId(), p_version_id: randomId() }],
]) {
  await step(`A5 비로그인: ${name} 실행 거부`, async () => {
    const { error } = await anon.rpc(fn, args);
    expect(error, "비로그인 실행이 허용됨");
    return `거부 코드 ${error.code}`;
  });
}

await step("A6 비로그인: AI 상세페이지 Edge Function 호출 거부(로그인 필요)", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-detail-page`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ mode: "rewrite", text: "테스트", instruction: "shorter", source: {} }),
  });
  expect(response.status === 401, `status ${response.status}`);
});

/* ───────────────────────── Part B: 제작자 전체 흐름 (실제 AI) ───────────────────────── */

if (!EMAIL || !PASSWORD) {
  results.push("SKIP  Part B 제작자 전체 흐름 — E2E_CREATOR_EMAIL / E2E_CREATOR_PASSWORD 시크릿이 없음");
  console.log(results.at(-1));
} else {
  const owner = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const cleanup = { fundingId: null, pageIds: [] };
  let session;
  let pageId;
  let fundingId;
  let browser;
  const PRODUCT = `E2E 테스트 후디 ${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;

  try {
    await step("B0 테스트 제작자 로그인 + 브랜드 확인", async () => {
      const { data, error } = await owner.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
      expect(!error, error?.message);
      session = data.session;
      const { data: brand } = await owner.from("brands").select("id, brand_name").eq("owner_user_id", session.user.id).maybeSingle();
      expect(brand, "테스트 계정에 내 브랜드가 없음(마이페이지에서 등록 필요)");
      return brand.brand_name;
    });

    await step("B1 상세페이지 초안 생성(DB insert, RLS 경유)", async () => {
      const source = {
        imageUrl: `${SITE}/clothing-templates/hoodie-white.png.png`,
        imagePath: null,
        isFrontBackComposite: false,
        clothTypeId: "hoodie", clothType: "후드티", materialId: "cotton", material: "코튼 기모",
        colorId: "white", color: "화이트", fitId: "", fit: "오버핏",
        designDescription: "가슴 왼쪽 작은 레터링 자수가 들어간 미니멀 후드티", aiPrompt: "", styleOptions: [],
        decorations: [], accessories: [], constructionFeatures: [], productionCountry: "한국", productionMethod: "국내 봉제",
        estimateUnitMin: null, estimateUnitMax: null, estimateDevelopmentTotal: null,
        targetQuantity: 30, sizeOptions: ["M", "L"], measurements: null, trademarkScreeningId: null, designId: null,
        creatorName: "", creatorBio: "", creatorImageUrl: null, brandId: null, brandName: "", brandShortDescription: "", brandDescription: "", brandLogoUrl: null,
        userProvided: { price: 49000, composition: "", background: "", targetCustomer: "", careNote: "", colorName: "", fitNote: "", oneLiner: "", highlights: "", details: "", productionNote: "", shippingNote: "", emphasis: [] },
      };
      const { data, error } = await owner
        .from("product_detail_pages")
        .insert({ user_id: session.user.id, template: "minimal", title: PRODUCT, status: "draft", source })
        .select("id")
        .single();
      expect(!error, error?.message);
      pageId = data.id;
      cleanup.pageIds.push(pageId);
      return pageId;
    });

    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ko-KR" });
    await context.addInitScript(([key, value]) => {
      localStorage.setItem(key, value);
      localStorage.setItem("brander_visit_notice_seen", "1");
      localStorage.setItem("brander_mascot_first_visit_done", "1");
      sessionStorage.setItem("brander_mascot_session_greeted", "1");
      localStorage.setItem("profileNotificationHidden", new Date().toISOString());
    }, ["sb-jwmzjszdjlrqrhadbggr-auth-token", JSON.stringify(session)]);
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => undefined);
    onFailure = async (name) => {
      await shot(name);
      const toasts = await page.locator("li[role=status], [data-sonner-toast], [role=alert]").allInnerTexts().catch(() => []);
      return [`url=${page.url().replace(SITE, "")}`, ...toasts.map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean)].join(" / ").slice(0, 400);
    };
    const inline = (label) => page.locator(`[data-inline-edit][aria-label="${label}"]`).first();
    const body = () => page.locator("[data-inline-edit][aria-label='본문을 입력하세요']").first();
    const typeInto = async (locator, text) => {
      await locator.click();
      await page.keyboard.press("Control+A");
      await page.keyboard.type(text);
      await page.keyboard.press("Tab");
    };
    const waitSaved = () => page.waitForFunction(() => document.querySelector("[data-testid=save-status]")?.getAttribute("data-state") === "saved", null, { timeout: 30000 });
    const db = async () => {
      const { data, error } = await owner.from("product_detail_pages").select("*, sections:detail_page_sections(*)").eq("id", pageId).single();
      if (error) throw error;
      data.sections.sort((a, b) => a.sort_order - b.sort_order);
      return data;
    };

    await step("B2 AI 상세페이지 생성(실제 Gemini 카피 + AI 이미지 1장) → 편집 화면", async () => {
      await page.goto(`${SITE}/detail-pages/${pageId}`);
      await page.getByRole("button", { name: /AI로 제작하기/ }).waitFor({ timeout: 60000 });
      for (const box of await page.locator("[id^='image-type-']").all()) {
        const id = await box.getAttribute("id");
        const checked = (await box.getAttribute("aria-checked")) === "true";
        if (checked !== (id === "image-type-hero")) await box.click();
      }
      await shot("b2-setup");
      await page.getByRole("button", { name: /AI로 제작하기/ }).click();
      await inline("상품명").waitFor({ timeout: 120000 });
      await page.waitForFunction(() => !document.body.innerText.includes("AI 이미지 생성 중") && !document.body.innerText.includes("AI 이미지 대기 중"), null, { timeout: 180000 });
      await shot("b2-editor");
      const row = await db();
      expect(row.sections.length >= 8, `섹션 ${row.sections.length}개`);
      expect(row.generation?.provider === "ai", `카피 provider=${row.generation?.provider} (${row.generation?.fallbackReason ?? ""})`);
      const hero = row.sections.find((section) => section.section_type === "hero");
      const { data: assets } = await owner.from("generated_assets").select("id, generation_status").eq("detail_page_id", pageId);
      return `섹션 ${row.sections.length}개, 카피=AI, 이미지 ${assets?.filter((a) => a.generation_status === "completed").length ?? 0}장 완료, 히어로 이미지 ${hero?.images?.[0]?.source}`;
    });

    await step("B3 텍스트 직접 수정 → 자동저장 → DB 반영", async () => {
      await typeInto(inline("상품명"), PRODUCT);
      await typeInto(body(), "운영 E2E 에서 직접 고친 제품 소개 문단입니다. 데일리로 입기 좋은 오버핏 후드티예요.");
      await waitSaved();
      const row = await db();
      expect(row.title === PRODUCT, `title=${row.title}`);
      expect(row.sections.some((section) => section.content?.description?.includes("운영 E2E 에서 직접 고친")), "본문 미저장");
    });

    const rewriteResults = [];
    const sectionsExcept = (row, id) => JSON.stringify(row.sections.filter((section) => section.id !== id).map((section) => [section.id, section.content, section.images]));
    for (const [label, instruction] of [
      ["더 짧게", "shorter"],
      ["더 자세하게", "longer"],
      ["더 고급스럽게", "luxury"],
      ["패션 브랜드 스타일로", "fashion"],
      ["자연스럽게 수정", "natural"],
      ["이 문구만 다시 작성", "rewrite"],
      ["직접 요청하기…", "custom"],
    ]) {
      await step(`B4 AI 부분 재작성(실제 AI): ${label}`, async () => {
        await waitSaved().catch(() => undefined);
        const beforeRow = await db();
        const target = beforeRow.sections.find((section) => section.content?.description?.length && ["story"].includes(section.section_type))
          ?? beforeRow.sections.find((section) => section.content?.description?.includes("운영 E2E"));
        const before = (await body().innerText()).trim();
        await body().click();
        const toolbar = page.getByTestId("rewrite-toolbar");
        await toolbar.getByRole("button", { name: label, exact: true }).click();
        if (instruction === "custom") {
          await page.getByLabel("재작성 요청").fill("20대 직장인 출근룩 느낌으로 두 문장 이내");
          await page.getByRole("button", { name: "이 요청으로 다시 쓰기" }).click();
        }
        const outcome = await Promise.race([
          page.waitForFunction((value) => {
            const text = document.querySelector("[data-inline-edit][aria-label='본문을 입력하세요']")?.innerText.trim();
            return text && text !== value;
          }, before, { timeout: 90000 }).then(() => "changed"),
          page.getByText("다시 작성하지 못했어요").first().waitFor({ timeout: 90000 }).then(() => "failed"),
        ]);
        const after = (await body().innerText()).trim();
        if (outcome === "failed") {
          expect(after === before, "AI 실패인데 원문이 바뀜");
          throw new Error("AI 호출 실패(원문 유지됨)");
        }
        await waitSaved();
        await page.waitForTimeout(1500);
        const afterRow = await db();
        expect(sectionsExcept(afterRow, target?.id) === sectionsExcept(beforeRow, target?.id), "다른 섹션이 바뀜");
        rewriteResults.push(`${label}: ${after.slice(0, 40)}…`);
        return `${before.length}자 → ${after.length}자`;
      });
    }
    await shot("b4-rewrite");

    await step("B5 이미지 수정: 라이브러리에서 AI/원본 이미지 넣기 → DB 반영", async () => {
      await page.getByRole("tab", { name: "섹션 구성" }).click();
      await page.locator("[data-section-row='design'] button").nth(1).click();
      const images = page.locator("aside [data-testid=section-image]");
      const count = await images.count();
      await page.getByRole("button", { name: /이미지 불러오기/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("ul li button").first().waitFor();
      await dialog.locator("ul li button").first().click();
      await dialog.getByRole("button", { name: /장 넣기/ }).click();
      await page.waitForFunction((n) => document.querySelectorAll("aside [data-testid=section-image]").length === n, count + 1);
      await images.last().getByLabel("이미지 설명").fill("운영 E2E 추가 이미지");
      await waitSaved();
      const row = await db();
      const design = row.sections.find((section) => section.section_type === "design");
      expect(design.images.some((image) => image.alt === "운영 E2E 추가 이미지"), "이미지 미저장");
    });

    await step("B6 임시저장 → 새로고침 → DB 에서 다시 불러와 유지", async () => {
      await page.getByTestId("manual-save").click();
      await page.getByText("임시저장했어요").first().waitFor();
      await page.reload();
      await inline("상품명").waitFor({ timeout: 60000 });
      expect((await inline("상품명").innerText()).trim() === PRODUCT, "새로고침 후 상품명 유실");
      await page.getByText("운영 E2E 추가 이미지", { exact: false }).count();
      const { data: versions } = await owner.rpc("list_detail_page_versions", { p_page_id: pageId });
      expect(versions.some((version) => version.kind === "manual_save"), "임시저장 버전 없음");
      return `버전 ${versions.length}개`;
    });

    await step("B7 미리보기(Desktop/Mobile) — 편집 UI 없음", async () => {
      await page.getByTestId("open-preview").click();
      const preview = page.getByTestId("preview-page");
      await preview.waitFor();
      expect(await preview.locator("[data-inline-edit]").count() === 0, "미리보기에 편집 UI");
      await page.getByRole("button", { name: "Mobile" }).click();
      await shot("b7-preview-mobile");
      await page.getByRole("button", { name: "미리보기 닫기" }).click();
    });

    await step("B8 서버 등록 검증: 필수 항목 누락 페이지는 API 직접 호출로도 등록 불가", async () => {
      const { data, error } = await owner.from("product_detail_pages").insert({ user_id: session.user.id, title: "", source: {} }).select("id").single();
      expect(!error, error?.message);
      cleanup.pageIds.push(data.id);
      const { error: publishError } = await owner.rpc("publish_detail_page", { p_page_id: data.id });
      expect(publishError, "누락 페이지가 등록됨");
      expect(publishError.hint === "detail_page_missing_items" || /보이는 섹션/.test(publishError.message), publishError.message);
      return publishError.message.slice(0, 60);
    });

    await step("B9 펀딩 시작(상표 검수 → 펀딩 초안 생성 → 연결 → 자동 등록)", async () => {
      await page.getByRole("button", { name: /이 상세페이지로 펀딩 시작하기/ }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "펀딩 시작하기" }).click();
      const outcome = await Promise.race([
        page.waitForURL(/\/fundings\/[0-9a-f-]+\/edit/, { timeout: 180000 }).then(() => "ok"),
        page.getByText(/펀딩을 시작하지 못했어요|내 브랜드를 먼저 등록해주세요|상세페이지 연결에 실패/).first().waitFor({ timeout: 180000 }).then(() => "error"),
      ]);
      if (outcome === "error") {
        const toasts = await page.locator("li[role=status], [data-sonner-toast]").allInnerTexts().catch(() => []);
        throw new Error(`펀딩 시작 오류: ${toasts.join(" / ").replace(/\s+/g, " ").slice(0, 300)}`);
      }
      fundingId = page.url().match(/fundings\/([0-9a-f-]+)\/edit/)[1];
      cleanup.fundingId = fundingId;
      const row = await db();
      expect(row.funding_id === fundingId, "펀딩 연결 안 됨");
      expect(row.published_version > 0 && row.published_at, `자동 등록 안 됨 (v${row.published_version})`);
      const { data: funding } = await owner.from("fundings").select("status, price").eq("id", fundingId).single();
      return `펀딩 ${fundingId.slice(0, 8)} status=${funding.status} price=${funding.price}, 등록 v${row.published_version}`;
    });

    await step("B10 실제 펀딩 상세페이지 반영(제작자 화면)", async () => {
      await page.goto(`${SITE}/fundings/${fundingId}`);
      await page.getByText("운영 E2E 에서 직접 고친", { exact: false }).first().waitFor({ timeout: 60000 }).catch(async () => {
        // 재작성으로 본문이 바뀌었을 수 있으므로 상품명으로 확인
        await page.getByText(PRODUCT).first().waitFor({ timeout: 30000 });
      });
      await shot("b10-funding-detail");
    });

    await step("B11 비로그인/다른 사용자: 승인 전 테스트 펀딩의 상세페이지 차단(API + 브라우저)", async () => {
      const { data: rows } = await anon.from("fundings").select("id").eq("id", fundingId);
      expect(rows.length === 0, "비로그인에 승인 전 펀딩 노출");
      const { data: published, error } = await anon.rpc("get_published_detail_page", { p_funding_id: fundingId });
      expect(!error && published === null, `비로그인에 게시본 노출: ${JSON.stringify(published)?.slice(0, 80)}`);
      const { data: pages } = await anon.from("product_detail_pages").select("id").eq("id", pageId);
      expect(pages.length === 0, "비로그인에 초안 노출");
      const anonContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const anonPage = await anonContext.newPage();
      for (const path of [`/fundings/${fundingId}`, `/fundings/${fundingId}?preview=draft`]) {
        await anonPage.goto(`${SITE}${path}`);
        await anonPage.waitForTimeout(5000);
        const text = await anonPage.innerText("body");
        expect(!text.includes(PRODUCT) && !text.includes("운영 E2E"), `비로그인 화면에 노출: ${path}`);
      }
      await anonPage.screenshot({ path: `${SHOTS}/b11-anon-blocked.png` });
      await anonContext.close();
    });

    await step("B12 마이페이지 → 내가 만든 펀딩 → 상세페이지 수정 → 변경사항 저장 → 재반영", async () => {
      await page.goto(`${SITE}/my-fundings`);
      await page.locator("article").filter({ hasText: PRODUCT }).getByRole("link", { name: "상세페이지 수정" }).click();
      await page.waitForURL(/\/detail-pages\//, { timeout: 60000 });
      await inline("한 줄 소개").waitFor({ timeout: 60000 });
      expect((await page.getByTestId("publish-button").first().innerText()).includes("변경사항 저장"), "버튼이 '변경사항 저장'이 아님");
      const stamp = `운영 재수정 ${Date.now().toString().slice(-6)}`;
      await typeInto(inline("한 줄 소개"), stamp);
      await waitSaved();
      const before = await db();
      expect(before.published_document?.page?.subtitle !== stamp, "저장 전에 고객 화면에 반영됨");
      await page.getByTestId("publish-button").first().click();
      await page.getByRole("alertdialog").getByText("변경사항이 저장되었습니다.").waitFor({ timeout: 60000 });
      const after = await db();
      expect(after.published_document?.page?.subtitle === stamp, "변경사항 미반영");
      await page.goto(`${SITE}/fundings/${fundingId}`);
      await page.getByText(stamp).first().waitFor({ timeout: 60000 });
      await shot("b12-republished");
      return `v${before.published_version} → v${after.published_version}`;
    });

    console.log("rewrite samples:\n  " + rewriteResults.join("\n  "));
  } finally {
    await browser?.close();
    // 정리: 테스트 펀딩 삭제(→ 상세페이지 funding_id null) 후 상세페이지 삭제
    await step("B13 테스트 데이터 정리", async () => {
      const notes = [];
      // 중간 실패로 연결 전에 만들어진 테스트 펀딩도 찾아서 정리한다(이 계정 + 테스트 상품명 접두어만).
      const { data: leftovers } = await owner
        .from("fundings")
        .select("id, product_name")
        .eq("creator_id", session?.user?.id ?? "00000000-0000-0000-0000-000000000000")
        .like("product_name", "E2E 테스트 후디%");
      for (const row of leftovers ?? []) {
        if (row.id !== cleanup.fundingId) {
          const { error } = await owner.functions.invoke("delete-funding", { body: { fundingId: row.id, reason: "운영 E2E 테스트 데이터 정리" } });
          notes.push(error ? `남은 펀딩 ${row.id.slice(0, 8)} 삭제 실패: ${error.message}` : `남은 펀딩 ${row.id.slice(0, 8)} 삭제`);
        }
      }
      if (cleanup.fundingId) {
        const { data, error } = await owner.functions.invoke("delete-funding", { body: { fundingId: cleanup.fundingId, reason: "운영 E2E 테스트 데이터 정리" } });
        notes.push(error ? `펀딩 삭제 실패: ${error.message}` : `펀딩 삭제 ${data?.success ? "완료" : JSON.stringify(data)}`);
      }
      for (const id of cleanup.pageIds) {
        const { error } = await owner.from("product_detail_pages").delete().eq("id", id);
        notes.push(error ? `페이지 ${id.slice(0, 8)} 삭제 실패: ${error.message}` : `페이지 ${id.slice(0, 8)} 삭제`);
      }
      expect(!notes.some((note) => note.includes("실패")), notes.join(", "));
      return notes.join(", ");
    });
  }
}

fs.writeFileSync(`${SHOTS}/results.txt`, results.join("\n") + "\n");
console.log("\n" + results.join("\n"));
process.exit(failed ? 1 : 0);
