import type { Estate } from "./estate";

export type RoneCadence = "week" | "month";
export type RoneSeries = "sale" | "lease";

type RoneTable = {
  STATBL_ID?: string;
  STATBL_NM?: string;
  DTACYCLE_CD?: string;
};

type RoneItem = {
  ITM_ID?: string | number;
  ITM_NM?: string;
  ITM_FULLNM?: string;
};

export type RoneDataRow = {
  STATBL_ID?: string;
  WRTTIME_IDTFR_ID?: string | number;
  WRTTIME_DESC?: string;
  CLS_ID?: string | number;
  CLS_NM?: string;
  CLS_FULLNM?: string;
  ITM_ID?: string | number;
  ITM_NM?: string;
  ITM_FULLNM?: string;
  DTA_VAL?: string | number;
  UI_NM?: string;
};

export type RoneSelection = {
  id: string;
  name: string;
  cycle: "WK" | "MM";
  series: RoneSeries;
  cadence: RoneCadence;
};

const decodeXml = (value: string) =>
  value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");

export function parseRoneXml(xml: string) {
  const rows = [...xml.matchAll(/<row>([\s\S]*?)<\/row>/gi)].map((match) => {
    const row: Record<string, string> = {};
    for (const field of match[1].matchAll(/<([A-Z0-9_]+)>([\s\S]*?)<\/\1>/gi))
      row[field[1].toUpperCase()] = decodeXml(field[2].trim());
    return row;
  });
  const total = Number(xml.match(/<list_total_count>(\d+)<\/list_total_count>/i)?.[1] || rows.length);
  const code = xml.match(/<CODE>([^<]+)<\/CODE>/i)?.[1] || "";
  const message = decodeXml(xml.match(/<MESSAGE>([\s\S]*?)<\/MESSAGE>/i)?.[1] || "");
  return { rows, total, code, message };
}

function tableScore(table: RoneTable, series: RoneSeries, cadence: RoneCadence) {
  const name = String(table.STATBL_NM || "");
  const cycle = String(table.DTACYCLE_CD || "");
  const wantedCycle = cadence === "week" ? "WK" : "MM";
  if (!String(cycle).split(",").includes(wantedCycle)) return -1;
  if (!/아파트/.test(name) || !/지수/.test(name)) return -1;
  if (series === "sale" ? !/매매/.test(name) : !/전세/.test(name)) return -1;
  if (/실거래|평균|중위|규모별|유형별|계절조정/.test(name)) return -1;
  let score = 0;
  if (/변동률/.test(name)) score += 40;
  if (/가격지수/.test(name)) score += 20;
  if (/지역별|시군구별/.test(name)) score += 15;
  if (cadence === "week" && /주간|\(주\)/.test(name)) score += 10;
  if (cadence === "month" && /월간|\(월\)/.test(name)) score += 10;
  return score;
}

export function selectRoneTables(tables: RoneTable[]) {
  const selections: RoneSelection[] = [];
  for (const cadence of ["week", "month"] as const)
    for (const series of ["sale", "lease"] as const) {
      const best = tables
        .map((table) => ({ table, score: tableScore(table, series, cadence) }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score)[0]?.table;
      if (best?.STATBL_ID)
        selections.push({
          id: best.STATBL_ID,
          name: String(best.STATBL_NM || best.STATBL_ID),
          cycle: cadence === "week" ? "WK" : "MM",
          series,
          cadence,
        });
    }
  return selections;
}

export function selectRoneValueItem(items: RoneItem[]) {
  const scored = items
    .map((item) => {
      const name = `${item.ITM_NM || ""} ${item.ITM_FULLNM || ""}`;
      const score = /변동률/.test(name) ? 30 : /증감률/.test(name) ? 20 : /지수/.test(name) ? 10 : 0;
      return { item, score, isRate: /변동률|증감률/.test(name) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  if (!scored?.item.ITM_ID) return null;
  return { id: String(scored.item.ITM_ID), isRate: scored.isRate };
}

const regionAliases: Array<[string, string[]]> = [
  ["울산광역시", ["울산광역시", "울산"]],
  ["인천광역시", ["인천광역시", "인천"]],
  ["부산광역시", ["부산광역시", "부산"]],
  ["대구광역시", ["대구광역시", "대구"]],
  ["경상남도", ["경상남도", "경남"]],
  ["경상북도", ["경상북도", "경북"]],
];

const targetDistricts: Record<string, string[]> = {
  울산광역시: ["중구", "남구", "동구", "북구", "울주군"],
  인천광역시: [
    "제물포구", "영종구", "미추홀구", "연수구", "남동구", "부평구",
    "계양구", "서해구", "검단구", "강화군", "옹진군",
  ],
  부산광역시: [
    "중구", "서구", "동구", "영도구", "부산진구", "동래구", "남구", "북구",
    "해운대구", "사하구", "금정구", "강서구", "연제구", "수영구", "사상구", "기장군",
  ],
  대구광역시: [
    "중구", "동구", "서구", "남구", "북구", "수성구", "달서구", "달성군", "군위군",
  ],
  경상남도: [
    "창원시", "진주시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시",
    "의령군", "함안군", "창녕군", "고성군", "남해군", "하동군", "산청군", "함양군",
    "거창군", "합천군",
  ],
  경상북도: [
    "포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시",
    "문경시", "경산시", "의성군", "청송군", "영양군", "영덕군", "청도군", "고령군",
    "성주군", "칠곡군", "예천군", "봉화군", "울진군", "울릉군",
  ],
};

const targetCityDistricts = {
  창원시: ["의창구", "성산구", "마산합포구", "마산회원구", "진해구"],
  포항시: ["남구", "북구"],
};

export function roneLocation(row: RoneDataRow) {
  const label = `${row.CLS_FULLNM || ""} ${row.CLS_NM || ""}`.replace(/\s+/g, " ").trim();
  const matched = regionAliases.find(([, aliases]) => aliases.some((alias) => label.includes(alias)));
  if (!matched) return null;
  const region = matched[0];
  let district = "전체";
  for (const value of targetDistricts[region])
    if (label.includes(value)) {
      district = value;
      break;
    }
  if (region === "경상남도" && label.includes("창원"))
    for (const child of targetCityDistricts.창원시)
      if (label.includes(child)) district = `창원시 ${child}`;
  if (region === "경상북도" && label.includes("포항"))
    for (const child of targetCityDistricts.포항시)
      if (label.includes(child)) district = `포항시 ${child}`;
  return { region, district };
}

function isoWeekDate(year: number, week: number) {
  const fourth = new Date(Date.UTC(year, 0, 4));
  const day = fourth.getUTCDay() || 7;
  fourth.setUTCDate(fourth.getUTCDate() - day + 1 + (week - 1) * 7);
  return fourth.toISOString().slice(0, 10);
}

export function roneDate(row: RoneDataRow, cadence: RoneCadence) {
  const description = String(row.WRTTIME_DESC || "");
  const full = description.match(/(20\d{2})\D+(\d{1,2})\D+(\d{1,2})/);
  if (full)
    return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
  const value = String(row.WRTTIME_IDTFR_ID || "").replace(/\D/g, "");
  if (cadence === "month" && /^\d{6}$/.test(value))
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-01`;
  if (cadence === "week" && /^\d{6}$/.test(value))
    return isoWeekDate(Number(value.slice(0, 4)), Number(value.slice(4, 6)));
  return null;
}

export function normalizeRoneRows(
  rows: RoneDataRow[],
  selection: RoneSelection,
  item: { id: string; isRate: boolean },
  checkedAt: string,
) {
  const prepared = rows
    .filter((row) => String(row.ITM_ID || "") === item.id)
    .map((row) => ({ row, location: roneLocation(row), date: roneDate(row, selection.cadence) }))
    .filter((entry): entry is typeof entry & { location: NonNullable<typeof entry.location>; date: string } =>
      !!entry.location && !!entry.date && Number.isFinite(Number(entry.row.DTA_VAL)),
    )
    .sort((a, b) =>
      `${a.row.CLS_ID || ""}-${a.date}`.localeCompare(`${b.row.CLS_ID || ""}-${b.date}`),
    );
  const previous = new Map<string, number>();
  const records: Estate[] = [];
  for (const entry of prepared) {
    const value = Number(entry.row.DTA_VAL);
    const classification = String(entry.row.CLS_ID || entry.row.CLS_NM || "unknown");
    let rate: number | null = item.isRate ? value : null;
    if (!item.isRate) {
      const old = previous.get(classification);
      if (old != null && old !== 0) rate = ((value - old) / old) * 100;
      previous.set(classification, value);
    }
    if (rate == null || !Number.isFinite(rate)) continue;
    const metric = `${selection.series === "sale" ? "매매" : "전세"}지수 ${selection.cadence === "week" ? "주간" : "월간"}`;
    records.push({
      id: `rone-${selection.id}-${classification}-${String(entry.row.WRTTIME_IDTFR_ID || entry.date)}-${selection.series}`,
      kind: "시장지표",
      name: `${entry.location.region} ${entry.location.district} ${metric}`,
      region: entry.location.region,
      district: entry.location.district,
      date: entry.date,
      dateType: "official",
      verifiedAt: checkedAt,
      source: "한국부동산원 R-ONE",
      url: `https://www.reb.or.kr/r-one/portal/stat/easyStatPage/${selection.id}.do`,
      summary: `${selection.name}의 공식 ${item.isRate ? "변동률" : "가격지수 전기 대비 계산값"}입니다.`,
      status: "공식자료",
      important: false,
      rate: Number(rate.toFixed(4)),
      metric,
    });
  }
  return records;
}
