import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
function load(file) {
  const url = new URL("../lib/" + file, import.meta.url);
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(url, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    }).outputText,
    { exports, require: createRequire(url), URL },
  );
  return exports;
}
const { regions, seed, supplyFor } = load("estate.ts");
const { optionalCount } = load("data-utils.ts");
const { parsePermitRows } = load("kosis.ts");
const { buildApplyhomeSchedule } = load("applyhome.ts");
const {
  parseIncheonBoardHtml,
  isRelevantIncheonTitle,
  inferIncheonDistrict,
} = load("incheon-sources.ts");
const { lawdCodeFor, parseApartmentTrades, recentMonths } =
  load("transactions.ts");
test("empty upstream counts never become zero", () => {
  for (const v of [undefined, null, "", "  ", true, -1, "abc"])
    assert.equal(optionalCount(v), null);
  assert.equal(optionalCount("0"), 0);
  assert.equal(optionalCount("1,234"), 1234);
});
test("period totals are partial and completions are separate from occupancy", () => {
  const s = supplyFor(seed, "울산광역시", "전체", 2026, "분양");
  assert.equal(s.value, 775);
  assert.equal(s.partial, true);
  assert.equal(supplyFor(seed, "울산광역시", "전체", 2026, "준공").value, 1557);
  assert.equal(supplyFor(seed, "울산광역시", "전체", 2026, "입주").value, 1430);
  assert.equal(
    supplyFor(seed, "울산광역시", "울주군", 2026, "입주").value,
    1430,
  );
  assert.equal(supplyFor(seed, "울산광역시", "전체", 2025, "준공").value, 4047);
});
test("province statistics do not leak into district metrics", () => {
  assert.equal(
    seed.find(
      (x) =>
        x.metric === "미분양" &&
        x.region === "울산광역시" &&
        x.district === "전체",
    ).units,
    1192,
  );
  assert.equal(
    seed.filter(
      (x) =>
        x.metric === "미분양" &&
        x.region === "울산광역시" &&
        x.district === "남구",
    ).length,
    0,
  );
});
test("full year total supersedes partial records", () => {
  const base = seed.find(
    (x) => x.kind === "공급량" && x.year === 2026 && x.supplyType === "분양",
  );
  const all = [
    base,
    {
      ...base,
      id: "whole",
      units: 2000,
      coverage: "전체집계",
      date: "2026-12-31",
    },
  ];
  assert.equal(supplyFor(all, "울산광역시", "전체", 2026, "분양").value, 2000);
});
test("future supply keeps expected and estimated confidence separate", () => {
  const expected = supplyFor(seed, "울산광역시", "울주군", 2027, "입주");
  assert.equal(expected.value, 266);
  assert.equal(expected.supplyStatus, "expected");
  const base = expected.rows[0];
  const estimated = supplyFor(
    [
      {
        ...base,
        id: "estimated",
        year: 2030,
        status: "모형 추정",
        supplyStatus: "estimated",
      },
    ],
    "울산광역시",
    "울주군",
    2030,
    "입주",
  );
  assert.equal(estimated.supplyStatus, "estimated");
});
test("past occupancy plans display as confirmed unless explicitly estimated", () => {
  const base = seed.find((x) => x.id === "lh-taehwa-supply");
  const past = { ...base, id: "past", year: 2025, status: "입주 예상물량" };
  assert.equal(
    supplyFor([past], "울산광역시", "울주군", 2025, "입주").supplyStatus,
    "confirmed",
  );
  assert.equal(
    supplyFor(
      [{ ...past, supplyStatus: "estimated", status: "모형 추정" }],
      "울산광역시",
      "울주군",
      2025,
      "입주",
    ).supplyStatus,
    "estimated",
  );
});
test("repeat notices for the same complex are not double counted", () => {
  const whole = seed.find((x) => x.id === "movein-ulsan-laels-2028");
  const result = supplyFor(
    [
      whole,
      {
        ...whole,
        id: "applyhome-occupancy-laels",
        name: "라엘에스 입주예정 공급",
        units: 1073,
      },
    ],
    "울산광역시",
    "남구",
    2028,
    "입주",
  );
  assert.equal(result.value, 2033);
  assert.equal(result.rows.length, 1);
});
test("KOSIS permits map Yeongnam and Incheon provinces and keep their meaning", () => {
  const rows = parsePermitRows([
    { C1_NM: "울산", PRD_DE: "2025", DT: "1,234", LST_CHN_DE: "20260206" },
    { C1_NM: "서울", PRD_DE: "2025", DT: "999" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].region, "울산광역시");
  assert.equal(rows[0].units, 1234);
  assert.equal(rows[0].supplyType, "인허가");
  assert.equal(rows[0].coverage, "전체집계");
  assert.equal(rows[0].date, "2026-02-06");
  assert.equal(
    parsePermitRows([{ NM: "부산", PRD_DE: "2024", DT: "10" }])[0].region,
    "부산광역시",
  );
  assert.equal(
    parsePermitRows([{ NM: "인천", PRD_DE: "2024", DT: "20" }])[0].region,
    "인천광역시",
  );
});
test("ApplyHome dates keep special supply and priority rounds separate", () => {
  const schedule = buildApplyhomeSchedule({
    SPSPLY_RCEPT_BGNDE: "20260914",
    SPSPLY_RCEPT_ENDDE: "20260914",
    GNRL_RNK1_CRSPAREA_RCPTDE: "2026-09-15",
    GNRL_RNK1_ETC_AREA_RCPTDE: "2026-09-16",
    GNRL_RNK2_CRSPAREA_RCPTDE: "2026-09-17",
    GNRL_RNK2_ETC_AREA_RCPTDE: "2026-09-17",
  });
  assert.deepEqual(JSON.parse(JSON.stringify(schedule)), [
    { date: "2026-09-14", label: "특별공급 접수" },
    { date: "2026-09-15", label: "1순위 접수 · 해당지역" },
    { date: "2026-09-16", label: "1순위 접수 · 기타지역" },
    { date: "2026-09-17", label: "2순위 접수 · 기타지역" },
    { date: "2026-09-17", label: "2순위 접수 · 해당지역" },
  ]);
});
test("ApplyHome legacy priority date aliases remain compatible", () => {
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        buildApplyhomeSchedule({
          GNRL_RNK1_CRSPAREA_RCPTDE_PD: "2026-10-01",
          GNRL_RNK2_ETC_AREA_RCPTDE_PD: "20261002",
        }),
      ),
    ),
    [
      { date: "2026-10-01", label: "1순위 접수 · 해당지역" },
      { date: "2026-10-02", label: "2순위 접수 · 기타지역" },
    ],
  );
});
test("B-04 uses the official notice date rather than the verification date", () => {
  const b04 = seed.find((item) => item.id === "ulsan-b04");
  assert.equal(b04.date, "2026-02-26");
  assert.equal(b04.dateType, "official");
  assert.equal(b04.verifiedAt, "2026-09-09");
});
test("Incheon official boards keep posting dates and reject false keyword hits", () => {
  const html = `
    <table><tbody>
      <tr><td><a href="/IC010101/view?nttNo=2044795&amp;curPage=1"><span>인천항 내항 1·8부두 재개발 사업계획 공고</span></a></td><td>2025-05-26</td></tr>
      <tr><td><a href="/IC010101/view?nttNo=22">인재개발원 교육생 모집</a></td><td>2025-05-27</td></tr>
    </tbody></table>`;
  const rows = parseIncheonBoardHtml(html, {
    key: "city-news",
    name: "인천광역시 새소식",
    baseUrl: "https://www.incheon.go.kr",
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "incheon-city-news-2044795");
  assert.equal(rows[0].date, "2025-05-26");
  assert.equal(rows[0].dateType, "official");
  assert.equal(rows[0].district, "제물포구");
  assert.equal(isRelevantIncheonTitle("인재개발원 재개발 교육과정"), false);
  assert.equal(inferIncheonDistrict("영종 A18블록 주택건설사업"), "영종구");
  assert.equal(inferIncheonDistrict("청라 공동주택 개발계획"), "서해구");
});
test("RTMS district codes cover metro and non-autonomous districts", () => {
  assert.equal(lawdCodeFor("울산광역시", "남구"), "31140");
  assert.equal(lawdCodeFor("인천광역시", "연수구"), "28185");
  assert.deepEqual(JSON.parse(JSON.stringify(regions["인천광역시"])), [
    "제물포구",
    "영종구",
    "미추홀구",
    "연수구",
    "남동구",
    "부평구",
    "계양구",
    "서해구",
    "검단구",
    "강화군",
    "옹진군",
  ]);
  assert.equal(lawdCodeFor("경상남도", "창원시 성산구"), "48123");
  assert.equal(lawdCodeFor("경상남도", "창원시"), null);
});
test("RTMS XML parser normalizes trades and excludes cancellations", () => {
  const rows = parseApartmentTrades(`
    <response><header><resultCode>000</resultCode></header><body><items>
      <item><aptNm>태화&amp;리버</aptNm><dealAmount>52,000</dealAmount><excluUseAr>84.91</excluUseAr><dealYear>2026</dealYear><dealMonth>8</dealMonth><dealDay>7</dealDay><floor>12</floor><buildYear>2020</buildYear><umdNm>신정동</umdNm><jibun>1-2</jibun></item>
      <item><aptNm>해제단지</aptNm><dealAmount>40,000</dealAmount><excluUseAr>84</excluUseAr><dealYear>2026</dealYear><dealMonth>8</dealMonth><dealDay>8</dealDay><cdealDay>20260809</cdealDay></item>
    </items></body></response>`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].apartment, "태화&리버");
  assert.equal(rows[0].amount, 52000);
  assert.equal(rows[0].date, "2026-08-07");
});
test("RTMS month range crosses year boundaries", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(recentMonths("2026-02", 4))), [
    "202602",
    "202601",
    "202512",
    "202511",
  ]);
});
