export function getDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLng = deg2rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export const RISK_LEVELS = {
  VERY_HIGH: { label: "매우 높음", color: "red", threshold: 80 },
  HIGH: { label: "높음", color: "orange", threshold: 60 },
  MEDIUM: { label: "보통", color: "yellow", threshold: 40 },
  LOW: { label: "낮음", color: "green", threshold: 0 },
} as const;

export function getRiskLevel(score: number) {
  if (score >= 80) return RISK_LEVELS.VERY_HIGH;
  if (score >= 60) return RISK_LEVELS.HIGH;
  if (score >= 40) return RISK_LEVELS.MEDIUM;
  return RISK_LEVELS.LOW;
}
