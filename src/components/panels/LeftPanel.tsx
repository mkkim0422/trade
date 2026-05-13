"use client";

import { useEffect, useMemo, useState } from "react";
import { useDashboardStore } from "@/store/useDashboardStore";
import ClusterStoreList from "./ClusterStoreList";
import SECDetailCard from "@/components/cards/SECDetailCard";
import SECComparisonView from "@/components/cards/SECComparisonView";
import MetricGrid from "@/components/cards/MetricGrid";
import TimelineCard from "@/components/cards/TimelineCard";
import ScatterCard from "@/components/cards/ScatterCard";
import AIConsultantCard from "@/components/cards/AIConsultantCard";
import { calculateSingleStoreSEC, type SECScore } from "@/lib/analysis";
import {
  loadFootTraffic,
  getFootTrafficNearby,
  type FootTrafficData,
} from "@/lib/foottraffic";
import {
  loadGridAggregates,
  type GridAggregate,
} from "@/lib/grid-aggregates";
import {
  classifyStore,
  type Quadrant,
  type QuadrantInfo,
} from "@/lib/paradox";
import {
  loadMonthly,
  classifyClosurePeriod,
  nearbyMonthAvg,
  type MonthlyData,
} from "@/lib/monthly";
import { generateAIDiagnosis } from "@/lib/narrative";
import {
  createVirtualStore,
  VIRTUAL_BUSINESS_OPTIONS,
} from "@/lib/virtual-store";
import { detectDong } from "@/lib/gangnam-dongs";
import type { Store } from "@/types";

// 매장 클릭 시 4단계 분석 시퀀스. 각 단계 라벨은 다음에 등장할 카드와 매칭.
// 발표용 "AI다움" 연출 — 실제 계산은 useMemo로 즉시 끝나지만 일부러 보여준다.
const ANALYSIS_STEPS = [
  "AI 진단 생성 중",
  "시간축 데이터 매칭",
  "4사분면 격자 분류",
  "8개 지표 계산",
];
const TOTAL_STEPS = ANALYSIS_STEPS.length;
// 180ms × 4단계 = 720ms는 발표용 연출이었으나 가상 매장 재클릭 시 느리게 체감됨.
// 60ms × 4 = 240ms로 단축 — 스태거 효과는 유지, 체감 즉시.
const STEP_INTERVAL_MS = 60;

export default function LeftPanel() {
  const selectedStore = useDashboardStore((state) => state.selectedStore);
  const setSelectedStore = useDashboardStore((state) => state.setSelectedStore);
  const selectedSEC = useDashboardStore((state) => state.selectedSEC);
  const setSelectedSEC = useDashboardStore((state) => state.setSelectedSEC);
  const showSECComparison = useDashboardStore(
    (state) => state.showSECComparison,
  );
  const clusterStores = useDashboardStore((state) => state.clusterStores);
  const currentDong = useDashboardStore((state) => state.currentDong);
  const topSECByDong = useDashboardStore((state) => state.topSECByDong);
  const virtualStoreVisible = useDashboardStore((s) => s.virtualStoreVisible);
  const virtualStorePosition = useDashboardStore((s) => s.virtualStorePosition);
  const virtualStoreBusiness = useDashboardStore((s) => s.virtualStoreBusiness);
  const setVirtualStoreBusiness = useDashboardStore(
    (s) => s.setVirtualStoreBusiness,
  );
  const setVirtualStoreVisible = useDashboardStore(
    (s) => s.setVirtualStoreVisible,
  );
  const setVirtualStorePosition = useDashboardStore(
    (s) => s.setVirtualStorePosition,
  );
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [foottrafficData, setFoottrafficData] = useState<FootTrafficData[]>([]);
  const [grids, setGrids] = useState<GridAggregate[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);

  const topSEC = currentDong ? topSECByDong[currentDong] || [] : [];

  // 가상 매장이 활성화돼 있으면 실 매장 선택보다 우선.
  // virtualStore가 selectedStore 자리에 끼면 SEC/사분면/AI 진단 함수가 그대로 동작.
  const virtualStore = useMemo<Store | null>(() => {
    if (virtualStoreVisible && virtualStorePosition) {
      return createVirtualStore(
        virtualStorePosition.lat,
        virtualStorePosition.lng,
        virtualStoreBusiness,
      );
    }
    return null;
  }, [virtualStoreVisible, virtualStorePosition, virtualStoreBusiness]);

  const effectiveStore: Store | null = virtualStore || selectedStore;

  useEffect(() => {
    fetch("/data/stores-recent.json")
      .then((res) => res.json())
      .then((data: Store[]) => setAllStores(data))
      .catch((err) => console.error("전체 매장 로드 실패:", err));
  }, []);

  useEffect(() => {
    loadFootTraffic()
      .then((data) => setFoottrafficData(data))
      .catch((err) => console.error("유동인구 로드 실패:", err));
  }, []);

  useEffect(() => {
    loadGridAggregates()
      .then((data) => setGrids(data.grids))
      .catch((err) => console.error("격자 데이터 로드 실패:", err));
  }, []);

  useEffect(() => {
    loadMonthly()
      .then(setMonthlyData)
      .catch((err) => console.error("월별 폐업 로드 실패:", err));
  }, []);

  const foottrafficStats = useMemo(() => {
    if (!effectiveStore || foottrafficData.length === 0) {
      return { dailyAvg: 0, weekdayAvg: 0, weekendAvg: 0, gridCount: 0 };
    }
    return getFootTrafficNearby(
      effectiveStore.lat,
      effectiveStore.lng,
      250,
      foottrafficData,
    );
  }, [effectiveStore, foottrafficData]);

  // 단일 매장 SEC (B-3 신규). 가상 매장도 실 매장과 동일 함수로 계산.
  const sec: SECScore | null = useMemo(() => {
    if (
      !effectiveStore ||
      allStores.length === 0 ||
      foottrafficData.length === 0
    ) {
      return null;
    }
    return calculateSingleStoreSEC(
      effectiveStore,
      allStores,
      foottrafficData,
      250,
    );
  }, [effectiveStore, allStores, foottrafficData]);

  // 4사분면 분류 (헤더 배지 + AI 진단 입력).
  // 250m 반경 실측 폐점 수(sec.nearbyClosedCount)를 전달해서 사용자가 지도에서
  // 보는 마커 수와 분류 라벨이 일치하게 함.
  const quadrant: QuadrantInfo | null = useMemo(() => {
    if (!effectiveStore || grids.length === 0) return null;
    return classifyStore(
      effectiveStore,
      grids,
      undefined,
      sec?.nearbyClosedCount,
    );
  }, [effectiveStore, grids, sec?.nearbyClosedCount]);

  // AI 진단 텍스트. 가상 매장은 closeDate 없음 → s3는 자동 생략됨.
  const diagnosisText = useMemo(() => {
    if (!effectiveStore || !sec || !quadrant) return "";
    const targetMonth = effectiveStore.closeDate?.slice(0, 7);
    const period = classifyClosurePeriod(effectiveStore.closeDate);
    const avg =
      targetMonth && monthlyData
        ? nearbyMonthAvg(monthlyData.months, targetMonth)
        : null;
    // 가상 매장 클릭 시 시각/숫자 검증용. AI 진단 "반경 250m N건"이 stores-recent.json
    // 실측 카운트와 일치하는지, 격자 closures(50m 단일값)와 별도 값인지 확인 가능.
    if (virtualStore) {
      console.log("🤖 가상 매장 AI 진단 데이터", {
        coord: `(${virtualStore.lat.toFixed(5)}, ${virtualStore.lng.toFixed(5)})`,
        nearbyClosedCount_250m: sec.nearbyClosedCount ?? 0,
        grid_closures_50m: quadrant.grid?.closures ?? null,
        grid_foot: quadrant.grid?.foot ?? null,
        quadrant: quadrant.quadrant,
        secTotal: Math.round(sec.totalScore),
      });
    }
    return generateAIDiagnosis({
      store: effectiveStore,
      sec: Math.round(sec.totalScore),
      quadrant: quadrant.quadrant,
      quadrantLabel: quadrant.label,
      gridData: quadrant.grid
        ? { closures: quadrant.grid.closures, foot: quadrant.grid.foot }
        : null,
      // SEC LUD 원시값 = 250m 반경 실 폐업 카운트. 시각적 핀 수와 일치.
      nearbyClosedCount: sec.nearbyClosedCount ?? 0,
      // 반경 250m 평균 유동 — FootTrafficCard / SEC footScore와 동일 출처.
      dailyFootAvg250m: foottrafficStats.dailyAvg * 1000,
      monthlyContext: { avgClosures: avg, period },
    });
  }, [
    effectiveStore,
    sec,
    quadrant,
    monthlyData,
    virtualStore,
    foottrafficStats.dailyAvg,
  ]);

  // 가상 매장은 좌표 변경 시에도 ProgressiveCardStack을 재실행시켜
  // "분석 중…" 진행바 다시 보이게 → 발표 임팩트 ↑.
  const stackKey = virtualStore
    ? `virtual:${virtualStore.lat.toFixed(5)},${virtualStore.lng.toFixed(5)}:${virtualStore.category}`
    : selectedStore?.id;

  return (
    <div className="flex flex-col h-full relative">
      {clusterStores && <ClusterStoreList />}

      {showSECComparison && <SECComparisonView topSEC={topSEC} />}

      {selectedSEC && !selectedStore && !virtualStore && !showSECComparison && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-white">
            <button
              onClick={() => setSelectedSEC(null)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              ← 돌아가기
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <SECDetailCard sec={selectedSEC} />
          </div>
        </div>
      )}

      {!effectiveStore &&
        !selectedSEC &&
        !showSECComparison &&
        !clusterStores && <div className="flex-1" />}

      {effectiveStore && !showSECComparison && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {virtualStore ? (
            <VirtualStoreHeader
              store={virtualStore}
              quadrant={quadrant}
              sec={sec}
              business={virtualStoreBusiness}
              onChangeBusiness={setVirtualStoreBusiness}
              onClose={() => {
                setVirtualStorePosition(null);
                setVirtualStoreVisible(false);
              }}
            />
          ) : (
            <SelectedStoreHeader
              store={effectiveStore}
              quadrant={quadrant}
              sec={sec}
              onClose={() => setSelectedStore(null)}
            />
          )}
          {/* stackKey — 좌표/업종 바뀌면 재마운트해서 분석 시퀀스 다시 재생. */}
          <ProgressiveCardStack
            key={stackKey}
            store={effectiveStore}
            allStores={allStores}
            foottrafficStats={foottrafficStats}
            diagnosisText={diagnosisText}
            nearbyClosedCount={sec?.nearbyClosedCount ?? 0}
            sec={sec}
          />
        </div>
      )}
    </div>
  );
}

interface VirtualHeaderProps {
  store: Store;
  quadrant: QuadrantInfo | null;
  sec: SECScore | null;
  business: string;
  onChangeBusiness: (b: string) => void;
  onClose: () => void;
}

function VirtualStoreHeader({
  store,
  quadrant,
  sec,
  business,
  onChangeBusiness,
  onClose,
}: VirtualHeaderProps) {
  const grade = sec ? secGrade(sec.totalScore) : null;
  // 발표 멘트("역삼동", "신사 가로수길" 등)와 헤더 일관성 위해 행정동 표시.
  // detectDong은 bounds 기반 — 가장자리에서 null일 수 있어 fallback 좌표 유지.
  const dongInfo = detectDong(store.lat, store.lng);
  const dongLabel = dongInfo ? dongInfo.name : "강남구";
  return (
    <div className="p-5 border-b-2 border-purple-300 bg-gradient-to-br from-purple-50 to-fuchsia-50">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">
            시뮬레이션
          </div>
          <h2 className="font-bold text-base text-slate-900 flex items-center gap-1.5">
            📍 신규 매장 후보
          </h2>
          <p className="text-[12px] text-slate-700 mt-1.5">
            <span className="font-semibold text-purple-800">{dongLabel}</span>{" "}
            일대
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            ({store.lat.toFixed(5)}, {store.lng.toFixed(5)})
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-3 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-purple-100 text-purple-500 hover:text-purple-700 transition-colors"
          aria-label="가상 매장 닫기"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label className="text-[11px] font-semibold text-slate-600">
          업종
        </label>
        <select
          value={business}
          onChange={(e) => onChangeBusiness(e.target.value)}
          className="text-xs font-medium bg-white border-2 border-purple-300 rounded-md px-2 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-500"
          aria-label="업종 선택"
        >
          {VIRTUAL_BUSINESS_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-slate-500 ml-auto">
          업종 변경 시 SEC 재계산
        </span>
      </div>

      {quadrant && (
        <div
          className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3 py-2 rounded-lg border-2 font-bold text-sm"
          style={{
            background: quadrant.bg,
            borderColor: quadrant.border,
            color: quadrant.color,
          }}
        >
          <span className="flex items-center gap-1">
            <span className="text-base">{quadrant.emoji}</span>
            <span>{quadrant.label}</span>
            {quadrantSubtext(quadrant.quadrant) && (
              <>
                <span className="opacity-40">·</span>
                <span className="text-xs">
                  {quadrantSubtext(quadrant.quadrant)}
                </span>
              </>
            )}
          </span>
          {sec && grade && (
            <span className="flex items-center gap-1">
              <span className="opacity-40">·</span>
              <span className="text-xs font-semibold">
                SEC {Math.round(sec.totalScore)}
              </span>
              <span className="opacity-40">·</span>
              <span
                className="text-xs font-bold"
                style={{ color: grade.color }}
              >
                {grade.label}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface HeaderProps {
  store: Store;
  quadrant: QuadrantInfo | null;
  sec: SECScore | null;
  onClose: () => void;
}

// SEC 점수의 *재출점 적정도* 해석. 헤더 라벨 + 우패널 TOP3와 메시지 일관성.
function secGrade(score: number): { label: string; color: string } {
  if (score < 50) return { label: "재출점 비추천", color: "#DC2626" };
  if (score < 70) return { label: "조건부 검토", color: "#D97706" };
  return { label: "재출점 가능", color: "#059669" };
}

// 4사분면 부속 라벨 — 함정 자리 = 위험, 황금 = 우량 등 *직관적 의미*.
// 청중이 "함정"의 부정성/"황금"의 긍정성을 즉시 인지하게.
function quadrantSubtext(q: Quadrant): string | null {
  switch (q) {
    case "paradox":
    case "danger":
      return "위험";
    case "golden":
      return "우량";
    case "quiet":
      return "정체";
    default:
      return null;
  }
}

function SelectedStoreHeader({ store, quadrant, sec, onClose }: HeaderProps) {
  const grade = sec ? secGrade(sec.totalScore) : null;

  return (
    <div className="p-5 border-b border-slate-200 bg-white">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-base text-slate-900 truncate">
            {store.name}
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">
            {store.address}
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-3 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="선택 해제"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="px-2.5 py-1 bg-red-50 text-red-600 text-xs font-semibold rounded-md border border-red-200">
          폐업
        </span>
        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-md">
          {store.category}
        </span>
        {store.openDate && store.closeDate && (
          <span className="text-[11px] text-slate-500">
            {store.openDate.slice(0, 7)} ~ {store.closeDate.slice(0, 7)}
          </span>
        )}
      </div>

      {/* 4사분면 + SEC + 등급 — 발표 시 첫인상. */}
      {quadrant && (
        <div
          className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3 py-2 rounded-lg border-2 font-bold text-sm"
          style={{
            background: quadrant.bg,
            borderColor: quadrant.border,
            color: quadrant.color,
          }}
        >
          <span className="flex items-center gap-1">
            <span className="text-base">{quadrant.emoji}</span>
            <span>{quadrant.label}</span>
            {quadrantSubtext(quadrant.quadrant) && (
              <>
                <span className="opacity-40">·</span>
                <span className="text-xs">
                  {quadrantSubtext(quadrant.quadrant)}
                </span>
              </>
            )}
          </span>
          {sec && grade && (
            <span className="flex items-center gap-1">
              <span className="opacity-40">·</span>
              <span className="text-xs font-semibold">
                SEC {Math.round(sec.totalScore)}
              </span>
              <span className="opacity-40">·</span>
              <span
                className="text-xs font-bold"
                style={{ color: grade.color }}
              >
                {grade.label}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface StackProps {
  store: Store;
  allStores: Store[];
  foottrafficStats: {
    dailyAvg: number;
    weekdayAvg: number;
    weekendAvg: number;
    gridCount: number;
  };
  diagnosisText: string;
  // 250m 반경 실측 폐업 수 — ScatterCard X축 + 헤더 배지와 일관성 확보.
  nearbyClosedCount: number;
  // SEC 8지표 점수 — MetricGrid 하단 4개(업종/공실/장수/면적) 표시용.
  sec: SECScore | null;
}

// 매장 바뀔 때 부모에서 key={store.id}로 remount → state(step) 자연 reset.
function ProgressiveCardStack({
  store,
  allStores,
  foottrafficStats,
  diagnosisText,
  nearbyClosedCount,
  sec,
}: StackProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      timers.push(setTimeout(() => setStep(i), i * STEP_INTERVAL_MS));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <>
      {step < TOTAL_STEPS && <AnalysisProgress step={step} />}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* 발표 스토리라인: ① AI → ② 시간축 → ③ 산점도 → ④ 8지표 (+ 펼침) */}
        {step >= 1 &&
          (diagnosisText ? (
            <div className="card-reveal">
              <AIConsultantCard text={diagnosisText} storeId={store.id} />
            </div>
          ) : (
            <div className="card-reveal">
              <PlaceholderCard
                icon="🤖"
                title="AI 진단"
                subtitle="데이터 로딩 중..."
              />
            </div>
          ))}

        {step >= 2 && (
          <div className="card-reveal">
            <TimelineCard store={store} />
          </div>
        )}
        {step >= 3 && (
          <div className="card-reveal">
            <ScatterCard
              store={store}
              nearbyClosedCount={nearbyClosedCount}
            />
          </div>
        )}

        {step >= 4 && allStores.length > 0 && (
          <div className="card-reveal">
            <MetricGrid
              store={store}
              allStores={allStores}
              foottrafficStats={foottrafficStats}
              sec={sec}
            />
          </div>
        )}
      </div>
    </>
  );
}

// 분석 시퀀스 진행 표시. step 0..(TOTAL_STEPS-1) 노출, TOTAL_STEPS 도달 시 부모에서 숨김.
function AnalysisProgress({ step }: { step: number }) {
  const label = ANALYSIS_STEPS[step] ?? ANALYSIS_STEPS[TOTAL_STEPS - 1];
  const displayed = Math.min(step + 1, TOTAL_STEPS);
  return (
    <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-blue-500 pulse-dot" />
      <span className="text-xs font-semibold text-blue-900">
        분석 중… {displayed}/{TOTAL_STEPS}
      </span>
      <span className="text-[11px] text-blue-700 truncate">{label}</span>
    </div>
  );
}

function PlaceholderCard({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 p-4 min-h-[100px] flex flex-col items-center justify-center">
      <div className="text-2xl mb-1 opacity-40">{icon}</div>
      <div className="text-sm font-semibold text-slate-400">{title}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">{subtitle}</div>
    </div>
  );
}
