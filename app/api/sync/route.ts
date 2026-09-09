import {
  database,
  recordSync,
  requireCollector,
  sameOrigin,
  settings,
} from "@/lib/server";
import { optionalCount } from "@/lib/data-utils";
import { regions, type Estate } from "@/lib/estate";
import {
  buildApplyhomeSchedule,
  normalizeApplyhomeDate,
} from "@/lib/applyhome";
// Official schema namespace: https://infuser.odcloud.kr/oas/docs?namespace=ApplyhomeInfoDetailSvc/v1
// Manual bounded ingestion. Does not claim to cover all housing or region-wide supply.
export async function POST(req: Request) {
  let authorized = false;
  try {
    sameOrigin(req);
    await requireCollector(req);
    authorized = true;
    const key = settings().PUBLIC_DATA_KEY;
    if (!key)
      return Response.json(
        { error: "청약홈 공공데이터 인증키가 연결되지 않았습니다." },
        { status: 503 },
      );
    const body: any = await req.json();
    const from = String(body.from || "");
    const to = String(body.to || "");
    const supplyOnly = body.supplyOnly === true;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      from > to ||
      (+new Date(to) - +new Date(from)) / 86400000 > 93
    )
      return Response.json(
        { error: "수집기간은 최대 93일로 지정하세요." },
        { status: 400 },
      );
    const all: Estate[] = [];
    const observedScheduleFields = new Set<string>();
    let complete = false;
    for (let page = 1; page <= 10; page++) {
      const url = new URL(
        "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail",
      );
      url.searchParams.set("serviceKey", key);
      url.searchParams.set("page", String(page));
      url.searchParams.set("perPage", "100");
      url.searchParams.set("cond[RCRIT_PBLANC_DE::GTE]", from);
      url.searchParams.set("cond[RCRIT_PBLANC_DE::LTE]", to);
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Error("공공데이터 응답 오류");
      const data = (await response.json()) as any;
      if (!Array.isArray(data.data)) throw Error("응답 형식 확인 필요");
      for (const x of data.data) {
        Object.keys(x)
          .filter((field) => /RNK|RCPT|RCEPT|SPSPLY/.test(field))
          .forEach((field) => observedScheduleFields.add(field));
        const address = String(x.HSSPLY_ADRES || "");
        const r = Object.keys(regions).find(
          (r) =>
            address.startsWith(r) ||
            String(x.SUBSCRPT_AREA_CODE_NM || "").includes(
              r
                .replace("광역시", "")
                .replace("경상남도", "경남")
                .replace("경상북도", "경북"),
            ),
        );
        if (!r) continue;
        const district =
          regions[r].find((d) =>
            address
              .split(/\s+/)
              .some((part) => part === d || part.startsWith(d + " ")),
          ) || "전체";
        const id = String(x.PBLANC_NO || x.HOUSE_MANAGE_NO || "");
        const date = normalizeApplyhomeDate(x.RCRIT_PBLANC_DE);
        if (!id || !x.HOUSE_NM || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const units = optionalCount(x.TOT_SUPLY_HSHLDCO);
        const endDate =
          normalizeApplyhomeDate(x.SUBSCRPT_RCEPT_ENDDE) ||
          normalizeApplyhomeDate(x.RCEPT_ENDDE) ||
          undefined;
        const schedule = buildApplyhomeSchedule(x);
        const moveRaw = String(x.MVN_PREARNGE_YM || "").replace(/-/g, "");
        const moveMonth = /^\d{6}$/.test(moveRaw)
          ? `${moveRaw.slice(0, 4)}-${moveRaw.slice(4, 6)}`
          : undefined;
        const notice: Estate = {
          id: "applyhome-" + id,
          kind: "분양",
          name: String(x.HOUSE_NM),
          region: r,
          district,
          date,
          dateType: "official",
          verifiedAt: new Date().toISOString().slice(0, 10),
          source: "한국부동산원 청약홈",
          url:
            typeof x.PBLANC_URL === "string" &&
            /^https?:\/\//.test(x.PBLANC_URL)
              ? x.PBLANC_URL
              : "https://www.applyhome.co.kr/",
          summary: `${address}. 청약홈 APT 공고 기준 공급물량입니다. 분양가·면적·자격은 모집공고 원문을 확인하세요.`,
          status: "모집공고",
          important: false,
          units,
          endDate,
          moveYear: moveMonth ? Number(moveMonth.slice(0, 4)) : null,
          moveMonth,
          developer: String(x.CNSTRCT_ENTRPS_NM || ""),
          coverage: "해당 APT 모집공고의 공급물량",
          schedule,
          history: [{ date, text: "청약홈 모집공고" }],
        };
        // Historical backfills can persist only the annual supply evidence.
        // Keeping old notices out of the calendar avoids turning it into an archive.
        if (!supplyOnly) all.push(notice);
        if (units !== null)
          all.push({
            ...notice,
            id: `applyhome-supply-${id}`,
            kind: "공급량",
            name: `${String(x.HOUSE_NM)} 모집공고 공급`,
            year: Number(date.slice(0, 4)),
            supplyType: "분양",
            coverage: "부분집계",
            important: false,
            endDate: undefined,
            moveMonth: undefined,
            schedule: undefined,
            history: undefined,
          });
      }
      const total = Number(data.matchCount ?? data.totalCount);
      if (
        data.data.length < 100 ||
        (Number.isFinite(total) && page * 100 >= total)
      ) {
        complete = true;
        break;
      }
    }
    if (!complete)
      return Response.json(
        {
          error:
            "조회 결과가 많습니다. 기간을 줄여 다시 수집하세요. 부분 결과는 저장하지 않았습니다.",
        },
        { status: 422 },
      );
    const unique = [...new Map(all.map((x) => [x.id, x])).values()];
    for (let i = 0; i < unique.length; i += 50)
      await database().batch(
        unique
          .slice(i, i + 50)
          .map((x) =>
            database()
              .prepare(
                "INSERT INTO estate_records(id,payload,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated",
              )
              .bind(x.id, JSON.stringify(x), new Date().toISOString()),
          ),
      );
    await recordSync(
      "청약홈",
      "success",
      unique.length,
      `${from}~${to} APT 모집공고`,
    );
    return Response.json({
      ok: true,
      count: unique.length,
      scheduleFields: [...observedScheduleFields].sort(),
      scope: supplyOnly
        ? "청약홈 APT 공고 공급량 · 선택 기간 · 경상권"
        : "청약홈 APT 공고 · 선택 기간 · 경상권",
    });
  } catch (error) {
    if (authorized)
      try {
        await recordSync("청약홈", "error", 0, "수집 실패");
      } catch {}
    return Response.json(
      {
        error:
          "수집을 완료하지 못했습니다. 인증키 승인·이용한도·외부기관 상태를 확인하세요.",
        detail: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 502 },
    );
  }
}
