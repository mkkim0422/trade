// 매장 → 가장 가까운 격자 매핑 → 4사분면 분류.
// closurePctile은 격자 94.6%가 0이라 percentile 비교가 무의미 → 절대값 임계값 사용.

import type { GridAggregate } from "./grid-aggregates";
import { getDistance } from "./constants";

export type Quadrant =
  | "paradox" // 사람 많음 + 폐업 많음 (함정)
  | "danger" // 사람 적음 + 폐업 많음 (확실히 망함)
  | "golden" // 사람 많음 + 폐업 적음 (좋은 자리)
  | "quiet" // 사람 적음 + 폐업 적음 (조용함)
  | "neutral" // 어느 사분면에도 명확히 안 들어감
  | "unknown"; // 격자 매핑 실패

export interface QuadrantInfo {
  quadrant: Quadrant;
  label: string;
  color: string; // 텍스트 색
  bg: string; // 배경 색
  border: string; // 테두리 색
  emoji: string;
  grid: GridAggregate | null;
  distanceM: number; // 매장-격자 중심 거리 (m)
}

const QUADRANT_DEFS: Record<Quadrant, Omit<QuadrantInfo, "grid" | "distanceM">> = {
  paradox: {
    quadrant: "paradox",
    label: "함정 자리",
    color: "#A855F7",
    bg: "#FAF5FF",
    border: "#A855F7",
    emoji: "🟣",
  },
  danger: {
    quadrant: "danger",
    label: "위험 구간",
    color: "#DC2626",
    bg: "#FEF2F2",
    border: "#EF4444",
    emoji: "⚠️",
  },
  golden: {
    quadrant: "golden",
    label: "황금 구간",
    color: "#B45309",
    bg: "#FFFBEB",
    border: "#F59E0B",
    emoji: "🏆",
  },
  quiet: {
    quadrant: "quiet",
    label: "고요 구간",
    color: "#475569",
    bg: "#F8FAFC",
    border: "#94A3B8",
    emoji: "🌙",
  },
  neutral: {
    quadrant: "neutral",
    label: "보통 구간",
    color: "#475569",
    bg: "#F1F5F9",
    border: "#CBD5E1",
    emoji: "•",
  },
  unknown: {
    quadrant: "unknown",
    label: "데이터 부족",
    color: "#94A3B8",
    bg: "#F8FAFC",
    border: "#E2E8F0",
    emoji: "—",
  },
};

// 매장이 어느 격자에 속하는지 + 4사분면 분류.
// maxMeters: 매장-격자 중심 허용 거리. 공원/광장/도로처럼 SKT 격자 누락 영역 클릭
// 시에도 인접 격자로 매핑되도록 300m. 실 매장과 가상 매장이 같은 자리에서
// 동일 결과 내도록 여유 확보.
// nearbyClosedCount(반경 250m 실측):
//   - 전달되면 closures 축은 이 값을 사용 → 시각적 마커 수와 분류가 일치.
//   - 매핑 실패 폴백도 가능 — 카운트만으로 danger/quiet/neutral 추정.
//   - 미전달이면 grid.closures(50m 단일 셀)로 폴백 → ScatterCard 등 격자 시각화용.
export function classifyStore(
  store: { lat: number; lng: number },
  allGrids: GridAggregate[],
  maxMeters = 300,
  nearbyClosedCount?: number,
): QuadrantInfo {
  // 박스 컷으로 후보 축소.
  const latDelta = (maxMeters / 111000) * 1.5;
  const lngDelta =
    (maxMeters / (111000 * Math.cos((store.lat * Math.PI) / 180))) * 1.5;
  let bestGrid: GridAggregate | null = null;
  let bestDist = Infinity;
  for (const g of allGrids) {
    if (Math.abs(g.lat - store.lat) > latDelta) continue;
    if (Math.abs(g.lng - store.lng) > lngDelta) continue;
    const d = getDistance(store.lat, store.lng, g.lat, g.lng);
    if (d < bestDist) {
      bestDist = d;
      bestGrid = g;
    }
  }

  // 격자 매핑 실패 — 250m 카운트만으로 추정 분류 (foot 불명이라
  // paradox/golden은 단정 못 함, danger/quiet/neutral만 가능).
  if (!bestGrid || bestDist > maxMeters) {
    if (nearbyClosedCount !== undefined) {
      let q: Quadrant;
      if (nearbyClosedCount >= 80) q = "danger";
      else if (nearbyClosedCount <= 30) q = "quiet";
      else q = "neutral";
      return { ...QUADRANT_DEFS[q], grid: null, distanceM: bestDist };
    }
    return { ...QUADRANT_DEFS.unknown, grid: null, distanceM: bestDist };
  }

  const f = bestGrid.foot;

  let quadrant: Quadrant;
  if (nearbyClosedCount !== undefined) {
    // 250m 반경 단일선 임계 — 산점도와 시각 일치 (X=80, Y=50).
    // 4사분면이 평면을 완전히 덮어 neutral 모호 영역 없음.
    const c = nearbyClosedCount;
    if (f >= 50 && c >= 80) quadrant = "paradox";
    else if (f < 50 && c >= 80) quadrant = "danger";
    else if (f >= 50 && c < 80) quadrant = "golden";
    else quadrant = "quiet"; // f < 50 && c < 80
  } else {
    // 격자(50m) 임계값. closures 분포: median 0, 격자 95%가 0~1, 상위 5% = 3+
    const c = bestGrid.closures;
    if (f >= 50 && c >= 3) quadrant = "paradox";
    else if (f < 30 && c >= 3) quadrant = "danger";
    else if (f >= 50 && c <= 1) quadrant = "golden";
    else if (f < 30 && c <= 1) quadrant = "quiet";
    else quadrant = "neutral";
  }

  return { ...QUADRANT_DEFS[quadrant], grid: bestGrid, distanceM: bestDist };
}
