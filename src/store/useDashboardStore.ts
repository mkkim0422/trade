import { create } from "zustand";
import type { Store } from "@/types";
import type { SECScore } from "@/lib/analysis";

interface DashboardState {
  selectedStore: Store | null;
  setSelectedStore: (store: Store | null) => void;

  categoryFilter: string | null;
  setCategoryFilter: (category: string | null) => void;

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
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedStore: null,
  setSelectedStore: (store) => set({ selectedStore: store }),

  categoryFilter: null,
  setCategoryFilter: (category) => set({ categoryFilter: category }),

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
}));
