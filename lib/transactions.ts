export type ApartmentTrade = {
  apartment: string;
  district: string;
  dong: string;
  address: string;
  area: number;
  amount: number;
  date: string;
  floor: number | null;
  builtYear: number | null;
};

const lawdCodes: Record<string, Record<string, string>> = {
  울산광역시: { 중구: "31110", 남구: "31140", 동구: "31170", 북구: "31200", 울주군: "31710" },
  부산광역시: {
    중구: "26110", 서구: "26140", 동구: "26170", 영도구: "26200", 부산진구: "26230",
    동래구: "26260", 남구: "26290", 북구: "26320", 해운대구: "26350", 사하구: "26380",
    금정구: "26410", 강서구: "26440", 연제구: "26470", 수영구: "26500", 사상구: "26530", 기장군: "26710",
  },
  대구광역시: {
    중구: "27110", 동구: "27140", 서구: "27170", 남구: "27200", 북구: "27230",
    수성구: "27260", 달서구: "27290", 달성군: "27710", 군위군: "27720",
  },
  경상남도: {
    "창원시 의창구": "48121", "창원시 성산구": "48123", "창원시 마산합포구": "48125",
    "창원시 마산회원구": "48127", "창원시 진해구": "48129", 진주시: "48170", 통영시: "48220",
    사천시: "48240", 김해시: "48250", 밀양시: "48270", 거제시: "48310", 양산시: "48330",
    의령군: "48720", 함안군: "48730", 창녕군: "48740", 고성군: "48820", 남해군: "48840",
    하동군: "48850", 산청군: "48860", 함양군: "48870", 거창군: "48880", 합천군: "48890",
  },
  경상북도: {
    "포항시 남구": "47111", "포항시 북구": "47113", 경주시: "47130", 김천시: "47150",
    안동시: "47170", 구미시: "47190", 영주시: "47210", 영천시: "47230", 상주시: "47250",
    문경시: "47280", 경산시: "47290", 의성군: "47730", 청송군: "47750", 영양군: "47760",
    영덕군: "47770", 청도군: "47820", 고령군: "47830", 성주군: "47840", 칠곡군: "47850",
    예천군: "47900", 봉화군: "47920", 울진군: "47930", 울릉군: "47940",
  },
};

export function lawdCodeFor(region: string, district: string) {
  return lawdCodes[region]?.[district] || null;
}

function decode(value: string) {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => entities[name])
    .trim();
}

function tag(xml: string, ...names: string[]) {
  for (const name of names) {
    const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match) return decode(match[1]);
  }
  return "";
}

function number(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseApartmentTrades(xml: string): ApartmentTrade[] {
  const code = tag(xml, "resultCode", "returnReasonCode");
  if (code && !["00", "000"].includes(code))
    throw new Error(
      tag(xml, "resultMsg", "errMsg", "returnAuthMsg") ||
        `공공데이터 오류 ${code}`,
    );
  const rows: ApartmentTrade[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const item = match[1];
    const amount = number(tag(item, "dealAmount", "거래금액"));
    const area = number(tag(item, "excluUseAr", "전용면적"));
    const year = tag(item, "dealYear", "년");
    const month = tag(item, "dealMonth", "월").padStart(2, "0");
    const day = tag(item, "dealDay", "일").padStart(2, "0");
    const cancelled = tag(item, "cdealDay", "해제사유발생일");
    if (amount == null || area == null || !/^\d{4}$/.test(year) || cancelled) continue;
    const floor = number(tag(item, "floor", "층"));
    const builtYear = number(tag(item, "buildYear", "건축년도"));
    const dong = tag(item, "umdNm", "법정동");
    const jibun = tag(item, "jibun", "지번");
    rows.push({
      apartment: tag(item, "aptNm", "아파트") || "단지명 미제공",
      district: tag(item, "sggNm", "시군구"),
      dong,
      address: [dong, jibun].filter(Boolean).join(" "),
      area,
      amount,
      date: `${year}-${month}-${day}`,
      floor: floor == null ? null : floor,
      builtYear: builtYear == null ? null : builtYear,
    });
  }
  return rows;
}

export function recentMonths(endMonth: string, count: number) {
  const [year, month] = endMonth.split("-").map(Number);
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(Date.UTC(year, month - 1 - i, 1));
    result.push(`${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

async function fetchMonth(key: string, lawdCode: string, month: string) {
  const url = new URL(
    "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev",
  );
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("LAWD_CD", lawdCode);
  url.searchParams.set("DEAL_YMD", month);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "2000");
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const xml = await response.text();
  if (!response.ok)
    throw new Error(`공공데이터 응답 오류 (${response.status})`);
  return parseApartmentTrades(xml);
}

export async function lookupApartmentTrades(input: {
  key: string;
  region: string;
  district: string;
  area: number;
  months: number;
  endMonth: string;
}) {
  const lawdCode = lawdCodeFor(input.region, input.district);
  if (!lawdCode)
    throw new Error(
      "창원·포항은 구까지 선택하고, 그 밖의 지역은 시·군·구를 선택하세요.",
    );
  const months = recentMonths(input.endMonth, input.months);
  const all: ApartmentTrade[] = [];
  for (let index = 0; index < months.length; index += 3) {
    const batch = await Promise.all(
      months
        .slice(index, index + 3)
        .map((month) => fetchMonth(input.key, lawdCode, month)),
    );
    batch.forEach((rows) => all.push(...rows));
  }
  const tolerance = input.area * 0.1;
  const comparable = all
    .filter((trade) => Math.abs(trade.area - input.area) <= tolerance)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        Math.abs(a.area - input.area) - Math.abs(b.area - input.area),
    );
  const amounts = comparable.map((trade) => trade.amount).sort((a, b) => a - b);
  const median = amounts.length
    ? amounts.length % 2
      ? amounts[Math.floor(amounts.length / 2)]
      : Math.round(
          (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2,
        )
    : null;
  return {
    items: comparable.slice(0, 200),
    summary: {
      count: comparable.length,
      average: amounts.length
        ? Math.round(
            amounts.reduce((sum, value) => sum + value, 0) / amounts.length,
          )
        : null,
      median,
      minimum: amounts[0] ?? null,
      maximum: amounts.at(-1) ?? null,
    },
    scope: `${input.region} ${input.district} · ${months.at(-1)}~${months[0]} 계약 · 전용면적 ±10%`,
    source: "국토교통부 아파트 매매 실거래가 상세 자료",
    sourceUrl: "https://www.data.go.kr/data/15126468/openapi.do",
  };
}
