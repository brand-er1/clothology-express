// AI 의류 이미지 생성 → 제작의뢰 → DB 저장 → 관리자 확인 로컬 E2E (운영 DB · 운영 함수에 접속하지 않는다)
//
// 구성: 로컬 Postgres(모든 마이그레이션 적용) + gateway.mjs(Supabase 호환 REST/Storage/Auth) +
//       실제 Edge Function(supabase/functions/submit-production-request, Deno) + Vite 개발 서버 + Playwright
// 유료 AI 이미지 생성(generate-optimized-image)만 고정 의류 이미지를 돌려주는 대체 응답을 쓴다.
//
// 사용법:
//   PGHOST=/tmp PGPORT=55432 PGUSER=postgres PG_MODULE_BASE=<pg 패키지가 있는 폴더>/ \
//   DENO_IMPORT_MAP=<esm.sh → npm 매핑 import map> node scripts/e2e/local-ai-production-request/run.mjs
import { spawn, execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.E2E_SHOTS ?? path.join(os.tmpdir(), "ai-production-request-e2e");
const DB = process.env.E2E_DB ?? "brander_ai_request_e2e";
const SECRET = crypto.randomBytes(32).toString("hex");
const GATEWAY_PORT = 54321;
const APP_PORT = 5179;
const STORAGE_DIR = path.join(OUT, "storage");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const pgRequire = createRequire(process.env.PG_MODULE_BASE ?? import.meta.url);
const pg = pgRequire("pg");
const { chromium } = require("playwright");

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = (payload) => {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 6 * 3600, ...payload }));
  return `${head}.${body}.${b64url(crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest())}`;
};
const ANON = jwt({ role: "anon" });
const SERVICE = jwt({ role: "service_role" });

const MEMBER = { id: "e2e00000-0000-0000-0000-0000000000c1", email: "member@e2e.local" };
const ADMIN = { id: "e2e00000-0000-0000-0000-0000000000ad", email: "admin@e2e.local" };

const results = [];
let failed = false;
const step = async (name, fn) => {
  const started = Date.now();
  try {
    const note = await fn();
    results.push(`PASS  ${name}${note ? ` — ${note}` : ""} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch (error) {
    failed = true;
    results.push(`FAIL  ${name} — ${String(error?.message ?? error).split("\n")[0]}`);
  }
  console.log(results.at(-1));
};
const expect = (cond, message) => { if (!cond) throw new Error(message); };

// ── 1. DB ───────────────────────────────────────────────────────────────────
const psql = (args, input) => execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-q", "-d", DB, ...args], { input, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, PGOPTIONS: "-c client_min_messages=warning" } });
execFileSync("dropdb", ["--if-exists", DB], { stdio: "ignore" });
execFileSync("createdb", [DB]);
psql(["-f", path.join(ROOT, "scripts/admin-db-tests/00_supabase_stub.sql")]);
for (const file of fs.readdirSync(path.join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
  psql(["-f", path.join(ROOT, "supabase/migrations", file)]);
}
psql([], `
set session_replication_role = replica;
insert into storage.buckets (id, name, public) values ('generated_images', 'generated_images', true) on conflict do nothing;
insert into auth.users (id, email) values ('${MEMBER.id}', '${MEMBER.email}'), ('${ADMIN.id}', '${ADMIN.email}');
insert into public.profiles (id, username, full_name, phone_number, account_type) values
  ('${MEMBER.id}', 'e2e_member', '김회원', '010-2222-3333', 'buyer'),
  ('${ADMIN.id}', 'e2e_admin', '운영관리자', null, 'seller')
on conflict (id) do update set username = excluded.username, full_name = excluded.full_name, phone_number = excluded.phone_number, account_type = excluded.account_type;
insert into public.admin_members (user_id, role, status, display_name) values ('${ADMIN.id}', 'super_admin', 'active', 'E2E 운영');
-- 기존 접수 데이터(변경되면 안 됨)
insert into public.orders (id, user_id, cloth_type, material, status, request_source, request_title, created_at)
values ('e2e00000-0000-0000-0000-00000000e001', '${MEMBER.id}', '셔츠', '면', 'approved', 'design_upload', '기존 의뢰', now() - interval '5 day');
`);
const db = new pg.Client({ database: DB });
await db.connect();
const legacyHash = async () => (await db.query("select md5(to_jsonb(o)::text) h from orders o where id = 'e2e00000-0000-0000-0000-00000000e001'")).rows[0].h;
const legacyBefore = await legacyHash();

// ── 2. 서버들 ───────────────────────────────────────────────────────────────
const children = [];
const start = (cmd, args, env, name) => {
  const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  const logFile = fs.createWriteStream(path.join(OUT, `${name}.log`));
  child.stdout.pipe(logFile);
  child.stderr.pipe(logFile);
  children.push(child);
  return child;
};
const cleanup = () => children.forEach((child) => child.kill("SIGTERM"));
process.on("exit", cleanup);

const waitFor = async (url, label, timeout = 90_000) => {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} did not start (${url})`);
};

start("node", [path.join(HERE, "gateway.mjs")], {
  GATEWAY_PORT: String(GATEWAY_PORT), PGDATABASE: DB, JWT_SECRET: SECRET, STORAGE_DIR, FUNCTION_URL: "http://127.0.0.1:8000",
  FIXTURE_IMAGE: path.join(ROOT, "public/portfolio/hood-pullover.webp"), GATEWAY_LOG: "1",
}, "gateway");
const denoArgs = ["run", "--no-lock", "--allow-net", "--allow-env", "--allow-read"];
if (process.env.DENO_IMPORT_MAP) denoArgs.push(`--import-map=${process.env.DENO_IMPORT_MAP}`);
denoArgs.push("supabase/functions/submit-production-request/index.ts");
start("deno", denoArgs, { SUPABASE_URL: `http://127.0.0.1:${GATEWAY_PORT}`, SUPABASE_SERVICE_ROLE_KEY: SERVICE }, "function");
start("npx", ["vite", "--port", String(APP_PORT), "--strictPort", "--host", "127.0.0.1"], {
  VITE_SUPABASE_URL: `http://127.0.0.1:${GATEWAY_PORT}`, VITE_SUPABASE_PUBLISHABLE_KEY: ANON, VITE_PAYMENT_MODE: "disabled",
}, "vite");
await waitFor(`http://127.0.0.1:${GATEWAY_PORT}/rest/v1/`, "gateway");
await waitFor("http://127.0.0.1:8000/", "edge function", 120_000);
await waitFor(`http://127.0.0.1:${APP_PORT}/`, "vite");

const APP = `http://127.0.0.1:${APP_PORT}`;
const sessionFor = (user) => {
  const access = jwt({ sub: user.id, role: "authenticated", email: user.email, aud: "authenticated" });
  return JSON.stringify({
    access_token: access, refresh_token: "e2e-refresh", token_type: "bearer", expires_in: 21600,
    expires_at: Math.floor(Date.now() / 1000) + 21600,
    user: { id: user.id, email: user.email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  });
};
const STORAGE_KEY = "sb-127-auth-token";

const browser = await chromium.launch();

// 고객: 의류 선택 → 원단 → 설명 → AI 이미지 생성 → (자동으로) 수정 단계 → 제작의뢰
const generateDesign = async (page) => {
  await page.goto(`${APP}/customize`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /후드티/ }).first().click();
  await page.getByRole("button", { name: /^다음 단계$/ }).click();
  await page.locator("[role=button], button").filter({ hasText: /코튼|면|기모|쭈리|테리/ }).first().click();
  await page.getByRole("button", { name: /^다음 단계$/ }).click();
  await page.locator("textarea").first().fill("버건디 컬러 오버핏 후드티, 왼쪽 가슴 작은 자수 로고");
  await page.getByRole("button", { name: /^다음 단계$/ }).click();
  await page.getByRole("button", { name: /^이미지 생성하기$/ }).click();
  await page.getByTestId("ai-image-result-actions").first().waitFor({ timeout: 30_000 });
};

const fillAndSubmit = async (page, { name, phoneTyped, quantity, budget, request }) => {
  const dialog = page.getByRole("dialog");
  if (name !== undefined) await dialog.locator("#pr-contactName").fill(name);
  if (phoneTyped !== undefined) { await dialog.locator("#pr-phone").fill(""); await dialog.locator("#pr-phone").pressSequentially(phoneTyped); }
  if (quantity) await dialog.locator("#pr-quantity").fill(quantity);
  if (budget) await dialog.getByRole("radio", { name: budget }).click();
  if (request) await dialog.locator("#pr-request").fill(request);
};

let guestOrderId = null;
let memberOrderId = null;

// ── 3. 비회원 (PC) ──────────────────────────────────────────────────────────
const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const guest = await desktop.newPage();
guest.on("pageerror", (e) => console.log("[guest pageerror]", e.message));

await step("AI 의류 이미지 생성 → 완료 화면에 3개 버튼 (다시 생성 · 다운로드 · 제작의뢰하기)", async () => {
  await generateDesign(guest);
  const bar = guest.getByTestId("ai-image-result-actions").first();
  for (const label of ["이미지 다시 생성", "이미지 다운로드", "제작의뢰하기"]) {
    expect(await bar.getByRole("button", { name: label }).isVisible(), `${label} 버튼 없음`);
  }
  const bg = await bar.getByTestId("request-production").evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg === "rgb(116, 27, 43)", `제작의뢰 버튼 색상이 버건디가 아님: ${bg}`);
  await guest.screenshot({ path: path.join(OUT, "01-result-actions-desktop.png"), fullPage: false });
  return `버튼 색상 ${bg}`;
});

await step("이미지 다운로드 버튼이 파일을 내려받는다", async () => {
  const [download] = await Promise.all([guest.waitForEvent("download", { timeout: 15_000 }), guest.getByTestId("download-design").first().click()]);
  return download.suggestedFilename();
});

await step("제작의뢰하기 → 팝업에 생성 이미지가 자동 첨부", async () => {
  await guest.getByTestId("request-production").first().click();
  const img = guest.getByTestId("production-request-image");
  await img.waitFor();
  expect(await img.evaluate((el) => el.complete && el.naturalWidth > 0), "첨부 이미지가 표시되지 않음");
  await guest.screenshot({ path: path.join(OUT, "02-request-dialog-desktop.png") });
});

await step("필수 항목 누락 · 잘못된 전화번호는 접수되지 않음", async () => {
  const dialog = guest.getByRole("dialog");
  await dialog.getByRole("button", { name: "제작의뢰 접수하기" }).click();
  await dialog.getByText("고객 이름을 입력해주세요.").waitFor();
  await dialog.getByText("전화번호를 입력해주세요.").waitFor();
  await dialog.getByText("개인정보 수집 및 이용에 동의해주세요.").waitFor();
  await fillAndSubmit(guest, { name: "이비회원", phoneTyped: "010123" });
  expect(await dialog.locator("#pr-phone").inputValue() === "010-123", "자동 하이픈 변환 실패");
  await dialog.locator("#pr-privacyConsent").click();
  await dialog.getByRole("button", { name: "제작의뢰 접수하기" }).click();
  await dialog.getByText("전화번호를 010-0000-0000 형식으로 정확히 입력해주세요.").waitFor();
  const count = (await db.query("select count(*)::int n from production_request_details")).rows[0].n;
  expect(count === 0, `잘못된 입력인데 ${count}건 저장됨`);
  await guest.screenshot({ path: path.join(OUT, "03-validation-desktop.png") });
});

await step("서버도 잘못된 전화번호를 거부 (화면 검증 우회 시)", async () => {
  const response = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/functions/v1/submit-production-request`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}`, apikey: ANON },
    body: JSON.stringify({ submissionKey: crypto.randomUUID(), contactName: "우회", phone: "02-123-4567", quantityUndecided: true, privacyConsent: true, privacyConsentVersion: "2026-11-27.v1", image: { url: "https://example.com/x.png" } }),
  });
  const body = await response.json();
  expect(response.status === 400 && body.ok === false && /전화번호/.test(body.error), `예상 밖 응답 ${response.status} ${JSON.stringify(body)}`);
  return `${response.status} ${body.error}`;
});

await step("비회원 접수 (수량 미정 · 예산 선택) → DB 저장 후에만 완료 문구", async () => {
  const dialog = guest.getByRole("dialog");
  await fillAndSubmit(guest, { phoneTyped: "01098765432", budget: "100~300만원", request: "11월 말까지 납품 희망" });
  expect(await dialog.locator("#pr-phone").inputValue() === "010-9876-5432", "전화번호 형식 변환 실패");
  await guest.screenshot({ path: path.join(OUT, "04-filled-desktop.png") });
  await dialog.getByRole("button", { name: "제작의뢰 접수하기" }).click();
  await guest.getByTestId("production-request-success").waitFor({ timeout: 30_000 });
  const text = await guest.getByTestId("production-request-success").innerText();
  expect(text.includes("제작의뢰가 정상적으로 접수되었습니다.") && text.includes("입력하신 전화번호로 제작 가능 여부와 견적을 안내해 드리겠습니다."), "완료 문구 불일치");
  const row = (await db.query(`select o.id, o.status, o.request_source, o.user_id, o.guest_phone, o.image_path, o.generated_image_url, d.contact_name, d.contact_phone, d.quantity_undecided, d.budget, d.customer_request, d.ai_prompt, d.entry_point, d.image_source_url
    from orders o join production_request_details d on d.order_id = o.id`)).rows;
  expect(row.length === 1, `저장된 의뢰 ${row.length}건`);
  const r = row[0];
  guestOrderId = r.id;
  expect(r.request_source === "ai_image_request" && r.status === "pending" && r.user_id === null, "의뢰 기본값 불일치");
  expect(r.contact_phone === "01098765432" && r.guest_phone === "01098765432" && r.contact_name === "이비회원", "연락처 불일치");
  expect(r.quantity_undecided === true && r.budget === "100~300만원" && r.customer_request === "11월 말까지 납품 희망", "수량/예산/요청 불일치");
  expect(r.ai_prompt?.startsWith("E2E: oversized"), "AI 프롬프트 미저장");
  expect(r.image_path.startsWith("production-requests/") && fs.existsSync(path.join(STORAGE_DIR, "generated_images", r.image_path)), "이미지가 영구 저장소(production-requests/)에 복사되지 않음");
  expect(r.image_source_url && r.generated_image_url !== r.image_source_url, "원본 URL과 영구 URL이 분리되지 않음");
  await guest.screenshot({ path: path.join(OUT, "05-success-desktop.png") });
  return `order ${r.id.slice(0, 8)} · ${r.image_path}`;
});

await step("원본 생성 이미지가 사라져도 의뢰 이미지는 남는다 (임시 URL 만료 대비)", async () => {
  const src = (await db.query("select image_source_url from production_request_details where order_id = $1", [guestOrderId])).rows[0].image_source_url;
  const original = decodeURIComponent(new URL(src).pathname.split("/generated_images/")[1]);
  fs.unlinkSync(path.join(STORAGE_DIR, "generated_images", original));
  const url = (await db.query("select generated_image_url from orders where id = $1", [guestOrderId])).rows[0].generated_image_url;
  const response = await fetch(url);
  expect(response.ok && (await response.arrayBuffer()).byteLength > 1000, "영구 저장 이미지 조회 실패");
});

await step("접수 완료 → 'AI 이미지 생성 페이지로 돌아가기'", async () => {
  await guest.getByRole("button", { name: "AI 이미지 생성 페이지로 돌아가기" }).click();
  await guest.getByRole("dialog").waitFor({ state: "detached" });
  expect(new URL(guest.url()).pathname.endsWith("/customize"), `현재 위치 ${guest.url()}`);
});

await step("같은 접수 키 재전송(더블 클릭 · 재시도)은 1건만 저장", async () => {
  const key = (await db.query("select submission_key from production_request_details where order_id = $1", [guestOrderId])).rows[0].submission_key;
  const response = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/functions/v1/submit-production-request`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}`, apikey: ANON },
    body: JSON.stringify({ submissionKey: key, contactName: "이비회원", phone: "010-9876-5432", quantityUndecided: true, privacyConsent: true, privacyConsentVersion: "2026-11-27.v1", image: { url: "https://example.com/x.png" } }),
  });
  const body = await response.json();
  const count = (await db.query("select count(*)::int n from orders where request_source = 'ai_image_request'")).rows[0].n;
  expect(body.ok && body.duplicate && body.orderId === guestOrderId && count === 1, `중복 방지 실패 ${JSON.stringify(body)} count=${count}`);
});
await desktop.close();

// ── 4. 회원 (모바일) ────────────────────────────────────────────────────────
const mobile = await browser.newContext({ ...require("playwright").devices["iPhone 13"] });
await mobile.addInitScript(([key, value]) => { localStorage.setItem(key, value); }, [STORAGE_KEY, sessionFor(MEMBER)]);
const member = await mobile.newPage();
member.on("pageerror", (e) => console.log("[member pageerror]", e.message));

await step("회원 (모바일): 생성 → 제작의뢰 팝업에 프로필 이름 · 전화번호 자동 입력 → 접수", async () => {
  await generateDesign(member);
  await member.screenshot({ path: path.join(OUT, "06-result-actions-mobile.png") });
  await member.getByTestId("request-production").first().click();
  const dialog = member.getByRole("dialog");
  await dialog.locator("#pr-contactName").waitFor();
  await member.waitForFunction(() => (document.querySelector("#pr-phone"))?.value === "010-2222-3333", null, { timeout: 10_000 });
  expect(await dialog.locator("#pr-contactName").inputValue() === "김회원", "회원 이름 미리 채우기 실패");
  await dialog.locator("#pr-quantity").fill("50");
  await dialog.locator("#pr-privacyConsent").click();
  await member.screenshot({ path: path.join(OUT, "07-request-dialog-mobile.png"), fullPage: false });
  await dialog.getByRole("button", { name: "제작의뢰 접수하기" }).dblclick();
  await member.getByTestId("production-request-success").waitFor({ timeout: 30_000 });
  await member.screenshot({ path: path.join(OUT, "08-success-mobile.png") });
  const rows = (await db.query("select o.id, o.user_id, o.requested_quantity, o.guest_phone, d.contact_phone from orders o join production_request_details d on d.order_id = o.id where o.user_id = $1", [MEMBER.id])).rows;
  expect(rows.length === 1, `더블 클릭 후 ${rows.length}건 저장`);
  memberOrderId = rows[0].id;
  expect(rows[0].requested_quantity === 50 && rows[0].contact_phone === "01022223333" && rows[0].guest_phone === null, "회원 의뢰 값 불일치");
});
await mobile.close();

// ── 5. 관리자 ───────────────────────────────────────────────────────────────
const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
await adminContext.addInitScript(([key, value]) => { localStorage.setItem(key, value); }, [STORAGE_KEY, sessionFor(ADMIN)]);
const admin = await adminContext.newPage();
admin.on("pageerror", (e) => console.log("[admin pageerror]", e.message));

await step("관리자 '제작 의뢰' 메뉴에 미확인 건수 표시", async () => {
  await admin.goto(`${APP}/admin/production-requests`, { waitUntil: "networkidle" });
  const badge = admin.getByTestId("nav-badge-production_new").first();
  await badge.waitFor({ timeout: 20_000 });
  const text = (await badge.innerText()).trim();
  expect(text === "2", `미확인 배지 ${text}`);
  return `배지 ${text}건`;
});

await step("기존 제작의뢰 목록에 AI 디자인 제작의뢰 2건이 'AI 디자인 제작의뢰' 표시와 함께 노출", async () => {
  const rows = admin.getByTestId("production-request-row");
  await rows.first().waitFor();
  const aiRows = rows.filter({ hasText: "AI 디자인 제작의뢰" });
  expect(await aiRows.count() === 2, `AI 의뢰 행 ${await aiRows.count()}`);
  expect(await rows.filter({ hasText: "NEW · 미확인" }).count() === 2, "미확인 표시 없음");
  await admin.screenshot({ path: path.join(OUT, "09-admin-list.png") });
});

await step("목록에서 전화번호 클릭 → 클립보드 복사", async () => {
  await admin.getByTestId("production-request-row").filter({ hasText: "이비회원" }).getByTestId("copy-phone").click();
  const copied = await admin.evaluate(() => navigator.clipboard.readText());
  expect(copied === "010-9876-5432", `복사값 ${copied}`);
  return copied;
});

await step("상세: 이미지 · 이름 · 전화번호 · 계정 · 수량 · 예산 · 요청 · 프롬프트 · 접수일시 · 유입 경로 · 상태", async () => {
  await admin.getByTestId("production-request-row").filter({ hasText: "이비회원" }).click();
  const panel = admin.getByTestId("production-request-workflow");
  await panel.waitFor();
  await admin.getByTestId("ai-design-request-badge").waitFor();
  const text = await panel.innerText();
  for (const expected of ["이비회원", "010-9876-5432", "미정", "100~300만원", "11월 말까지 납품 희망", "AI 이미지 생성 페이지 · 디자인 수정 화면", "비회원 접수", "신규 접수"]) {
    expect(text.includes(expected), `상세에 '${expected}' 없음`);
  }
  await panel.getByRole("button", { name: "AI 이미지 생성 프롬프트" }).click();
  expect((await admin.getByTestId("request-ai-prompt").innerText()).startsWith("E2E: oversized"), "프롬프트 미표시");
  await admin.screenshot({ path: path.join(OUT, "10-admin-detail.png"), fullPage: false });
});

await step("의뢰 이미지 클릭 → 확대, 원본 다운로드", async () => {
  await admin.getByTestId("request-image-zoom").click();
  const full = admin.getByTestId("request-image-full");
  await full.waitFor();
  expect(await full.evaluate((el) => el.complete && el.naturalWidth > 0), "확대 이미지 로드 실패");
  await admin.screenshot({ path: path.join(OUT, "11-admin-image-zoom.png") });
  const [download] = await Promise.all([admin.waitForEvent("download", { timeout: 15_000 }), admin.getByRole("button", { name: "원본 다운로드" }).click()]);
  const file = path.join(OUT, `downloaded-${download.suggestedFilename()}`);
  await download.saveAs(file);
  const original = (await db.query("select image_path from orders where id = $1", [guestOrderId])).rows[0].image_path;
  const same = Buffer.compare(fs.readFileSync(file), fs.readFileSync(path.join(STORAGE_DIR, "generated_images", original))) === 0;
  expect(same, "다운로드 파일이 원본과 다름");
  await admin.keyboard.press("Escape");
  return download.suggestedFilename();
});

await step("진행 상태 변경(상담 대기 → 견적 발송) + 내부 메모 기록", async () => {
  const panel = admin.getByTestId("production-request-workflow");
  await panel.getByRole("radio", { name: "견적 발송" }).click();
  await panel.locator("#pr-admin-comment").fill("견적서를 문자로 보내드렸습니다.");
  await admin.getByTestId("save-progress").click();
  await admin.getByText("진행 상태를 저장했습니다").first().waitFor();
  await admin.getByTestId("memo-input").fill("11/27 통화 — 50장 기준 견적 요청, 자수 위치 확인");
  await admin.getByTestId("save-memo").click();
  await admin.getByTestId("memo-list").getByText("11/27 통화 — 50장 기준 견적 요청").waitFor();
  const row = (await db.query("select o.status, o.admin_comment, p.progress_status, (select count(*)::int from production_request_memos m where m.order_id = o.id) memos from orders o join production_request_progress p on p.order_id = o.id where o.id = $1", [guestOrderId])).rows[0];
  expect(row.progress_status === "quote_sent" && row.status === "approved" && row.memos === 1 && row.admin_comment === "견적서를 문자로 보내드렸습니다.", JSON.stringify(row));
  await admin.screenshot({ path: path.join(OUT, "12-admin-progress-memo.png"), fullPage: false });
  return `progress=${row.progress_status}, orders.status=${row.status}`;
});

await step("상세를 연 의뢰는 미확인에서 빠진다 (배지 2 → 1)", async () => {
  await admin.keyboard.press("Escape");
  await admin.waitForFunction(() => document.querySelector('[data-testid="nav-badge-production_new"]')?.textContent?.trim() === "1", null, { timeout: 15_000 });
});

await step("회원 의뢰 상세: 고객 계정 정보(이메일 · 아이디 · 회원 구분) 표시", async () => {
  await admin.getByTestId("production-request-row").filter({ hasText: "김회원" }).click();
  const panel = admin.getByTestId("production-request-workflow");
  await panel.waitFor();
  const text = await panel.innerText();
  for (const expected of [MEMBER.email, "e2e_member", "구매자 회원", "010-2222-3333", "50장"]) expect(text.includes(expected), `'${expected}' 없음`);
  await admin.keyboard.press("Escape");
});

await step("권한 없는 회원은 관리자 RPC로 전화번호를 볼 수 없다", async () => {
  const response = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/rest/v1/rpc/admin_list_production_requests`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${jwt({ sub: MEMBER.id, role: "authenticated" })}` }, body: "{}",
  });
  const tableRead = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/rest/v1/production_request_details?select=contact_phone`, {
    headers: { apikey: ANON, Authorization: `Bearer ${jwt({ sub: MEMBER.id, role: "authenticated" })}` },
  });
  expect(response.status >= 400 && tableRead.status >= 400, `RPC ${response.status}, table ${tableRead.status}`);
  return `RPC ${response.status} · table ${tableRead.status}`;
});

await step("기존 제작의뢰 데이터는 변경되지 않음", async () => {
  const after = await legacyHash();
  expect(Boolean(legacyBefore) && after === legacyBefore, "기존 의뢰 변경됨");
});

await browser.close();
await db.end();
cleanup();
console.log(`\n${results.join("\n")}\n\nscreenshots: ${OUT}`);
process.exit(failed ? 1 : 0);
