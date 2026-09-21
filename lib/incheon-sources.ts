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

const IH_BASE_URL = "https://www.ih.co.kr";
const LH_SALE_URL =
  "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1027";
const LH_RENT_URL =
  "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1026";

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
  /재개발|재건축|정비구역|정비계획|사업시행인가|관리처분|가로주택|소규모(?:주택|재건축)|도시개발|개발계획|실시계획|지구단위계획|공공주택|주택건설(?:사업|공사)|공동주택|입주자\s*모집|분양|주택\s*공급|택지개발|역세권개발|경제자유구역|사용검사/;
const excludedPattern =
  /인재개발원|인력양성|교육생|직업훈련|채용|합격자|수강생|교육과정/;

export function isRelevantIncheonTitle(title: string) {
  return relevantPattern.test(title) && !excludedPattern.test(title);
}

export function inferIncheonDistrict(title: string) {
  const rules: Array<[RegExp, string]> = [
    [/검단|검암|마전|불로|원당|당하|오류동/, "검단구"],
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

export function parseIhHousingNotices(html: string) {
  const records: Estate[] = [];
  const pattern =
    /<p\b[^>]*class=["'][^"']*title[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']*msg_seq=([0-9]+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?title=["']작성일["'][^>]*>\s*(20\d{2})[.-](\d{2})[.-](\d{2})\s*<\/li>/gi;
  for (const match of html.matchAll(pattern)) {
    const title = decodeHtml(match[3]);
    if (!isRelevantIncheonTitle(title)) continue;
    const date = `${match[4]}-${match[5]}-${match[6]}`;
    records.push({
      id: `incheon-ih-housing-${match[2]}`,
      kind: classifyKind(title),
      name: title,
      region: "인천광역시",
      district: inferIncheonDistrict(title),
      date,
      dateType: "official",
      source: "iH 인천도시공사 주택분양",
      url: new URL(decodeHtml(match[1]), IH_BASE_URL).toString(),
      summary:
        "인천도시공사 공식 주택분양 게시판의 공고입니다. 공급조건·세대수·신청기간은 연결된 공고문과 첨부파일에서 확인하세요.",
      status: "iH 공식 공고",
      important: /입주자\s*모집|분양|공급|사용검사/.test(title),
    });
  }
  return records;
}

export function parseIhProjects(
  html: string,
  checkedAt = new Date().toISOString().slice(0, 10),
) {
  const records: Estate[] = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1];
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (cell) => decodeHtml(cell[1]),
    );
    if (cells.length < 5) continue;
    const link = row.match(
      /<a\b[^>]*href=["']([^"']*land_seq=([0-9]+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!link) continue;
    const type = cells[1];
    const title = decodeHtml(link[3]);
    const relevantType = /도시개발사업|도시재생사업|건축사업|AMC사업/.test(
      type,
    );
    const relevantTitle =
      /주택|아파트|공동주택|임대|도시|지구|역세권|복합|단지|개발|재생|검단|계양|영종|송도|청라|도화|구월|검암/.test(
        title,
      );
    if (!relevantType || !relevantTitle) continue;
    const scale = cells[3] || "규모 미표기";
    const period = cells[4].replace(/\s+/g, " ").trim() || "기간 미표기";
    records.push({
      id: `incheon-ih-project-${link[2]}`,
      kind: classifyKind(title),
      name: title,
      region: "인천광역시",
      district: inferIncheonDistrict(title),
      date: checkedAt,
      dateType: "checked",
      verifiedAt: checkedAt,
      source: "iH 인천도시공사 진행사업",
      url: new URL(decodeHtml(link[1]), IH_BASE_URL).toString(),
      summary: `${type} · 사업규모 ${scale} · 사업기간 ${period}. 인천도시공사 공식 진행사업 현황 기준이며 세부 단계는 연결된 사업 페이지에서 확인하세요.`,
      status: `${type} · ${period}`,
      important: /도시개발|도시재생|주택|아파트|임대/.test(
        `${type} ${title}`,
      ),
    });
  }
  return records;
}

export function parseLhIncheonNotices(html: string, listUrl: string) {
  const records: Estate[] = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1];
    const link = row.match(
      /<a\b[^>]*data-id1=["']([0-9]+)["'][^>]*class=["'][^"']*wrtancInfoBtn[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!link) continue;
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (cell) => decodeHtml(cell[1]),
    );
    if (cells.length < 8 || cells[3] !== "인천광역시") continue;
    const title = decodeHtml(link[2]).replace(/\s*\d+일전\s*$/, "").trim();
    const dates = row.match(/20\d{2}[.-]\d{2}[.-]\d{2}/g) || [];
    if (!dates.length) continue;
    const date = dates[0].replaceAll(".", "-");
    const closing = dates[1]?.replaceAll(".", "-");
    const noticeType = cells[1] || "공공주택";
    const status = cells[7] || "공고";
    records.push({
      id: `incheon-lh-${link[1]}`,
      kind: "분양",
      name: title,
      region: "인천광역시",
      district: inferIncheonDistrict(title),
      date,
      dateType: "official",
      source: "LH청약플러스",
      url: listUrl,
      summary: `${noticeType} 공식 공고입니다.${closing ? ` 공고 마감일은 ${closing}입니다.` : ""} 신청조건과 실제 접수일은 LH 원문에서 확인하세요.`,
      status: `${noticeType} · ${status}`,
      important: /공고중|정정공고중|접수중/.test(status),
    });
  }
  return records;
}

export async function collectIncheonOfficialRecords(
  fetcher: typeof fetch = fetch,
) {
  const records = new Map<string, Estate>();
  const boardResults = await Promise.all(
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
  const customSources = [
    {
      name: "iH 인천도시공사 주택분양",
      urls: [1, 2, 3].map((page) =>
        page === 1
          ? `${IH_BASE_URL}/main/sale_lease/board/house_notice.jsp`
          : `${IH_BASE_URL}/main/bbs/bbsMsgList.do?cate1=a&bcd=sale_lease&pgno=${page}`,
      ),
      parse: (html: string) => parseIhHousingNotices(html),
    },
    {
      name: "iH 인천도시공사 진행사업",
      urls: [1, 2, 3, 4].map((page) =>
        page === 1
          ? `${IH_BASE_URL}/main/business/all.jsp`
          : `${IH_BASE_URL}/main/land/landList.do?pgno=${page}`,
      ),
      parse: (html: string) => parseIhProjects(html),
    },
    {
      name: "LH청약플러스 인천 공공주택",
      urls: [LH_SALE_URL, LH_RENT_URL],
      parse: (html: string, url: string) => parseLhIncheonNotices(html, url),
    },
  ];
  const customResults = await Promise.all(
    customSources.map(async (source) => {
      const settled = await Promise.allSettled(
        source.urls.map(async (url) => {
          const response = await fetcher(url, {
            headers: { "User-Agent": "YeongnamPropertyAtlas/1.0" },
            signal: AbortSignal.timeout(25000),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return source.parse(await response.text(), url);
        }),
      );
      const fulfilled = settled.filter(
        (item): item is PromiseFulfilledResult<Estate[]> =>
          item.status === "fulfilled",
      );
      const failures = settled.length - fulfilled.length;
      return {
        records: fulfilled.flatMap((item) => item.value),
        result: {
          source: source.name,
          ok: fulfilled.length > 0,
          fetched: fulfilled.length,
          matched: fulfilled.reduce((sum, item) => sum + item.value.length, 0),
          message: failures
            ? `${failures}개 조회 실패, 나머지 결과 저장`
            : "공식 목록 조회 완료",
        } satisfies IncheonSourceResult,
      };
    }),
  );
  const sourceResults = [...boardResults, ...customResults];
  for (const sourceResult of sourceResults)
    for (const record of sourceResult.records) records.set(record.id, record);
  return {
    records: [...records.values()],
    sources: sourceResults.map((item) => item.result),
  };
}
