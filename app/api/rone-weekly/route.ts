import { regions, type Estate } from "@/lib/estate";
import { database, recordSync, requireCollector, sameOrigin } from "@/lib/server";

const metrics = new Set(["매매지수 주간", "전세지수 주간"]);
const sourceUrl =
  "https://www.reb.or.kr/r-one/portal/bbs/rpt/selectBulletinPage.do?bbsCd=RPT&seq=3140&noticeYn=Y&listSubCd=RPT03";

type WeeklyRow = {
  region?: unknown;
  district?: unknown;
  date?: unknown;
  metric?: unknown;
  rate?: unknown;
};

function normalize(row: WeeklyRow, verifiedAt: string): Estate {
  const region = String(row.region || "");
  const district = String(row.district || "");
  const date = String(row.date || "");
  const metric = String(row.metric || "");
  const rate = Number(row.rate);
  if (
    !(region in regions) ||
    (district !== "전체" && !regions[region].includes(district)) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !metrics.has(metric) ||
    !Number.isFinite(rate) ||
    Math.abs(rate) > 20
  )
    throw new Error("주간 시계열 행 형식이 올바르지 않습니다.");
  return {
    id: `rone-weekly:${metric}:${date}:${region}:${district}`,
    kind: "시장지표",
    name: `${region} ${district} ${metric}`,
    region,
    district,
    date,
    dateType: "official",
    verifiedAt,
    source: "한국부동산원 R-ONE 주간아파트가격동향조사",
    url: sourceUrl,
    summary:
      "한국부동산원 주간아파트가격동향조사 시계열 통계표의 전주 대비 변동률입니다.",
    status: "공식통계",
    important: false,
    rate: Math.round(rate * 10000) / 10000,
    metric,
  };
}

export async function POST(req: Request) {
  let authorized = false;
  try {
    sameOrigin(req);
    await requireCollector(req);
    authorized = true;
    const body = (await req.json()) as {
      rows?: WeeklyRow[];
      final?: unknown;
      total?: unknown;
      workbook?: unknown;
      verifiedAt?: unknown;
    };
    if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 1000)
      return Response.json(
        { error: "한 번에 1~1000개의 주간 시계열 행을 보내세요." },
        { status: 400 },
      );
    const verifiedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(body.verifiedAt || ""))
      ? String(body.verifiedAt)
      : new Date().toISOString().slice(0, 10);
    const records = body.rows.map((row) => normalize(row, verifiedAt));
    const updated = new Date().toISOString();
    for (let index = 0; index < records.length; index += 50)
      await database().batch(
        records.slice(index, index + 50).map((record) =>
          database()
            .prepare(
              "INSERT INTO estate_records(id,payload,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated",
            )
            .bind(record.id, JSON.stringify(record), updated),
        ),
      );
    if (body.final === true) {
      const total = Number(body.total);
      const workbook = String(body.workbook || "시계열 통계표").slice(0, 120);
      await recordSync(
        "R-ONE 주간",
        "success",
        Number.isFinite(total) ? total : records.length,
        `과거자료 역수집 · 최근 5년 매매·전세 · ${workbook}`,
      );
    }
    return Response.json({ ok: true, count: records.length, final: body.final === true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "알 수 없는 오류";
    if (authorized)
      try {
        await recordSync("R-ONE 주간", "error", 0, `수집 실패 · ${detail.slice(0, 240)}`);
      } catch {}
    return Response.json(
      { error: "R-ONE 주간 시계열을 저장하지 못했습니다.", detail },
      { status: 502 },
    );
  }
}
