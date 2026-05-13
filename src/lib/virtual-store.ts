// 가상 매장 시뮬레이션 — 발표 클라이맥스용.
// 매장 자체는 가상이지만 좌표 기반 분석은 100% 실데이터 (격자/유동/SEC).
// createVirtualStore()가 만든 객체를 selectedStore 자리에 끼우면
// calculateSingleStoreSEC, classifyStore, generateAIDiagnosis가 그대로 동작.

import type { Store } from "@/types";

// 매장 클릭 핸들러 / 카드 컴포넌트에서 "가상 매장인지" 판별하는 상수.
// ScatterCard의 별 색상 분기, AI 진단 시기 분기 등에 사용.
export const VIRTUAL_STORE_ID = "__virtual_store__";

// 발표 시연용 사전 정의 좌표 — grid-aggregates + stores-recent 250m 반경 카운트로 검증.
// 좌표 선정 기준: (1) classifyStore 분류 일치, (2) 250m 텍스트 수치와 시각 핀 일치,
//                 (3) 카카오맵 시각 확인 — 상업가/한복판이어야 발표 멘트와 일관.
//
//   TRAP  : 역삼동 (역삼1동, 역삼역 북쪽 250m, 테헤란로 변).
//           격자 closures 48, foot 72 → paradox 분류.
//           250m 반경 실 폐업 120건. AI 텍스트도 120건 표기.
//   GOLDEN: 청담동 명품 거리 (청담사거리 남쪽 130m, 도산대로 명품 부티크 라인).
//           격자 closures 0, foot 90 → golden 분류.
//           250m 반경 실 폐업 19건 (TRAP 대비 6.3배 격차). AI 텍스트도 19건 표기.
//
// 발표 멘트: "역삼동 한복판 폐업 120건 vs 청담 명품거리 폐업 19건 · 같은 강남구 6배 격차".
export const DEMO_TRAP_COORD = { lat: 37.50301, lng: 127.03686 };
export const DEMO_GOLDEN_COORD = { lat: 37.52203, lng: 127.048 };

export const DEFAULT_BUSINESS = "한식";

// 가상 매장을 실 Store 인터페이스에 맞게 합성.
// openDate=현재일, closeDate 없음 (영업 중 상정). status='active'.
// area=50(평균 한식점 규모). dong은 좌표로 정확 매핑되진 않지만 표시용으로만 사용.
export function createVirtualStore(
  lat: number,
  lng: number,
  business: string = DEFAULT_BUSINESS,
  todayISO?: string,
): Store {
  const today = todayISO ?? new Date().toISOString().slice(0, 10);
  return {
    id: VIRTUAL_STORE_ID,
    name: "신규 매장 후보",
    category: business,
    address: `시뮬레이션 위치 (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
    lat,
    lng,
    status: "active",
    openDate: today,
    area: 50,
    dong: undefined,
  };
}

// 업종 드롭다운 옵션 — LOCALDATA 업태명 + 카테고리 매핑 기준.
export const VIRTUAL_BUSINESS_OPTIONS: string[] = [
  "한식",
  "중국식",
  "일식",
  "경양식",
  "분식",
  "통닭(치킨)",
  "호프/통닭",
  "까페",
  "기타",
];
