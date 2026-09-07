# 영남 부동산 아틀라스

Private owner-facing real estate research workspace covering Ulsan, Busan, Daegu, Gyeongnam and Gyeongbuk.

## Implemented

- Clickable province map and current named municipality selectors, searchable regional records and detail/history sheets.
- Up to five combined region/unit comparison slots, supply-year comparison, price-per-area calculation, same-metric/same-date rankings.
- Annual supply by sale, occupancy and permit; unavailable values remain null; published regional totals supersede partial records. District aggregates are not double-counted with their constituent records. Province partial aggregates are not summed with potentially overlapping district records. Importers must keep record IDs stable for revisions.
- Persistent D1 records and user-scoped favorites/alert preferences, validated JSON import/export and form editing.
- Date-based calendar, ICS download, loan/cash planning, area-matched recorded transaction comparisons, glossary/checklist.
- Evidence search and optional server-only OpenAI model answers with record citations.

## Integration status and limits

This is an initial working application, not a complete live market feed. Seed records are a small official-source collection checked on 2026-09-07. No sample market rates or fabricated volume series are supplied. The LH 266-unit series is a partial sum of four published unit types, not Ulsan-wide supply. News dates describe a posting/as-of date; records whose date is collection time say so in their summary.

- Live market indices, transactions and region-wide annual supply require licensed/official datasets. Currently supplied through validated manual records and JSON import. PUBLIC_DATA_KEY enables the manual, bounded /api/sync APT notice adapter. A key alone does not start collection. Live ingestion is untested without credentials. Automatic scheduled collection and market-index adapters are not implemented.
- AI_API_KEY enables server-only OpenAI Chat Completions; AI_MODEL defaults to gpt-4.1-mini. Without a key, the endpoint explicitly returns evidence search, not generated AI. No key was configured or live model call tested.
- Alert preference storage and in-site watchlist filtering work. RESEND_API_KEY and EMAIL_FROM enable a manual, authenticated own-account digest endpoint. No credentials were supplied and sending is untested/inactive. Background scheduling is not implemented or active. Email input stores a preference; sending requires a separate explicit button action and a configured service.
- The map uses KOSTAT 2013 province geometry from https://github.com/southkorea/southkorea-maps/tree/master/kostat/2013 . It is labeled as a historical schematic; Gunwi is assigned to Daegu in the current text selectors. It does not establish cadastral/project boundaries. A current geometry dataset is needed for precise administrative maps.
- Site access is owner-only. API routes require the platform-authenticated email; writes check Origin. If audience is ever expanded, add a separate owner/admin authorization rule before allowing shared users to edit source records.
- Checklist and comparison selections are transient UI state. Authoritative records/favorites use D1.

## Validation

Production Worker build, TypeScript check with generated Cloudflare runtime types, and direct supply arithmetic assertions. No browser QA was requested. D1 schema is managed by Drizzle migrations. No credentials are stored in source.

## GitHub 저장소 / 실행

사용자 생성 저장소: [Gyeongsang-Real-Estate-Search](https://github.com/Jijunkyoung/Gyeongsang-Real-Estate-Search)
기존 저장소 설명: 경상도 부동산조회-1

- [서비스 열기](https://yeongnam-property-atlas.jjk08255.chatgpt.site) (소유자 로그인 필요)
- `index.html`: 위 서비스 접속용 시작 페이지. 이 파일만 열어서는 서버 API·데이터베이스가 실행되지 않습니다.
- `app/page.tsx`: 실제 React 홈페이지. `app/api/`: 저장·수집·검색·발송 서버 코드.
- `lib/verified-data.json`: 출처별 확인 통계. 보도 확인과 기관 원표 대조를 구분합니다.
- `gpt.md`: 개발일지. 이전 `gpt.me`의 이력과 utility_final_2 참고 관계를 보존했습니다.
- [자료 연결 절차](docs/DATA_SETUP.md): 사용자가 신청할 API와 미구현 연동 범위.

Node.js 22.13 이상과 npm을 사용합니다.

```bash
npm ci
cp .env.example .env
npm run dev
```

현재 앱은 Sites의 Cloudflare Worker + D1 환경과 인증 헤더를 사용합니다. 로컬에서 화면은 확인할 수 있지만 인증이 필요한 API는 별도 로컬 인증·D1 구성이 필요합니다. 공개 GitHub Pages는 정적 파일만 제공하므로 서버 API를 실행하지 못합니다. 다른 호스팅으로 옮길 때는 Cloudflare D1 바인딩, 마이그레이션, 인증·관리자 권한을 구성해야 합니다. 사용자 인증 헤더를 임의로 신뢰하는 공개 서버로 배포하지 마세요.

빌드: `npm run build` / 타입 확인: `npx tsc --noEmit`.
소스 수정 시 실제 변경 내용·검증 결과·남은 연동 작업을 `gpt.md`에 추가하고 GitHub main에 커밋합니다. GitHub 저장과 서비스 게시의 성공 여부는 각각 확인합니다.

### 이번 자료 보완

22개 통계 확인본을 추가했습니다. 주간 지수, 울산 미분양·거래, 5개 시도의 준공 후 미분양, 울산 기간 누계 공급을 포함합니다. 전체 연도·시군구의 완전한 통계는 아닙니다. 최신자료는 출처에 표시된 기준일까지만 유효하며 자동 갱신은 작동하지 않습니다.

지역 탐색에서는 핵심 시장지표와 출처를 상세 화면 없이 바로 확인할 수 있습니다. 공급 화면은 광역시의 구·군과 창원·포항의 하위 구를 선택하고, 연도별 비교표와 집계 근거 단지를 확인할 수 있습니다. 등록값이 없는 칸은 `미수집`으로 표시하며 현재 조건의 웹검색 링크를 제공합니다. 이 프로젝트는 개인용이며 `utility_final_2`의 회사 폐쇄망 제약을 적용하지 않습니다.
