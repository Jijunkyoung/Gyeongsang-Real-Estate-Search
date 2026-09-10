import type { Estate } from "./estate";

const regionNames: Record<string, string> = {
  인천: "인천광역시",
  인천광역시: "인천광역시",
  부산: "부산광역시",
  부산광역시: "부산광역시",
  대구: "대구광역시",
  대구광역시: "대구광역시",
  울산: "울산광역시",
  울산광역시: "울산광역시",
  경남: "경상남도",
  경상남도: "경상남도",
  경북: "경상북도",
  경상북도: "경상북도",
};

export type KosisRow = Record<string, unknown>;

function publishedDate(value: unknown) {
  const text = String(value || "");
  return /^\d{8}$/.test(text)
    ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
    : new Date().toISOString().slice(0, 10);
}

export function parsePermitRows(rows: KosisRow[]): Estate[] {
  const result: Estate[] = [];
  for (const row of rows) {
    const region = regionNames[String(row.C1_NM || row.NM || "").trim()];
    const year = Number(row.PRD_DE);
    const value = Number(String(row.DT ?? "").replaceAll(",", ""));
    if (
      !region ||
      !Number.isInteger(year) ||
      !Number.isInteger(value) ||
      value < 0
    )
      continue;
    const date = publishedDate(row.LST_CHN_DE);
    result.push({
      id: `kosis-permit-${region}-${year}`,
      kind: "공급량",
      name: `${region} ${year}년 주택건설 인허가 실적`,
      region,
      district: "전체",
      date,
      source: "KOSIS · 국토교통부 주택건설실적통계",
      url: "https://kosis.kr/statHtml/statHtml.do?orgId=116&tblId=DT_MLTM_666",
      summary:
        "KOSIS 지역별 주택건설 인허가실적의 연간 시도 전체 수치입니다. 인허가는 실제 분양·입주·준공 물량과 다릅니다.",
      status: "공식 연간통계",
      important: false,
      units: value,
      year,
      supplyType: "인허가",
      coverage: "전체집계",
      supplyStatus: "confirmed",
    });
  }
  return [...new Map(result.map((item) => [item.id, item])).values()];
}
