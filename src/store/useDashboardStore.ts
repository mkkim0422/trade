import { create } from "zustand";
import type { Store } from "@/types";
import type { SECScore } from "@/lib/analysis";
import type { GridAggregate } from "@/lib/grid-aggregates";

interface DashboardState {
  selectedStore: Store | null;
  setSelectedStore: (store: Store | null) => void;

  categoryFilter: string | null;
  setCategoryFilter: (category: string | null) => void;
  // 업태 필터 ON/OFF 마스터 스위치 — false면 categoryFilter 무시(전체 매장 표시).
  // TOP3 토글 ON 시 자동 false (발표 시연 우선).
  categoryFilterEnabled: boolean;
  setCategoryFilterEnabled: (enabled: boolean) => void;

  showHeatmap: boolean;
  setShowHeatmap: (show: boolean) => void;

  clusterStores: Store[] | null;
  setClusterStores: (stores: Store[] | null) => void;

  showGoldenPins: boolean;
  setShowGoldenPins: (show: boolean) => void;

  selectedSEC: SECScore | null;
  setSelectedSEC: (sec: SECScore | null) => void;

  showSECComparison: boolean;
  setShowSECComparison: (show: boolean) => void;

  dateFilter: {
    startDate: string | null;
    endDate: string | null;
  };
  setDateFilter: (filter: {
    startDate: string | null;
    endDate: string | null;
  }) => void;

  currentDong: string | null;
  setCurrentDong: (dong: string | null) => void;

  topSECByDong: Record<string, SECScore[]>;
  setTopSECByDong: (data: Record<string, SECScore[]>) => void;

  worstByDong: Record<string, SECScore[]>;
  setWorstByDong: (data: Record<string, SECScore[]>) => void;

  showWorstPins: boolean;
  setShowWorstPins: (show: boolean) => void;

  mapTargetCoord: { lat: number; lng: number; zoom?: number } | null;
  setMapTargetCoord: (
    coord: { lat: number; lng: number; zoom?: number } | null,
  ) => void;

  // ── 묶음 A: 함정 자리 격자 레이어 ───────────────────────────
  showParadoxLayer: boolean;
  setShowParadoxLayer: (show: boolean) => void;
  selectedParadoxGrid: GridAggregate | null;
  setSelectedParadoxGrid: (grid: GridAggregate | null) => void;

  // ── 묶음 B placeholder (값만 잡고 사용은 묶음 B에서) ────────
  // 시간축 슬라이더의 현재 월 (YYYY-MM). null이면 전체 누적.
  timelineMonth: string | null;
  setTimelineMonth: (month: string | null) => void;
  // 8지표 그리드에서 펼쳐진 카드. 디폴트 'lud'.
  expandedMetric: "lud" | "seg" | "trend" | "foot" | null;
  setExpandedMetric: (m: "lud" | "seg" | "trend" | "foot" | null) => void;

  // ── 가상 매장 시뮬레이션 (발표 클라이맥스용) ────────────────
  virtualStoreVisible: boolean;
  setVirtualStoreVisible: (v: boolean) => void;
  virtualStorePosition: { lat: number; lng: number } | null;
  setVirtualStorePosition: (p: { lat: number; lng: number } | null) => void;
  virtualStoreBusiness: string;
  setVirtualStoreBusiness: (b: string) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedStore: null,
  setSelectedStore: (store) => set({ selectedStore: store }),

  categoryFilter: null,
  setCategoryFilter: (category) => set({ categoryFilter: category }),
  categoryFilterEnabled: true,
  setCategoryFilterEnabled: (enabled) =>
    set({ categoryFilterEnabled: enabled }),

  showHeatmap: false,
  setShowHeatmap: (show) => set({ showHeatmap: show }),

  clusterStores: null,
  setClusterStores: (stores) => set({ clusterStores: stores }),

  showGoldenPins: false,
  setShowGoldenPins: (show) => set({ showGoldenPins: show }),

  selectedSEC: null,
  setSelectedSEC: (sec) => set({ selectedSEC: sec }),

  showSECComparison: false,
  setShowSECComparison: (show) => set({ showSECComparison: show }),

  dateFilter: { startDate: null, endDate: null },
  setDateFilter: (filter) => set({ dateFilter: filter }),

  currentDong: null,
  setCurrentDong: (dong) => set({ currentDong: dong }),

  topSECByDong: {},
  setTopSECByDong: (data) => set({ topSECByDong: data }),

  worstByDong: {},
  setWorstByDong: (data) => set({ worstByDong: data }),

  showWorstPins: false,
  setShowWorstPins: (show) => set({ showWorstPins: show }),

  mapTargetCoord: null,
  setMapTargetCoord: (coord) => set({ mapTargetCoord: coord }),

  showParadoxLayer: false,
  setShowParadoxLayer: (show) => set({ showParadoxLayer: show }),
  selectedParadoxGrid: null,
  setSelectedParadoxGrid: (grid) => set({ selectedParadoxGrid: grid }),

  timelineMonth: null,
  setTimelineMonth: (month) => set({ timelineMonth: month }),
  expandedMetric: "lud",
  setExpandedMetric: (m) => set({ expandedMetric: m }),

  virtualStoreVisible: false,
  setVirtualStoreVisible: (v) => set({ virtualStoreVisible: v }),
  virtualStorePosition: null,
  setVirtualStorePosition: (p) => set({ virtualStorePosition: p }),
  virtualStoreBusiness: "한식",
  setVirtualStoreBusiness: (b) => set({ virtualStoreBusiness: b }),
}));
