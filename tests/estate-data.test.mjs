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
