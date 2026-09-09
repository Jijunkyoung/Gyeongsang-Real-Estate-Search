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
    { exports, require: createRequire(url) },
  );
  return exports;
}
const { seed, supplyFor } = load("estate.ts");
const { optionalCount } = load("data-utils.ts");
const { parsePermitRows } = load("kosis.ts");
const { buildApplyhomeSchedule } = load("applyhome.ts");
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
test("KOSIS permits map only Yeongnam provinces and keep their meaning", () => {
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
