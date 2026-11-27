// 로컬 E2E 용 Supabase 호환 게이트웨이 (운영에 접속하지 않는다).
//
//  /rest/v1/rpc/:fn , /rest/v1/:table  → 로컬 Postgres (JWT 의 role 로 SET ROLE + request.jwt.claim.* 설정 = PostgREST 와 같은 권한 모델)
//  /storage/v1/object/...               → 로컬 파일시스템 버킷
//  /auth/v1/user                        → JWT 검증 후 사용자 반환
//  /functions/v1/submit-production-request → 실제 Edge Function 코드(Deno)로 프록시
//  /functions/v1/generate-optimized-image  → (유료 AI 생성만 대체) 고정 의류 이미지를 Storage 에 저장하고 생성 결과 형식으로 반환
//
// 환경변수: GATEWAY_PORT, PGDATABASE/PGHOST/PGPORT/PGUSER, JWT_SECRET, STORAGE_DIR, FUNCTION_URL, FIXTURE_IMAGE
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(process.env.PG_MODULE_BASE ?? import.meta.url);
const pg = require("pg");

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const SECRET = process.env.JWT_SECRET;
const STORAGE_DIR = process.env.STORAGE_DIR;
const FUNCTION_URL = process.env.FUNCTION_URL ?? "http://127.0.0.1:8000";
const FIXTURE = process.env.FIXTURE_IMAGE;
const PUBLIC_BASE = `http://127.0.0.1:${PORT}`;
const pool = new pg.Pool({ max: 8 });
const log = (...args) => process.env.GATEWAY_LOG && console.log("[gateway]", ...args);

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
export const signJwt = (payload, secret) => {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
};
const verifyJwt = (token) => {
  const [head, body, sig] = String(token ?? "").split(".");
  if (!head || !body || !sig) return null;
  const expected = b64url(crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest());
  if (expected !== sig) return null;
  const claims = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  return claims;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer, accept, accept-profile, content-profile, x-upsert, range, cache-control, x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS, HEAD",
  "Access-Control-Expose-Headers": "content-range, content-type",
};
const send = (res, status, body, headers = {}) => {
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(status, { ...cors, ...(isBuf ? {} : { "Content-Type": "application/json" }), ...headers });
  res.end(isBuf ? body : body === undefined ? "" : JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => resolve(Buffer.concat(chunks)));
  req.on("error", reject);
});
const ident = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw Object.assign(new Error(`bad identifier ${name}`), { status: 400 });
  return `"${name}"`;
};

const claimsFor = (req) => {
  const auth = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  return verifyJwt(auth) ?? verifyJwt(req.headers.apikey) ?? { role: "anon" };
};

const withRole = async (claims, fn) => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const role = ["anon", "authenticated", "service_role"].includes(claims.role) ? claims.role : "anon";
    await client.query(`set local role ${role}`);
    await client.query(
      "select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true), set_config('request.jwt.claim.role', $3, true)",
      [JSON.stringify(claims), claims.sub ?? "", role],
    );
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const pgError = (res, error) => {
  const status = error.status ?? (error.code === "42501" ? 403 : error.code === "P0001" ? 400 : 400);
  log("pg error", error.message);
  send(res, status, { code: error.code ?? "PGRST", message: error.message, details: error.detail ?? null, hint: error.hint ?? null });
};

// ── /rest/v1 ────────────────────────────────────────────────────────────────
const restRpc = async (req, res, fn, claims) => {
  const raw = await readBody(req);
  const args = raw.length ? JSON.parse(raw.toString("utf8")) : {};
  const names = Object.keys(args);
  const params = names.map((name) => {
    const value = args[name];
    if (value === null || value === undefined) return null;
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
  const call = `public.${ident(fn)}(${names.map((name, i) => `${ident(name)} => $${i + 1}`).join(", ")})`;
  try {
    const rows = await withRole(claims, (client) => client.query(`select to_json(${call}) as r`, params));
    const values = rows.rows.map((row) => row.r);
    // 스칼라/jsonb 반환은 값 하나, setof 는 배열
    const meta = await pool.query("select proretset from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace limit 1", [fn]);
    send(res, 200, meta.rows[0]?.proretset ? values : values[0] ?? null);
  } catch (error) {
    pgError(res, error);
  }
};

const parseFilters = (search) => {
  const where = [];
  const params = [];
  let select = "*";
  let order = "";
  let limit = "";
  for (const [key, value] of search.entries()) {
    if (key === "select") { select = value.split(",").map((c) => (c.trim() === "*" ? "*" : ident(c.trim()))).join(", "); continue; }
    if (key === "order") {
      order = " order by " + value.split(",").map((part) => { const [col, dir] = part.split("."); return `${ident(col)} ${dir === "desc" ? "desc" : "asc"}`; }).join(", ");
      continue;
    }
    if (key === "limit") { limit = ` limit ${Number(value) | 0}`; continue; }
    if (key === "offset" || key === "columns") continue;
    const [op, ...rest] = value.split(".");
    const operand = rest.join(".");
    if (op === "eq") { params.push(operand); where.push(`${ident(key)}::text = $${params.length}`); }
    else if (op === "neq") { params.push(operand); where.push(`${ident(key)}::text <> $${params.length}`); }
    else if (op === "is") where.push(`${ident(key)} is ${operand === "null" ? "null" : operand === "true" ? "true" : "false"}`);
    else if (op === "in") { params.push(operand.replace(/^\(|\)$/g, "").split(",")); where.push(`${ident(key)}::text = any($${params.length})`); }
    else throw Object.assign(new Error(`unsupported filter ${op}`), { status: 400 });
  }
  return { select, where: where.length ? ` where ${where.join(" and ")}` : "", params, order, limit };
};

const restTable = async (req, res, table, claims, url) => {
  const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  try {
    const f = parseFilters(url.searchParams);
    let sql;
    let params = f.params;
    if (req.method === "GET" || req.method === "HEAD") {
      sql = `select ${f.select} from public.${ident(table)}${f.where}${f.order}${f.limit}`;
    } else if (req.method === "POST" || req.method === "PATCH") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const rows = Array.isArray(body) ? body : [body];
      const cols = Object.keys(rows[0] ?? {});
      const offset = params.length;
      params = [...params, JSON.stringify(rows)];
      const colList = cols.map(ident).join(", ");
      if (req.method === "POST") {
        sql = `insert into public.${ident(table)} (${colList}) select ${colList} from json_populate_recordset(null::public.${ident(table)}, $${offset + 1}::json) returning *`;
      } else {
        const sets = cols.map((c) => `${ident(c)} = r.${ident(c)}`).join(", ");
        sql = `update public.${ident(table)} t set ${sets} from json_populate_recordset(null::public.${ident(table)}, $${offset + 1}::json) r${f.where.replace(/"([a-z_]+)"::text/g, 't."$1"::text')} returning t.*`;
      }
    } else if (req.method === "DELETE") {
      sql = `delete from public.${ident(table)}${f.where} returning *`;
    } else {
      return send(res, 405, { message: "method" });
    }
    const result = await withRole(claims, (client) => client.query(sql, params));
    if (single) {
      if (result.rows.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `Results contain ${result.rows.length} rows` });
      return send(res, 200, result.rows[0]);
    }
    const prefer = req.headers.prefer ?? "";
    if (req.method !== "GET" && !prefer.includes("return=representation")) return send(res, 201, undefined);
    send(res, 200, result.rows, { "Content-Range": `0-${Math.max(result.rows.length - 1, 0)}/*` });
  } catch (error) {
    pgError(res, error);
  }
};

// ── /storage/v1 ─────────────────────────────────────────────────────────────
const storagePath = (bucket, objectPath) => {
  const full = path.resolve(STORAGE_DIR, bucket, objectPath);
  if (!full.startsWith(path.resolve(STORAGE_DIR, bucket) + path.sep)) throw Object.assign(new Error("bad path"), { status: 400 });
  return full;
};
const mimeOf = (file) => ({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[path.extname(file).toLowerCase()] ?? "application/octet-stream");

export const putObject = (bucket, objectPath, bytes) => {
  const file = storagePath(bucket, objectPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return `${PUBLIC_BASE}/storage/v1/object/public/${bucket}/${objectPath.split("/").map(encodeURIComponent).join("/")}`;
};

const storage = async (req, res, rest, claims) => {
  try {
    const parts = rest.split("/").map(decodeURIComponent);
    if (parts[0] === "object" && parts[1] === "public" && req.method === "GET") {
      const file = storagePath(parts[2], parts.slice(3).join("/"));
      if (!fs.existsSync(file)) return send(res, 404, { message: "Object not found" });
      return send(res, 200, fs.readFileSync(file), { "Content-Type": mimeOf(file) });
    }
    if (parts[0] === "object" && (parts[1] === "authenticated" || (req.method === "GET" && parts[1] !== "public"))) {
      const offset = parts[1] === "authenticated" ? 2 : 1;
      if (claims.role !== "service_role") return send(res, 403, { message: "forbidden" });
      const file = storagePath(parts[offset], parts.slice(offset + 1).join("/"));
      if (!fs.existsSync(file)) return send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      return send(res, 200, fs.readFileSync(file), { "Content-Type": mimeOf(file) });
    }
    if (parts[0] === "object" && req.method === "POST") {
      if (claims.role !== "service_role") return send(res, 403, { message: "Only the server may upload in this rig" });
      const bucket = parts[1];
      const objectPath = parts.slice(2).join("/");
      const file = storagePath(bucket, objectPath);
      if (fs.existsSync(file) && req.headers["x-upsert"] !== "true") return send(res, 400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
      const bytes = await readBody(req);
      putObject(bucket, objectPath, bytes);
      return send(res, 200, { Key: `${bucket}/${objectPath}`, Id: crypto.randomUUID() });
    }
    if (parts[0] === "object" && req.method === "DELETE") {
      if (claims.role !== "service_role") return send(res, 403, { message: "forbidden" });
      const bucket = parts[1];
      const { prefixes = [] } = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const removed = [];
      for (const prefix of prefixes) {
        const file = storagePath(bucket, prefix);
        if (fs.existsSync(file)) { fs.unlinkSync(file); removed.push({ name: prefix }); }
      }
      return send(res, 200, removed);
    }
    send(res, 404, { message: "unsupported storage call" });
  } catch (error) {
    send(res, error.status ?? 500, { message: error.message });
  }
};

// ── /functions/v1 ───────────────────────────────────────────────────────────
const proxyFunction = async (req, res, name) => {
  const body = await readBody(req);
  const target = `${FUNCTION_URL}/${name}`;
  const headers = { ...req.headers };
  delete headers.host;
  delete headers["content-length"];
  try {
    const response = await fetch(target, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
    const buffer = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, { ...cors, "Content-Type": response.headers.get("content-type") ?? "application/json" });
    res.end(buffer);
  } catch (error) {
    send(res, 502, { error: `function unreachable: ${error.message}` });
  }
};

const fakeGenerate = async (req, res) => {
  await readBody(req);
  const ext = path.extname(FIXTURE) || ".png";
  const objectPath = `e2e_${Date.now()}_${crypto.randomUUID().slice(0, 8)}${ext}`;
  const url = putObject("generated_images", objectPath, fs.readFileSync(FIXTURE));
  send(res, 200, {
    imageUrls: [url], storedImageUrls: [url], imagePaths: [objectPath], alreadyStored: true,
    optimizedPrompt: "E2E: oversized burgundy cotton hoodie, front chest embroidery, studio product photo",
  });
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, undefined);
  const url = new URL(req.url, PUBLIC_BASE);
  const claims = claimsFor(req);
  log(req.method, url.pathname, claims.role, claims.sub ?? "");
  const match = (prefix) => url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : null;
  let rest;
  if ((rest = match("/rest/v1/rpc/")) !== null) return restRpc(req, res, rest, claims);
  if ((rest = match("/rest/v1/")) !== null) return restTable(req, res, rest, claims, url);
  if ((rest = match("/storage/v1/")) !== null) return storage(req, res, rest, claims);
  if (url.pathname === "/auth/v1/user") {
    if (!claims.sub) return send(res, 401, { code: 401, msg: "invalid JWT" });
    const user = await pool.query("select id, email, created_at from auth.users where id = $1", [claims.sub]);
    if (!user.rows[0]) return send(res, 401, { code: 401, msg: "user not found" });
    return send(res, 200, { ...user.rows[0], aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} });
  }
  if ((rest = match("/functions/v1/")) !== null) {
    if (rest === "submit-production-request") return proxyFunction(req, res, rest);
    if (rest === "generate-optimized-image") return fakeGenerate(req, res);
    await readBody(req);
    return send(res, 200, {});
  }
  if (url.pathname.startsWith("/auth/v1/")) { await readBody(req); return send(res, 200, {}); }
  send(res, 404, { message: `no route ${url.pathname}` });
});

server.listen(PORT, "127.0.0.1", () => console.log(`gateway listening on ${PUBLIC_BASE}`));
