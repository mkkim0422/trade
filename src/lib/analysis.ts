import type { Store } from "@/types";
import { getDistance } from "./constants";
import { getFootTrafficNearby, type FootTrafficData } from "./foottraffic";

export interface LUDAnalysis {
  score: number;
  nearbyClosedCount: number;
  pattern: "supply_excess" | "demand_decrease" | "rental_pressure" | "unknown";
  patternLabel: string;
  radius: number;
}

export function analyzeLUD(
  targetStore: Store,
  allStores: Store[],
  radius: number = 250,
): LUDAnalysis {
  const nearbyStores = allStores.filter((store) => {
    if (store.id === targetStore.id) return false;
    const distance = getDistance(
      targetStore.lat,
      targetStore.lng,
      store.lat,
      store.lng,
    );
    return distance <= radius;
  });

  const nearbyClosedCount = nearbyStores.length;

  let score = 0;
  if (nearbyClosedCount >= 50) score = 90;
  else if (nearbyClosedCount >= 30) score = 75;
  else if (nearbyClosedCount >= 20) score = 60;
  else if (nearbyClosedCount >= 10) score = 45;
  else if (nearbyClosedCount >= 5) score = 30;
  else score = 15;

  let pattern: LUDAnalysis["pattern"] = "unknown";
  let patternLabel = "분류 불가";

  if (nearbyClosedCount >= 30) {
    pattern = "supply_excess";
    patternLabel = "공급 과잉형";
  } else if (nearbyClosedCount >= 15) {
    pattern = "demand_decrease";
    patternLabel = "수요 감소형";
  } else if (nearbyClosedCount >= 5) {
    pattern = "rental_pressure";
    patternLabel = "임대료 압박형";
  }

  return {
    score,
    nearbyClosedCount,
    pattern,
    patternLabel,
    radius,
  };
}

export interface SEGAnalysis {
  longTermRate: number;
  avgDuration: number;
  nearbyLongTerm: number;
}

export interface TrendAnalysis {
  yearlyClosures: { year: string; count: number }[];
  trend: "increasing" | "stable" | "decreasing";
}

export function analyzeSEG(
  targetStore: Store,
  allStores: Store[],
  radius: number = 250,
): SEGAnalysis {
  const nearbyStores = allStores.filter((store) => {
    if (store.id === targetStore.id) return false;
    const distance = getDistance(
      targetStore.lat,
      targetStore.lng,
      store.lat,
      store.lng,
    );
    return distance <= radius;
  });

  const durations = nearbyStores
    .filter((store) => store.openDate && store.closeDate)
    .map((store) => {
      const start = new Date(store.openDate);
      const end = new Date(store.closeDate as string);
      const years =
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
      return years;
    });

  const longTermStores = durations.filter((d) => d >= 5);
  const longTermRate =
    durations.length > 0
      ? (longTermStores.length / durations.length) * 100
      : 0;

  const avgDuration =
    durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

  return {
    longTermRate: Math.round(longTermRate),
    avgDuration: Math.round(avgDuration * 10) / 10,
    nearbyLongTerm: longTermStores.length,
  };
}

export function analyzeTrend(
  targetStore: Store,
  allStores: Store[],
  radius: number = 250,
): TrendAnalysis {
  const nearbyStores = allStores.filter((store) => {
    if (store.id === targetStore.id) return false;
    const distance = getDistance(
      targetStore.lat,
      targetStore.lng,
      store.lat,
      store.lng,
    );
    return distance <= radius;
  });

  const yearMap = new Map<string, number>();
  nearbyStores.forEach((store) => {
    if (!store.closeDate) return;
    const year = store.closeDate.substring(0, 4);
    yearMap.set(year, (yearMap.get(year) || 0) + 1);
  });

  const yearlyClosures = Array.from(yearMap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year));

  let trend: TrendAnalysis["trend"] = "stable";
  if (yearlyClosures.length >= 3) {
    const recent = yearlyClosures
      .slice(-2)
      .reduce((sum, y) => sum + y.count, 0);
    const past = yearlyClosures
      .slice(0, -2)
      .reduce((sum, y) => sum + y.count, 0);
    const recentAvg = recent / 2;
    const pastAvg = past / (yearlyClosures.length - 2);

    if (recentAvg > pastAvg * 1.3) trend = "increasing";
    else if (recentAvg < pastAvg * 0.7) trend = "decreasing";
  }

  return {
    yearlyClosures,
    trend,
  };
}

export interface SECScore {
  storeId: string;
  storeName: string;
  lat: number;
  lng: number;
  totalScore: number;
  ludScore: number;
  segScore: number;
  trendScore: number;
  foottrafficScore?: number;
  categoryScore?: number;
  vacancyScore?: number;
  longTermScore?: number;
  areaScore?: number;
  kind?: "best" | "worst";
  reasoning: string;
}

export interface SECResult {
  top3: SECScore[];
  bottom3: SECScore[];
}

export function calculateSECScores(
  allStores: Store[],
  radius: number = 250,
): SECScore[] {
  console.log("🏆 SEC 분석 시작: 폐업 매장 중 재출점 적합지 선정");

  const scores: SECScore[] = [];

  allStores.forEach((store) => {
    const nearbyStores = allStores.filter((other) => {
      if (other.id === store.id) return false;
      const distance = getDistance(
        store.lat,
        store.lng,
        other.lat,
        other.lng,
      );
      return distance <= radius;
    });

    const nearbyCount = nearbyStores.length;

    let ludScore = 100;
    if (nearbyCount >= 50) ludScore = 10;
    else if (nearbyCount >= 30) ludScore = 25;
    else if (nearbyCount >= 20) ludScore = 40;
    else if (nearbyCount >= 10) ludScore = 60;
    else if (nearbyCount >= 5) ludScore = 80;
    else ludScore = 95;

    const durations = nearbyStores
      .filter((s) => s.openDate && s.closeDate)
      .map((s) => {
        const start = new Date(s.openDate);
        const end = new Date(s.closeDate as string);
        return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
      });

    const avgDuration =
      durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0;

    const segScore = Math.min(100, avgDuration * 15);

    const yearMap = new Map<string, number>();
    nearbyStores.forEach((s) => {
      if (!s.closeDate) return;
      const year = s.closeDate.substring(0, 4);
      yearMap.set(year, (yearMap.get(year) || 0) + 1);
    });

    const years = Array.from(yearMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    let trendScore = 50;
    if (years.length >= 3) {
      const recent =
        years.slice(-2).reduce((sum, y) => sum + y[1], 0) / 2;
      const past =
        years.slice(0, -2).reduce((sum, y) => sum + y[1], 0) /
        (years.length - 2);

      if (recent < past * 0.7) trendScore = 80;
      else if (recent < past * 1.3) trendScore = 60;
      else trendScore = 30;
    }

    const totalScore = ludScore * 0.5 + segScore * 0.3 + trendScore * 0.2;

    if (nearbyCount > 60) return;

    scores.push({
      storeId: store.id,
      storeName: store.name,
      lat: store.lat,
      lng: store.lng,
      totalScore: Math.round(totalScore * 10) / 10,
      ludScore: Math.round(ludScore),
      segScore: Math.round(segScore),
      trendScore,
      reasoning: generateSECReasoning(
        trendScore,
        nearbyCount,
        avgDuration,
      ),
    });
  });

  scores.sort((a, b) => b.totalScore - a.totalScore);

  console.log(
    `✅ SEC 분석 완료: ${scores.length}개 후보지 중 TOP 3 선정`,
  );
  console.log(
    "TOP 3:",
    scores.slice(0, 3).map((s) => `${s.storeName} (점수: ${s.totalScore})`),
  );

  return scores.slice(0, 3);
}

export function calculateSECScoresWithFootTraffic(
  allStores: Store[],
  foottrafficData: FootTrafficData[],
  radius: number = 250,
  dongLabel?: string,
): SECResult {
  console.log(
    `🏆 ${dongLabel ? `[${dongLabel}] ` : ""}SEC 분석 시작: 8가지 지표 (최적 + 최악)`,
  );

  const scores: SECScore[] = [];

  allStores.forEach((store) => {
    const nearbyStores = allStores.filter((other) => {
      if (other.id === store.id) return false;
      const distance = getDistance(
        store.lat,
        store.lng,
        other.lat,
        other.lng,
      );
      return distance <= radius;
    });

    const nearbyCount = nearbyStores.length;

    let ludScore = 100;
    if (nearbyCount >= 50) ludScore = 10;
    else if (nearbyCount >= 30) ludScore = 25;
    else if (nearbyCount >= 20) ludScore = 40;
    else if (nearbyCount >= 10) ludScore = 60;
    else if (nearbyCount >= 5) ludScore = 80;
    else ludScore = 95;

    const durations = nearbyStores
      .filter((s) => s.openDate && s.closeDate)
      .map((s) => {
        const start = new Date(s.openDate);
        const end = new Date(s.closeDate as string);
        return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
      });

    const avgDuration =
      durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0;

    const segScore = Math.min(100, avgDuration * 15);

    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const recentClosures = nearbyStores.filter((s) => {
      if (!s.closeDate) return false;
      return new Date(s.closeDate) >= threeMonthsAgo;
    }).length;

    const yearlyClosures = nearbyStores.filter((s) => {
      if (!s.closeDate) return false;
      return new Date(s.closeDate) >= oneYearAgo;
    }).length;

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

    if (monthlyYearly > 0) {
      console.log(`${store.name} 추세:`, {
        최근3개월: recentClosures,
        최근1년: yearlyClosures,
        월평균_3개월: monthlyRecent.toFixed(2),
        월평균_1년: monthlyYearly.toFixed(2),
        가속도: acceleration.toFixed(2),
        점수: trendScore,
      });
    }

    const foottraffic = getFootTrafficNearby(
      store.lat,
      store.lng,
      radius,
      foottrafficData,
    );

    let foottrafficScore = 50;
    let scaledDaily = 0;
    let scaledWeekday = 0;
    let scaledWeekend = 0;
    if (foottraffic.gridCount > 0) {
      scaledDaily = foottraffic.dailyAvg * 1000;
      scaledWeekday = foottraffic.weekdayAvg * 1000;
      scaledWeekend = foottraffic.weekendAvg * 1000;
      if (scaledDaily >= 50000) foottrafficScore = 100;
      else if (scaledDaily >= 30000) foottrafficScore = 90;
      else if (scaledDaily >= 20000) foottrafficScore = 80;
      else if (scaledDaily >= 10000) foottrafficScore = 70;
      else if (scaledDaily >= 5000) foottrafficScore = 60;
      else foottrafficScore = 50;
    }

    let monthsSinceClosed = 0;
    if (store.closeDate) {
      const closed = new Date(store.closeDate);
      const today = new Date();
      monthsSinceClosed = Math.max(
        0,
        Math.floor(
          (today.getTime() - closed.getTime()) / (1000 * 60 * 60 * 24 * 30),
        ),
      );
    }

    const longTermCount = durations.filter((d) => d >= 5).length;
    const longTermRate =
      durations.length > 0 ? (longTermCount / durations.length) * 100 : 0;

    const sameCatDurations = nearbyStores
      .filter((s) => s.category === store.category && s.openDate && s.closeDate)
      .map((s) => {
        const start = new Date(s.openDate);
        const end = new Date(s.closeDate as string);
        return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
      });

    let categoryScore = 60;
    if (sameCatDurations.length >= 2) {
      const sameCatLongTermRate =
        (sameCatDurations.filter((d) => d >= 5).length /
          sameCatDurations.length) *
        100;
      if (sameCatLongTermRate >= 50) categoryScore = 85;
      else if (sameCatLongTermRate >= 25) categoryScore = 65;
      else categoryScore = 40;
    }

    let vacancyScore: number;
    if (monthsSinceClosed <= 3) vacancyScore = 100;
    else if (monthsSinceClosed <= 6) vacancyScore = 85;
    else if (monthsSinceClosed <= 12) vacancyScore = 70;
    else if (monthsSinceClosed <= 24) vacancyScore = 55;
    else vacancyScore = 40;

    let longTermScore: number;
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

    const totalScore =
      ludScore * 0.25 +
      segScore * 0.15 +
      trendScore * 0.12 +
      categoryScore * 0.12 +
      vacancyScore * 0.08 +
      longTermScore * 0.05 +
      areaScore * 0.03 +
      foottrafficScore * 0.2;

    scores.push({
      storeId: store.id,
      storeName: store.name,
      lat: store.lat,
      lng: store.lng,
      totalScore: Math.round(totalScore * 10) / 10,
      ludScore: Math.round(ludScore),
      segScore: Math.round(segScore),
      trendScore,
      foottrafficScore: Math.round(foottrafficScore),
      categoryScore: Math.round(categoryScore),
      vacancyScore: Math.round(vacancyScore),
      longTermScore: Math.round(longTermScore),
      areaScore: Math.round(areaScore),
      reasoning: generateSECReasoningWithFootTraffic({
        ludScore,
        segScore,
        trendScore,
        categoryFitScore: categoryScore,
        nearbyCount,
        avgDuration,
        monthsSinceClosed,
        dailyFoottraffic: scaledDaily,
        weekdayFoottraffic: scaledWeekday,
        weekendFoottraffic: scaledWeekend,
        category: store.category,
        longTermCount,
        longTermRate,
      }),
    });
  });

  scores.sort((a, b) => b.totalScore - a.totalScore);

  const MIN_PIN_DISTANCE = 100;
  const pickSpread = (sorted: SECScore[]): SECScore[] => {
    const picked: SECScore[] = [];
    for (const candidate of sorted) {
      if (picked.length >= 3) break;
      const tooClose = picked.some(
        (p) =>
          getDistance(p.lat, p.lng, candidate.lat, candidate.lng) <
          MIN_PIN_DISTANCE,
      );
      if (!tooClose) picked.push(candidate);
    }
    while (picked.length < 3 && sorted.length > picked.length) {
      const fallback = sorted.find((s) => !picked.includes(s));
      if (!fallback) break;
      picked.push(fallback);
    }
    return picked;
  };

  const top3 = pickSpread(scores).map((s) => ({ ...s, kind: "best" as const }));
  const bottom3 = pickSpread([...scores].reverse()).map((s) => ({
    ...s,
    kind: "worst" as const,
  }));

  console.log(`🏆 ${dongLabel ? `[${dongLabel}] ` : ""}SEC TOP 3 (최적):`);
  top3.forEach((s, i) => {
    console.log(`\n${i + 1}위: ${s.storeName} (총점 ${s.totalScore})`);
    console.log(
      `  입지 ${s.ludScore} (25%) + 상권 ${s.segScore} (15%) + 추세 ${s.trendScore} (12%) + 유동 ${s.foottrafficScore} (20%)`,
    );
    console.log(
      `  + 업종 ${s.categoryScore} (12%) + 공실 ${s.vacancyScore} (8%) + 장수 ${s.longTermScore} (5%) + 면적 ${s.areaScore} (3%)`,
    );
  });

  console.log(
    `\n⚠️ ${dongLabel ? `[${dongLabel}] ` : ""}SEC BOTTOM 3 (최악):`,
  );
  bottom3.forEach((s, i) => {
    console.log(`\n${i + 1}위(최악): ${s.storeName} (총점 ${s.totalScore})`);
    console.log(
      `  입지 ${s.ludScore} + 상권 ${s.segScore} + 추세 ${s.trendScore} + 유동 ${s.foottrafficScore} + 업종 ${s.categoryScore} + 공실 ${s.vacancyScore} + 장수 ${s.longTermScore} + 면적 ${s.areaScore}`,
    );
  });

  return { top3, bottom3 };
}

interface ReasoningInputs {
  ludScore: number;
  segScore: number;
  trendScore: number;
  categoryFitScore: number;
  nearbyCount: number;
  avgDuration: number;
  monthsSinceClosed: number;
  dailyFoottraffic: number;
  weekdayFoottraffic: number;
  weekendFoottraffic: number;
  category: string;
  longTermCount: number;
  longTermRate: number;
}

function generateSECReasoningWithFootTraffic(inputs: ReasoningInputs): string {
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
  } = inputs;

  const seed = nearbyCount + Math.round(avgDuration * 10);
  const pattern = seed % 3;
  const parts: string[] = [];

  if (ludScore >= 90) {
    const phrases = [
      `반경 250m 내 폐업 매장이 단 ${nearbyCount}개로 경쟁 공백 상태입니다.`,
      `주변 ${nearbyCount}개 폐업으로 포화도가 낮아 진입 장벽이 낮습니다.`,
      `인근 폐업 ${nearbyCount}건으로 신규 출점 시 경쟁 압박이 거의 없습니다.`,
    ];
    parts.push(phrases[pattern]);
  } else if (ludScore >= 70) {
    const phrases = [
      `반경 250m 내 ${nearbyCount}개 폐업으로 적정 경쟁 수준입니다.`,
      `주변 폐업 ${nearbyCount}건으로 과도한 경쟁 없이 안정적입니다.`,
      `인근 ${nearbyCount}곳 폐업은 상권 평균 수준으로 우려 없습니다.`,
    ];
    parts.push(phrases[pattern]);
  } else if (ludScore >= 50) {
    const phrases = [
      `반경 250m 내 ${nearbyCount}개 폐업으로 다소 경쟁이 있으나 관리 가능한 수준입니다.`,
      `주변 ${nearbyCount}건 폐업이 있어 진입 전 차별화 전략이 필요합니다.`,
      `인근 폐업 ${nearbyCount}곳으로 경쟁 상황을 면밀히 검토해야 합니다.`,
    ];
    parts.push(phrases[pattern]);
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
      `주변 매장 평균 ${avgDuration.toFixed(1)}년 영업 중이며, 장수 매장 ${longTermCount}곳이 상권을 지탱하고 있습니다.`,
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
    parts.push(`유동인구 데이터가 부족하여 현장 답사를 통한 검증이 필요합니다.`);
  }

  if (trendScore >= 80) {
    const phrases = [
      `최근 1년 폐업 추세가 안정적이거나 감소세로 상권 회복 신호입니다.`,
      `최근 3개월 폐업이 연평균 대비 낮아 상권이 개선되고 있습니다.`,
      `폐업 가속도가 낮아 안정적인 진입 시점으로 판단됩니다.`,
    ];
    parts.push(phrases[pattern]);
  } else if (trendScore >= 60) {
    parts.push(
      `최근 폐업이 소폭 증가했으나 전체 추세는 우려할 수준이 아닙니다.`,
    );
  } else {
    parts.push(
      `최근 폐업 가속화 추세가 관찰되어 시장 상황 모니터링이 필요합니다.`,
    );
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
  } else {
    parts.push(
      `폐업 후 ${Math.floor(monthsSinceClosed / 12)}년 이상 경과해 건물주의 급한 임대 수요가 예상됩니다.`,
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

function generateSECReasoning(
  trendScore: number,
  nearbyCount: number,
  avgDuration: number,
): string {
  const parts: string[] = [];

  if (nearbyCount <= 10) {
    parts.push(
      `반경 250m 내 폐업 매장이 ${nearbyCount}개로 경쟁 압박이 낮습니다.`,
    );
  } else {
    parts.push(`반경 250m 내 폐업 매장은 ${nearbyCount}개입니다.`);
  }

  if (avgDuration >= 5) {
    parts.push(
      `주변 매장의 평균 영업기간이 ${avgDuration.toFixed(1)}년으로 상권 안정성이 검증되었습니다.`,
    );
  } else if (avgDuration >= 3) {
    parts.push(
      `주변 매장의 평균 영업기간은 ${avgDuration.toFixed(1)}년입니다.`,
    );
  }

  if (trendScore >= 70) {
    parts.push("최근 폐업 추세가 감소하여 상권이 회복 중입니다.");
  }

  return parts.join(" ");
}

export function generateNarrative(
  ludAnalysis: LUDAnalysis,
  segAnalysis: SEGAnalysis,
  trendAnalysis: TrendAnalysis,
): string {
  const risk =
    ludAnalysis.score >= 70
      ? "높은"
      : ludAnalysis.score >= 40
        ? "중간"
        : "낮은";
  const stability = segAnalysis.longTermRate >= 30 ? "양호" : "불안정";
  const trendText =
    trendAnalysis.trend === "increasing"
      ? "증가 추세"
      : trendAnalysis.trend === "decreasing"
        ? "감소 추세"
        : "안정 추세";

  return `이 입지는 폐업 위험도가 ${risk} 수준이며, 장수 매장 비율은 ${stability}합니다. 최근 폐업은 ${trendText}를 보이고 있어 ${ludAnalysis.patternLabel} 패턴으로 추정됩니다.`;
}
