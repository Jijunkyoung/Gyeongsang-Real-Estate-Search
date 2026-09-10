import { collectIncheonOfficialRecords } from "@/lib/incheon-sources";
import {
  database,
  recordSync,
  requireCollector,
  sameOrigin,
} from "@/lib/server";

export async function POST(req: Request) {
  let authorized = false;
  try {
    sameOrigin(req);
    await requireCollector(req);
    authorized = true;
    const { records, sources } = await collectIncheonOfficialRecords();
    if (!sources.some((source) => source.ok))
      throw new Error("모든 인천 공식 게시판 조회 실패");
    for (let i = 0; i < records.length; i += 50)
      await database().batch(
        records.slice(i, i + 50).map((record) =>
          database()
            .prepare(
              "INSERT INTO estate_records(id,payload,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated",
            )
            .bind(record.id, JSON.stringify(record), new Date().toISOString()),
        ),
      );
    const partial = sources.some((source) => !source.ok);
    await recordSync(
      "인천 공식자료",
      "success",
      records.length,
      partial ? "일부 게시판 실패 · 성공 자료 저장" : "3개 공식 채널 수집",
    );
    return Response.json({ ok: true, count: records.length, sources });
  } catch (error) {
    if (authorized)
      try {
        await recordSync("인천 공식자료", "error", 0, "수집 실패");
      } catch {}
    return Response.json(
      {
        error: "인천 공식자료 수집을 완료하지 못했습니다.",
        detail: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 502 },
    );
  }
}
