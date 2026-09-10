import verifiedData from "./verified-data.json";
export const regions: Record<string, string[]> = {
  울산광역시: ["중구", "남구", "동구", "북구", "울주군"],
  인천광역시: [
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
  ],
  부산광역시: [
    "중구",
    "서구",
    "동구",
    "영도구",
    "부산진구",
    "동래구",
    "남구",
    "북구",
    "해운대구",
    "사하구",
    "금정구",
    "강서구",
    "연제구",
    "수영구",
    "사상구",
    "기장군",
  ],
  대구광역시: [
    "중구",
    "동구",
    "서구",
    "남구",
    "북구",
    "수성구",
    "달서구",
    "달성군",
    "군위군",
  ],
  경상남도: [
    "창원시",
    "진주시",
    "통영시",
    "사천시",
    "김해시",
    "밀양시",
    "거제시",
    "양산시",
    "의령군",
    "함안군",
    "창녕군",
    "고성군",
    "남해군",
    "하동군",
    "산청군",
    "함양군",
    "거창군",
    "합천군",
  ],
  경상북도: [
    "포항시",
    "경주시",
    "김천시",
    "안동시",
    "구미시",
    "영주시",
    "영천시",
    "상주시",
    "문경시",
    "경산시",
    "의성군",
    "청송군",
    "영양군",
    "영덕군",
    "청도군",
    "고령군",
    "성주군",
    "칠곡군",
    "예천군",
    "봉화군",
    "울진군",
    "울릉군",
  ],
};
// Non-autonomous city districts are represented with their parent city in the key.
export const cityDistricts: Record<string, string[]> = {
  창원시: ["의창구", "성산구", "마산합포구", "마산회원구", "진해구"],
  포항시: ["남구", "북구"],
};
for (const [city, children] of Object.entries(cityDistricts)) {
  const province = city === "창원시" ? "경상남도" : "경상북도";
  regions[province].push(...children.map((child) => city + " " + child));
}
export function withinDistrict(actual: string, selected: string) {
  return (
    selected === "전체" ||
    actual === selected ||
    actual.startsWith(selected + " ")
  );
}
export const kinds = [
  "분양",
  "재개발",
  "재건축",
  "개발사업",
  "중요소식",
  "공급량",
  "시장지표",
  "실거래",
] as const;
export type Estate = {
  id: string;
  kind: string;
  name: string;
  region: string;
  district: string;
  date: string;
  dateType?: "official" | "checked";
  verifiedAt?: string;
  source: string;
  url: string;
  summary: string;
  status: string;
  important: boolean;
  units?: number | null;
  year?: number | null;
  supplyType?: string;
  coverage?: string;
  supplyStatus?: "confirmed" | "expected" | "estimated";
  price?: number | null;
  area?: number | null;
  rate?: number | null;
  metric?: string;
  endDate?: string;
  stage?: string;
  developer?: string;
  ratio?: number | null;
  moveYear?: number | null;
  moveMonth?: string;
  lat?: number | null;
  lng?: number | null;
  schedule?: { date: string; label: string }[];
  history?: { date: string; text: string }[];
};
export const sources = [
  {
    name: "한국부동산원 R-ONE",
    type: "가격지수·거래량",
    url: "https://www.reb.or.kr/r-one/portal/main/indexPage.do",
  },
  {
    name: "국토교통부 실거래가",
    type: "매매·전월세 실거래",
    url: "https://rt.molit.go.kr/",
  },
  {
    name: "청약홈",
    type: "분양·모집공고·경쟁률",
    url: "https://www.applyhome.co.kr/",
  },
  {
    name: "부산 정비사업 통합",
    type: "재개발·재건축·고시",
    url: "https://dynamice.busan.go.kr/",
  },
  {
    name: "울산 건설·주택·토지",
    type: "도시개발·주택",
    url: "https://www.ulsan.go.kr/u/metro/main.ulsan",
  },
  {
    name: "울산 남구 정비사업",
    type: "정비구역 현황",
    url: "https://www.ulsannamgu.go.kr/apt/redZone/redZoneStatus.jsp",
  },
  {
    name: "대구광역시",
    type: "고시·공고·주택",
    url: "https://www.daegu.go.kr/",
  },
  {
    name: "경상남도",
    type: "주택·도시개발 공고",
    url: "https://www.gyeongnam.go.kr/",
  },
  {
    name: "경상북도",
    type: "주택·도시개발 공고",
    url: "https://www.gb.go.kr/",
  },
  {
    name: "인천광역시",
    type: "도시·주택·토지·고시공고",
    url: "https://www.incheon.go.kr/",
  },
  {
    name: "인천광역시 고시공고",
    type: "정비계획·사업인가·도시계획 공식 고시",
    url: "http://announce.incheon.go.kr/citynet/jsp/sap/SAPGosiBizProcess.do?command=searchList&flag=gosiGL&svp=Y&sido=ic",
  },
  {
    name: "인천 주택포털",
    type: "주택정책·공급 공지",
    url: "https://www.incheon.go.kr/housing/",
  },
  {
    name: "인천경제자유구역청",
    type: "송도·영종·청라 개발계획·고시",
    url: "https://www.ifez.go.kr/",
  },
  {
    name: "iH 인천도시공사",
    type: "도시개발·공공주택·분양",
    url: "https://www.ih.co.kr/",
  },
  {
    name: "LH 청약플러스",
    type: "공공주택 공급계획",
    url: "https://apply.lh.or.kr/",
  },
  {
    name: "청약홈 공공데이터",
    type: "분양정보 연동 신청",
    url: "https://www.data.go.kr/data/15098547/openapi.do",
  },
];
const lh =
  "https://apply.lh.or.kr/lhapply/apply/noti/sp/list.do?PREVIEW=&mi=1042&sAisTpCd=10&sUppAisTpCd=06";
export const seed: Estate[] = [
  ...verifiedData,
  {
    id: "ulsan-b04",
    kind: "재개발",
    name: "울산 남구 B-04 재개발",
    region: "울산광역시",
    district: "남구",
    date: "2026-02-26",
    dateType: "official",
    verifiedAt: "2026-09-09",
    source: "울산광역시 고시 제2026-33호",
    url: "https://ulsan.go.kr/u/rep/transfer/notice/45614.ulsan?gosiGbn=N&mId=001004002000000000",
    summary:
      "울산광역시 공식 고시목록에서 2026년 2월 26일 게시된 정비구역 지정 및 정비계획 결정 변경 고시입니다. 자료 확인일과 고시일을 분리했으며, 이후 사업시행인가 등 최종 단계는 후속 공식자료로 확인해야 합니다.",
    status: "공식 고시",
    important: true,
    stage: "정비계획 변경 고시",
    history: [
      {
        date: "2023-09-07",
        text: "정비구역 지정 및 정비계획 결정·지형도면 고시",
      },
      { date: "2023-12-14", text: "정정 고시" },
      { date: "2024-09-12", text: "정비계획 경미한 변경 고시" },
      {
        date: "2026-02-26",
        text: "울산광역시 고시 제2026-33호 정비계획 변경 고시",
      },
    ],
  },
  {
    id: "changwon-daeya",
    kind: "재개발",
    name: "창원 대야구역 재개발",
    region: "경상남도",
    district: "창원시",
    date: "2026-06-15",
    source: "창원시 고시 제2026-163호 · 토지이음",
    url: "https://eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=636010",
    summary:
      "대야구역 정비계획과 구역의 경미한 변경이 고시되었습니다. 변경 세부 내용은 고시문에서 확인하세요. 이 고시만으로 현재 최종 사업단계를 판단할 수 없습니다.",
    status: "공식 고시",
    important: true,
    stage: "정비계획 경미한 변경",
    history: [
      { date: "2008-07-03", text: "최초 정비구역 지정 고시" },
      { date: "2026-06-15", text: "정비계획·정비구역 경미한 변경 고시" },
    ],
  },
  {
    id: "changwon-gyeonghwa",
    kind: "재개발",
    name: "창원 경화구역 재개발",
    region: "경상남도",
    district: "창원시",
    date: "2026-03-13",
    source: "창원시 고시 제2026-59호 · 토지이음",
    url: "https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=631707",
    summary:
      "경화구역 정비계획과 정비구역의 경미한 변경 고시가 등록되었습니다. 담당 기관은 창원시 도시재생과입니다.",
    status: "공식 고시",
    important: false,
    stage: "정비계획 경미한 변경",
  },
  {
    id: "gumi-geoui2",
    kind: "개발사업",
    name: "구미 거의2지구 도시개발구역 지정 해제",
    region: "경상북도",
    district: "구미시",
    date: "2026-04-13",
    source: "경상북도 고시 제2026-143호 · 토지이음",
    url: "https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=634634",
    summary:
      "2014년에 지정된 거의2지구 도시개발구역에 대해 지정 해제가 고시되었습니다. 개발 기대를 검토할 때 기존 계획의 유효 여부를 반드시 확인해야 하는 사례입니다.",
    status: "구역 지정 해제",
    important: true,
    stage: "지정 해제",
    history: [
      { date: "2014-10-27", text: "도시개발구역 지정 및 개발계획 수립" },
      { date: "2026-04-13", text: "도시개발구역 지정 해제 고시" },
    ],
  },
  {
    id: "busan-sajik15",
    kind: "재건축",
    name: "부산 사직1-5지구 재건축",
    region: "부산광역시",
    district: "동래구",
    date: "2026-04-22",
    source: "동래구 고시 제2026-28호 · 토지이음",
    url: "https://eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=634955",
    summary:
      "사직1-5지구 재건축사업의 관리처분계획인가 고시가 등록되었습니다. 개별 권리와 이후 이주·착공 일정은 별도 자료로 확인하세요.",
    status: "공식 고시",
    important: false,
    stage: "관리처분계획인가",
    history: [{ date: "2026-04-22", text: "관리처분계획인가 고시" }],
  },
  {
    id: "busan-geoje4",
    kind: "재건축",
    name: "부산 거제4 재건축",
    region: "부산광역시",
    district: "연제구",
    date: "2026-04-01",
    source: "부산시 고시 제2026-115호 · 토지이음",
    url: "https://eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=631962",
    summary:
      "연제구 거제동 840번지 일원의 정비계획 결정과 정비구역 지정이 고시되었습니다. 단지 규모와 공급 일정은 관계도서에서 확인하세요.",
    status: "공식 고시",
    important: false,
    stage: "정비구역 지정",
    history: [{ date: "2026-04-01", text: "정비계획 결정 및 정비구역 지정" }],
  },
  {
    id: "busan-anrak1",
    kind: "재건축",
    name: "부산 안락1 재건축",
    region: "부산광역시",
    district: "동래구",
    date: "2026-07-22",
    source: "동래구 고시 제2026-70호 · 토지이음",
    url: "https://eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=640554",
    summary:
      "안락동 1230번지 일원 재건축사업의 관리처분계획 변경인가가 고시되었습니다. 사업비와 조합원별 부담의 변경 여부는 원문과 조합 자료로 확인하세요.",
    status: "공식 고시",
    important: true,
    stage: "관리처분계획 변경인가",
    history: [{ date: "2026-07-22", text: "관리처분계획 변경인가 고시" }],
  },
  {
    id: "busan-namcheon2",
    kind: "재건축",
    name: "남천2 제3지구 삼익비치 재건축",
    region: "부산광역시",
    district: "수영구",
    date: "2026-05-20",
    source: "부산시 고시 제2026-181호 · 토지이음",
    url: "https://eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=634477",
    summary:
      "삼익비치 재건축사업 정비계획과 정비구역의 변경 지정이 고시되었습니다. 정비계획 변경 사실과 최종 사업단계는 구분해서 확인하세요.",
    status: "공식 고시",
    important: false,
    stage: "정비계획 변경 고시",
    history: [
      { date: "2014-05-21", text: "정비구역 지정" },
      { date: "2026-05-20", text: "정비계획 및 정비구역 변경 지정" },
    ],
  },
  {
    id: "daegu-ansim-road",
    kind: "개발사업",
    name: "괴전동 안심창조밸리 진입도로",
    region: "대구광역시",
    district: "동구",
    date: "2026-09-07",
    source: "대구광역시 도시건설본부",
    url: "https://www.daegu.go.kr/build/index.do?menu_id=00932865",
    summary:
      "2026년 9월 계속사업 현황에 포함된 진입도로 사업입니다. 도로 폭 20m, 총 길이 758m이며 게시자료상 사업기간은 2018년 1월~2027년 12월, 보상 100%입니다. 표시일은 자료 확인일입니다.",
    status: "계속사업 · 보상 100%",
    important: true,
    stage: "계속사업",
  },
  {
    id: "lh-taehwa",
    kind: "분양",
    name: "울산태화강변 A1 행복주택",
    region: "울산광역시",
    district: "울주군",
    date: "2026-09-07",
    source: "LH 공급계획",
    url: lh,
    summary:
      "공공임대 공급계획입니다. 확인된 4개 주택형은 29.18㎡ 176호, 29.48㎡ 12호, 36.3㎡ 48호, 44.63㎡ 30호입니다. 일반분양과 구분하며, 현재 접수 여부와 전체 단지 규모는 모집공고에서 재확인하세요.",
    status: "예정·원문 확인",
    important: true,
    units: 266,
    moveYear: 2027,
    coverage: "확인된 4개 주택형 합계 · 전체 공급 아님",
    history: [
      {
        date: "2026-05",
        text: "공급계획상 공급 예정월 (실제 진행 여부 미확인)",
      },
      { date: "2027-04", text: "공급계획상 입주 예정월" },
    ],
  },
  {
    id: "lh-taehwa-supply",
    kind: "공급량",
    name: "울산태화강변 A1 확인 물량",
    region: "울산광역시",
    district: "울주군",
    date: "2026-09-07",
    source: "LH 공급계획",
    url: lh,
    summary:
      "LH에 게시된 4개 주택형의 부분 합계입니다. 울산 전체 입주물량이 아닙니다.",
    status: "예정",
    important: false,
    units: 266,
    year: 2027,
    supplyType: "입주",
    coverage: "부분집계",
    supplyStatus: "expected",
  },
  {
    id: "busan-march",
    kind: "중요소식",
    name: "부산 정비사업 추진현황 공개",
    region: "부산광역시",
    district: "전체",
    date: "2026-04-10",
    source: "부산광역시",
    url: "https://dynamice.busan.go.kr/view.do?no=285&ntt_id=19475&pgMode=view",
    summary:
      "2026년 3월 말 기준 정비사업 추진현황 자료가 공개되어 있습니다. 개별 사업의 현재 단계는 이후 고시와 함께 확인하세요.",
    status: "공식자료",
    important: true,
    history: [
      { date: "2026-03-31", text: "추진현황 자료 기준일" },
      { date: "2026-04-10", text: "자료 게시일" },
    ],
  },
  {
    id: "ulsan-regeneration",
    kind: "중요소식",
    name: "울산 도시재생 참여자 모집 안내",
    region: "울산광역시",
    district: "전체",
    date: "2026-08-13",
    source: "울산광역시",
    url: "https://www.ulsan.go.kr/u/metro/main.ulsan",
    summary:
      "울산시 건설·주택·토지 페이지에 도시재생 참여자 모집 안내가 게시되어 있습니다. 접수기간과 세부 조건은 원문을 확인하세요.",
    status: "공식게시",
    important: false,
  },
];
export const glossary = [
  [
    "권리가액",
    "조합원이 가진 기존 부동산의 권리를 사업에서 평가한 금액입니다. 평가와 산정 근거를 확인하세요.",
  ],
  [
    "비례율",
    "정비사업의 예상 수입·비용과 종전자산 평가액을 토대로 산정하는 비율입니다. 사업비 변경에 따라 달라질 수 있습니다.",
  ],
  [
    "추가분담금",
    "새 주택을 배정받는 과정에서 조합원이 추가로 부담하는 금액입니다. 추정치와 확정 금액을 구분하세요.",
  ],
  [
    "분양·입주·인허가",
    "분양은 공급 모집, 입주는 실제 사용 시작, 인허가는 건설 계획의 행정적 승인 단계입니다. 연도별 물량을 합쳐 집계하지 않습니다.",
  ],
  [
    "가격지수 변동률",
    "지역 주택가격의 변화를 보여주는 지수의 증감률입니다. 개별 단지의 거래가격 상승률과는 다릅니다.",
  ],
  [
    "미분양·준공 후 미분양",
    "미분양은 아직 분양되지 않은 주택, 준공 후 미분양은 건물이 완성된 후에도 남은 주택입니다.",
  ],
  [
    "사업단계 확인",
    "정비구역 지정 → 조합설립 → 사업시행인가 → 관리처분인가 → 이주·철거 → 착공 → 준공 순으로 진행을 살펴봅니다. 사업 유형에 따라 절차가 다릅니다.",
  ],
];
export function fmt(v: number | null | undefined, suffix = "") {
  return v == null ? "미수집" : v.toLocaleString("ko-KR") + suffix;
}
export function supplyFor(
  items: Estate[],
  region: string,
  district: string,
  year: number,
  type: string,
) {
  const classify = (selected: Estate[]) => {
    if (
      selected.some(
        (x) => x.supplyStatus === "estimated" || /추정/.test(x.status),
      )
    )
      return "estimated" as const;
    if (year < new Date().getFullYear()) return "confirmed" as const;
    if (
      selected.some(
        (x) => x.supplyStatus === "expected" || /예상|예정/.test(x.status),
      )
    )
      return "expected" as const;
    return "confirmed" as const;
  };
  const rawRows = items
    .filter(
      (x) =>
        x.kind === "공급량" &&
        x.region === region &&
        withinDistrict(x.district, district) &&
        x.year === year &&
        x.supplyType === type &&
        x.units != null,
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  // The same complex can be announced again for cancellations or residual units.
  // For one district/year, keep the largest confirmed complex count instead of
  // adding a smaller re-announcement to it.
  const normalizeSupplyName = (name: string) =>
    name
      .replace(/\s*(입주예정 공급|확인 물량|모집공고 공급)$/, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  const byComplex = new Map<string, Estate>();
  for (const row of rawRows) {
    const key = `${row.district}|${normalizeSupplyName(row.name)}`;
    const previous = byComplex.get(key);
    if (!previous || (row.units ?? 0) > (previous.units ?? 0))
      byComplex.set(key, row);
  }
  const rows = [...byComplex.values()].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const total = rows.find(
    (x) => x.coverage === "전체집계" && x.district === district,
  );
  if (total)
    return {
      value: total.units ?? null,
      partial: false,
      rows: [total],
      supplyStatus: classify([total]),
    };
  // A district total replaces partial records inside that district. Never add it twice.
  const used: Estate[] = [];
  for (const d of [...new Set(rows.map((x) => x.district))]) {
    const group = rows.filter((x) => x.district === d);
    const whole = group.find((x) => x.coverage === "전체집계");
    used.push(...(whole ? [whole] : group));
  }
  // A province-level partial aggregate may overlap district records: show it alone.
  const regional = used.filter((x) => x.district === "전체");
  const chosen = district === "전체" && regional.length ? [regional[0]] : used;
  return {
    value: chosen.length
      ? chosen.reduce((a, x) => a + (x.units ?? 0), 0)
      : null,
    partial: true,
    rows: chosen,
    supplyStatus: chosen.length ? classify(chosen) : null,
  };
}
