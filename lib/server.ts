import { env } from "cloudflare:workers";
import { seed } from "./estate";
export function database() {
  if (!env.DB) throw new Error("저장소를 사용할 수 없습니다.");
  return env.DB;
}
export async function allRecords() {
  const r = await database()
    .prepare("SELECT payload FROM estate_records")
    .all<{ payload: string }>();
  const map = new Map(seed.map((x) => [x.id, x]));
  for (const x of r.results) {
    const v = JSON.parse(x.payload);
    map.set(v.id, v);
  }
  return [...map.values()];
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
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new Error("요청 출처를 확인할 수 없습니다.");
}
export function settings() {
  return env as unknown as Record<string, string>;
}
