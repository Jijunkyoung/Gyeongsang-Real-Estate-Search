"use client";
import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  MapPin,
  ArrowUpRight,
  Search,
  Star,
  Plus,
  ArrowRight,
  Building2,
  Layers,
  CalendarDays,
  SlidersHorizontal,
  Bell,
  ChartNoAxesCombined,
  BookOpen,
  Download,
  Check,
  RefreshCw,
  ExternalLink,
  Sparkles,
  X,
  Landmark,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import maps from "@/lib/map.json";
import {
  regions,
  cityDistricts,
  withinDistrict,
  kinds,
  seed,
  sources,
  glossary,
  fmt,
  supplyFor,
  type Estate,
} from "@/lib/estate";
const short = (s: string) =>
  s
    .replace("광역시", "")
    .replace("경상남도", "경남")
    .replace("경상북도", "경북");
const labels: Record<string, [number, number]> = {
  경상북도: [270, 250],
  대구광역시: [217, 384],
  경상남도: [155, 497],
  울산광역시: [349, 450],
  부산광역시: [298, 552],
};
function Pick({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (s: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="picker">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((x) => (
          <SelectItem value={x} key={x}>
            {x}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Layers size={27} />
      <p>{children}</p>
      <span>등록되지 않은 수치는 0건 또는 0%를 의미하지 않습니다.</span>
    </div>
  );
}
function LinkOut({ url, children }: { url: string; children: ReactNode }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="source-link">
      {children}
      <ArrowUpRight size={14} />
    </a>
  );
}
function SignInNotice() {
  return (
    <section className="panel signin-panel">
      <Star size={28} />
      <div>
        <h2>내 관심목록 사용하기</h2>
        <p>
          ChatGPT로 로그인하면 이메일 계정별로 관심 지역·단지와 알림 설정이 따로
          저장됩니다.
        </p>
      </div>
      <a
        className="btn primary"
        href="/signin-with-chatgpt?return_to=%2F%3Fview%3Dfavorites"
        target="_top"
      >
        ChatGPT로 로그인
      </a>
    </section>
  );
}
function download(name: string, data: string, type = "application/json") {
  const u = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
type Pref = { favorites: string[]; alerts: boolean; email: string };
type Account = { signedIn: boolean; email: string; canAdmin: boolean };
type SyncRun = {
  source: string;
  status: "success" | "error";
  count: number;
  message: string;
  updatedAt: string;
};
export default function Home() {
  const [tab, setTab] = useState("overview"),
    [region, setRegion] = useState("울산광역시"),
    [district, setDistrict] = useState("전체"),
    [layer, setLayer] = useState("전체"),
    [q, setQ] = useState("");
  const [records, setRecords] = useState<Estate[]>(seed),
    [prefs, setPrefs] = useState<Pref>({
      favorites: [],
      alerts: false,
      email: "",
    }),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [account, setAccount] = useState<Account>({
    signedIn: false,
    email: "",
    canAdmin: false,
  });
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [detail, setDetail] = useState<Estate | null>(null),
    [compare, setCompare] = useState<string[]>([]),
    [supplyType, setSupplyType] = useState("분양"),
    [startYear, setStartYear] = useState("2024"),
    [endYear, setEndYear] = useState("2030"),
    [compareType, setCompareType] = useState("지역"),
    [showEdit, setShowEdit] = useState(false),
    [editing, setEditing] = useState<Estate | null>(null);
  const [connections, setConnections] = useState({
    housing: false,
    kosis: false,
    ai: false,
    email: false,
  });
  const [syncFrom, setSyncFrom] = useState("2026-09-01"),
    [syncTo, setSyncTo] = useState("2026-09-07"),
    [syncing, setSyncing] = useState(false);
  const [kosisFrom, setKosisFrom] = useState("2020"),
    [kosisTo, setKosisTo] = useState("2025"),
    [kosisSyncing, setKosisSyncing] = useState(false);
  async function syncData() {
    setSyncing(true);
    try {
      const r = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: syncFrom, to: syncTo }),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      toast.success(d.count + "건을 수집했습니다.");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }
  async function syncKosis() {
    setKosisSyncing(true);
    try {
      const r = await fetch("/api/kosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startYear: kosisFrom, endYear: kosisTo }),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      toast.success(`${d.count}건의 KOSIS 인허가 통계를 저장했습니다.`);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setKosisSyncing(false);
    }
  }
  async function sendDigest() {
    try {
      const r = await fetch("/api/email", { method: "POST" });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      toast.success("관심자료 이메일을 발송했습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function reload() {
    setBusy(true);
    try {
      const r = await fetch("/api/estate");
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      setRecords(d.records);
      setPrefs(d.preferences);
      setConnections(d.connections);
      setAccount(d.account || { signedIn: false, email: "", canAdmin: false });
      setSyncRuns(d.sync || []);
      setLoaded(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    reload();
    const t = new URLSearchParams(location.search).get("view");
    if (
      t &&
      [
        "overview",
        "region",
        "supply",
        "compare",
        "calendar",
        "favorites",
        "guide",
        "admin",
      ].includes(t)
    )
      setTab(t);
  }, []);
  function go(t: string) {
    setTab(t);
    history.replaceState(null, "", "?view=" + t);
  }
  function selectRegion(r: string) {
    setRegion(r);
    setDistrict("전체");
  }
  const selection = `${region}|${district}`;
  async function savePrefs(p: Pref) {
    if (!account.signedIn) {
      toast.error("관심목록 저장은 ChatGPT 로그인이 필요합니다.");
      return;
    }
    if (!loaded) {
      toast.error("저장소 연결을 확인한 뒤 다시 시도하세요.");
      return;
    }
    try {
      const r = await fetch("/api/estate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preferences", preferences: p }),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      setPrefs(p);
      toast.success("내 계정의 관심 설정을 저장했습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  function star(id: string) {
    savePrefs({
      ...prefs,
      favorites: prefs.favorites.includes(id)
        ? prefs.favorites.filter((x) => x !== id)
        : [...prefs.favorites, id],
    });
  }
  function addCompare(id: string) {
    if (compare.includes(id)) {
      setCompare(compare.filter((x) => x !== id));
      return;
    }
    if (compare.length >= 5) {
      toast.error("최대 5개까지 비교할 수 있습니다. 기존 대상을 제거하세요.");
      return;
    }
    setCompare([...compare, id]);
    toast.success("비교함에 추가했습니다.");
  }
  const selected = records.filter(
    (x) => x.region === region && withinDistrict(x.district, district),
  );
  const filtered = selected.filter(
    (x) =>
      (layer === "전체" || x.kind === layer) &&
      (!q || `${x.name} ${x.region} ${x.district} ${x.summary}`.includes(q)),
  );
  const searchResults = q
    ? records.filter((x) =>
        `${x.name} ${x.region} ${x.district} ${x.summary}`.includes(q),
      )
    : [];
  const news = records
    .filter((x) => x.important)
    .sort((a, b) => b.date.localeCompare(a.date));
  const years = Array.from(
    { length: Math.max(1, Number(endYear) - Number(startYear) + 1) },
    (_, i) => Number(startYear) + i,
  );
  const supply = years.map((year) => ({
    year,
    ...supplyFor(records, region, district, year, supplyType),
  }));
  const metric = (r: string, d: string, name: string) =>
    records
      .filter(
        (x) =>
          x.kind === "시장지표" &&
          x.region === r &&
          x.district === d &&
          x.metric === name,
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  function card(x: Estate) {
    return (
      <article className="record" key={x.id}>
        <div className="row spread">
          <span className={"tag " + (x.kind === "분양" ? "green" : "")}>
            {x.kind === "분양" && x.id === "lh-taehwa" ? "공공임대" : x.kind}
          </span>
          <button
            aria-label={`${x.name} 관심 저장`}
            className="icon-btn"
            onClick={() => star(x.id)}
          >
            <Star
              size={18}
              fill={prefs.favorites.includes(x.id) ? "currentColor" : "none"}
            />
          </button>
        </div>
        <button className="record-title" onClick={() => setDetail(x)}>
          {x.name}
          <ArrowUpRight size={18} />
        </button>
        <p>
          {short(x.region)} {x.district === "전체" ? "" : x.district} ·{" "}
          {x.status}
        </p>
        <RecordFacts record={x} />
        <p className="summary">{x.summary}</p>
        <LinkOut url={x.url}>출처 바로 확인</LinkOut>
        <div className="row spread foot">
          <span>
            {x.source} · {x.date}
          </span>
          <button className="text-button" onClick={() => setDetail(x)}>
            상세 보기
          </button>
        </div>
      </article>
    );
  }
  const toolbar = (
    <div className="filters">
      <Pick
        value={region}
        onChange={selectRegion}
        options={Object.keys(regions)}
        label="시도"
      />
      <Pick
        value={district}
        onChange={setDistrict}
        options={["전체", ...regions[region]]}
        label="시군구"
      />
      <button className="btn" onClick={() => star(selection)}>
        <Star
          size={16}
          fill={prefs.favorites.includes(selection) ? "currentColor" : "none"}
        />
        관심지역
      </button>
      <button className="btn" onClick={() => addCompare(selection)}>
        <Plus size={16} />
        비교 추가
      </button>
    </div>
  );
  const supplyChart = (
    <>
      <div
        className="chart"
        role="img"
        aria-label={`${region} ${supplyType} 연도별 공급량. 미수집 연도는 수치 없음.`}
      >
        {supply.map((s) => (
          <div className="bar-col" key={s.year}>
            <span className="bar-number">
              {s.value == null ? "—" : fmt(s.value)}
            </span>
            <div className="bar-track">
              {s.value != null ? (
                <div
                  className={"bar " + (s.partial ? "partial" : "")}
                  style={{
                    height:
                      Math.max(
                        3,
                        (s.value /
                          Math.max(1, ...supply.map((v) => v.value || 0))) *
                          100,
                      ) + "%",
                  }}
                />
              ) : (
                <div className="bar-missing" />
              )}
            </div>
            <strong>{s.year}</strong>
            <small>
              {s.value == null ? "미수집" : s.partial ? "부분집계" : "전체집계"}
            </small>
          </div>
        ))}
      </div>
      <p className="note">
        단위: 호 · 빗금은 일부 기간 또는 일부 단지 집계입니다. 연간 전체와 직접
        비교하지 마세요. 준공은 실제 입주와 다르며, 예정 물량은 변경될 수
        있습니다.
      </p>
    </>
  );
  return (
    <div className="app">
      <Toaster position="top-center" richColors />
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Building2 size={24} />
          </span>
          <span>
            영남 부동산<span className="brand-en">PROPERTY ATLAS</span>
          </span>
        </a>
        <div className="global-search">
          <Search size={18} />
          <input
            aria-label="통합검색"
            placeholder="지역, 단지 또는 정비구역 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              className="icon-btn"
              aria-label="검색 지우기"
              onClick={() => setQ("")}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button className="btn header-save" onClick={() => go("favorites")}>
          <Star size={17} />
          관심목록 <b>{prefs.favorites.length}</b>
        </button>
        {account.signedIn ? (
          <div className="account-menu">
            <span title={account.email}>{account.email}</span>
            <a href="/signout-with-chatgpt?return_to=%2F" target="_top">
              로그아웃
            </a>
          </div>
        ) : (
          <a
            className="btn primary header-login"
            href="/signin-with-chatgpt?return_to=%2F"
            target="_top"
          >
            로그인
          </a>
        )}
      </header>
      <Tabs value={tab} onValueChange={go}>
        <div className="nav-wrap">
          <TabsList className="nav-tabs">
            {[
              ["overview", "대시보드"],
              ["region", "지역 탐색"],
              ["supply", "연도별 공급"],
              ["compare", "지역·단지 비교"],
              ["calendar", "일정 달력"],
              ["favorites", "관심·알림"],
              ["guide", "부동산 도구"],
              ["admin", "자료 관리"],
            ]
              .filter(([v]) => v !== "admin" || account.canAdmin)
              .map(([v, l]) => (
                <TabsTrigger value={v} key={v}>
                  {l}
                  {v === "compare" && compare.length > 0 && (
                    <span className="count">{compare.length}</span>
                  )}
                </TabsTrigger>
              ))}
          </TabsList>
          <span className="nav-note">부산 · 울산 · 대구 · 경남 · 경북</span>
        </div>
        <main className="workspace">
          {error && (
            <div className="notice warning">
              {error} 현재는 초기 확인 자료만 표시합니다.{" "}
              <button onClick={reload}>다시 연결</button>
            </div>
          )}
          {q && (
            <section className="panel search-results">
              <div className="section-head">
                <h2>
                  통합검색 결과 <span>{searchResults.length}</span>
                </h2>
                <button className="text-button" onClick={() => setQ("")}>
                  닫기
                </button>
              </div>
              {searchResults.length ? (
                <div className="cards">{searchResults.map(card)}</div>
              ) : (
                <Empty>등록된 자료에서 검색 결과를 찾지 못했습니다.</Empty>
              )}
            </section>
          )}
          <TabsContent value="overview">
            <div className="page-heading">
              <div>
                <p className="eyebrow">YEONGNAM / MARKET OVERVIEW</p>
                <h1>
                  지역을 읽고, 변화를 발견하다
                  <span className="accent-dot">.</span>
                </h1>
                <p>지도에서 시작하는 경상권 부동산 탐색</p>
              </div>
              <button className="btn" onClick={reload} disabled={busy}>
                <RefreshCw size={16} className={busy ? "spin" : ""} />
                {busy ? "확인 중" : "자료 새로고침"}
              </button>
            </div>
            <div className="notice">
              <span className="notice-label">자료 안내</span>확인한 공고와 발표
              통계를 제공합니다. 보도에서 확인한 수치는 출처에 별도 표시하며,
              기관 원표 직접 대조와 자동 갱신은 연결 상태를 확인하세요.
              <button onClick={() => go(account.canAdmin ? "admin" : "guide")}>
                {account.canAdmin ? "출처 및 연결 상태" : "자료 출처 확인"}{" "}
                <ArrowRight size={15} />
              </button>
            </div>
            <div className="stats">
              {[
                ["탐색 지역", "5", "개 시·도", "경상권 주요 지역", MapPin],
                [
                  "분양·임대",
                  String(records.filter((x) => x.kind === "분양").length),
                  "건 등록",
                  "등록 자료 기준 · 전체 물량 아님",
                  Building2,
                ],
                [
                  "정비·개발",
                  String(
                    records.filter((x) =>
                      ["재개발", "재건축", "개발사업"].includes(x.kind),
                    ).length,
                  ),
                  "건 등록",
                  "지자체 자료 추가 가능",
                  Layers,
                ],
                [
                  "비교함",
                  String(compare.length),
                  "/ 5",
                  "지역 또는 단지를 나란히 비교",
                  ChartNoAxesCombined,
                ],
              ].map(([t, n, u, h, I]: any) => (
                <div className="stat" key={t}>
                  <div className="row spread">
                    <span>{t}</span>
                    <I size={19} />
                  </div>
                  <div className="stat-number">
                    {n}
                    <small>{u}</small>
                  </div>
                  <p>{h}</p>
                </div>
              ))}
            </div>
            <div className="map-grid">
              <section className="panel map-panel">
                <div className="section-head">
                  <div>
                    <h2>경상권 지도</h2>
                    <p>지역을 선택해 자세히 살펴보세요</p>
                  </div>
                  <span className="subtle-tag">
                    <MapPin size={14} />
                    지역 탐색
                  </span>
                </div>
                <div className="map-surface">
                  <div className="map-chips">
                    {Object.keys(regions).map((r) => (
                      <button
                        className={region === r ? "selected" : ""}
                        key={r}
                        onClick={() => selectRegion(r)}
                      >
                        {short(r)}
                      </button>
                    ))}
                  </div>
                  <svg
                    viewBox="-15 70 500 575"
                    className="region-map"
                    aria-label="경상권 지역 선택 지도"
                  >
                    <defs>
                      <pattern
                        id="grid"
                        width="30"
                        height="30"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 30 0 L 0 0 0 30"
                          fill="none"
                          stroke="#cbd8df"
                          strokeWidth=".5"
                        />
                      </pattern>
                      <filter id="shadow">
                        <feDropShadow
                          dx="0"
                          dy="5"
                          stdDeviation="4"
                          floodOpacity=".12"
                        />
                      </filter>
                    </defs>
                    <rect
                      x="-15"
                      y="70"
                      width="500"
                      height="575"
                      fill="url(#grid)"
                    />
                    {maps.map((m) => (
                      <path
                        className="province"
                        tabIndex={0}
                        role="button"
                        aria-label={`${m.name} 선택`}
                        aria-pressed={region === m.name}
                        key={m.name}
                        d={m.path}
                        onClick={() => selectRegion(m.name)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectRegion(m.name);
                          }
                        }}
                        fill={region === m.name ? "#197565" : "#d4e0e4"}
                        stroke="#fff"
                        strokeWidth="2"
                        filter={region === m.name ? "url(#shadow)" : undefined}
                      />
                    ))}
                    {Object.entries(labels).map(([r, [x, y]]) => (
                      <g key={r} pointerEvents="none">
                        <rect
                          x={x - 30}
                          y={y - 16}
                          width="60"
                          height="31"
                          rx="7"
                          fill={region === r ? "#124e45" : "white"}
                        />
                        <text
                          x={x}
                          y={y + 5}
                          textAnchor="middle"
                          fill={region === r ? "white" : "#365064"}
                          fontSize="15"
                          fontWeight="650"
                        >
                          {short(r)}
                        </text>
                      </g>
                    ))}
                    <text
                      x="423"
                      y="330"
                      fill="#98b2c2"
                      fontSize="14"
                      writingMode="vertical-rl"
                      letterSpacing="8"
                    >
                      동해
                    </text>
                  </svg>
                  <div className="map-caption">
                    통계청 2013 경계 기반 개략 지도 · 군위군은 목록에서 대구로
                    분류
                    <br />
                    사업구역 경계·토지 경계로 사용하지 마세요.
                  </div>
                </div>
              </section>
              <section className="panel region-panel">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">SELECTED REGION</p>
                    <h2 className="region-title">{region}</h2>
                  </div>
                  <button
                    className="icon-btn"
                    aria-label="관심지역 저장"
                    onClick={() => star(selection)}
                  >
                    <Star
                      fill={
                        prefs.favorites.includes(selection)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                </div>
                <Pick
                  value={district}
                  onChange={setDistrict}
                  options={["전체", ...regions[region]]}
                  label="시군구 선택"
                />
                <div className="region-metrics">
                  {["매매지수 주간", "전세지수 주간"].map((n) => (
                    <div key={n}>
                      <p>{n}</p>
                      <strong>
                        {fmt(metric(region, district, n)?.rate, "%")}
                      </strong>
                      <small>
                        {metric(region, district, n) ? (
                          <LinkOut url={metric(region, district, n)!.url}>
                            {metric(region, district, n)!.date} · 출처
                          </LinkOut>
                        ) : (
                          "자료 미등록 · 자료 관리에서 연결"
                        )}
                      </small>
                    </div>
                  ))}
                </div>
                <div className="region-counts">
                  <span>
                    분양·임대{" "}
                    <b>{selected.filter((x) => x.kind === "분양").length}건</b>
                  </span>
                  <span>
                    재개발·재건축{" "}
                    <b>
                      {
                        selected.filter((x) =>
                          ["재개발", "재건축"].includes(x.kind),
                        ).length
                      }
                      건
                    </b>
                  </span>
                </div>
                <h3>연도별 분양 실적·계획</h3>
                <div className="mini-years">
                  {[2024, 2025, 2026].map((y) => {
                    const s = supplyFor(records, region, district, y, "분양");
                    return (
                      <div key={y}>
                        <span>{y}</span>
                        <strong>{fmt(s.value)}</strong>
                        <small>
                          {s.value == null
                            ? "미수집"
                            : s.partial
                              ? "부분집계 · 호"
                              : "전체집계 · 호"}
                        </small>
                      </div>
                    );
                  })}
                </div>
                <p className="note">
                  등록된 자료 범위입니다. 지역 전체 물량과 다를 수 있습니다.
                </p>
                <button
                  className="btn primary wide"
                  onClick={() => go("region")}
                >
                  {short(region)} {district === "전체" ? "" : district} 자세히
                  보기
                  <ArrowRight size={17} />
                </button>
                <button
                  className="btn wide"
                  onClick={() => addCompare(selection)}
                >
                  <Plus size={16} />
                  지역 비교함에 추가
                </button>
              </section>
            </div>
            <div className="section-head margin-top">
              <div>
                <h2>
                  놓치지 말아야 할 소식 <span className="pill">중요</span>
                </h2>
                <p>공식 발표와 확인이 필요한 일정을 한곳에서</p>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  go("region");
                  setLayer("중요소식");
                }}
              >
                지역별 소식 보기 <ArrowRight size={16} />
              </button>
            </div>
            <div className="cards">{news.slice(0, 6).map(card)}</div>
            <div className="bottom-grid">
              <section className="panel">
                <div className="section-head">
                  <h2>공급 흐름 살펴보기</h2>
                  <button className="text-button" onClick={() => go("supply")}>
                    연도별 전체 보기 <ArrowRight size={16} />
                  </button>
                </div>
                <div className="row">
                  <span className="tag green">{region}</span>
                  <span className="note">분양·입주·인허가를 구분해 확인</span>
                </div>
                {supplyChart}
              </section>
              <section className="panel dark-panel">
                <Sparkles size={25} />
                <h2>
                  자료에 묻고,
                  <br />
                  근거까지 확인하세요.
                </h2>
                <p>
                  지역·단지·공급량에 대한 질문을 등록된 공식자료에서
                  찾아드립니다.
                </p>
                <button className="btn light" onClick={() => go("guide")}>
                  부동산 자료 도우미 <ArrowUpRight size={17} />
                </button>
                <small>생성형 AI 미연동 시 자료 검색으로 제공</small>
              </section>
            </div>
          </TabsContent>
          <TabsContent value="region">
            <div className="page-heading">
              <div>
                <p className="eyebrow">REGION EXPLORER</p>
                <h1>지역 탐색</h1>
                <p>지역의 시세, 분양과 정비사업을 함께 확인하세요.</p>
              </div>
            </div>
            {toolbar}
            <MarketSnapshot
              records={records}
              region={region}
              district={district}
            />
            <div className="filter-chips">
              {["전체", ...kinds.filter((x) => x !== "공급량")].map((x) => (
                <button
                  key={x}
                  className={layer === x ? "selected" : ""}
                  onClick={() => setLayer(x)}
                >
                  {x}
                </button>
              ))}
            </div>
            <section className="panel">
              <div className="section-head">
                <h2>
                  {region} {district === "전체" ? "" : district}{" "}
                  <span>{filtered.length}건 등록</span>
                </h2>
                <button className="btn" onClick={() => go("supply")}>
                  <ChartNoAxesCombined size={16} />
                  연도별 공급
                </button>
              </div>
              {filtered.length ? (
                <div className="cards">{filtered.map(card)}</div>
              ) : (
                <Empty>
                  선택한 지역·분류의 자료가 아직 등록되지 않았습니다. 자료
                  관리에서 공식자료를 추가할 수 있습니다.
                </Empty>
              )}
            </section>
            <section className="panel margin-top">
              <h2>지역별 상승률</h2>
              <p className="note">
                같은 지표·같은 기준일의 수치만 비교합니다. 지수가 없는 지역은
                순위에서 제외됩니다.
              </p>
              <Rankings records={records} />
            </section>
          </TabsContent>
          <TabsContent value="supply">
            <div className="page-heading">
              <div>
                <p className="eyebrow">HOUSING SUPPLY</p>
                <h1>연도별 공급량</h1>
                <p>시·구별 공급량과 집계에 포함된 단지를 함께 확인하세요.</p>
              </div>
            </div>
            <SupplyLocation
              region={region}
              district={district}
              onRegion={selectRegion}
              onDistrict={setDistrict}
            />
            <section className="panel">
              <div className="section-head">
                <h2>
                  {region} {district === "전체" ? "" : district} 공급 추이
                </h2>
                <div className="filters">
                  <Pick
                    value={supplyType}
                    onChange={setSupplyType}
                    options={["입주", "분양", "인허가", "준공"]}
                    label="공급 유형"
                  />
                  <Pick
                    value={startYear}
                    onChange={(v) => {
                      setStartYear(v);
                      if (+v > +endYear) setEndYear(v);
                    }}
                    options={Array.from({ length: 16 }, (_, i) =>
                      String(2020 + i),
                    )}
                    label="시작 연도"
                  />
                  <span>~</span>
                  <Pick
                    value={endYear}
                    onChange={setEndYear}
                    options={Array.from(
                      { length: 2035 - Number(startYear) + 1 },
                      (_, i) => String(Number(startYear) + i),
                    )}
                    label="종료 연도"
                  />
                </div>
              </div>
              {supplyChart}
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      "연도",
                      "유형",
                      "확인 물량",
                      "범위",
                      "실적·예정",
                      "자료 출처",
                    ].map((x) => (
                      <TableHead key={x}>{x}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supply.map((s) => (
                    <TableRow key={s.year}>
                      <TableCell>{s.year}</TableCell>
                      <TableCell>{supplyType}</TableCell>
                      <TableCell>
                        <b>{fmt(s.value, "호")}</b>
                      </TableCell>
                      <TableCell>
                        {s.value == null
                          ? "자료 없음"
                          : s.partial
                            ? "부분집계"
                            : "전체집계"}
                      </TableCell>
                      <TableCell>
                        {[...new Set(s.rows.map((x) => x.status))].join(
                          " · ",
                        ) || "—"}
                      </TableCell>
                      <TableCell>
                        {s.rows.length ? (
                          s.rows.map((x) => (
                            <div key={x.id}>
                              <LinkOut url={x.url}>
                                {x.source} · {x.date}
                              </LinkOut>
                            </div>
                          ))
                        ) : (
                          <SupplySearch
                            region={region}
                            district={district}
                            year={s.year}
                            type={supplyType}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
            <SupplyDistricts
              records={records}
              region={region}
              district={district}
              years={years}
              type={supplyType}
              onDistrict={setDistrict}
            />
            <section className="panel margin-top">
              <h2>미분양 현황</h2>
              <div className="region-metrics">
                {["미분양", "준공 후 미분양"].map((n) => (
                  <div key={n}>
                    <p>{n}</p>
                    <strong>
                      {fmt(metric(region, district, n)?.units, "호")}
                    </strong>
                    <small>
                      {metric(region, district, n) ? (
                        <LinkOut url={metric(region, district, n)!.url}>
                          {metric(region, district, n)!.date} · 출처
                        </LinkOut>
                      ) : (
                        "자료 미등록"
                      )}
                    </small>
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>
          <TabsContent value="compare">
            <div className="page-heading">
              <div>
                <p className="eyebrow">SIDE BY SIDE / UP TO FIVE</p>
                <h1>
                  지역·단지 비교{" "}
                  <span className="accent">{compare.length}/5</span>
                </h1>
                <p>지역과 단지는 각각 같은 기준으로 비교합니다.</p>
              </div>
              <button className="btn" onClick={() => setCompare([])}>
                비교함 비우기
              </button>
            </div>
            <div className="filters">
              <Pick
                value={compareType}
                onChange={setCompareType}
                options={["지역", "단지"]}
                label="비교 유형"
              />
              {compareType === "지역" ? (
                toolbar
              ) : (
                <Select
                  value="선택"
                  onValueChange={(v) => addCompare("unit:" + v)}
                >
                  <SelectTrigger className="picker" aria-label="비교 단지 선택">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="선택">단지 선택</SelectItem>
                    {records
                      .filter((x) =>
                        ["분양", "재개발", "재건축", "실거래"].includes(x.kind),
                      )
                      .map((x) => (
                        <SelectItem key={x.id} value={x.id}>
                          {x.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="filter-chips">
              {compare.map((id) => (
                <button
                  key={id}
                  onClick={() => setCompare(compare.filter((x) => x !== id))}
                >
                  {id.startsWith("unit:")
                    ? records.find((x) => x.id === id.slice(5))?.name
                    : id.replace("|", " ")}
                  <X size={14} />
                </button>
              ))}
            </div>
            <CompareTable
              records={records}
              ids={compare.filter((x) =>
                compareType === "지역"
                  ? !x.startsWith("unit:")
                  : x.startsWith("unit:"),
              )}
              type={compareType}
            />
          </TabsContent>
          <TabsContent value="calendar">
            <CalendarView records={records} detail={setDetail} />
          </TabsContent>
          <TabsContent value="favorites">
            <div className="page-heading">
              <div>
                <p className="eyebrow">MY WATCHLIST</p>
                <h1>관심목록과 알림</h1>
                <p>저장한 지역과 단지의 변경 소식을 모아봅니다.</p>
              </div>
            </div>
            {!account.signedIn ? (
              <SignInNotice />
            ) : (
              <>
                <div className="account-notice">
                  <Check size={17} />
                  <span>
                    <b>{account.email}</b> 계정의 관심목록입니다.
                  </span>
                </div>
                <div className="filter-chips">
                  {prefs.favorites
                    .filter((x) => x.includes("|"))
                    .map((id) => (
                      <button
                        key={id}
                        onClick={() => {
                          const [r, d] = id.split("|");
                          setRegion(r);
                          setDistrict(d);
                          go("region");
                        }}
                      >
                        <MapPin size={15} />
                        {id.replace("|", " ")}
                      </button>
                    ))}
                </div>
                <div className="cards">
                  {records
                    .filter(
                      (x) =>
                        prefs.favorites.includes(x.id) ||
                        prefs.favorites.includes(x.region + "|전체") ||
                        prefs.favorites.includes(x.region + "|" + x.district),
                    )
                    .map(card)}
                </div>
                {!prefs.favorites.length && (
                  <Empty>관심지역이나 단지의 별표를 눌러 저장하세요.</Empty>
                )}
                <section className="panel margin-top">
                  <div className="section-head">
                    <h2>관심정보 알림</h2>
                    <Switch
                      aria-label="관심 알림 켜기"
                      checked={prefs.alerts}
                      onCheckedChange={(v) =>
                        savePrefs({ ...prefs, alerts: v })
                      }
                    />
                  </div>
                  <p>
                    관심목록에 등록한 지역·단지의 중요소식과 접수 마감 일정을
                    확인합니다.
                  </p>
                  {prefs.alerts && (
                    <div className="notice">
                      {
                        records.filter(
                          (x) =>
                            x.important &&
                            (prefs.favorites.includes(x.id) ||
                              prefs.favorites.includes(x.region + "|전체") ||
                              prefs.favorites.includes(
                                x.region + "|" + x.district,
                              )),
                        ).length
                      }
                      개의 관심 중요소식이 등록되어 있습니다.
                    </div>
                  )}
                  <label className="field">
                    알림 받을 이메일 주소
                    <input
                      type="email"
                      value={prefs.email}
                      placeholder={account.email}
                      onChange={(e) =>
                        setPrefs({ ...prefs, email: e.target.value })
                      }
                    />
                  </label>
                  <button className="btn" onClick={() => savePrefs(prefs)}>
                    알림 설정 저장
                  </button>
                  <button
                    className="btn"
                    disabled={!connections.email}
                    onClick={sendDigest}
                  >
                    내 이메일로 관심자료 보내기
                  </button>
                  <p className="note">
                    관심목록은 현재 로그인한 이메일 계정에만 표시됩니다. 자동
                    이메일 발송은 발송 서비스와 정기 실행 연결 전까지 작동하지
                    않습니다.
                  </p>
                </section>
              </>
            )}
          </TabsContent>
          <TabsContent value="guide">
            <ToolsView records={records} ai={connections.ai} />
          </TabsContent>
          <TabsContent value="admin">
            {account.canAdmin ? (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">DATA & SOURCES</p>
                    <h1>자료 관리</h1>
                    <p>공식자료를 등록하고 출처와 기준일을 관리합니다.</p>
                  </div>
                  <button
                    className="btn primary"
                    onClick={() => {
                      setEditing(null);
                      setShowEdit(true);
                    }}
                  >
                    <Plus size={16} />
                    자료 등록
                  </button>
                </div>
                <div className="stats">
                  <div className="stat">
                    <h3>공급자료 연동</h3>
                    <p>
                      KOSIS {connections.kosis ? "연결됨" : "대기"} · 청약홈{" "}
                      {connections.housing ? "연결됨" : "대기"}
                    </p>
                    <LinkOut url="https://kosis.kr/openapi/">
                      KOSIS 공식 통계
                    </LinkOut>
                  </div>
                  <div className="stat">
                    <h3>생성형 AI</h3>
                    <p>
                      {connections.ai
                        ? "연결 설정됨"
                        : "연동 대기 · 현재 자료 검색 제공"}
                    </p>
                  </div>
                  <div className="stat">
                    <h3>이메일 자동발송</h3>
                    <p>
                      {connections.email
                        ? "수동 발송 연결됨 · 정기 실행 미연결"
                        : "발송 서비스·정기 실행 연결 필요"}
                    </p>
                  </div>
                  <div className="stat">
                    <h3>자료 저장소</h3>
                    <p>
                      {loaded
                        ? "연결됨 · 관심목록과 자료 저장 가능"
                        : "연결 확인 필요"}
                    </p>
                  </div>
                </div>
                <section className="panel">
                  <h2>실제 자료 연결 절차</h2>
                  <ol>
                    <li>
                      KOSIS 연간 인허가 통계와 청약홈 APT 공고를 각각
                      수집합니다.
                    </li>
                    <li>
                      인증키는 서버 비밀 환경변수에만 저장하며 공개 저장소에는
                      올리지 않습니다.
                    </li>
                    <li>
                      GitHub Actions가 매일 오전 9시 15분에 자동 수집합니다. 이
                      화면의 버튼은 즉시 다시 수집할 때 사용합니다.
                    </li>
                  </ol>
                  <p className="note">
                    KOSIS 인허가는 시도 전체 연간 실적입니다. 실제 분양·입주량과
                    다르며 구·군 세부값은 단지 및 지자체 자료를 별도로 수집해야
                    합니다.
                  </p>
                  <LinkOut url="https://github.com/Jijunkyoung/Gyeongsang-Real-Estate-Search/blob/main/docs/DATA_SETUP.md">
                    항목별 연결 방법과 현재 제공 범위
                  </LinkOut>
                  <h2>KOSIS 연간 인허가 통계 수집</h2>
                  <p className="note">
                    국토교통부 지역별 주택건설 인허가실적에서 경상권 5개 시도의
                    연간 전체값을 가져옵니다. 현재 공식 확정자료 범위 안에서
                    선택하세요.
                  </p>
                  <div className="filters">
                    <input
                      aria-label="KOSIS 시작 연도"
                      type="number"
                      min="1990"
                      max={new Date().getFullYear()}
                      value={kosisFrom}
                      onChange={(e) => setKosisFrom(e.target.value)}
                    />
                    <span>~</span>
                    <input
                      aria-label="KOSIS 종료 연도"
                      type="number"
                      min="1990"
                      max={new Date().getFullYear()}
                      value={kosisTo}
                      onChange={(e) => setKosisTo(e.target.value)}
                    />
                    <button
                      className="btn primary"
                      disabled={!connections.kosis || kosisSyncing}
                      onClick={syncKosis}
                    >
                      {kosisSyncing ? "수집 중…" : "KOSIS 수집 실행"}
                    </button>
                  </div>
                  <h2>청약홈 공고 수집</h2>
                  <p className="note">
                    APT 공고를 최대 93일 범위로 수집합니다. 전체 주택 공급량으로
                    집계하지 않습니다. 자동수집은 최근 60일과 향후 120일을 짧은
                    구간으로 나눠 조회합니다.
                  </p>
                  <div className="filters">
                    <input
                      aria-label="수집 시작일"
                      type="date"
                      value={syncFrom}
                      onChange={(e) => setSyncFrom(e.target.value)}
                    />
                    <span>~</span>
                    <input
                      aria-label="수집 종료일"
                      type="date"
                      value={syncTo}
                      onChange={(e) => setSyncTo(e.target.value)}
                    />
                    <button
                      className="btn primary"
                      disabled={!connections.housing || syncing}
                      onClick={syncData}
                    >
                      {syncing ? "수집 중…" : "수집 실행"}
                    </button>
                  </div>
                  {syncRuns.length > 0 && (
                    <div className="stats margin-top">
                      {syncRuns.map((run) => (
                        <div className="stat" key={run.source}>
                          <h3>{run.source} 최근 수집</h3>
                          <p>
                            {run.status === "success" ? "정상" : "실패"} ·{" "}
                            {run.count}건
                          </p>
                          <small>
                            {run.message} ·{" "}
                            {new Date(run.updatedAt).toLocaleString("ko-KR")}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <div className="filters">
                  <button
                    className="btn"
                    onClick={() =>
                      download(
                        "estate-data.json",
                        JSON.stringify(records, null, 2),
                      )
                    }
                  >
                    <Download size={16} />
                    전체 자료 내보내기
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      download(
                        "estate-import-template.json",
                        JSON.stringify(
                          [
                            {
                              id: "supply-지역-연도-유형",
                              kind: "공급량",
                              name: "공급자료 제목",
                              region: "울산광역시",
                              district: "전체",
                              date: "2026-09-07",
                              source: "공식자료 기관명",
                              url: "https://www.ulsan.go.kr/",
                              summary:
                                "원문에서 확인한 범위와 주택유형을 기입하세요.",
                              status: "예정",
                              important: false,
                              units: 0,
                              year: 2027,
                              supplyType: "입주",
                              coverage: "부분집계",
                            },
                          ],
                          null,
                          2,
                        ),
                      )
                    }
                  >
                    가져오기 양식
                  </button>
                  <label className="btn upload">
                    JSON 자료 가져오기
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          if (f.size > 2000000)
                            throw Error("2MB 이하 파일을 선택하세요.");
                          const rows = JSON.parse(await f.text());
                          const r = await fetch("/api/estate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ records: rows }),
                          });
                          const d: any = await r.json();
                          if (!r.ok) throw Error(d.error);
                          toast.success(`${d.count}건을 저장했습니다.`);
                          await reload();
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <p className="note">
                  같은 ID의 자료는 갱신됩니다. 새 ID를 사용하면 추가됩니다.
                  공급량은 같은 범위를 중복 등록하지 마세요. 양식의 0은 입력
                  자리이며 실제 수치로 수정해야 합니다.
                </p>
                <section className="panel">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {["분류", "자료명", "지역", "기준·게시일", "관리"].map(
                          (x) => (
                            <TableHead key={x}>{x}</TableHead>
                          ),
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((x) => (
                        <TableRow key={x.id}>
                          <TableCell>{x.kind}</TableCell>
                          <TableCell>{x.name}</TableCell>
                          <TableCell>
                            {short(x.region)} {x.district}
                          </TableCell>
                          <TableCell>{x.date}</TableCell>
                          <TableCell>
                            <button
                              className="text-button"
                              onClick={() => {
                                setEditing(x);
                                setShowEdit(true);
                              }}
                            >
                              수정
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
                <div className="section-head margin-top">
                  <h2>공식 출처 바로가기</h2>
                  <span className="note">
                    외부 원문 링크 · 자동수집 여부와 별개
                  </span>
                </div>
                <div className="source-grid">
                  {sources.map((s) => (
                    <a
                      className="source-card"
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      key={s.name}
                    >
                      <Landmark size={20} />
                      <div>
                        <b>{s.name}</b>
                        <p>{s.type}</p>
                      </div>
                      <ArrowUpRight size={18} />
                    </a>
                  ))}
                </div>
              </>
            ) : (
              <section className="panel">
                <h2>관리자 전용</h2>
                <p>자료 등록·수집·수정은 사이트 관리자만 사용할 수 있습니다.</p>
              </section>
            )}
          </TabsContent>
        </main>
      </Tabs>
      <footer>
        <span>영남 부동산 아틀라스</span>
        <span>
          공식자료 우선 · 출처와 기준일 확인 · 확인 자료는 2026.09.07에 수집
        </span>
      </footer>
      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent className="detail-sheet">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.name}</SheetTitle>
                <SheetDescription>
                  {detail.region} {detail.district} · {detail.kind}
                </SheetDescription>
              </SheetHeader>
              <div className="detail-body">
                <span className="tag green">{detail.status}</span>
                <p>{detail.summary}</p>
                <p className="note">
                  아래에는 확인된 항목만 표시합니다. 미표시 항목은 값이 0이거나
                  사업에 해당하지 않는다고 단정할 수 없습니다. 원문을 함께
                  확인하세요.
                </p>
                <dl>
                  {detailFields(detail).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <h3>확인 이력</h3>
                {detail.history?.length ? (
                  <ol className="timeline">
                    {detail.history.map((h, i) => (
                      <li key={i}>
                        <time>{h.date}</time>
                        <p>{h.text}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="note">확인된 진행 이력이 없습니다.</p>
                )}
                <LinkOut url={detail.url}>{detail.source} 원문 확인</LinkOut>
                <p className="note">기준·게시일: {detail.date}</p>
                <button className="btn wide" onClick={() => star(detail.id)}>
                  <Star size={16} />
                  관심목록 저장·해제
                </button>
                {["분양", "재개발", "재건축", "실거래"].includes(
                  detail.kind,
                ) && (
                  <button
                    className="btn primary wide"
                    onClick={() => {
                      addCompare("unit:" + detail.id);
                      setCompareType("단지");
                    }}
                  >
                    단지 비교함에 추가
                  </button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="editor-dialog">
          <DialogHeader>
            <DialogTitle>{editing ? "자료 수정" : "공식자료 등록"}</DialogTitle>
            <DialogDescription>
              출처와 기준일을 입력하세요. 확인되지 않은 수치는 비워두세요.
            </DialogDescription>
          </DialogHeader>
          {showEdit && (
            <Editor
              initial={editing}
              onSaved={async () => {
                setShowEdit(false);
                await reload();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Rankings({ records }: { records: Estate[] }) {
  const [m, setM] = useState("매매지수 주간"),
    [date, setDate] = useState("최신 동일기준");
  const dates = [
    ...new Set(
      records
        .filter((x) => x.kind === "시장지표" && x.metric === m)
        .map((x) => x.date),
    ),
  ]
    .sort()
    .reverse();
  const chosen = date === "최신 동일기준" ? dates[0] : date;
  const rows = records
    .filter(
      (x) =>
        x.kind === "시장지표" &&
        x.metric === m &&
        x.date === chosen &&
        x.rate != null,
    )
    .sort((a, b) => (b.rate || 0) - (a.rate || 0));
  return (
    <>
      <div className="filters">
        <Pick
          value={m}
          onChange={(v) => {
            setM(v);
            setDate("최신 동일기준");
          }}
          options={[
            "매매지수 월간",
            "전세지수 월간",
            "매매지수 주간",
            "전세지수 주간",
          ]}
          label="상승률 지표"
        />
        <Pick
          value={date}
          onChange={setDate}
          options={["최신 동일기준", ...dates]}
          label="지표 기준일"
        />
      </div>
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>순위</TableHead>
              <TableHead>지역</TableHead>
              <TableHead>변동률</TableHead>
              <TableHead>기준일</TableHead>
              <TableHead>출처</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>
                  {r.region} {r.district}
                </TableCell>
                <TableCell>{fmt(r.rate, "%")}</TableCell>
                <TableCell>{r.date}</TableCell>
                <TableCell>
                  <LinkOut url={r.url}>{r.source}</LinkOut>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Empty>해당 지표의 공식 통계가 아직 등록되지 않았습니다.</Empty>
      )}
    </>
  );
}
function CompareTable({
  records,
  ids,
  type,
}: {
  records: Estate[];
  ids: string[];
  type: string;
}) {
  const [y, setY] = useState("2026");
  if (!ids.length)
    return (
      <section className="panel">
        <Empty>
          {type === "지역"
            ? "시도와 시군구를 선택해 비교함에 추가하세요."
            : "지역 탐색에서 단지의 상세정보를 열어 비교함에 추가하세요."}{" "}
          최대 5개를 비교할 수 있습니다.
        </Empty>
      </section>
    );
  const getMetric = (r: string, d: string, m: string) =>
    records
      .filter(
        (x) =>
          x.kind === "시장지표" &&
          x.region === r &&
          x.district === d &&
          x.metric === m,
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  const stats = [
    "매매지수 주간",
    "전세지수 주간",
    "매매지수 월간",
    "전세지수 월간",
    "거래량",
    "미분양",
    "준공 후 미분양",
  ];
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{type} 비교표</h2>
        <Pick
          value={y}
          onChange={setY}
          options={Array.from({ length: 16 }, (_, i) => String(2020 + i))}
          label="공급 비교 연도"
        />
      </div>
      <p className="note">
        통계는 기준일이 다르면 직접 비교하지 마세요. 개별 단지의 금액은
        전용면적·계약일·층·주택유형을 함께 확인해야 합니다.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>항목</TableHead>
            {ids.map((id) => (
              <TableHead key={id}>
                {type === "지역"
                  ? id.replace("|", " ")
                  : records.find((x) => x.id === id.slice(5))?.name ||
                    "자료 없음"}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(type === "지역"
            ? [
                ...stats,
                `${y}년 분양`,
                `${y}년 입주`,
                `${y}년 인허가`,
                `${y}년 준공`,
              ]
            : [
                "전용면적",
                "분양가·거래가",
                "㎡당 금액",
                "확인 물량",
                "입주 예정",
                "추진단계",
                "기준일",
                "출처",
              ]
          ).map((label) => (
            <TableRow key={label}>
              <TableCell>
                <b>{label}</b>
              </TableCell>
              {ids.map((id) => {
                if (type === "지역") {
                  const [r, d] = id.split("|");
                  if (label.includes("년 ")) {
                    const s = supplyFor(
                      records,
                      r,
                      d,
                      +y,
                      label.split("년 ")[1],
                    );
                    return (
                      <TableCell key={id}>
                        {fmt(s.value, "호")}
                        <small className="block">
                          {s.value == null
                            ? ""
                            : s.partial
                              ? "부분집계"
                              : "전체집계"}
                        </small>
                      </TableCell>
                    );
                  }
                  const s = getMetric(r, d, label);
                  return (
                    <TableCell key={id}>
                      {fmt(
                        label.includes("지수") ? s?.rate : s?.units,
                        label.includes("지수")
                          ? "%"
                          : label === "거래량"
                            ? "건"
                            : "호",
                      )}
                      {s && (
                        <small className="block">
                          <LinkOut url={s.url}>{s.date}</LinkOut>
                        </small>
                      )}
                    </TableCell>
                  );
                }
                const x = records.find((v) => v.id === id.slice(5));
                const val = !x ? (
                  "자료 없음"
                ) : label === "전용면적" ? (
                  fmt(x.area, "㎡")
                ) : label === "분양가·거래가" ? (
                  fmt(x.price, "만원")
                ) : label === "㎡당 금액" ? (
                  fmt(
                    x.price != null && x.area
                      ? Math.round(x.price / x.area)
                      : null,
                    "만원/㎡",
                  )
                ) : label === "확인 물량" ? (
                  fmt(x.units, "호")
                ) : label === "입주 예정" ? (
                  fmt(x.moveYear, "년")
                ) : label === "추진단계" ? (
                  x.stage || "미확인"
                ) : label === "기준일" ? (
                  x.date
                ) : (
                  <LinkOut url={x.url}>{x.source}</LinkOut>
                );
                return <TableCell key={id}>{val}</TableCell>;
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
function CalendarView({
  records,
  detail,
}: {
  records: Estate[];
  detail: (x: Estate) => void;
}) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)),
    [r, setR] = useState("전체");
  const [year, mon] = month.split("-").map(Number);
  const days = new Date(year, mon, 0).getDate(),
    offset = new Date(year, mon - 1, 1).getDay();
  type CalendarEvent = {
    key: string;
    date: string;
    label: string;
    record: Estate;
    monthOnly: boolean;
  };
  const events = useMemo(
    () => {
      const found: CalendarEvent[] = [];
      const add = (
        record: Estate,
        date: string | undefined,
        label: string,
      ) => {
        if (!date || !/^\d{4}-\d{2}(-\d{2})?$/.test(date)) return;
        found.push({
          key: `${record.id}|${date}|${label}`,
          date: date.length === 7 ? `${date}-01` : date,
          label,
          record,
          monthOnly: date.length === 7,
        });
      };
      for (const record of records) {
        if (r !== "전체" && r !== record.region) continue;
        add(record, record.endDate, "청약·접수 마감");
        if (
          ["분양", "재개발", "재건축"].includes(record.kind) &&
          !(record.history || []).some((history) => history.date === record.date)
        )
          add(record, record.date, `${record.kind} 게시·기준일`);
        add(record, record.moveMonth, "입주 예정월");
        for (const history of record.history || [])
          add(record, history.date, history.text);
      }
      return [...new Map(found.map((event) => [event.key, event])).values()];
    },
    [records, r],
  );
  const monthEvents = events
    .filter((event) => event.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
  function shift(n: number) {
    const d = new Date(year, mon - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">DATES THAT MATTER</p>
          <h1>청약·사업 일정 달력</h1>
          <p>
            모집공고·마감일·사업 이력·입주 예정월을 함께 봅니다. 월 단위 일정은
            날짜가 확정된 것이 아닙니다.
          </p>
        </div>
      </div>
      <section className="panel">
        <div className="section-head">
          <div className="filters">
            <button
              className="btn"
              aria-label="이전 달"
              onClick={() => shift(-1)}
            >
              ‹
            </button>
            <h2>
              {year}년 {mon}월
            </h2>
            <button
              className="btn"
              aria-label="다음 달"
              onClick={() => shift(1)}
            >
              ›
            </button>
            <input
              aria-label="달력 월"
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
          </div>
          <Pick
            value={r}
            onChange={setR}
            options={["전체", ...Object.keys(regions)]}
            label="일정 지역"
          />
        </div>
        <div className="calendar-grid">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <div className="weekday" key={d}>
              {d}
            </div>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <div className="calendar-day blank" key={"blank" + i} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const day = `${month}-${String(i + 1).padStart(2, "0")}`;
            return (
              <div className="calendar-day" key={day}>
                <b>{i + 1}</b>
                {monthEvents
                  .filter((event) => !event.monthOnly && event.date === day)
                  .map((event) => (
                    <button
                      key={event.key}
                      onClick={() => detail(event.record)}
                    >
                      {event.record.name}
                      <small>{event.label}</small>
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
        {monthEvents.some((event) => event.monthOnly) && (
          <div className="margin-top">
            <h3>월 단위 예정 일정</h3>
            <p className="note">
              날짜가 확정되지 않은 입주·공급 예정은 아래에 별도로 표시합니다.
            </p>
            <div className="filter-chips">
              {monthEvents
                .filter((event) => event.monthOnly)
                .map((event) => (
                  <button
                    key={`month-${event.key}`}
                    onClick={() => detail(event.record)}
                  >
                    {event.record.name} · {event.label}
                  </button>
                ))}
            </div>
          </div>
        )}
        {!monthEvents.length && (
          <p className="note">
            이번 달에 수집·등록된 일정이 없습니다. 실제 일정이 없다는 의미는
            아닙니다.
          </p>
        )}
      </section>
      <section className="panel margin-top">
        <h2>{year}년 {mon}월 일정 목록</h2>
        {monthEvents.length ? (
          monthEvents.map((event) => (
              <div className="event-row" key={event.key}>
                <span>
                  {event.monthOnly ? event.date.slice(0, 7) : event.date}
                </span>
                <button
                  className="text-button"
                  onClick={() => detail(event.record)}
                >
                  {event.record.name} · {event.label}
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    const clean = (s: string) =>
                      s
                        .replace(/\\/g, "\\\\")
                        .replace(/\n/g, "\\n")
                        .replace(/[,;]/g, " ");
                    download(
                      "estate-schedule.ics",
                      `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Yeongnam Atlas//KO\r\nBEGIN:VEVENT\r\nUID:${event.key.replace(/[^a-zA-Z0-9]/g, "-")}@yeongnam-atlas\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z\r\nDTSTART;VALUE=DATE:${event.date.replace(/-/g, "")}\r\nSUMMARY:${clean(event.record.name + " " + event.label)}\r\nDESCRIPTION:${clean(event.record.source + " " + event.record.url)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`,
                      "text/calendar",
                    );
                  }}
                >
                  <Download size={15} />내 달력에 추가
                </button>
              </div>
            ))
        ) : (
          <p className="note">
            자료를 수집하거나 자료 관리에서 일정을 등록하면 달력에 반영됩니다.
            청약홈에 아직 게시되지 않은 향후 공고는 자동수집 후 표시됩니다.
          </p>
        )}
      </section>
    </>
  );
}
function ToolsView({ records, ai }: { records: Estate[]; ai: boolean }) {
  const [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState<any>(null),
    [asking, setAsking] = useState(false);
  const [price, setPrice] = useState(50000),
    [options, setOptions] = useState(2000),
    [cost, setCost] = useState(1000),
    [loan, setLoan] = useState(30000),
    [rate, setRate] = useState(4),
    [term, setTerm] = useState(30),
    [deposit, setDeposit] = useState(10);
  const [unit, setUnit] = useState("선택");
  const picked = records.find((x) => x.id === unit);
  const neighbors = picked
    ? records.filter(
        (x) =>
          x.kind === "실거래" &&
          x.region === picked.region &&
          x.district === picked.district &&
          x.area != null &&
          picked.area != null &&
          Math.abs(x.area - picked.area) <= picked.area * 0.1 &&
          x.price != null,
      )
    : [];
  const interest = rate / 100 / 12,
    n = term * 12,
    payment = interest
      ? (loan * interest * Math.pow(1 + interest, n)) /
        (Math.pow(1 + interest, n) - 1)
      : loan / n;
  async function ask() {
    if (question.trim().length < 2) return;
    setAsking(true);
    setAnswer(null);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      setAnswer(d);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAsking(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PROPERTY TOOLKIT</p>
          <h1>부동산 도구</h1>
          <p>자료 검색부터 자금계획, 검토 체크리스트까지</p>
        </div>
      </div>
      <section className="panel">
        <div className="section-head">
          <h2>
            <Sparkles size={20} />
            부동산 자료 도우미
          </h2>
          <span className="tag">
            {ai ? "AI 연결됨" : "등록 자료 검색 모드"}
          </span>
        </div>
        <p className="note">
          등록된 자료만 근거로 답합니다. 생성형 AI는 별도 연결이 필요하며,
          실시간 인터넷 검색 기능은 포함되지 않습니다.
        </p>
        <div className="ask-row">
          <input
            aria-label="부동산 질문"
            placeholder="예: 울산 입주 공급량은?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
          />
          <button
            className="btn primary"
            onClick={ask}
            disabled={asking || question.trim().length < 2}
          >
            {asking ? "찾는 중…" : "질문하기"}
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="filter-chips">
          {["울산 공급량", "부산 정비사업", "울산 분양"].map((q) => (
            <button key={q} onClick={() => setQuestion(q)}>
              {q}
            </button>
          ))}
        </div>
        {answer && (
          <div className="answer">
            <span className="tag green">{answer.mode}</span>
            <p style={{ whiteSpace: "pre-wrap" }}>{answer.answer}</p>
            {answer.sources.map((s: any, i: number) => (
              <div key={s.id}>
                <LinkOut url={s.url}>
                  [{i + 1}] {s.name} · {s.date}
                </LinkOut>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="panel margin-top">
        <h2>자금계획 계산기</h2>
        <p className="note">
          단위: 만원 · 입력값에 따른 계산이며 대출 가능액·세금·실제 금리를
          판정하지 않습니다.
        </p>
        <div className="calculator">
          <div className="form-grid">
            {[
              ["주택 가격", price, setPrice, 0, 10000000],
              ["옵션 비용", options, setOptions, 0, 1000000],
              ["세금·기타 비용 직접 입력", cost, setCost, 0, 1000000],
              ["예상 대출금", loan, setLoan, 0, 10000000],
              ["연 이자율 (%)", rate, setRate, 0, 100],
              ["상환기간 (년)", term, setTerm, 1, 50],
              ["계약금 비율 (%)", deposit, setDeposit, 0, 100],
            ].map(([l, v, s, min, max]: any) => (
              <label className="field" key={l}>
                {l}
                <input
                  type="number"
                  min={min}
                  max={max}
                  step="any"
                  value={v}
                  onChange={(e) =>
                    s(Math.min(max, Math.max(min, Number(e.target.value))))
                  }
                />
              </label>
            ))}
          </div>
          <div className="calc-result">
            <span>예상 필요 자기자금</span>
            <strong>
              {fmt(Math.max(0, price + options + cost - loan))}
              <small>만원</small>
            </strong>
            <dl>
              <div>
                <dt>총 취득예산</dt>
                <dd>{fmt(price + options + cost)}만원</dd>
              </div>
              <div>
                <dt>계약금</dt>
                <dd>{fmt(Math.round((price * deposit) / 100))}만원</dd>
              </div>
              <div>
                <dt>월 상환액 (원리금균등)</dt>
                <dd>{fmt(Math.round(payment * 10000))}원</dd>
              </div>
              <div>
                <dt>월 이자 (이자만 납부 시)</dt>
                <dd>{fmt(Math.round(loan * 10000 * interest))}원</dd>
              </div>
            </dl>
            {loan > price + options + cost && (
              <p>대출금이 총 예산을 초과합니다. 입력값을 확인하세요.</p>
            )}
            <small>
              계약금은 총 주택 가격에 포함되며 추가 합산하지 않습니다.
            </small>
          </div>
        </div>
      </section>
      <section className="panel margin-top">
        <h2>분양가와 주변 실거래가 비교</h2>
        <p className="note">
          같은 시군구, 전용면적 ±10%의 등록 거래를 찾아줍니다. 연식·계약일·층은
          결과에서 별도로 확인하세요.
        </p>
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger className="picker" aria-label="분양 단지 선택">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="선택">분양 단지 선택</SelectItem>
            {records
              .filter((x) => x.kind === "분양")
              .map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {picked && (
          <p>
            선택 단지: {picked.name} · {fmt(picked.area, "㎡")} ·{" "}
            {fmt(picked.price, "만원")}
          </p>
        )}
        {neighbors.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "거래 단지",
                  "면적",
                  "거래금액",
                  "분양가 차액",
                  "계약일",
                  "상세·출처",
                ].map((x) => (
                  <TableHead key={x}>{x}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {neighbors.map((x) => (
                <TableRow key={x.id}>
                  <TableCell>{x.name}</TableCell>
                  <TableCell>{fmt(x.area, "㎡")}</TableCell>
                  <TableCell>{fmt(x.price, "만원")}</TableCell>
                  <TableCell>
                    {fmt(
                      picked?.price != null && x.price != null
                        ? picked.price - x.price
                        : null,
                      "만원",
                    )}
                  </TableCell>
                  <TableCell>{x.date}</TableCell>
                  <TableCell>
                    <LinkOut url={x.url}>{x.summary || x.source}</LinkOut>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty>면적과 가격이 확인된 비교 거래가 아직 없습니다.</Empty>
        )}
      </section>
      <div className="bottom-grid">
        <section className="panel">
          <h2>부동산 용어 사전</h2>
          {glossary.map(([title, desc]) => (
            <details className="glossary" key={title}>
              <summary>{title}</summary>
              <p>{desc}</p>
            </details>
          ))}
        </section>
        <section className="panel">
          <h2>검토 체크리스트</h2>
          <p className="note">체크 상태는 이번 화면에서만 유지됩니다.</p>
          {[
            "공식 모집공고의 공급유형과 자격 확인",
            "분양가·옵션·중도금 이자 포함 총비용 산정",
            "비슷한 면적·연식의 실제 거래 비교",
            "향후 3년 입주물량과 미분양 확인",
            "정비사업 단계와 최근 인허가 원문 확인",
            "추정 분담금의 기준일·사업비 가정 확인",
            "교통 개발사업의 승인·착공 여부 구분",
            "등기·권리관계 및 거래 제한 개별 확인",
          ].map((x, i) => (
            <label className="check-row" key={x}>
              <Checkbox id={"check" + i} />
              {x}
            </label>
          ))}
        </section>
      </div>
    </>
  );
}
function Editor({
  initial,
  onSaved,
}: {
  initial: Estate | null;
  onSaved: () => void;
}) {
  const [data, setData] = useState<Estate>(
    initial || {
      id: "",
      kind: "중요소식",
      name: "",
      region: "울산광역시",
      district: "전체",
      date: new Date().toISOString().slice(0, 10),
      source: "",
      url: "",
      summary: "",
      status: "공식자료",
      important: false,
    },
  );
  const [saving, setSaving] = useState(false),
    [err, setErr] = useState(""),
    [hist, setHist] = useState(
      (initial?.history || []).map((x) => x.date + " | " + x.text).join("\n"),
    );
  function field(k: keyof Estate, v: any) {
    setData((d) => ({ ...d, [k]: v }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const payload = {
        ...data,
        id: data.id || crypto.randomUUID(),
        history: hist
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [date, ...text] = line.split("|");
            return { date: date.trim(), text: text.join("|").trim() };
          }),
      };
      const r = await fetch("/api/estate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: [payload] }),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      toast.success("자료를 저장했습니다.");
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="editor">
      <div className="form-grid">
        <label className="field">
          분류
          <Pick
            value={data.kind}
            onChange={(v) => field("kind", v)}
            options={[...kinds]}
            label="자료 분류"
          />
        </label>
        <label className="field">
          지역
          <Pick
            value={data.region}
            onChange={(v) => setData({ ...data, region: v, district: "전체" })}
            options={Object.keys(regions)}
            label="자료 지역"
          />
        </label>
        <label className="field">
          시군구
          <Pick
            value={data.district}
            onChange={(v) => field("district", v)}
            options={["전체", ...regions[data.region]]}
            label="자료 시군구"
          />
        </label>
        <label className="field">
          기준·게시일
          <input
            required
            type="date"
            value={data.date}
            onChange={(e) => field("date", e.target.value)}
          />
        </label>
      </div>
      <label className="field">
        자료명·단지명
        <input
          required
          value={data.name}
          onChange={(e) => field("name", e.target.value)}
        />
      </label>
      <div className="form-grid">
        <label className="field">
          출처 기관
          <input
            required
            value={data.source}
            onChange={(e) => field("source", e.target.value)}
          />
        </label>
        <label className="field">
          상태
          <input
            required
            placeholder="예정 / 확정실적 / 공식자료"
            value={data.status}
            onChange={(e) => field("status", e.target.value)}
          />
        </label>
      </div>
      <label className="field">
        원문 URL
        <input
          required
          type="url"
          value={data.url}
          onChange={(e) => field("url", e.target.value)}
        />
      </label>
      <label className="field">
        요약·확인 범위
        <textarea
          rows={3}
          value={data.summary}
          onChange={(e) => field("summary", e.target.value)}
        />
      </label>
      <label className="check-row">
        <Checkbox
          checked={data.important}
          onCheckedChange={(v) => field("important", v === true)}
        />
        메인 중요소식으로 표시
      </label>
      {data.kind === "공급량" && (
        <div className="form-grid">
          <label className="field">
            공급 유형
            <Pick
              value={data.supplyType || "입주"}
              onChange={(v) => field("supplyType", v)}
              options={["분양", "입주", "인허가", "준공"]}
              label="공급 유형"
            />
          </label>
          <label className="field">
            집계 범위
            <Pick
              value={data.coverage || "부분집계"}
              onChange={(v) => field("coverage", v)}
              options={["부분집계", "전체집계"]}
              label="집계 범위"
            />
          </label>
          <label className="field">
            공급 연도
            <input
              required
              type="number"
              min="1900"
              max="2200"
              value={data.year ?? ""}
              onChange={(e) =>
                setData({
                  ...data,
                  year: e.target.value ? +e.target.value : null,
                  supplyType: data.supplyType || "입주",
                  coverage: data.coverage || "부분집계",
                })
              }
            />
          </label>
        </div>
      )}
      {data.kind === "시장지표" && (
        <label className="field">
          지표
          <Pick
            value={data.metric || "선택"}
            onChange={(v) => field("metric", v)}
            options={[
              "선택",
              "매매지수 월간",
              "전세지수 월간",
              "매매지수 주간",
              "전세지수 주간",
              "거래량",
              "미분양",
              "준공 후 미분양",
            ]}
            label="시장지표"
          />
        </label>
      )}
      {data.kind !== "중요소식" && (
        <div className="form-grid">
          {(
            [
              ["units", "물량·거래량 (호/건)"],
              ["price", "분양가·실거래가 (만원)"],
              ["area", "전용면적 (㎡)"],
              ["rate", "지수 변동률 (%)"],
              ["moveYear", "입주 예정연도"],
              ["ratio", "청약 경쟁률 (:1)"],
            ] as [keyof Estate, string][]
          ).map(([k, label]) => (
            <label key={k} className="field">
              {label}
              <input
                type="number"
                step="any"
                value={(data[k] as number) ?? ""}
                onChange={(e) =>
                  field(k, e.target.value === "" ? null : +e.target.value)
                }
              />
            </label>
          ))}
        </div>
      )}
      <div className="form-grid">
        <label className="field">
          접수·계약 마감일
          <input
            type="date"
            value={data.endDate || ""}
            onChange={(e) => field("endDate", e.target.value)}
          />
        </label>
        <label className="field">
          추진단계
          <input
            value={data.stage || ""}
            onChange={(e) => field("stage", e.target.value)}
          />
        </label>
        <label className="field">
          시공사
          <input
            value={data.developer || ""}
            onChange={(e) => field("developer", e.target.value)}
          />
        </label>
      </div>
      <label className="field">
        사업 이력 (한 줄에 날짜 | 내용)
        <textarea
          placeholder="2026-09-07 | 공식 고시 확인"
          value={hist}
          onChange={(e) => setHist(e.target.value)}
          rows={3}
        />
      </label>
      {err && (
        <p role="alert" className="form-error">
          {err}
        </p>
      )}
      <button type="submit" className="btn primary wide" disabled={saving}>
        {saving ? "저장 중…" : "자료 저장"}
      </button>
    </form>
  );
}

function detailFields(x: Estate): [string, string][] {
  const out: [string, string][] = [];
  const add = (label: string, v: number | null | undefined, suffix: string) => {
    if (v != null) out.push([label, fmt(v, suffix)]);
  };
  if (x.kind === "시장지표") {
    out.push(["지표", x.metric || "미등록"]);
    add("변동률", x.rate, "%");
    add(
      x.metric === "거래량" ? "매매 거래량" : "주택 수",
      x.units,
      x.metric === "거래량" ? "건" : "호",
    );
  } else {
    add("확인 물량", x.units, "호");
    add("분양가·실거래가", x.price, "만원");
    add("전용면적", x.area, "㎡");
    add("입주 예정연도", x.moveYear, "년");
    add("경쟁률", x.ratio, ":1");
  }
  for (const [k, v] of [
    ["청약 마감", x.endDate],
    ["추진단계", x.stage],
    ["시공사", x.developer],
    ["공급 유형", x.supplyType],
    ["집계 범위", x.coverage],
  ])
    if (v) out.push([k!, v]);
  return out;
}

function MarketSnapshot({
  records,
  region,
  district,
}: {
  records: Estate[];
  region: string;
  district: string;
}) {
  const names = [
    "매매지수 주간",
    "전세지수 주간",
    "매매지수 월간",
    "전세지수 월간",
    "거래량",
    "미분양",
    "준공 후 미분양",
  ];
  const latest = (name: string) =>
    records
      .filter(
        (x) =>
          x.kind === "시장지표" &&
          x.region === region &&
          x.metric === name &&
          (x.district === district ||
            (district !== "전체" && x.district === "전체")),
      )
      .sort(
        (a, b) =>
          (a.district === district ? 0 : 1) -
            (b.district === district ? 0 : 1) || b.date.localeCompare(a.date),
      )[0];
  return (
    <section className="panel market-snapshot">
      <div className="section-head">
        <div>
          <h2>
            {region} {district === "전체" ? "" : district} 핵심 지표
          </h2>
          <p>
            상세보기를 열지 않아도 최신 등록값과 기준일을 확인할 수 있습니다.
          </p>
        </div>
      </div>
      <div className="snapshot-grid">
        {names.map((name) => {
          const x = latest(name);
          const rate = name.includes("지수");
          const value = rate ? x?.rate : x?.units;
          const suffix = rate ? "%" : name === "거래량" ? "건" : "호";
          return (
            <article key={name}>
              <span>{name}</span>
              <strong
                className={
                  rate && value != null
                    ? value > 0
                      ? "value-up"
                      : value < 0
                        ? "value-down"
                        : ""
                    : ""
                }
              >
                {rate && value != null && value > 0 ? "+" : ""}
                {fmt(value, suffix)}
              </strong>
              {x ? (
                <>
                  <small>
                    {x.district === district ? x.district : "시·도 전체"} ·{" "}
                    {x.date}
                  </small>
                  <LinkOut url={x.url}>출처 확인</LinkOut>
                </>
              ) : (
                <>
                  <small>현재 등록자료 없음</small>
                  <SupplySearch
                    region={region}
                    district={district}
                    year={new Date().getFullYear()}
                    type={name}
                  />
                </>
              )}
            </article>
          );
        })}
      </div>
      <p className="note">
        시군구 자료가 없으면 시·도 전체값을 표시하고 범위를 따로 적습니다.
        주간·월간 지수와 개별 단지 가격 상승률은 서로 다른 지표입니다.
      </p>
    </section>
  );
}
function RecordFacts({ record: x }: { record: Estate }) {
  const facts = detailFields(x);
  return (
    <div className="record-facts">
      <dl>
        {facts.map(([key, value]) => (
          <div
            key={key}
            className={
              key === "변동률"
                ? x.rate! > 0
                  ? "value-up"
                  : x.rate! < 0
                    ? "value-down"
                    : ""
                : ""
            }
          >
            <dt>{key}</dt>
            <dd>
              {key === "변동률" && x.rate! > 0 ? "+" : ""}
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p>
        기준·게시일 <time>{x.date}</time>
      </p>
    </div>
  );
}
function SupplyLocation({
  region,
  district,
  onRegion,
  onDistrict,
}: {
  region: string;
  district: string;
  onRegion: (v: string) => void;
  onDistrict: (v: string) => void;
}) {
  const province = region === "경상남도" || region === "경상북도";
  const city = province ? district.split(" ")[0] : region;
  const children = province ? cityDistricts[city] : regions[region];
  return (
    <section className="panel">
      <h2>시 → 구 선택</h2>
      <div className="filters">
        <label className="field">
          시·도
          <Pick
            value={region}
            onChange={onRegion}
            options={Object.keys(regions)}
            label="공급 시도"
          />
        </label>
        {province && (
          <label className="field">
            시·군
            <Pick
              value={city}
              onChange={onDistrict}
              options={[
                "전체",
                ...regions[region].filter((x) => !x.includes(" ")),
              ]}
              label="공급 시군"
            />
          </label>
        )}
        {children && (
          <label className="field">
            구·군
            <Pick
              value={province ? district.split(" ")[1] || "전체" : district}
              onChange={(v) =>
                onDistrict(
                  province ? (v === "전체" ? city : city + " " + v) : v,
                )
              }
              options={["전체", ...children]}
              label="공급 구군"
            />
          </label>
        )}
      </div>
      {province && !children && city !== "전체" && (
        <p className="note">{city}는 하위 구가 없어 시·군 단위로 조회합니다.</p>
      )}
    </section>
  );
}
function SupplySearch({
  region,
  district,
  year,
  type,
}: {
  region: string;
  district: string;
  year: number;
  type: string;
}) {
  const q = `${region} ${district === "전체" ? "" : district} ${year}년 ${type === "입주" ? "아파트 입주 예정 세대수" : type + " 주택 물량"}`;
  return (
    <a
      className="source-link"
      href={
        "https://search.naver.com/search.naver?query=" + encodeURIComponent(q)
      }
      target="_blank"
      rel="noreferrer"
    >
      {year}년 자료 웹검색
      <ExternalLink size={14} />
    </a>
  );
}
function SupplyDistricts({
  records,
  region,
  district,
  years,
  type,
  onDistrict,
}: {
  records: Estate[];
  region: string;
  district: string;
  years: number[];
  type: string;
  onDistrict: (v: string) => void;
}) {
  const parent = district.split(" ")[0];
  const children = cityDistricts[parent];
  const districts = children
    ? children.map((x) => parent + " " + x)
    : regions[region].filter((x) => !x.includes(" "));
  const shown = records.filter(
    (x) =>
      x.kind === "공급량" &&
      x.region === region &&
      withinDistrict(x.district, district) &&
      x.supplyType === type &&
      years.includes(x.year || 0),
  );
  return (
    <section className="panel margin-top">
      <div className="section-head">
        <h2>{children ? parent : region} 구·군별 공급 비교</h2>
        <span className="tag">{type} · 단위 호</span>
      </div>
      <p className="note">
        지역명을 누르면 해당 구·군으로 이동합니다. 미수집은 공급이 없다는 뜻이
        아닙니다. 시 전체 총계를 구별로 임의 배분하지 않습니다.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>구·군 / 시</TableHead>
            {years.map((y) => (
              <TableHead key={y}>{y}년</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {districts.map((d) => (
            <TableRow key={d}>
              <TableCell>
                <button className="text-button" onClick={() => onDistrict(d)}>
                  {d}
                  {cityDistricts[d] ? " · 구별 보기" : ""}
                </button>
              </TableCell>
              {years.map((y) => {
                const s = supplyFor(records, region, d, y, type);
                return (
                  <TableCell key={y}>
                    <strong>{fmt(s.value)}</strong>
                    <small className="block">
                      {s.value == null
                        ? "미수집"
                        : s.partial
                          ? "부분집계"
                          : "전체집계"}
                    </small>
                    {s.value == null && (
                      <SupplySearch
                        region={region}
                        district={d}
                        year={y}
                        type={type}
                      />
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <h3 className="margin-top">
        {district === "전체" ? region : district} 등록된 공급 근거
      </h3>
      <p className="note">
        아래는 등록 자료 목록입니다. 전체 총계가 있으면 그래프는 총계를 사용하고
        개별 단지를 다시 더하지 않습니다. 예정 물량은 최신 사업 일정에 따라
        변경될 수 있습니다.
      </p>
      {shown.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "연도",
                "구·군",
                "단지·통계명",
                "물량",
                "기간·상태",
                "확인 출처",
              ].map((x) => (
                <TableHead key={x}>{x}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown
              .sort(
                (a, b) =>
                  (a.year || 0) - (b.year || 0) ||
                  a.district.localeCompare(b.district),
              )
              .map((x) => (
                <TableRow key={x.id}>
                  <TableCell>{x.year}</TableCell>
                  <TableCell>{x.district}</TableCell>
                  <TableCell>{x.name}</TableCell>
                  <TableCell>{fmt(x.units, "호")}</TableCell>
                  <TableCell>
                    {x.status}
                    <small className="block">{x.coverage}</small>
                  </TableCell>
                  <TableCell>
                    <LinkOut url={x.url}>{x.source}</LinkOut>
                    <small className="block">{x.date}</small>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      ) : (
        <p className="note">
          선택한 기간·유형의 구별 자료를 아직 수집하지 않았습니다. 위 웹검색에서
          현재 조건으로 추가 자료를 찾을 수 있습니다.
        </p>
      )}
      <details className="glossary">
        <summary>빈칸이 생기는 이유와 검색 방법</summary>
        <p>
          공개자료 검색은 가능합니다. 다만 분양·입주·준공은 서로 다른 통계이며,
          모든 구와 미래 연도의 자료가 하나의 무료 API에 들어 있지는 않습니다.
          미수집은 아직 등록하지 않은 상태이고, 부분집계는 확인한 단지나 기간만
          합산한 값입니다. 웹검색은 새 창에서 실행되며 결과가 자동으로 통계에
          저장되지는 않습니다. 확인한 원본은 자료 관리에서 추가할 수 있습니다.
        </p>
      </details>
    </section>
  );
}
