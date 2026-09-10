import type { Estate } from "./estate";

type BoardSource = {
  key: string;
  name: string;
  baseUrl: string;
  urls: string[];
};

export type IncheonSourceResult = {
  source: string;
  ok: boolean;
  fetched: number;
  matched: number;
  message: string;
};

const keywords = [
  "재개발",
  "재건축",
  "정비구역",
  "도시개발",
  "개발계획",
  "공공주택",
  "분양",
];

const cityUrls = keywords.map((keyword) => {
  const url = new URL("https://www.incheon.go.kr/IC010101");
  url.searchParams.set("srchKey", "srchSj");
  url.searchParams.set("srchWord", keyword);
  url.searchParams.set("curPage", "1");
  return url.toString();
});

const ifezUrls = ["noti01", "noti02"].flatMap((board) =>
  keywords.map((keyword) => {
    const url = new URL("https://www.ifez.go.kr/main/pst/list.do");
    url.searchParams.set("pst_id", board);
    url.searchParams.set("page", "1");
    url.searchParams.set("srchKey", "A");
    url.searchParams.set("srchVal", keyword);
    return url.toString();
  }),
);

export const incheonBoardSources: BoardSource[] = [
  {
    key: "city-news",
    name: "인천광역시 새소식",
    baseUrl: "https://www.incheon.go.kr",
    urls: cityUrls,
  },
  {
    key: "housing",
    name: "인천광역시 주택포털",
    baseUrl: "https://www.incheon.go.kr",
    urls: [1, 2].map(
      (page) =>
        `https://www.incheon.go.kr/housing/hou050100?curPage=${page}`,
    ),
  },
  {
    key: "ifez",
    name: "인천경제자유구역청",
    baseUrl: "https://www.ifez.go.kr",
    urls: ifezUrls,
  },
];

function decodeHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const relevantPattern =
  /재개발|재건축|정비구역|정비계획|사업시행인가|관리처분|가로주택|소규모(?:주택|재건축)|도시개발|개발계획|실시계획|지구단위계획|공공주택|주택건설(?:사업|공사)|공동주택|입주자\s*모집|분양|주택\s*공급|택지개발|역세권개발|경제자유구역/;
const excludedPattern =
  /인재개발원|인력양성|교육생|직업훈련|채용|합격자|수강생|교육과정/;

export function isRelevantIncheonTitle(title: string) {
  return relevantPattern.test(title) && !excludedPattern.test(title);
}

export function inferIncheonDistrict(title: string) {
  const rules: Array<[RegExp, string]> = [
    [/검단|마전|불로|원당|당하|오류동/, "검단구"],
    [/영종|운서|중산|하늘도시|용유/, "영종구"],
    [/청라|가정|루원|석남|가좌|서구/, "서해구"],
    [/송도|연수|동춘|옥련|선학/, "연수구"],
    [/남동|구월|논현|간석|만수/, "남동구"],
    [/부평|삼산|갈산|청천/, "부평구"],
    [/계양|작전|효성|계산/, "계양구"],
    [/강화/, "강화군"],
    [/옹진|백령|영흥/, "옹진군"],
    [/미추홀|주안|용현|학익|도화/, "미추홀구"],
    [/제물포|내항|동구|중구|송림|화수/, "제물포구"],
  ];
  return rules.find(([pattern]) => pattern.test(title))?.[1] || "전체";
}

function classifyKind(title: string) {
  if (/재건축|소규모재건축/.test(title)) return "재건축";
  if (/재개발|정비구역|정비계획|사업시행인가|관리처분|가로주택/.test(title))
    return "재개발";
  if (/입주자\s*모집|분양|주택\s*공급/.test(title)) return "분양";
  return "개발사업";
}

function stableNumber(href: string) {
  const decoded = decodeHtml(href);
  return (
    decoded.match(/[?&](?:nttNo|pst_sn)=([0-9]+)/i)?.[1] ||
    decoded.match(/\/([0-9]+)(?:[/?#]|$)/)?.[1]
  );
}

export function parseIncheonBoardHtml(
  html: string,
  source: Pick<BoardSource, "key" | "name" | "baseUrl">,
) {
  const records: Estate[] = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1];
    const link = row.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const date = row.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
    if (!link || !date) continue;
    const title = decodeHtml(link[2]).replace(/^["']+|["']+$/g, "").trim();
    const number = stableNumber(link[1]);
    if (!number || !isRelevantIncheonTitle(title)) continue;
    const url = new URL(decodeHtml(link[1]), source.baseUrl).toString();
    records.push({
      id: `incheon-${source.key}-${number}`,
      kind: classifyKind(title),
      name: title,
      region: "인천광역시",
      district: inferIncheonDistrict(title),
      date,
      dateType: "official",
      source: source.name,
      url,
      summary: `${source.name} 공식 게시목록에서 제목과 게시일을 자동 확인했습니다. 사업 단계·세대수·구역 경계는 연결된 원문과 첨부 고시문을 함께 확인하세요.`,
      status: "공식 게시",
      important: /고시|공고|인가|계획|입주자\s*모집/.test(title),
      stage: /관리처분/.test(title)
        ? "관리처분"
        : /사업시행인가/.test(title)
          ? "사업시행인가"
          : /정비구역|정비계획/.test(title)
            ? "정비계획"
            : undefined,
    });
  }
  return records;
}

export async function collectIncheonOfficialRecords(
  fetcher: typeof fetch = fetch,
) {
  const records = new Map<string, Estate>();
  const sourceResults = await Promise.all(
    incheonBoardSources.map(async (source) => {
    const settled = await Promise.allSettled(
      source.urls.map(async (url) => {
        const response = await fetcher(url, {
          headers: { "User-Agent": "YeongnamPropertyAtlas/1.0" },
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return parseIncheonBoardHtml(await response.text(), source);
      }),
    );
    const fulfilled = settled.filter(
      (item): item is PromiseFulfilledResult<Estate[]> =>
        item.status === "fulfilled",
    );
    const failures = settled.length - fulfilled.length;
      return {
        source,
        records: fulfilled.flatMap((item) => item.value),
        result: {
          source: source.name,
          ok: fulfilled.length > 0,
          fetched: fulfilled.length,
          matched: fulfilled.reduce((sum, item) => sum + item.value.length, 0),
          message: failures
            ? `${failures}개 조회 실패, 나머지 결과 저장`
            : "공식 게시목록 조회 완료",
        } satisfies IncheonSourceResult,
      };
    }),
  );
  for (const sourceResult of sourceResults)
    for (const record of sourceResult.records) records.set(record.id, record);
  return {
    records: [...records.values()],
    sources: sourceResults.map((item) => item.result),
  };
}
