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
export function requireCollector(req: Request) {
  const expected = settings().COLLECTION_TOKEN;
  const supplied = req.headers.get("x-collection-token");
  if (expected && supplied && supplied === expected) return;
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
