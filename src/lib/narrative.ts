// 규칙 기반 NLG 엔진. 4문장 구조의 한국어 진단 텍스트 생성.
// 같은 매장은 매번 같은 텍스트 (안정성), 다른 매장은 다른 표현 (다양성).
// LLM 호출 없음, 즉시 응답, 비용 0, 데모 안정.

import type { Store } from "@/types";
import type { Quadrant } from "./paradox";
import type { ClosurePeriod } from "./monthly";

export interface DiagnosisInput {
  store: Store;
  sec: number; // 0-100
  quadrant: Quadrant;
  quadrantLabel: string; // "함정 자리" 등
  gridData: { closures: number; foot: number } | null;
  // 실제 250m 반경 폐업 카운트 (calculateSingleStoreSEC의 nearbyClosedCount).
  // 격자 closures(50m 단일값)와는 다름, 텍스트의 "반경 250m"과 일치하는 값.
  nearbyClosedCount: number;
  // 반경 250m 평균 유동인구 (명/일, 이미 ×1000 스케일). FootTrafficCard /
  // SEC footScore / MetricGrid 유동 점수와 동일 값. 50m 단일 격자(gridData.foot)와
  // 다르며, AI 진단 텍스트는 이 값을 사용해 다른 카드와 일관성 유지.
  dailyFootAvg250m: number;
  monthlyContext: {
    avgClosures: number | null; // 폐업 시점 ±3개월 강남구 평균
    period: ClosurePeriod;
  };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function generateAIDiagnosis(input: DiagnosisInput): string {
  const seed = hashCode(input.store.id);
  const pickFrom = (arr: string[]) => arr[seed % arr.length];

  const s1 = buildS1(input, pickFrom);
  const s2 = buildS2(input.quadrant, seed);
  const s3 = buildS3(input.monthlyContext, pickFrom);
  const s4 = buildS4(input.sec, pickFrom);

  return [s1, s2, s3, s4].filter(Boolean).join(" ");
}

function buildS1(
  input: DiagnosisInput,
  pick: (arr: string[]) => string,
): string {
  const { quadrant, quadrantLabel, nearbyClosedCount, dailyFootAvg250m } =
    input;
  if (quadrant === "unknown") {
    return `이 자리는 격자 데이터 부족으로 정밀 분류가 제한됩니다.`;
  }
  const closStr = `반경 250m 폐업 ${nearbyClosedCount}건`;
  // 250m 평균 유동 — FootTrafficCard / SEC footScore와 같은 출처 → 모든 카드 일치.
  if (dailyFootAvg250m <= 0) {
    return `유동 데이터는 확보하지 못했지만 ${closStr}, ${quadrantLabel}로 분류됩니다.`;
  }
  const footStr = `일평균 유동 ${Math.round(dailyFootAvg250m).toLocaleString()}명`;

  return pick([
    `이 자리는 ${footStr}, ${closStr}의 ${quadrantLabel} 안에 있습니다.`,
    `${footStr} · ${closStr}, ${quadrantLabel}에 위치합니다.`,
    `${quadrantLabel}에 해당합니다 (${footStr}, ${closStr}).`,
  ]);
}

const S2_VARIATIONS: Record<Quadrant, string[]> = {
  paradox: [
    "격자 유동·폐업 둘 다 상위, 함정 자리 전형 패턴입니다.",
    "격자 유동과 폐업이 모두 누적되는 자리, 일반 상권분석에서 놓치는 패턴입니다.",
    "함정 자리, 격자 유동·폐업 동시 상위로 분류된 입지입니다.",
  ],
  danger: [
    "폐업 누적 + 격자 유동 평균 이하, 회복 신호가 부족합니다.",
    "격자 유동 낮음 + 폐업 다수, 구조적으로 어려운 입지입니다.",
    "위험 구간, 격자 유동·폐업 모두 불리한 자리입니다.",
  ],
  golden: [
    "폐업 적고 격자 유동 상위, 강남구 우량 입지입니다.",
    "황금 구간, 격자 유동 풍부 + 폐업 누적 없음.",
    "수요 대비 경쟁이 안정된 자리로 신규 진입 시 유리합니다.",
  ],
  quiet: [
    "격자 유동 낮음 + 폐업 누적 없음, 마케팅 의존도가 높은 자리입니다.",
    "조용한 입지, 폐업도 드물지만 신규 매출도 천천히 쌓입니다.",
    "낮은 경쟁/낮은 유동 구간, 인지도 확보가 관건입니다.",
  ],
  neutral: [
    "강남구 평균적인 입지로, 매장 운영 역량이 성패를 가릅니다.",
    "유동·폐업 모두 평년 수준, 입지보다 컨셉이 변수입니다.",
    "보통 구간으로, 차별화 전략 없이는 평균 결과에 머무릅니다.",
  ],
  unknown: [
    "격자 데이터 부족으로 정밀 분석이 제한됩니다. 세부 점수를 참고하세요.",
    "주변 격자 정보가 부족합니다, 현장 답사로 보완이 필요합니다.",
  ],
};

function buildS2(q: Quadrant, seed: number): string {
  const arr = S2_VARIATIONS[q];
  return arr[seed % arr.length];
}

function buildS3(
  ctx: DiagnosisInput["monthlyContext"],
  pick: (arr: string[]) => string,
): string {
  const { period, avgClosures } = ctx;
  const avg = avgClosures ?? 0;
  switch (period) {
    case "covid":
      return pick([
        `특히 코로나 직격 시기에 폐업하여 외부 충격 영향이 큽니다 (당시 강남구 월 ${avg}건 폐업).`,
        `폐업 시점이 코로나 한복판, 구조적 입지보다 외부 변수 영향이 컸습니다.`,
      ]);
    case "recent":
      return pick([
        `최근 1년 내 폐업으로 현재 시점 위험도가 높습니다.`,
        `가장 최근 폐업 사례, 현재 시점 분석에 강한 신호입니다.`,
      ]);
    case "pre-covid":
      return pick([
        `코로나 이전 폐업으로 구조적 입지 문제가 의심됩니다.`,
        `외부 충격 없이 폐업, 입지 자체의 한계가 의심됩니다.`,
      ]);
    case "post-covid":
      return pick([
        `코로나 이후 폐업으로 회복기 적응 실패 가능성이 있습니다.`,
        `리오프닝 시기 폐업, 변화한 상권에 적응하지 못한 사례입니다.`,
      ]);
    default:
      return "";
  }
}

function buildS4(sec: number, pick: (arr: string[]) => string): string {
  if (sec <= 30) {
    return pick([
      `SEC ${sec}점으로 재출점 시 매우 신중한 검토가 필요합니다.`,
      `종합 점수 ${sec}점, 재출점 비추천 수준입니다.`,
    ]);
  }
  if (sec <= 50) {
    return pick([
      `SEC ${sec}점으로 재출점 적정도가 낮은 입지입니다.`,
      `종합 ${sec}점, 재출점 시 추가 데이터 검증이 필요합니다.`,
    ]);
  }
  if (sec <= 70) {
    return pick([
      `SEC ${sec}점으로 조건부 재출점 검토가 가능합니다.`,
      `${sec}점, 컨셉 차별화 시 재출점 가능 입지입니다.`,
    ]);
  }
  return pick([
    `SEC ${sec}점으로 재출점 적합 입지로 분류됩니다.`,
    `${sec}점, 강남구 우량 재출점 후보입니다.`,
  ]);
}

// 시간축 카드 멘트와 일관 (TimelineCard도 같은 분기 사용).
export function buildTimelineMessage(
  targetMonth: string | null,
  nearbyAvg: number | null,
  overallAvg: number,
): string {
  if (!targetMonth || nearbyAvg === null) {
    return "매장 선택 시 폐업 시점이 강조됩니다.";
  }
  const isCovid = targetMonth >= "2020-03" && targetMonth <= "2022-04";
  if (isCovid) {
    return `코로나 직격 시기 폐업, 강남구 월 평균 ${nearbyAvg}건`;
  }
  if (nearbyAvg > overallAvg * 1.5) {
    return `강남구 폐업이 가속화되던 시기 (월 ${nearbyAvg}건)`;
  }
  if (nearbyAvg < overallAvg * 0.7) {
    return `강남구 폐업이 잠잠하던 시기 (월 ${nearbyAvg}건)`;
  }
  return `강남구 폐업이 평년 수준이던 시기 (월 ${nearbyAvg}건)`;
}
