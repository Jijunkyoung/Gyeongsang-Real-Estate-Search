import type { Estate } from "./estate";

export type TrendCadence = "week" | "month";

export type MarketTrendPoint = {
  period: string;
  label: string;
  date: string;
  sale: number | null;
  lease: number | null;
};

const weekStart = (date: string) => {
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) return date;
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return value.toISOString().slice(0, 10);
};

const periodLabel = (period: string, cadence: TrendCadence) => {
  if (cadence === "month") return period.replace("-", ".");
  const [, month, day] = period.split("-");
  return `${Number(month)}.${Number(day)}`;
};

export function marketTrendFor(
  items: Estate[],
  region: string,
  district: string,
  cadence: TrendCadence,
) {
  const scoped = items.filter(
    (item) =>
      item.kind === "시장지표" &&
      item.region === region &&
      item.district === district &&
      item.rate != null,
  );
  const series = [
    { key: "sale" as const, weekly: "매매지수 주간", monthly: "매매지수 월간" },
    { key: "lease" as const, weekly: "전세지수 주간", monthly: "전세지수 월간" },
  ];
  const buckets = new Map<string, MarketTrendPoint>();
  let monthlySeries = 0;
  let weeklyFallbackSeries = 0;

  for (const { key, weekly, monthly } of series) {
    const nativeMonthly = scoped.filter((item) => item.metric === monthly);
    const selected =
      cadence === "month" && nativeMonthly.length
        ? nativeMonthly
        : scoped.filter((item) => item.metric === weekly);
    if (cadence === "month") {
      if (nativeMonthly.length) monthlySeries += 1;
      else if (selected.length) weeklyFallbackSeries += 1;
    }
    for (const item of selected.sort((a, b) => a.date.localeCompare(b.date))) {
      const period = cadence === "month" ? item.date.slice(0, 7) : weekStart(item.date);
      const previous = buckets.get(period) || {
        period,
        label: periodLabel(period, cadence),
        date: item.date,
        sale: null,
        lease: null,
      };
      previous[key] = item.rate ?? null;
      if (item.date > previous.date) previous.date = item.date;
      buckets.set(period, previous);
    }
  }

  const points = [...buckets.values()]
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(cadence === "week" ? -52 : -36);
  const basis =
    cadence === "week"
      ? "공식 주간지표"
      : monthlySeries && weeklyFallbackSeries
        ? "공식 월간지표·주간 월말값 혼합"
        : monthlySeries
          ? "공식 월간지표"
          : "주간지표의 월말값";
  return { points, basis };
}
