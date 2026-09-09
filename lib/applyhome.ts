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
