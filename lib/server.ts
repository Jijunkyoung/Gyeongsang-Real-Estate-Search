import { env } from "cloudflare:workers";
import { seed } from "./estate";
export function database() {
  if (!env.DB) throw new Error("저장소를 사용할 수 없습니다.");
  return env.DB;
}
export async function allRecords() {
  const r = await database()
    .prepare("SELECT id,payload FROM estate_records")
    .all<{ id: string; payload: string }>();
  const map = new Map(seed.map((x) => [x.id, x]));
  for (const x of r.results) {
    if (x.id.startsWith("_sync:")) continue;
    const v = JSON.parse(x.payload);
    map.set(v.id, v);
  }
  return [...map.values()];
}
export type SyncRun = {
  source: string;
  status: "success" | "error";
  count: number;
  message: string;
  updatedAt: string;
};
export async function syncRuns() {
  const r = await database()
    .prepare("SELECT payload FROM estate_records WHERE id LIKE '_sync:%'")
    .all<{ payload: string }>();
  return r.results
    .map((x) => JSON.parse(x.payload) as SyncRun)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function recordSync(
  source: string,
  status: SyncRun["status"],
  count: number,
  message: string,
) {
  const updatedAt = new Date().toISOString();
  const payload: SyncRun = { source, status, count, message, updatedAt };
  await database()
    .prepare(
      "INSERT INTO estate_records(id,payload,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated",
    )
    .bind(`_sync:${source}`, JSON.stringify(payload), updatedAt)
    .run();
}
export type UserIdentity = { id: string; email: string };
export function optionalIdentity(req: Request): UserIdentity | null {
  const id = req.headers.get("oai-authenticated-user-id");
  const email = req.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLowerCase();
  return id && email ? { id, email } : null;
}
export function owner(req: Request) {
  const user = optionalIdentity(req);
  if (!user) throw new Error("로그인이 필요합니다.");
  return user.email;
}
export function requireAdmin(req: Request) {
  const user = optionalIdentity(req);
  const adminId = settings().ADMIN_USER_ID;
  if (!user || !adminId || user.id !== adminId)
    throw new Error("관리자 권한이 필요합니다.");
  return user;
}
type GithubOidcClaims = {
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iss?: string;
  repository?: string;
  ref?: string;
  event_name?: string;
  workflow_ref?: string;
};
let githubKeys:
  | { expiresAt: number; keys: Array<JsonWebKey & { kid?: string }> }
  | undefined;
function decodeJwtPart(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}
async function verifyGithubCollector(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("OIDC 토큰 없음");
  const token = authorization.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("OIDC 토큰 형식 오류");
  const header = JSON.parse(
    new TextDecoder().decode(decodeJwtPart(parts[0])),
  ) as { alg?: string; kid?: string };
  const claims = JSON.parse(
    new TextDecoder().decode(decodeJwtPart(parts[1])),
  ) as GithubOidcClaims;
  if (header.alg !== "RS256" || !header.kid) throw new Error("OIDC 서명 형식 오류");
  if (!githubKeys || githubKeys.expiresAt < Date.now()) {
    const response = await fetch(
      "https://token.actions.githubusercontent.com/.well-known/jwks",
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) throw new Error("GitHub 공개키 조회 실패");
    const body = (await response.json()) as {
      keys?: Array<JsonWebKey & { kid?: string }>;
    };
    if (!body.keys?.length) throw new Error("GitHub 공개키 없음");
    githubKeys = { keys: body.keys, expiresAt: Date.now() + 3600000 };
  }
  const jwk = githubKeys.keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("GitHub 공개키 불일치");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeJwtPart(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const repository = "Jijunkyoung/Gyeongsang-Real-Estate-Search";
  if (
    !valid ||
    claims.iss !== "https://token.actions.githubusercontent.com" ||
    !audience.includes("yeongnam-property-atlas") ||
    claims.repository !== repository ||
    claims.ref !== "refs/heads/main" ||
    !["push", "schedule", "workflow_dispatch"].includes(
      claims.event_name || "",
    ) ||
    !claims.workflow_ref?.startsWith(
      `${repository}/.github/workflows/refresh-data.yml@refs/heads/main`,
    ) ||
    !claims.exp ||
    claims.exp < now ||
    (claims.nbf != null && claims.nbf > now + 30)
  )
    throw new Error("허용되지 않은 GitHub Actions 실행");
}
export async function requireCollector(req: Request) {
  const expected = settings().COLLECTION_TOKEN;
  const supplied = req.headers.get("x-collection-token");
  if (expected && supplied && supplied === expected) return;
  if (req.headers.get("authorization")?.startsWith("Bearer ")) {
    await verifyGithubCollector(req);
    return;
  }
  requireAdmin(req);
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new Error("요청 출처를 확인할 수 없습니다.");
}
export function settings() {
  return env as unknown as Record<string, string>;
}
