// 강남구 월별 폐업 카운트 캐시 로더.
// TimelineCard + AI 진단 두 곳에서 fetch 중복 방지.

export interface MonthRow {
  month: string; // YYYY-MM
  count: number;
}

export interface MonthlyData {
  computedAt: string;
  totalStores: number;
  monthCount: number;
  months: MonthRow[];
}

let cache: MonthlyData | null = null;
let inflight: Promise<MonthlyData> | null = null;

export async function loadMonthly(): Promise<MonthlyData> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/data/monthly-closures.json")
    .then((r) => {
      if (!r.ok) throw new Error("monthly-closures.json 로드 실패");
      return r.json();
    })
    .then((d: MonthlyData) => {
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

export type ClosurePeriod =
  | "pre-covid"
  | "covid"
  | "post-covid"
  | "recent"
  | "unknown";

// 폐업 시점 → 시기 분류 (현재 기준일 2026-05).
export function classifyClosurePeriod(
  closeDate: string | undefined,
): ClosurePeriod {
  if (!closeDate) return "unknown";
  const month = closeDate.slice(0, 7);
  if (month < "2020-02") return "pre-covid";
  if (month >= "2020-03" && month <= "2022-04") return "covid";
  if (month >= "2022-05" && month < "2025-05") return "post-covid";
  return "recent";
}

// 그 시점 ±3개월 강남구 평균 폐업 수.
export function nearbyMonthAvg(
  months: MonthRow[],
  targetMonth: string,
): number | null {
  const idx = months.findIndex((m) => m.month === targetMonth);
  if (idx < 0) return null;
  const start = Math.max(0, idx - 3);
  const end = Math.min(months.length - 1, idx + 3);
  const slice = months.slice(start, end + 1);
  const sum = slice.reduce((s, m) => s + m.count, 0);
  return Math.round(sum / slice.length);
}
