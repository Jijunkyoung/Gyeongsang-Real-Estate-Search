import { database, recordSync, requireCollector, sameOrigin, settings } from "@/lib/server";
import {
  normalizeRoneRows,
  parseRoneXml,
  selectRoneTables,
  selectRoneValueItem,
  type RoneDataRow,
  type RoneSelection,
} from "@/lib/rone";

const base = "https://www.reb.or.kr/r-one/openapi";

async function roneRows(endpoint: string, key: string, params: Record<string, string>) {
  const firstUrl = new URL(`${base}/${endpoint}`);
  const shared = { KEY: key, pSize: "1000", ...params };
  Object.entries({ ...shared, pIndex: "1" }).forEach(([name, value]) =>
    firstUrl.searchParams.set(name, value),
  );
  const firstResponse = await fetch(firstUrl, { signal: AbortSignal.timeout(25000) });
  if (!firstResponse.ok) throw new Error(`R-ONE 응답 오류 (${firstResponse.status})`);
  const first = parseRoneXml(await firstResponse.text());
  if (first.code && !["INFO-000", "INFO-200"].includes(first.code))
    throw new Error(`${first.code}: ${first.message}`);
  const pages = Math.ceil(first.total / 1000);
  const rows = [...first.rows];
  for (let start = 2; start <= pages; start += 4) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(4, pages - start + 1) }, async (_, index) => {
        const url = new URL(`${base}/${endpoint}`);
        Object.entries({ ...shared, pIndex: String(start + index) }).forEach(([name, value]) =>
          url.searchParams.set(name, value),
        );
        const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
        if (!response.ok) throw new Error(`R-ONE 응답 오류 (${response.status})`);
        const parsed = parseRoneXml(await response.text());
        if (parsed.code && !["INFO-000", "INFO-200"].includes(parsed.code))
          throw new Error(`${parsed.code}: ${parsed.message}`);
        return parsed.rows;
      }),
    );
    rows.push(...batch.flat());
  }
  return rows;
}

async function collectSelection(
  selection: RoneSelection,
  key: string,
  startYear: number,
  checkedAt: string,
) {
  const items = await roneRows("SttsApiTblItm.do", key, {
    STATBL_ID: selection.id,
    ITM_TAG: "항목",
  });
  const item = selectRoneValueItem(items);
  if (!item) throw new Error(`${selection.name}: 변동률·지수 항목을 찾지 못했습니다.`);
  const rows = (await roneRows("SttsApiTblData.do", key, {
    STATBL_ID: selection.id,
    DTACYCLE_CD: selection.cycle,
    ITM_ID: item.id,
    START_WRTTIME: String(startYear),
    END_WRTTIME: String(new Date().getUTCFullYear()),
  })) as RoneDataRow[];
  return normalizeRoneRows(rows, selection, item, checkedAt);
}

export async function POST(req: Request) {
  let authorized = false;
  try {
    sameOrigin(req);
    await requireCollector(req);
    authorized = true;
    const key = settings().RONE_API_KEY;
    if (!key)
      return Response.json({ error: "R-ONE 인증키가 연결되지 않았습니다." }, { status: 503 });
    const body = (await req.json().catch(() => ({}))) as { backfill?: unknown };
    const backfill = body.backfill === true;
    const now = new Date();
    const checkedAt = now.toISOString().slice(0, 10);
    const catalog = await roneRows("SttsApiTbl.do", key, {});
    const selections = selectRoneTables(catalog);
    // R-ONE Open API currently publishes the monthly price tables. Weekly
    // apartment trends are released through the separate bulletin/report feed,
    // so their absence must not block the official monthly backfill.
    const wanted = ["month-sale", "month-lease"];
    const found = new Set(selections.map((value) => `${value.cadence}-${value.series}`));
    const missing = wanted.filter((value) => !found.has(value));
    if (missing.length)
      throw new Error(`필요 통계표를 찾지 못했습니다: ${missing.join(", ")}`);
    const all = [];
    const diagnostics = [];
    for (const selection of selections) {
      const years = selection.cadence === "week" ? (backfill ? 2 : 1) : backfill ? 5 : 1;
      const records = await collectSelection(
        selection,
        key,
        now.getUTCFullYear() - years,
        checkedAt,
      );
      all.push(...records);
      diagnostics.push({
        cadence: selection.cadence,
        series: selection.series,
        table: selection.id,
        name: selection.name,
        count: records.length,
      });
    }
    const unique = [...new Map(all.map((record) => [record.id, record])).values()];
    for (let i = 0; i < unique.length; i += 50)
      await database().batch(
        unique.slice(i, i + 50).map((record) =>
          database()
            .prepare(
              "INSERT INTO estate_records(id,payload,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated",
            )
            .bind(record.id, JSON.stringify(record), new Date().toISOString()),
        ),
      );
    await recordSync(
      "R-ONE",
      "success",
      unique.length,
      `${backfill ? "과거자료 역수집" : "최근자료 갱신"} · 월간 매매·전세`,
    );
    return Response.json({
      ok: true,
      count: unique.length,
      backfill,
      diagnostics,
      weekly: selections.some((value) => value.cadence === "week")
        ? "R-ONE 주간 통계표 수집"
        : "R-ONE Open API 주간 통계표 미제공 · 기존 공식 주간자료 유지",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("R-ONE collection failed", detail);
    if (authorized)
      try {
        await recordSync("R-ONE", "error", 0, `수집 실패 · ${detail.slice(0, 240)}`);
      } catch {}
    return Response.json(
      {
        error: "R-ONE 과거 시장지표를 수집하지 못했습니다.",
        detail,
      },
      { status: 502 },
    );
  }
}
