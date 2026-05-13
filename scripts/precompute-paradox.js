// 강남구 50m 격자별 폐업/유동인구 사전계산 (분석 기간 = 최근 3년).
// 출력:
//   - public/data/grid-aggregates.json: 격자별 foot/closures + isParadox(절대값)
//   - public/data/stores-recent.json: 최근 3년 폐업 매장만 (앱이 실제로 사용)
//   - public/data/verification.json: 4사분면 폐업 간격 + 케이스 스터디
//   - public/data/monthly-closures.json: 1994~2026 전체 (시간축 차트용, 필터 X)
//
// 실행: node scripts/precompute-paradox.js

const fs = require("fs");

const FOOT_PATH = "public/data/foottraffic.json";
const STORES_PATH = "public/data/stores.json";
const OUT_PATH = "public/data/grid-aggregates.json";
const INTRO_OUT_PATH = "public/data/grid-aggregates-intro.json";
const STORES_RECENT_OUT = "public/data/stores-recent.json";
const MONTHLY_OUT_PATH = "public/data/monthly-closures.json";
const VERIFY_OUT_PATH = "public/data/verification.json";
const DONG_SEC_OUT = "public/data/dong-sec.json";

// 분석 기간 = 최근 3년 (오늘 2026-05-12 기준). monthly-closures는 32년 그대로.
const RECENT_CUTOFF = "2023-05-12";
const RECENT_END = "2026-05-12";

// 함정 자리 정의 — paradox.ts의 classifyStore와 일치(절대값). 격자 시각화·매장 분류 단일 기준.
const PARADOX_FOOT_MIN = 50;
const PARADOX_CLOSURES_MIN = 3;

// 인트로 분할: 유동 상위 30% vs 하위 30% 격자의 폐업 격차.
const SPLIT_TOP_PCT = 30;
const SPLIT_BOTTOM_PCT = 30;

const ASSIGN_RADIUS_M = 100;
// 인트로 Phase 2 전용 — SKT 격자가 강남역/선릉/삼성/학동/압구정/도곡 핵심 역세권에서
// 통째 누락이라 매장 60%가 미할당. 인트로 화면에서만 반경을 250m로 확대해 인접 격자에
// 폐업을 흡수시킴 (시각적 공백 메우기). 대시보드/검증/SEC 계산은 ASSIGN_RADIUS_M 그대로.
const INTRO_ASSIGN_RADIUS_M = 250;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// value 이하 비율 × 100 (0~100). sortedAsc는 오름차순 사전 정렬.
function percentile(sortedAsc, value) {
  let lo = 0;
  let hi = sortedAsc.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedAsc[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return (lo / sortedAsc.length) * 100;
}

function pctileThreshold(sortedAsc, p) {
  const idx = Math.floor((p / 100) * sortedAsc.length);
  return sortedAsc[Math.min(idx, sortedAsc.length - 1)];
}

console.log("📊 격자 사전계산 시작 (최근 3년 필터)...\n");

const grids = JSON.parse(fs.readFileSync(FOOT_PATH, "utf-8"));
const allStores = JSON.parse(fs.readFileSync(STORES_PATH, "utf-8"));
// 최근 3년 (2023-05-12 ~ 2026-05-12). 격자/검증/사분면은 모두 이걸 사용.
const stores = allStores.filter(
  (s) =>
    s.closeDate && s.closeDate >= RECENT_CUTOFF && s.closeDate <= RECENT_END,
);
console.log(`격자: ${grids.length.toLocaleString()}개`);
console.log(
  `매장 (전체): ${allStores.length.toLocaleString()}개 → 최근 3년 필터: ${stores.length.toLocaleString()}개`,
);
console.log(`분석 기간: ${RECENT_CUTOFF} ~ ${RECENT_END}\n`);

// 앱이 실제로 사용할 매장 파일 — 최근 3년만.
fs.writeFileSync(STORES_RECENT_OUT, JSON.stringify(stores));
const recentStat = fs.statSync(STORES_RECENT_OUT);
console.log(
  `💾 ${STORES_RECENT_OUT} (${(recentStat.size / 1024 / 1024).toFixed(2)} MB · ${stores.length}개)`,
);

console.log(`🔗 매장 → 격자 할당 (가장 가까운 격자 1개, ${ASSIGN_RADIUS_M}m 이내)...`);
const LAT_DELTA = ASSIGN_RADIUS_M / 111000;
const LNG_DELTA = ASSIGN_RADIUS_M / (111000 * Math.cos((37.5 * Math.PI) / 180));
const closureCount = new Map();
let unassigned = 0;

for (const s of stores) {
  let bestGid = null;
  let bestDist = Infinity;
  for (const g of grids) {
    if (Math.abs(g.lat - s.lat) > LAT_DELTA * 2) continue;
    if (Math.abs(g.lng - s.lng) > LNG_DELTA * 2) continue;
    const d = haversineMeters(s.lat, s.lng, g.lat, g.lng);
    if (d < bestDist) {
      bestDist = d;
      bestGid = g.gid;
    }
  }
  if (bestGid && bestDist <= ASSIGN_RADIUS_M) {
    closureCount.set(bestGid, (closureCount.get(bestGid) || 0) + 1);
  } else {
    unassigned++;
  }
}
console.log(`  할당 ${stores.length - unassigned}개 · 미할당 ${unassigned}개`);

const footValuesSorted = grids.map((g) => g.dailyAvg).sort((a, b) => a - b);
const closureValuesSorted = grids
  .map((g) => closureCount.get(g.gid) || 0)
  .sort((a, b) => a - b);

console.log("\n📈 분포:");
console.log(
  `  유동: 최소 ${footValuesSorted[0]}, 중앙 ${footValuesSorted[Math.floor(footValuesSorted.length / 2)]}, 최대 ${footValuesSorted[footValuesSorted.length - 1]}`,
);
console.log(
  `  폐업: 최소 ${closureValuesSorted[0]}, 중앙 ${closureValuesSorted[Math.floor(closureValuesSorted.length / 2)]}, 최대 ${closureValuesSorted[closureValuesSorted.length - 1]}`,
);

// 함정 자리 정의 = paradox.ts와 동일 (절대값). 격자 시각화·매장 분류 단일 기준.
const enriched = grids.map((g) => {
  const closures = closureCount.get(g.gid) || 0;
  const footPctile = percentile(footValuesSorted, g.dailyAvg);
  const closurePctile = percentile(closureValuesSorted, closures);
  const isParadox =
    g.dailyAvg >= PARADOX_FOOT_MIN && closures >= PARADOX_CLOSURES_MIN;
  return {
    gid: g.gid,
    dong: g.dong,
    lat: g.lat,
    lng: g.lng,
    foot: g.dailyAvg,
    footPctile: Math.round(footPctile * 10) / 10,
    closures,
    closurePctile: Math.round(closurePctile * 10) / 10,
    isParadox,
  };
});

const paradoxCount = enriched.filter((g) => g.isParadox).length;
console.log(
  `\n🟣 함정 자리 (foot≥${PARADOX_FOOT_MIN} AND closures≥${PARADOX_CLOSURES_MIN}): ${paradoxCount}곳`,
);
console.log("   ↳ paradox.ts classifyStore와 동일 기준 (단일 정의).");

// 참고: 절대값 임계 스윕.
console.log("\n📊 절대값 임계 스윕 (foot × closures):");
for (const f of [30, 40, 50, 60]) {
  for (const c of [2, 3, 4]) {
    const cnt = enriched.filter((g) => g.foot >= f && g.closures >= c).length;
    console.log(`  foot≥${f} AND closures≥${c}: ${cnt}곳`);
  }
}

// 인트로 분할 — 유동 상위 30% vs 하위 30% 격자의 폐업 비교.
console.log("\n🎬 인트로 분할 계산 (상위 30% vs 하위 30%):");
const topThresh = pctileThreshold(footValuesSorted, 100 - SPLIT_TOP_PCT);
const bottomThresh = pctileThreshold(footValuesSorted, SPLIT_BOTTOM_PCT);
let topClosures = 0;
let bottomClosures = 0;
for (const g of enriched) {
  if (g.foot >= topThresh) topClosures += g.closures;
  else if (g.foot <= bottomThresh) bottomClosures += g.closures;
}
const introSplit = {
  name: `top${SPLIT_TOP_PCT}_bottom${SPLIT_BOTTOM_PCT}`,
  top: SPLIT_TOP_PCT,
  bottom: SPLIT_BOTTOM_PCT,
  topThresh,
  bottomThresh,
  topClosures,
  bottomClosures,
  ratio: bottomClosures > 0 ? topClosures / bottomClosures : null,
  gapPct:
    topClosures + bottomClosures > 0
      ? (Math.abs(topClosures - bottomClosures) /
          ((topClosures + bottomClosures) / 2)) *
        100
      : 0,
};
console.log(
  `  상위 30% (foot≥${topThresh}): 폐업 ${topClosures}건 · 하위 30% (foot≤${bottomThresh}): 폐업 ${bottomClosures}건`,
);
console.log(
  `  비율 ${introSplit.ratio?.toFixed(2)}배 · 격차 ${introSplit.gapPct.toFixed(1)}%`,
);

const out = {
  computedAt: new Date().toISOString(),
  analysisWindow: { start: RECENT_CUTOFF, end: RECENT_END },
  totalStoresAll: allStores.length,
  totalStores: stores.length,
  totalGrids: grids.length,
  unassignedStores: unassigned,
  paradoxDef: {
    type: "absolute",
    footMin: PARADOX_FOOT_MIN,
    closuresMin: PARADOX_CLOSURES_MIN,
  },
  paradoxGridCount: paradoxCount,
  introSplit,
  grids: enriched,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(out));
const stat = fs.statSync(OUT_PATH);
console.log(`\n💾 저장: ${OUT_PATH} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

// ════════════════════════════════════════════════════════
// 인트로 Phase 2 전용 — 매장→격자 반경 250m 재집계.
// 목적: SKT 격자가 빠진 강남역/선릉/삼성/학동/압구정/도곡 매장을 인접 격자로 흡수.
// 영향 범위: grid-aggregates-intro.json (IntroPhase2.tsx만 읽음).
// 보존 사항:
//   - foot (격자 고유값, radius 무관)
//   - isParadox (원본 100m 기준 — 함정 자리 18곳 정의 유지, 정직성)
//   - paradoxGridCount 18 그대로
// 변경 사항: closures, closurePctile만 250m 재계산 → 빨강 격자 갯수 증가.
// ════════════════════════════════════════════════════════

console.log("\n🎬 인트로 전용 격자 집계 (반경 250m)...");
const INTRO_LAT_DELTA = INTRO_ASSIGN_RADIUS_M / 111000;
const INTRO_LNG_DELTA = INTRO_ASSIGN_RADIUS_M / (111000 * Math.cos((37.5 * Math.PI) / 180));
const introClosure = new Map();
let introUnassigned = 0;
for (const s of stores) {
  let bestGid = null;
  let bestDist = Infinity;
  for (const g of grids) {
    if (Math.abs(g.lat - s.lat) > INTRO_LAT_DELTA * 2) continue;
    if (Math.abs(g.lng - s.lng) > INTRO_LNG_DELTA * 2) continue;
    const d = haversineMeters(s.lat, s.lng, g.lat, g.lng);
    if (d < bestDist) {
      bestDist = d;
      bestGid = g.gid;
    }
  }
  if (bestGid && bestDist <= INTRO_ASSIGN_RADIUS_M) {
    introClosure.set(bestGid, (introClosure.get(bestGid) || 0) + 1);
  } else {
    introUnassigned++;
  }
}
console.log(
  `  할당 ${stores.length - introUnassigned}개 · 미할당 ${introUnassigned}개 (원본 ${stores.length - unassigned}/${unassigned})`,
);

const introClosureValuesSorted = grids
  .map((g) => introClosure.get(g.gid) || 0)
  .sort((a, b) => a - b);

// foot/footPctile/isParadox는 원본 enriched 그대로, closures/closurePctile만 교체.
const introEnriched = enriched.map((g) => {
  const closures = introClosure.get(g.gid) || 0;
  const closurePctile = percentile(introClosureValuesSorted, closures);
  return {
    ...g,
    closures,
    closurePctile: Math.round(closurePctile * 10) / 10,
  };
});

const introRedCount = introEnriched.filter((g) => g.closures >= 2).length;
const introBlueCount = introEnriched.filter((g) => g.foot >= 100).length;
const origRedCount = enriched.filter((g) => g.closures >= 2).length;
console.log(
  `  빨강 격자(closures≥2): ${introRedCount} (원본 ${origRedCount}) · 파랑(foot≥100): ${introBlueCount} (foot 불변)`,
);

const introOut = {
  computedAt: new Date().toISOString(),
  analysisWindow: { start: RECENT_CUTOFF, end: RECENT_END },
  source:
    "intro-only — 매장→격자 반경 250m. IntroPhase2.tsx 전용. paradox/SEC/검증은 grid-aggregates.json 사용.",
  totalStoresAll: allStores.length,
  totalStores: stores.length,
  totalGrids: grids.length,
  unassignedStores: introUnassigned,
  paradoxDef: out.paradoxDef,
  paradoxGridCount: paradoxCount,
  introSplit,
  grids: introEnriched,
};

fs.writeFileSync(INTRO_OUT_PATH, JSON.stringify(introOut));
const introStat = fs.statSync(INTRO_OUT_PATH);
console.log(
  `💾 저장: ${INTRO_OUT_PATH} (${(introStat.size / 1024 / 1024).toFixed(2)} MB)`,
);

// 핵심 역세권 색칠 효과 검증.
console.log("\n🔍 핫스팟 ±300m 인트로 격자 (closures≥2 빨강 / foot≥100 파랑):");
const INTRO_HOTSPOTS = [
  { name: "강남역", lat: 37.498, lng: 127.027 },
  { name: "신논현역", lat: 37.5045, lng: 127.025 },
  { name: "선릉역", lat: 37.504, lng: 127.049 },
  { name: "삼성역", lat: 37.508, lng: 127.063 },
  { name: "학동역", lat: 37.5142, lng: 127.0319 },
  { name: "압구정로데오", lat: 37.5276, lng: 127.0407 },
  { name: "도곡역", lat: 37.4906, lng: 127.0556 },
];
for (const h of INTRO_HOTSPOTS) {
  const inRad = introEnriched.filter(
    (g) => haversineMeters(h.lat, h.lng, g.lat, g.lng) <= 300,
  );
  const red = inRad.filter((g) => g.closures >= 2).length;
  const blue = inRad.filter((g) => g.foot >= 100).length;
  console.log(
    `  ${h.name.padEnd(8)} 격자 ${String(inRad.length).padStart(3)} · 빨강 ${String(red).padStart(2)} · 파랑 ${String(blue).padStart(2)}`,
  );
}

// 월별 폐업 집계 (시간축 차트용) — 32년 누적 그대로 유지 (의미 있는 시각화).
console.log("\n📅 월별 폐업 집계 (32년 전체)...");
const monthMap = new Map();
for (const s of allStores) {
  if (!s.closeDate) continue;
  const month = s.closeDate.slice(0, 7);
  monthMap.set(month, (monthMap.get(month) || 0) + 1);
}
const months = Array.from(monthMap.entries())
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([month, count]) => ({ month, count }));
const monthlyData = {
  computedAt: new Date().toISOString(),
  totalStores: allStores.length,
  monthCount: months.length,
  months,
};
fs.writeFileSync(MONTHLY_OUT_PATH, JSON.stringify(monthlyData));
console.log(
  `💾 저장: ${MONTHLY_OUT_PATH} (월 ${months.length}개, ${months[0]?.month} ~ ${months[months.length - 1]?.month})`,
);
const sortedCounts = months.map((m) => m.count).sort((a, b) => a - b);
const median = sortedCounts[Math.floor(sortedCounts.length / 2)];
console.log(
  `   월평균 폐업 ${(allStores.length / months.length).toFixed(1)}건 · 중앙값 ${median}건 · 최대 ${Math.max(...sortedCounts)}건`,
);

// ════════════════════════════════════════════════════════
// 검증 매장 자동 선정 (묶음 C용)
// SEC 로직은 src/lib/analysis.ts의 calculateSingleStoreSEC와 가중치/공식 동일.
// 두 코드 path가 같은 결과 내는지는 dev에서 console.log로 일치 검증.
// ════════════════════════════════════════════════════════

console.log("\n🔬 검증 매장 자동 선정 시작...");
const foottraffic = JSON.parse(fs.readFileSync(FOOT_PATH, "utf-8"));

// 박스 컷 + Haversine. analysis.ts 런타임은 박스 컷 없이 전체 filter지만
// 결과는 동일 (안전 마진 1.5×).
function footNearbyForSEC(lat, lng, radiusM, data) {
  const latDelta = (radiusM / 111000) * 1.5;
  const lngDelta = (radiusM / (111000 * Math.cos((lat * Math.PI) / 180))) * 1.5;
  let dailySum = 0,
    weekdaySum = 0,
    weekendSum = 0,
    cnt = 0;
  for (const g of data) {
    if (Math.abs(g.lat - lat) > latDelta) continue;
    if (Math.abs(g.lng - lng) > lngDelta) continue;
    if (haversineMeters(lat, lng, g.lat, g.lng) > radiusM) continue;
    dailySum += g.dailyAvg;
    weekdaySum += g.weekdayAvg;
    weekendSum += g.weekendAvg;
    cnt++;
  }
  if (cnt === 0)
    return { dailyAvg: 0, weekdayAvg: 0, weekendAvg: 0, gridCount: 0 };
  return {
    dailyAvg: dailySum / cnt,
    weekdayAvg: weekdaySum / cnt,
    weekendAvg: weekendSum / cnt,
    gridCount: cnt,
  };
}

// 공간 기반 vacancyScore — 좌표 ±100m 내 가장 최근 폐업 매장의 경과 개월.
// analysis.ts vacancyMonthsByLocation과 동일 로직 (런타임/precompute 일치).
function vacancyMonthsByLocation(lat, lng, allStores) {
  const today = new Date();
  let bestMsc = null;
  let bestDist = Infinity;
  for (const s of allStores) {
    if (!s.closeDate) continue;
    const d = haversineMeters(lat, lng, s.lat, s.lng);
    if (d > 100) continue;
    const msc = Math.max(
      0,
      Math.floor(
        (today.getTime() - new Date(s.closeDate).getTime()) /
          (1000 * 60 * 60 * 24 * 30),
      ),
    );
    if (bestMsc === null || msc < bestMsc || (msc === bestMsc && d < bestDist)) {
      bestMsc = msc;
      bestDist = d;
    }
  }
  return bestMsc;
}

// 매장 → 인근 매장 인덱스 (1회 캐싱). 5106 × 5106 = 26M 비교 → 박스 컷으로 ~수백K로 축소.
function nearbyStoresOf(store, allStores, radiusM) {
  const latDelta = (radiusM / 111000) * 1.5;
  const lngDelta =
    (radiusM / (111000 * Math.cos((store.lat * Math.PI) / 180))) * 1.5;
  const result = [];
  for (const s of allStores) {
    if (s.id === store.id) continue;
    if (Math.abs(s.lat - store.lat) > latDelta) continue;
    if (Math.abs(s.lng - store.lng) > lngDelta) continue;
    if (haversineMeters(store.lat, store.lng, s.lat, s.lng) > radiusM) continue;
    result.push(s);
  }
  return result;
}

// SEC 계산 — analysis.ts calculateSECScoresWithFootTraffic와 동일 로직 (가중치 25/15/12/12/8/5/3/20).
// 전체 SECScore 객체 반환 (8지표 + reasoning).
function calcSECFull(store, allStores, foottrafficData, radiusM = 250) {
  const nearbyStores = nearbyStoresOf(store, allStores, radiusM);
  const nearbyCount = nearbyStores.length;

  let ludScore = 100;
  if (nearbyCount >= 50) ludScore = 10;
  else if (nearbyCount >= 30) ludScore = 25;
  else if (nearbyCount >= 20) ludScore = 40;
  else if (nearbyCount >= 10) ludScore = 60;
  else if (nearbyCount >= 5) ludScore = 80;
  else ludScore = 95;

  const durations = [];
  for (const s of nearbyStores) {
    if (!s.openDate || !s.closeDate) continue;
    const d =
      (new Date(s.closeDate).getTime() - new Date(s.openDate).getTime()) /
      (1000 * 60 * 60 * 24 * 365);
    durations.push(d);
  }
  const avgDuration =
    durations.length > 0
      ? durations.reduce((s, d) => s + d, 0) / durations.length
      : 0;
  const segScore = Math.min(100, avgDuration * 15);

  const today = new Date();
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  let recentClosures = 0,
    yearlyClosures = 0;
  for (const s of nearbyStores) {
    if (!s.closeDate) continue;
    const d = new Date(s.closeDate);
    if (d >= threeMonthsAgo) recentClosures++;
    if (d >= oneYearAgo) yearlyClosures++;
  }
  const monthlyRecent = recentClosures / 3;
  const monthlyYearly = yearlyClosures / 12;
  const acceleration =
    monthlyYearly > 0 ? (monthlyRecent - monthlyYearly) / monthlyYearly : 0;
  let trendScore = 50;
  if (acceleration <= -0.3) trendScore = 100;
  else if (acceleration <= -0.1) trendScore = 90;
  else if (acceleration <= 0) trendScore = 80;
  else if (acceleration <= 0.1) trendScore = 70;
  else if (acceleration <= 0.3) trendScore = 60;
  else if (acceleration <= 0.5) trendScore = 50;
  else trendScore = 40;

  const foot = footNearbyForSEC(store.lat, store.lng, radiusM, foottrafficData);
  let foottrafficScore = 50;
  let scaledDaily = 0,
    scaledWeekday = 0,
    scaledWeekend = 0;
  if (foot.gridCount > 0) {
    scaledDaily = foot.dailyAvg * 1000;
    scaledWeekday = foot.weekdayAvg * 1000;
    scaledWeekend = foot.weekendAvg * 1000;
    if (scaledDaily >= 50000) foottrafficScore = 100;
    else if (scaledDaily >= 30000) foottrafficScore = 90;
    else if (scaledDaily >= 20000) foottrafficScore = 80;
    else if (scaledDaily >= 10000) foottrafficScore = 70;
    else if (scaledDaily >= 5000) foottrafficScore = 60;
    else foottrafficScore = 50;
  }

  // vacancyScore — 공간 기반. analysis.ts와 동일 로직.
  const monthsSinceClosed = vacancyMonthsByLocation(store.lat, store.lng, allStores);

  const longTermCount = durations.filter((d) => d >= 5).length;
  const longTermRate =
    durations.length > 0 ? (longTermCount / durations.length) * 100 : 0;

  const sameCatDurations = [];
  for (const s of nearbyStores) {
    if (s.category !== store.category || !s.openDate || !s.closeDate) continue;
    sameCatDurations.push(
      (new Date(s.closeDate).getTime() - new Date(s.openDate).getTime()) /
        (1000 * 60 * 60 * 24 * 365),
    );
  }
  let categoryScore = 60;
  if (sameCatDurations.length >= 2) {
    const r =
      (sameCatDurations.filter((d) => d >= 5).length /
        sameCatDurations.length) *
      100;
    if (r >= 50) categoryScore = 85;
    else if (r >= 25) categoryScore = 65;
    else categoryScore = 40;
  }

  let vacancyScore;
  if (monthsSinceClosed === null) vacancyScore = 50;
  else if (monthsSinceClosed <= 3) vacancyScore = 100;
  else if (monthsSinceClosed <= 6) vacancyScore = 85;
  else if (monthsSinceClosed <= 12) vacancyScore = 70;
  else if (monthsSinceClosed <= 24) vacancyScore = 55;
  else vacancyScore = 40;

  let longTermScore;
  if (longTermRate >= 60) longTermScore = 100;
  else if (longTermRate >= 40) longTermScore = 85;
  else if (longTermRate >= 25) longTermScore = 70;
  else if (longTermRate >= 10) longTermScore = 55;
  else longTermScore = 40;

  let areaScore = 60;
  if (store.area > 0) {
    const a = store.area;
    if (a >= 30 && a <= 100) areaScore = 100;
    else if ((a >= 20 && a < 30) || (a > 100 && a <= 150)) areaScore = 80;
    else if ((a >= 10 && a < 20) || (a > 150 && a <= 200)) areaScore = 65;
    else areaScore = 50;
  }

  const total =
    ludScore * 0.25 +
    segScore * 0.15 +
    trendScore * 0.12 +
    categoryScore * 0.12 +
    vacancyScore * 0.08 +
    longTermScore * 0.05 +
    areaScore * 0.03 +
    foottrafficScore * 0.2;

  return {
    storeId: store.id,
    storeName: store.name,
    lat: store.lat,
    lng: store.lng,
    totalScore: Math.round(total * 10) / 10,
    ludScore: Math.round(ludScore),
    segScore: Math.round(segScore),
    trendScore,
    foottrafficScore: Math.round(foottrafficScore),
    categoryScore: Math.round(categoryScore),
    vacancyScore: Math.round(vacancyScore),
    longTermScore: Math.round(longTermScore),
    areaScore: Math.round(areaScore),
    reasoning: generateSECReasoning({
      ludScore,
      segScore,
      trendScore,
      categoryFitScore: categoryScore,
      nearbyCount,
      avgDuration,
      monthsSinceClosed: monthsSinceClosed ?? 0,
      dailyFoottraffic: scaledDaily,
      weekdayFoottraffic: scaledWeekday,
      weekendFoottraffic: scaledWeekend,
      category: store.category,
      longTermCount,
      longTermRate,
    }),
  };
}

// analysis.ts generateSECReasoningWithFootTraffic 포팅. 가중치/조건 동일.
function generateSECReasoning(i) {
  const {
    ludScore,
    segScore,
    trendScore,
    categoryFitScore,
    nearbyCount,
    avgDuration,
    monthsSinceClosed,
    dailyFoottraffic,
    weekdayFoottraffic,
    weekendFoottraffic,
    category,
    longTermCount,
    longTermRate,
  } = i;
  const seed = nearbyCount + Math.round(avgDuration * 10);
  const pattern = seed % 3;
  const parts = [];

  if (ludScore >= 90) {
    parts.push(
      [
        `반경 250m 내 폐업 매장이 단 ${nearbyCount}개로 경쟁 공백 상태입니다.`,
        `주변 ${nearbyCount}개 폐업으로 포화도가 낮아 진입 장벽이 낮습니다.`,
        `인근 폐업 ${nearbyCount}건으로 신규 출점 시 경쟁 압박이 거의 없습니다.`,
      ][pattern],
    );
  } else if (ludScore >= 70) {
    parts.push(
      [
        `반경 250m 내 ${nearbyCount}개 폐업으로 적정 경쟁 수준입니다.`,
        `주변 폐업 ${nearbyCount}건으로 과도한 경쟁 없이 안정적입니다.`,
        `인근 ${nearbyCount}개 폐업은 상권 평균 수준으로 우려 없습니다.`,
      ][pattern],
    );
  } else if (ludScore >= 50) {
    parts.push(
      [
        `반경 250m 내 ${nearbyCount}개 폐업으로 다소 경쟁이 있으나 관리 가능한 수준입니다.`,
        `주변 ${nearbyCount}건 폐업이 있어 진입 전 차별화 전략이 필요합니다.`,
        `인근 폐업 ${nearbyCount}개로 경쟁 상황을 면밀히 검토해야 합니다.`,
      ][pattern],
    );
  } else {
    parts.push(
      `반경 250m 내 ${nearbyCount}개 폐업으로 고밀도 경쟁 지역입니다. 신중한 접근이 필요합니다.`,
    );
  }

  if (segScore >= 80) {
    if (longTermRate >= 60) {
      parts.push(
        `주변 매장 중 ${Math.round(longTermRate)}%가 5년 이상 영업해 상권 검증이 완료된 지역입니다.`,
      );
    } else {
      parts.push(
        `평균 영업기간 ${avgDuration.toFixed(1)}년으로 중장기 생존이 검증된 상권입니다.`,
      );
    }
  } else if (segScore >= 60) {
    parts.push(
      `주변 매장 평균 ${avgDuration.toFixed(1)}년 영업 중이며, 장수 매장 ${longTermCount}개가 상권을 지탱하고 있습니다.`,
    );
  } else if (avgDuration > 0) {
    parts.push(
      `평균 영업기간 ${avgDuration.toFixed(1)}년으로 짧은 편이나, 업종 특성을 고려한 전략이 필요합니다.`,
    );
  }

  if (dailyFoottraffic >= 30000) {
    if (weekdayFoottraffic > 0 && weekendFoottraffic > 0) {
      parts.push(
        `일평균 유동인구 ${Math.round(dailyFoottraffic).toLocaleString()}명 (주중 ${Math.round(weekdayFoottraffic).toLocaleString()}명, 주말 ${Math.round(weekendFoottraffic).toLocaleString()}명)으로 매우 활발한 상권입니다.`,
      );
    } else {
      parts.push(
        `일평균 유동인구 ${Math.round(dailyFoottraffic).toLocaleString()}명으로 매우 활발한 상권입니다.`,
      );
    }
  } else if (dailyFoottraffic >= 20000) {
    parts.push(
      `일평균 ${Math.round(dailyFoottraffic).toLocaleString()}명의 풍부한 유동인구로 안정적 고객 확보가 가능합니다.`,
    );
  } else if (dailyFoottraffic >= 10000) {
    parts.push(
      `일평균 유동인구 ${Math.round(dailyFoottraffic).toLocaleString()}명으로 충분한 상권 활성도를 보입니다.`,
    );
  } else if (dailyFoottraffic > 0) {
    parts.push(
      `일평균 ${Math.round(dailyFoottraffic).toLocaleString()}명 수준이며, 타겟 고객층 분석이 중요합니다.`,
    );
  } else {
    parts.push(
      `유동인구 데이터가 부족하여 현장 답사를 통한 검증이 필요합니다.`,
    );
  }

  if (trendScore >= 80) {
    parts.push(
      [
        `최근 1년 폐업 추세가 안정적이거나 감소세로 상권 회복 신호입니다.`,
        `최근 3개월 폐업이 연평균 대비 낮아 상권이 개선되고 있습니다.`,
        `폐업 가속도가 낮아 안정적인 진입 시점으로 판단됩니다.`,
      ][pattern],
    );
  } else if (trendScore >= 60) {
    parts.push(`최근 폐업이 소폭 증가했으나 전체 추세는 우려할 수준이 아닙니다.`);
  } else {
    parts.push(`최근 폐업 가속화 추세가 관찰되어 시장 상황 모니터링이 필요합니다.`);
  }

  if (monthsSinceClosed <= 3) {
    parts.push(
      `폐업 후 ${monthsSinceClosed}개월로 최신 정보이며, 임대 협상에 유리한 시점입니다.`,
    );
  } else if (monthsSinceClosed <= 6) {
    parts.push(
      `폐업 후 ${monthsSinceClosed}개월 경과로 재출점 검토에 적합한 타이밍입니다.`,
    );
  } else if (monthsSinceClosed <= 12) {
    parts.push(
      `폐업 후 ${monthsSinceClosed}개월이 지나 공실 기간이 다소 있으나 협상 여지가 있습니다.`,
    );
  } else if (monthsSinceClosed > 0) {
    parts.push(
      `폐업 후 ${monthsSinceClosed}개월이 경과해 임대 조건 재협상이 필요합니다.`,
    );
  }

  if (category) {
    if (categoryFitScore >= 80) {
      parts.push(
        `${category} 업종의 장기 생존율이 ${Math.round(longTermRate)}%로 업종 적합도가 높습니다.`,
      );
    } else if (categoryFitScore >= 60) {
      parts.push(
        `${category}은 이 상권에서 평균적인 생존율을 보이며, 차별화 전략으로 성과 제고가 가능합니다.`,
      );
    } else {
      parts.push(
        `${category} 업종은 경쟁이 치열하므로 독창적인 컨셉과 운영 전략이 필수입니다.`,
      );
    }
  }

  return parts.join(" ");
}

// 옵션 A 검증 — 4사분면별 폐업 간격 + 케이스 스터디 (동시 폐업 클러스터).
// SEC는 "재출점 적정도"라 영업기간 예측 못 함 (vacancyScore가 폐업 후 시간만 봄).
// 대신 "전염성" 가설: 함정 자리는 폐업 후 같은 자리에서 또 폐업까지 시간이 짧다.

// 매장 → 가장 가까운 다른 폐업 매장과의 폐업일 간격 (개월).
function nearestClosureGapMonths(target, allStores, radiusM) {
  const ld = (radiusM / 111000) * 1.5;
  const lng = (radiusM / (111000 * Math.cos((target.lat * Math.PI) / 180))) * 1.5;
  let minDiff = Infinity;
  for (const s of allStores) {
    if (s.id === target.id || !s.closeDate) continue;
    if (Math.abs(s.lat - target.lat) > ld) continue;
    if (Math.abs(s.lng - target.lng) > lng) continue;
    if (haversineMeters(s.lat, s.lng, target.lat, target.lng) > radiusM) continue;
    const d = Math.abs(
      (new Date(target.closeDate).getTime() -
        new Date(s.closeDate).getTime()) /
        (1000 * 60 * 60 * 24 * 30.44),
    );
    if (d < minDiff) minDiff = d;
  }
  return minDiff;
}

// 4사분면 매장 분류 (paradox.ts 절대값 임계와 동일).
const paradoxGridList2 = enriched.filter((g) => g.isParadox);
const goldenGridList = enriched.filter((g) => g.foot >= 50 && g.closures <= 1);
const dangerGridList = enriched.filter((g) => g.foot < 30 && g.closures >= 3);
const quietGridList = enriched.filter((g) => g.foot < 30 && g.closures <= 1);

function storesInGrids(allStores, grids, radius) {
  const result = [];
  for (const s of allStores) {
    if (!s.closeDate) continue;
    for (const g of grids) {
      if (Math.abs(g.lat - s.lat) > 0.0015) continue;
      if (Math.abs(g.lng - s.lng) > 0.002) continue;
      if (haversineMeters(s.lat, s.lng, g.lat, g.lng) <= radius) {
        result.push(s);
        break;
      }
    }
  }
  return result;
}

console.log("\n📊 4사분면별 폐업 간격 계산...");
const paraStores = storesInGrids(stores, paradoxGridList2, 100);
const goldStores = storesInGrids(stores, goldenGridList, 100);
const dangStores = storesInGrids(stores, dangerGridList, 100);
const quietStores = storesInGrids(stores, quietGridList, 100);

function intervalStatsFor(qStores, allStores) {
  const gaps = [];
  let withCluster = 0;
  for (const t of qStores) {
    const g = nearestClosureGapMonths(t, allStores, 100);
    if (g < Infinity) {
      gaps.push(g);
      if (g <= 6) withCluster++;
    }
  }
  gaps.sort((a, b) => a - b);
  return {
    count: qStores.length,
    measured: gaps.length,
    meanMonths: Math.round((gaps.reduce((s, x) => s + x, 0) / gaps.length) * 10) / 10,
    medianMonths: Math.round(gaps[Math.floor(gaps.length / 2)] * 10) / 10,
    clusterRate: Math.round((withCluster / gaps.length) * 1000) / 1000,
  };
}

const intervalStats = {
  paradox: intervalStatsFor(paraStores, stores),
  golden: intervalStatsFor(goldStores, stores),
  risk: intervalStatsFor(dangStores, stores),
  calm: intervalStatsFor(quietStores, stores),
};
console.log("  함정 자리:", intervalStats.paradox);
console.log("  황금:", intervalStats.golden);
console.log("  위험:", intervalStats.risk);
console.log("  고요:", intervalStats.calm);

// 케이스 스터디 — 함정 자리 + 100m + 12개월 윈도우 + 3+ 매장.
console.log("\n🔥 케이스 스터디 후보 추출...");
const CASE_RADIUS = 100;
const CASE_WINDOW_MONTHS = 12;
const CASE_MIN_STORES = 3;

const allCases = [];
for (const g of paradoxGridList2) {
  const nearby = stores.filter((s) => {
    if (!s.closeDate) return false;
    if (Math.abs(s.lat - g.lat) > 0.0015) return false;
    if (Math.abs(s.lng - g.lng) > 0.002) return false;
    return haversineMeters(s.lat, s.lng, g.lat, g.lng) <= CASE_RADIUS;
  });
  if (nearby.length < CASE_MIN_STORES) continue;
  nearby.sort((a, b) => a.closeDate.localeCompare(b.closeDate));

  // 12개월 슬라이딩 윈도우 — 가장 매장 많은 구간.
  let bestCount = 0;
  let bestStart = 0;
  for (let i = 0; i < nearby.length; i++) {
    const startD = new Date(nearby[i].closeDate);
    let cnt = 1;
    for (let j = i + 1; j < nearby.length; j++) {
      const d =
        (new Date(nearby[j].closeDate).getTime() - startD.getTime()) /
        (1000 * 60 * 60 * 24 * 30.44);
      if (d > CASE_WINDOW_MONTHS) break;
      cnt++;
    }
    if (cnt > bestCount) {
      bestCount = cnt;
      bestStart = i;
    }
  }
  if (bestCount < CASE_MIN_STORES) continue;
  const slice = nearby.slice(bestStart, bestStart + bestCount);
  const spanMonths =
    (new Date(slice[slice.length - 1].closeDate).getTime() -
      new Date(slice[0].closeDate).getTime()) /
    (1000 * 60 * 60 * 24 * 30.44);
  allCases.push({
    gid: g.gid,
    dong: g.dong,
    lat: g.lat,
    lng: g.lng,
    storeCount: bestCount,
    spanMonths: Math.round(spanMonths * 10) / 10,
    stores: slice,
  });
}

// 매장 수 많은 순 + 케이스 간 격자 거리 ≥ 200m + 동 분산.
allCases.sort((a, b) => b.storeCount - a.storeCount);
const selectedCases = [];
const usedDongsForCase = new Set();
for (const c of allCases) {
  if (selectedCases.length >= 5) break;
  if (usedDongsForCase.has(c.dong)) continue;
  const tooClose = selectedCases.some(
    (sc) => haversineMeters(sc.lat, sc.lng, c.lat, c.lng) < 200,
  );
  if (tooClose) continue;
  selectedCases.push(c);
  usedDongsForCase.add(c.dong);
}
console.log(`  선정: ${selectedCases.length}곳`);
selectedCases.forEach((c) =>
  console.log(
    `    ${c.dong} (${c.storeCount}개, ${c.spanMonths}개월 안)`,
  ),
);

// 매장별 직전 폐업 간격 (개월) 계산.
function caseToOutput(c) {
  const slice = c.stores;
  return {
    gid: c.gid,
    dong: c.dong,
    location: `${c.dong} 일대`,
    centerLat: c.lat,
    centerLng: c.lng,
    radiusM: CASE_RADIUS,
    spanMonths: c.spanMonths,
    storeCount: c.storeCount,
    stores: slice.map((s, i) => {
      const dur =
        (new Date(s.closeDate).getTime() - new Date(s.openDate).getTime()) /
        (1000 * 60 * 60 * 24 * 365);
      const gap =
        i === 0
          ? null
          : (new Date(s.closeDate).getTime() -
              new Date(slice[i - 1].closeDate).getTime()) /
            (1000 * 60 * 60 * 24 * 30.44);
      return {
        id: s.id,
        name: s.name,
        business: s.category,
        openDate: s.openDate,
        closeDate: s.closeDate,
        durationYears: Math.round(dur * 10) / 10,
        gapFromPrevMonths: gap === null ? null : Math.round(gap * 10) / 10,
      };
    }),
  };
}

const verificationOutput = {
  computedAt: new Date().toISOString(),
  hypothesis:
    "함정 자리는 전염성을 가진다 — 한 매장이 망하면 같은 자리에서 다음 폐업까지 시간이 다른 사분면보다 짧다.",
  intervalStats,
  caseStudies: selectedCases.map(caseToOutput),
};

fs.writeFileSync(VERIFY_OUT_PATH, JSON.stringify(verificationOutput, null, 2));
console.log(`💾 저장: ${VERIFY_OUT_PATH}`);

// ════════════════════════════════════════════════════════
// 동별 SEC top3/bottom3 사전계산.
// 기존 런타임 5-10초 → 0.3-0.5초 fetch로 단축. 진입 로딩 화면 제거 목적.
// 가중치/공식은 analysis.ts calculateSECScoresWithFootTraffic와 동일.
// ════════════════════════════════════════════════════════

console.log("\n🏆 동별 SEC top3/bottom3 사전계산 시작...");
const SEC_T0 = Date.now();

const byDong = {};
for (const s of stores) {
  const dong = s.dong || "알 수 없음";
  if (!byDong[dong]) byDong[dong] = [];
  byDong[dong].push(s);
}

const MIN_PIN_DISTANCE = 100;
function pickSpread(sortedScores) {
  const picked = [];
  for (const c of sortedScores) {
    if (picked.length >= 3) break;
    const tooClose = picked.some(
      (p) => haversineMeters(p.lat, p.lng, c.lat, c.lng) < MIN_PIN_DISTANCE,
    );
    if (!tooClose) picked.push(c);
  }
  // 3개 못 채우면 거리 무시하고 채움.
  while (picked.length < 3 && sortedScores.length > picked.length) {
    const fallback = sortedScores.find((s) => !picked.includes(s));
    if (!fallback) break;
    picked.push(fallback);
  }
  return picked;
}

const dongSecOut = {};
const dongEntries = Object.entries(byDong);
for (let di = 0; di < dongEntries.length; di++) {
  const [dong, dongStores] = dongEntries[di];
  const tStart = Date.now();
  const scores = dongStores.map((s) => calcSECFull(s, dongStores, foottraffic, 250));
  scores.sort((a, b) => b.totalScore - a.totalScore);
  const top3 = pickSpread(scores).map((s) => ({ ...s, kind: "best" }));
  const bottom3 = pickSpread([...scores].reverse()).map((s) => ({
    ...s,
    kind: "worst",
  }));
  dongSecOut[dong] = {
    totalCount: dongStores.length,
    top3,
    bottom3,
  };
  console.log(
    `  [${di + 1}/${dongEntries.length}] ${dong}: ${dongStores.length}개 매장 · ${Date.now() - tStart}ms`,
  );
}

fs.writeFileSync(DONG_SEC_OUT, JSON.stringify(dongSecOut));
const secStat = fs.statSync(DONG_SEC_OUT);
console.log(
  `💾 저장: ${DONG_SEC_OUT} (${(secStat.size / 1024).toFixed(1)} KB · 동 ${Object.keys(dongSecOut).length}개 · 총 ${((Date.now() - SEC_T0) / 1000).toFixed(1)}초)`,
);
