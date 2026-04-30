"use client";

import { useEffect, useMemo, useState } from "react";
import { useDashboardStore } from "@/store/useDashboardStore";
import ClusterStoreList from "./ClusterStoreList";
import LUDCard from "@/components/cards/LUDCard";
import SEGCard from "@/components/cards/SEGCard";
import TrendCard from "@/components/cards/TrendCard";
import FootTrafficCard from "@/components/cards/FootTrafficCard";
import NarrativeCard from "@/components/cards/NarrativeCard";
import SECDetailCard from "@/components/cards/SECDetailCard";
import SECComparisonView from "@/components/cards/SECComparisonView";
import {
  loadFootTraffic,
  getFootTrafficNearby,
  type FootTrafficData,
} from "@/lib/foottraffic";
import type { Store } from "@/types";

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
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [foottrafficData, setFoottrafficData] = useState<FootTrafficData[]>([]);

  const topSEC = currentDong ? topSECByDong[currentDong] || [] : [];

  useEffect(() => {
    fetch("/data/stores.json")
      .then((res) => res.json())
      .then((data: Store[]) => {
        setAllStores(data);
      })
      .catch((err) => console.error("전체 매장 로드 실패:", err));
  }, []);

  useEffect(() => {
    loadFootTraffic()
      .then((data) => setFoottrafficData(data))
      .catch((err) => console.error("유동인구 로드 실패:", err));
  }, []);

  const foottrafficStats = useMemo(() => {
    if (!selectedStore || foottrafficData.length === 0) {
      return { dailyAvg: 0, weekdayAvg: 0, weekendAvg: 0, gridCount: 0 };
    }
    return getFootTrafficNearby(
      selectedStore.lat,
      selectedStore.lng,
      250,
      foottrafficData,
    );
  }, [selectedStore, foottrafficData]);

  return (
    <div className="flex flex-col h-full relative">
      {clusterStores && <ClusterStoreList />}

      {showSECComparison && <SECComparisonView topSEC={topSEC} />}

      {selectedSEC && !selectedStore && !showSECComparison && (
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

      {!selectedStore &&
        !selectedSEC &&
        !showSECComparison &&
        !clusterStores && <div className="flex-1" />}

      {selectedStore && !showSECComparison && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-white">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-base text-slate-900 truncate">
                  {selectedStore.name}
                </h2>
                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">
                  {selectedStore.address}
                </p>
              </div>
              <button
                onClick={() => setSelectedStore(null)}
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

            <div className="mt-4 flex items-center gap-2">
              <span className="px-2.5 py-1 bg-red-50 text-red-600 text-xs font-semibold rounded-md border border-red-200">
                폐업
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-md">
                {selectedStore.category}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                기본 정보
              </h3>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">개업일</span>
                  <span className="text-slate-900 font-medium">
                    {selectedStore.openDate || "정보 없음"}
                  </span>
                </div>

                <div className="h-px bg-slate-100"></div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">폐업일</span>
                  <span className="text-red-600 font-semibold">
                    {selectedStore.closeDate}
                  </span>
                </div>

                <div className="h-px bg-slate-100"></div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">영업 기간</span>
                  <span className="text-slate-900 font-medium">
                    {calculateDuration(
                      selectedStore.openDate,
                      selectedStore.closeDate,
                    )}
                  </span>
                </div>

                <div className="h-px bg-slate-100"></div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">면적</span>
                  <span className="text-slate-900 font-medium">
                    {selectedStore.area > 0
                      ? `${selectedStore.area.toFixed(1)}㎡`
                      : "정보 없음"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {allStores.length > 0 && (
                <>
                  <LUDCard store={selectedStore} allStores={allStores} />
                  <SEGCard store={selectedStore} allStores={allStores} />
                  <TrendCard store={selectedStore} allStores={allStores} />
                  {foottrafficStats.gridCount > 0 ? (
                    <FootTrafficCard
                      dailyAvg={foottrafficStats.dailyAvg}
                      weekdayAvg={foottrafficStats.weekdayAvg}
                      weekendAvg={foottrafficStats.weekendAvg}
                    />
                  ) : (
                    <div className="bg-slate-50 rounded-xl border-2 border-slate-200 p-5 text-center">
                      <p className="text-sm text-slate-500">
                        주변 250m 유동인구 데이터 없음
                      </p>
                    </div>
                  )}
                  <NarrativeCard store={selectedStore} allStores={allStores} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function calculateDuration(openDate: string, closeDate?: string): string {
  if (!openDate || !closeDate) return "정보 없음";

  try {
    const start = new Date(openDate);
    const end = new Date(closeDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);

    if (years > 0) {
      return `${years}년 ${months}개월`;
    } else if (months > 0) {
      return `${months}개월`;
    } else {
      return `${diffDays}일`;
    }
  } catch {
    return "정보 없음";
  }
}
