"use client";

import { useMemo } from "react";
import type { Store } from "@/types";
import { useDashboardStore } from "@/store/useDashboardStore";

interface MapToolbarProps {
  allStores: Store[];
}

export default function MapToolbar({ allStores }: MapToolbarProps) {
  const currentDong = useDashboardStore((state) => state.currentDong);
  const categoryFilter = useDashboardStore((state) => state.categoryFilter);
  const dateFilter = useDashboardStore((state) => state.dateFilter);
  const showHeatmap = useDashboardStore((state) => state.showHeatmap);
  const setShowHeatmap = useDashboardStore((state) => state.setShowHeatmap);
  const showGoldenPins = useDashboardStore((state) => state.showGoldenPins);
  const setShowGoldenPins = useDashboardStore(
    (state) => state.setShowGoldenPins,
  );
  const setSelectedStore = useDashboardStore(
    (state) => state.setSelectedStore,
  );
  const setSelectedSEC = useDashboardStore((state) => state.setSelectedSEC);
  const setShowSECComparison = useDashboardStore(
    (state) => state.setShowSECComparison,
  );
  const topSECByDong = useDashboardStore((state) => state.topSECByDong);

  const dongStores = useMemo(() => {
    return currentDong
      ? allStores.filter((s) => s.dong === currentDong)
      : allStores;
  }, [allStores, currentDong]);

  const filteredStores = useMemo(() => {
    return dongStores.filter((store) => {
      if (categoryFilter && store.category !== categoryFilter) return false;
      if (dateFilter.startDate || dateFilter.endDate) {
        if (!store.closeDate) return false;
        if (dateFilter.startDate && store.closeDate < dateFilter.startDate)
          return false;
        if (dateFilter.endDate && store.closeDate > dateFilter.endDate)
          return false;
      }
      return true;
    });
  }, [dongStores, categoryFilter, dateFilter]);

  const categoryStats = useMemo(() => {
    const countMap = new Map<string, number>();
    filteredStores.forEach((store) => {
      const cat = store.category || "기타";
      countMap.set(cat, (countMap.get(cat) || 0) + 1);
    });
    return Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [filteredStores]);

  const yearlyStats = useMemo(() => {
    const yearMap = new Map<string, number>();
    filteredStores.forEach((store) => {
      if (!store.closeDate) return;
      const year = store.closeDate.substring(0, 4);
      yearMap.set(year, (yearMap.get(year) || 0) + 1);
    });
    return Array.from(yearMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, count]) => ({ year, count }));
  }, [filteredStores]);

  const yearlyMax = Math.max(...yearlyStats.map((y) => y.count), 1);

  const summary = useMemo(() => {
    const durations = filteredStores
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

    const longTerm = durations.filter((d) => d >= 5).length;
    const longTermRate =
      durations.length > 0 ? (longTerm / durations.length) * 100 : 0;

    return {
      total: filteredStores.length,
      avgDuration: avgDuration.toFixed(1),
      longTermRate: longTermRate.toFixed(1),
    };
  }, [filteredStores]);

  const dongTopSEC = currentDong ? topSECByDong[currentDong] || [] : [];

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b">
        <h2 className="text-sm font-bold text-slate-900">
          🗺️ 지도 도구
          {currentDong && (
            <span className="text-blue-600 ml-2 font-medium">
              ({currentDong})
            </span>
          )}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {currentDong
            ? `${currentDong} 통계 · ${filteredStores.length.toLocaleString()}개 매장`
            : `강남구 전체 · ${filteredStores.length.toLocaleString()}개 매장`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-slate-50 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-3">
            업태별 분포 (TOP 5)
          </h3>
          <div className="space-y-2">
            {categoryStats.length === 0 && (
              <p className="text-xs text-slate-400">데이터 없음</p>
            )}
            {categoryStats.map(({ name, count }) => {
              const percentage =
                filteredStores.length > 0
                  ? (count / filteredStores.length) * 100
                  : 0;
              return (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{name}</span>
                    <span className="font-medium text-slate-900">
                      {count}개 ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-3">
            연도별 폐업 추이
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {yearlyStats.length === 0 && (
              <p className="text-xs text-slate-400">데이터 없음</p>
            )}
            {yearlyStats.map(({ year, count }) => {
              const percentage = (count / yearlyMax) * 100;
              return (
                <div key={year}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{year}년</span>
                    <span className="font-medium text-slate-900">
                      {count}개
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5">
                    <div
                      className="bg-red-400 h-1.5 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-3">
            전체 통계
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">총 폐업 매장</span>
              <span className="font-medium text-slate-900">
                {summary.total.toLocaleString()}개
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">평균 영업 기간</span>
              <span className="font-medium text-slate-900">
                {summary.avgDuration}년
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">5년 이상 비율</span>
              <span className="font-medium text-green-600">
                {summary.longTermRate}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-700">
              히트맵 레이어
            </h3>
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showHeatmap ? "bg-blue-600" : "bg-slate-300"
              }`}
              aria-label="히트맵 토글"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showHeatmap ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-slate-500">
            폐업 매장 밀집도를 색상으로 표시합니다
          </p>
        </div>

        {currentDong && dongTopSEC.length > 0 && (
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg border-2 border-yellow-300 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-yellow-900">
                🏆 {currentDong} 최적 입지 TOP 3
              </h3>
              <button
                onClick={() => {
                  const next = !showGoldenPins;
                  console.log(
                    `🏆 SEC 토글: ${next}, 현재 동: ${currentDong}`,
                  );
                  setShowGoldenPins(next);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showGoldenPins ? "bg-yellow-600" : "bg-slate-300"
                }`}
                aria-label="황금 핀 토글"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showGoldenPins ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {showGoldenPins && (
              <>
                <button
                  onClick={() => setShowSECComparison(true)}
                  className="w-full mb-3 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
                >
                  📊 TOP 3 비교 분석
                </button>

                <div className="space-y-2">
                  {dongTopSEC.map((sec, index) => (
                    <button
                      key={sec.storeId}
                      onClick={() => {
                        setSelectedSEC(sec);
                        setSelectedStore(null);
                      }}
                      className="w-full text-left p-3 bg-white rounded-lg border-2 border-yellow-200 hover:border-yellow-400 transition-all"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0
                              ? "bg-yellow-500 text-white"
                              : index === 1
                                ? "bg-slate-400 text-white"
                                : "bg-orange-400 text-white"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <span className="font-semibold text-sm text-slate-900 truncate">
                          {sec.storeName}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        점수: {sec.totalScore} / 100
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {currentDong && dongTopSEC.length === 0 && (
          <div className="bg-slate-50 rounded-lg border border-dashed border-slate-300 p-3">
            <p className="text-xs text-slate-500 text-center">
              {currentDong} SEC 분석 진행 중…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
