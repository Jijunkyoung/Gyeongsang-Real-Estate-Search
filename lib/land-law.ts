import { lawdCodeFor } from "./transactions";
import { parseLandLawXml } from "./land-law-parser";

export const commonLandZones = [
  ["UQA111", "제1종전용주거지역"],
  ["UQA112", "제2종전용주거지역"],
  ["UQA121", "제1종일반주거지역"],
  ["UQA122", "제2종일반주거지역"],
  ["UQA123", "제3종일반주거지역"],
  ["UQA130", "준주거지역"],
  ["UQA210", "중심상업지역"],
  ["UQA220", "일반상업지역"],
  ["UQA230", "근린상업지역"],
  ["UQA240", "유통상업지역"],
  ["UQA310", "전용공업지역"],
  ["UQA320", "일반공업지역"],
  ["UQA330", "준공업지역"],
  ["UQA410", "보전녹지지역"],
  ["UQA420", "생산녹지지역"],
  ["UQA430", "자연녹지지역"],
] as const;

export async function lookupLandLaw(input: {
  key: string;
  region: string;
  district: string;
  ucode: string;
  fetcher?: typeof fetch;
}) {
  const areaCd = lawdCodeFor(input.region, input.district);
  if (!areaCd)
    throw new Error(
      "창원·포항은 구까지 선택하고, 그 밖의 지역은 시·군·구를 선택하세요.",
    );
  const fetcher = input.fetcher || fetch;
  const url = new URL(
    // This legacy endpoint is published as HTTP in the official HWP guide.
    // Its HTTPS gateway currently returns 522, so keep the documented scheme.
    "http://apis.data.go.kr/1613000/LuLawInfoService/DTluLawInfo",
  );
  url.searchParams.set("serviceKey", input.key);
  url.searchParams.set("areaCd", areaCd);
  url.searchParams.set("ucodeList", input.ucode);
  const response = await fetcher(url, { signal: AbortSignal.timeout(20000) });
  const xml = await response.text();
  try {
    const items = parseLandLawXml(xml);
    if (!response.ok)
      throw new Error(`공공데이터 응답 오류 (${response.status})`);
    return {
      items,
      scope: `${input.region} ${input.district} · ${input.ucode}`,
      source: "국토교통부 토지이용규제법령정보서비스",
      sourceUrl: "https://www.data.go.kr/data/15057174/openapi.do",
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "공공데이터 오류";
    throw new Error(`${detail} (HTTP ${response.status})`);
  }
}
