// 동별 SEC top3/bottom3 사전계산 데이터 로더.
// 출처: scripts/precompute-paradox.js → public/data/dong-sec.json
// 런타임 5-10초 SEC 계산을 빌드 타임으로 옮겨 진입 로딩 화면 단축 (5-10초 → 0.3초).

import type { SECScore } from "@/lib/analysis";

export interface DongSEC {
  totalCount: number;
  top3: SECScore[];
  bottom3: SECScore[];
}

export type DongSECMap = Record<string, DongSEC>;

let cache: DongSECMap | null = null;
let inflight: Promise<DongSECMap> | null = null;

export async function loadDongSEC(): Promise<DongSECMap> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/data/dong-sec.json")
    .then((r) => {
      if (!r.ok) throw new Error("dong-sec.json 로드 실패");
      return r.json();
    })
    .then((d: DongSECMap) => {
      cache = d;
      inflight = null;
      return d;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}
