import {
  database,
  recordSync,
  requireCollector,
  sameOrigin,
  settings,
} from "@/lib/server";
import { parsePermitRows, type KosisRow } from "@/lib/kosis";

export async function POST(req: Request) {
  let authorized = false;
  try {
    sameOrigin(req);
    requireCollector(req);
    authorized = true;
    const key = settings().KOSIS_API_KEY;
    if (!key)
      return Response.json(
        { error: "KOSIS 인증키가 연결되지 않았습니다." },
        { status: 503 },
      );
    const body = (await req.json()) as {
      startYear?: unknown;
      endYear?: unknown;
    };
    const startYear = Number(body.startYear);
    const endYear = Number(body.endYear);
    if (
      !Number.isInteger(startYear) ||
      !Number.isInteger(endYear) ||
      startYear < 1990 ||
      endYear > new Date().getFullYear() ||
      startYear > endYear ||
      endYear - startYear > 35
    )
      return Response.json(
        { error: "수집 연도는 1990년 이후 최대 36개 연도로 지정하세요." },
        { status: 400 },
      );
    const url = new URL(
      "https://kosis.kr/openapi/Param/statisticsParameterData.do",
    );
    const params: Record<string, string> = {
      method: "getList",
      apiKey: key,
      orgId: "116",
      tblId: "DT_MLTM_666",
      itmId: "ALL",
      objL1: "ALL",
      prdSe: "Y",
      startPrdDe: String(startYear),
      endPrdDe: String(endYear),
      format: "json",
      jsonVD: "Y",
      outputFields:
        "ORG_ID TBL_ID TBL_NM OBJ_ID OBJ_NM NM C1 C1_NM ITM_ID ITM_NM UNIT_NM PRD_SE PRD_DE LST_CHN_DE",
    };
    Object.entries(params).forEach(([name, value]) =>
      url.searchParams.set(name, value),
    );
    const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error("KOSIS 응답 오류");
    const data = (await response.json()) as
      | KosisRow[]
      | { err?: string; errMsg?: string };
    if (!Array.isArray(data))
      return Response.json(
        {
          error: `KOSIS 조회 실패: ${String(data.errMsg || data.err || "응답 형식 오류")}`,
        },
        { status: 502 },
      );
    const records = parsePermitRows(data);
    if (!records.length)
      return Response.json(
        {
          error: "선택한 연도의 경상권 인허가 통계를 찾지 못했습니다.",
          available: data.slice(0, 5).map((row) => ({
            C1: row.C1,
            C1_NM: row.C1_NM,
            NM: row.NM,
            C2: row.C2,
            C2_NM: row.C2_NM,
            ITM_NM: row.ITM_NM,
            PRD_DE: row.PRD_DE,
            DT: row.DT,
          })),
        },
        { status: 404 },
      );
    for (let i = 0; i < records.length; i += 50)
      await database().batch(
        records
          .slice(i, i + 50)
          .map((record) =>
            database()
              .prepare(
                "INSERT INTO estate_records(id,payload,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated",
              )
              .bind(
                record.id,
                JSON.stringify(record),
                new Date().toISOString(),
              ),
          ),
      );
    await recordSync(
      "KOSIS",
      "success",
      records.length,
      `${startYear}~${endYear} 주택건설 인허가`,
    );
    return Response.json({
      ok: true,
      count: records.length,
      scope: "KOSIS 지역별 주택건설 인허가 연간통계 · 경상권 시도",
    });
  } catch (error) {
    if (authorized)
      try {
        await recordSync("KOSIS", "error", 0, "수집 실패");
      } catch {}
    return Response.json(
      {
        error:
          "KOSIS 수집을 완료하지 못했습니다. 인증키·통계표 제공상태를 확인하세요.",
        detail: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 502 },
    );
  }
}
