// 옵션 A 검증 데이터 로더 — "함정 자리 = 전염성" 가설.
// 사전 계산: scripts/precompute-paradox.js → public/data/verification.json

export interface IntervalStat {
  count: number;
  measured: number;
  meanMonths: number;
  medianMonths: number;
  clusterRate: number;
}

export interface CaseStore {
  id: string;
  name: string;
  business: string;
  openDate: string;
  closeDate: string;
  durationYears: number;
  gapFromPrevMonths: number | null;
}

export interface CaseStudy {
  gid: string;
  dong: string;
  location: string;
  centerLat: number;
  centerLng: number;
  radiusM: number;
  spanMonths: number;
  storeCount: number;
  stores: CaseStore[];
}

export interface VerificationData {
  computedAt: string;
  hypothesis: string;
  intervalStats: {
    paradox: IntervalStat;
    golden: IntervalStat;
    risk: IntervalStat;
    calm: IntervalStat;
  };
  caseStudies: CaseStudy[];
}

let cache: VerificationData | null = null;
let inflight: Promise<VerificationData> | null = null;

export async function loadVerification(): Promise<VerificationData> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/data/verification.json")
    .then((r) => {
      if (!r.ok) throw new Error("verification.json 로드 실패");
      return r.json();
    })
    .then((d: VerificationData) => {
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
