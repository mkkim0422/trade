export interface FootTrafficData {
  gid: string;
  dong: string;
  weekdayAvg: number;
  weekendAvg: number;
  dailyAvg: number;
  lat: number;
  lng: number;
}

let foottrafficCache: FootTrafficData[] | null = null;
let inflight: Promise<FootTrafficData[]> | null = null;

export async function loadFootTraffic(): Promise<FootTrafficData[]> {
  if (foottrafficCache) return foottrafficCache;
  if (inflight) return inflight;

  inflight = fetch("/data/foottraffic.json")
    .then((res) => {
      if (!res.ok) throw new Error("foottraffic.json 로드 실패");
      return res.json();
    })
    .then((data: FootTrafficData[]) => {
      foottrafficCache = data;
      inflight = null;
      console.log(`✅ 유동인구 데이터 로드: ${data.length}개 격자`);
      return data;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });

  return inflight;
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export interface FootTrafficStats {
  dailyAvg: number;
  weekdayAvg: number;
  weekendAvg: number;
  gridCount: number;
}

export function getFootTrafficNearby(
  lat: number,
  lng: number,
  radius: number,
  data: FootTrafficData[],
): FootTrafficStats {
  const nearby = data.filter(
    (g) => haversineMeters(lat, lng, g.lat, g.lng) <= radius,
  );

  if (nearby.length === 0) {
    return { dailyAvg: 0, weekdayAvg: 0, weekendAvg: 0, gridCount: 0 };
  }

  let dailySum = 0;
  let weekdaySum = 0;
  let weekendSum = 0;
  nearby.forEach((g) => {
    dailySum += g.dailyAvg;
    weekdaySum += g.weekdayAvg;
    weekendSum += g.weekendAvg;
  });

  return {
    dailyAvg: dailySum / nearby.length,
    weekdayAvg: weekdaySum / nearby.length,
    weekendAvg: weekendSum / nearby.length,
    gridCount: nearby.length,
  };
}
