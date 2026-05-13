// 빌드시 사전계산된 격자 집계 데이터 로더.
// 출처: scripts/precompute-paradox.js → public/data/grid-aggregates.json

export interface GridAggregate {
  gid: string;
  dong: string;
  lat: number;
  lng: number;
  foot: number;
  footPctile: number;
  closures: number;
  closurePctile: number;
  isParadox: boolean;
}

export interface IntroSplit {
  name: string;
  top: number;
  bottom: number;
  topThresh?: number;
  bottomThresh?: number;
  topClosures: number;
  bottomClosures: number;
  ratio?: number | null;
  gapPct: number;
}

export interface ParadoxDef {
  type: "absolute" | "percentile";
  footMin?: number;
  closuresMin?: number;
}

export interface GridData {
  computedAt: string;
  analysisWindow?: { start: string; end: string };
  totalStoresAll?: number;
  totalStores: number;
  totalGrids: number;
  unassignedStores: number;
  paradoxDef?: ParadoxDef;
  paradoxGridCount: number;
  introSplit: IntroSplit;
  grids: GridAggregate[];
}

let cache: GridData | null = null;
let inflight: Promise<GridData> | null = null;

export async function loadGridAggregates(): Promise<GridData> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/data/grid-aggregates.json")
    .then((res) => {
      if (!res.ok) throw new Error("grid-aggregates.json 로드 실패");
      return res.json();
    })
    .then((data: GridData) => {
      cache = data;
      inflight = null;
      console.log(
        `📐 격자 집계 로드: ${data.totalGrids.toLocaleString()}개 · 함정 자리 ${data.paradoxGridCount}곳`,
      );
      return data;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

// 인트로 Phase 2 전용 — 매장→격자 반경 250m로 재집계된 격자(빨강 시각화 확장용).
// foot/isParadox는 원본과 동일, closures만 250m 재계산. 대시보드/SEC/검증은 사용 안 함.
let introCache: GridData | null = null;
let introInflight: Promise<GridData> | null = null;

export async function loadGridAggregatesIntro(): Promise<GridData> {
  if (introCache) return introCache;
  if (introInflight) return introInflight;
  introInflight = fetch("/data/grid-aggregates-intro.json")
    .then((res) => {
      if (!res.ok) throw new Error("grid-aggregates-intro.json 로드 실패");
      return res.json();
    })
    .then((data: GridData) => {
      introCache = data;
      introInflight = null;
      console.log(
        `🎬 인트로 격자 집계 로드(250m): ${data.totalGrids.toLocaleString()}개 · 함정 자리 ${data.paradoxGridCount}곳`,
      );
      return data;
    })
    .catch((err) => {
      introInflight = null;
      throw err;
    });
  return introInflight;
}
