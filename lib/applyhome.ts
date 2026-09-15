import type { Estate } from "./estate";

export function normalizeApplyhomeDate(value: unknown) {
  const raw = String(value || "").trim();
  if (/^\d{8}$/.test(raw))
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

export function buildApplyhomeSchedule(row: Record<string, unknown>) {
  const schedule: NonNullable<Estate["schedule"]> = [];
  const add = (value: unknown, label: string) => {
    const date = normalizeApplyhomeDate(value);
    if (!date) return;
    if (!schedule.some((item) => item.date === date && item.label === label))
      schedule.push({ date, label });
  };

  const specialStart = normalizeApplyhomeDate(row.SPSPLY_RCEPT_BGNDE);
  const specialEnd = normalizeApplyhomeDate(row.SPSPLY_RCEPT_ENDDE);
  if (specialStart) add(specialStart, "특별공급 접수");
  if (specialEnd && specialEnd !== specialStart)
    add(specialEnd, "특별공급 접수 마감");

  // The current ApplyHome APT detail schema uses the names without `_PD`.
  // Keep the older aliases as a fallback so already-exported rows remain usable.
  add(
    row.GNRL_RNK1_CRSPAREA_RCPTDE ?? row.GNRL_RNK1_CRSPAREA_RCPTDE_PD,
    "1순위 접수 · 해당지역",
  );
  add(
    row.GNRL_RNK1_ETC_AREA_RCPTDE ?? row.GNRL_RNK1_ETC_AREA_RCPTDE_PD,
    "1순위 접수 · 기타지역",
  );
  add(
    row.GNRL_RNK2_CRSPAREA_RCPTDE ?? row.GNRL_RNK2_CRSPAREA_RCPTDE_PD,
    "2순위 접수 · 해당지역",
  );
  add(
    row.GNRL_RNK2_ETC_AREA_RCPTDE ?? row.GNRL_RNK2_ETC_AREA_RCPTDE_PD,
    "2순위 접수 · 기타지역",
  );

  return schedule.sort(
    (a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label),
  );
}

function optionalRate(value: unknown) {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function optionalNonnegativeInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function parseApplyhomeCompetitionRows(
  rows: Record<string, unknown>[],
) {
  return rows.flatMap((row) => {
    const rankCode = String(row.SUBSCRPT_RANK_CODE ?? "").trim();
    if (rankCode !== "1" && rankCode !== "2") return [];
    const rateText = String(row.CMPET_RATE ?? "").trim();
    return [
      {
        housingType: String(row.HOUSE_TY ?? "").trim() || "주택형 미표기",
        rank: (rankCode === "1" ? "1순위" : "2순위") as
          | "1순위"
          | "2순위",
        residence: String(row.RESIDE_SENM ?? "").trim() || "지역 미표기",
        supplied: optionalNonnegativeInteger(row.SUPLY_HSHLDCO),
        applicants: optionalNonnegativeInteger(row.REQ_CNT),
        rate: optionalRate(row.CMPET_RATE),
        rateText: rateText || "미제공",
      },
    ];
  });
}

const specialApplicantFields = [
  "CRSPAREA_MNYCH_CNT",
  "CTPRVN_MNYCH_CNT",
  "ETC_AREA_MNYCH_CNT",
  "CRSPAREA_NWWDS_NMTW_CNT",
  "CTPRVN_NWWDS_NMTW_CNT",
  "ETC_AREA_NWWDS_NMTW_CNT",
  "CRSPAREA_LFE_FRST_CNT",
  "CTPRVN_LFE_FRST_CNT",
  "ETC_AREA_LFE_FRST_CNT",
  "CRSPAREA_YGMN_CNT",
  "CTPRVN_YGMN_CNT",
  "ETC_AREA_YGMN_CNT",
  "CRSPAREA_OPS_CNT",
  "CTPRVN_OPS_CNT",
  "ETC_AREA_OPS_CNT",
  "CRSPAREA_NWBB_NWBBSHR_CNT",
  "CTPRVN_NWBB_NWBBSHR_CNT",
  "ETC_AREA_NWBB_NWBBSHR_CNT",
  "INSTT_RECOMEND_DCSN_CNT",
  "INSTT_RECOMEND_PREPAR_CNT",
  "TRANSR_INSTT_ENFSN_CNT",
] as const;

export function parseApplyhomeSpecialRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => {
    const counts = specialApplicantFields
      .map((field) => optionalNonnegativeInteger(row[field]))
      .filter((value): value is number => value !== null);
    return {
      housingType: String(row.HOUSE_TY ?? "").trim() || "주택형 미표기",
      supplied: optionalNonnegativeInteger(row.SPSPLY_HSHLDCO),
      applicants: counts.length
        ? counts.reduce((sum, value) => sum + value, 0)
        : null,
      result: String(row.SUBSCRPT_RESULT_NM ?? "").trim(),
    };
  });
}
