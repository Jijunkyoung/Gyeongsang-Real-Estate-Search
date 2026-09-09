import { z } from "zod";
import {
  allRecords,
  database,
  optionalIdentity,
  owner,
  requireAdmin,
  sameOrigin,
  settings,
  syncRuns,
} from "@/lib/server";
import { regions, kinds } from "@/lib/estate";
const safeUrl = z
  .string()
  .url()
  .refine((s) => /^https?:\/\//.test(s));
const item = z
  .object({
    id: z.string().min(1).max(100),
    kind: z.enum(kinds),
    name: z.string().min(1).max(200),
    region: z.string().refine((x) => x in regions),
    district: z.string().min(1).max(40),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateType: z.enum(["official", "checked"]).optional(),
    verifiedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    source: z.string().min(1).max(100),
    url: safeUrl,
    summary: z.string().max(6000),
    status: z.string().min(1).max(100),
    important: z.boolean(),
    units: z.number().int().nonnegative().nullable().optional(),
    year: z.number().int().min(1900).max(2200).nullable().optional(),
    supplyType: z.enum(["분양", "입주", "인허가", "준공"]).optional(),
    coverage: z.string().max(200).optional(),
    supplyStatus: z.enum(["confirmed", "expected", "estimated"]).optional(),
    price: z.number().nonnegative().nullable().optional(),
    area: z.number().positive().nullable().optional(),
    rate: z.number().finite().nullable().optional(),
    metric: z.string().max(100).optional(),
    endDate: z.string().optional(),
    stage: z.string().max(100).optional(),
    developer: z.string().max(100).optional(),
    ratio: z.number().nonnegative().nullable().optional(),
    moveYear: z.number().int().min(1900).max(2200).nullable().optional(),
    moveMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
    lat: z.number().min(33).max(39).nullable().optional(),
    lng: z.number().min(124).max(132).nullable().optional(),
    schedule: z
      .array(
        z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          label: z.string().min(1).max(100),
        }),
      )
      .max(30)
      .optional(),
    history: z
      .array(z.object({ date: z.string().max(20), text: z.string().max(1000) }))
      .max(100)
      .optional(),
  })
  .superRefine((v, c) => {
    if (v.district !== "전체" && !regions[v.region].includes(v.district))
      c.addIssue({ code: "custom", message: "지역과 시군구가 맞지 않습니다." });
    if (
      v.kind === "시장지표" &&
      ![
        "매매지수 월간",
        "전세지수 월간",
        "매매지수 주간",
        "전세지수 주간",
        "거래량",
        "미분양",
        "준공 후 미분양",
      ].includes(v.metric || "")
    )
      c.addIssue({ code: "custom", message: "시장지표 유형을 선택하세요." });
    if (
      v.kind === "공급량" &&
      (v.units == null ||
        v.year == null ||
        !v.supplyType ||
        !["부분집계", "전체집계"].includes(v.coverage || ""))
    )
      c.addIssue({
        code: "custom",
        message: "공급량은 연도·물량·유형·집계범위가 필요합니다.",
      });
  });
export async function GET(req: Request) {
  try {
    const user = optionalIdentity(req);
    const records = await allRecords();
    const sync = await syncRuns();
    const p = user
      ? await database()
          .prepare("SELECT payload FROM estate_preferences WHERE owner=?")
          .bind(user.email)
          .first<{ payload: string }>()
      : null;
    const canAdmin =
      !!user &&
      !!settings().ADMIN_USER_ID &&
      user.id === settings().ADMIN_USER_ID;
    return Response.json({
      records,
      sync,
      preferences: p
        ? JSON.parse(p.payload)
        : { favorites: [], alerts: false, email: user?.email || "" },
      account: { signedIn: !!user, email: user?.email || "", canAdmin },
      connections: {
        housing: canAdmin && !!settings().PUBLIC_DATA_KEY,
        kosis: canAdmin && !!settings().KOSIS_API_KEY,
        ai: !!user && (!!settings().UPSTAGE_API_KEY || !!settings().AI_API_KEY),
        email: !!user && !!settings().RESEND_API_KEY && !!settings().EMAIL_FROM,
      },
    });
  } catch {
    return Response.json(
      { error: "자료를 불러오지 못했습니다. 잠시 후 다시 시도하세요." },
      { status: 503 },
    );
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = owner(req);
    if (Number(req.headers.get("content-length") || 0) > 2000000)
      return Response.json(
        { error: "파일은 2MB 이하만 가능합니다." },
        { status: 413 },
      );
    const body: any = await req.json();
    if (body.action === "preferences") {
      const p = z
        .object({
          favorites: z.array(z.string().max(200)).max(300),
          alerts: z.boolean(),
          email: z.union([z.literal(""), z.string().email()]),
        })
        .parse(body.preferences);
      await database()
        .prepare(
          "INSERT INTO estate_preferences(owner,payload) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET payload=excluded.payload",
        )
        .bind(user, JSON.stringify(p))
        .run();
      return Response.json({ ok: true });
    }
    requireAdmin(req);
    const items = z.array(item).min(1).max(1000).parse(body.records);
    await database().batch(
      items.map((v) =>
        database()
          .prepare(
            "INSERT INTO estate_records(id,payload,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated",
          )
          .bind(v.id, JSON.stringify(v), new Date().toISOString()),
      ),
    );
    return Response.json({ ok: true, count: items.length });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? "입력값을 확인하세요: " +
              e.issues.map((x) => x.message).join(", ")
            : "저장하지 못했습니다. 입력 내용은 유지됩니다.",
      },
      { status: 400 },
    );
  }
}
