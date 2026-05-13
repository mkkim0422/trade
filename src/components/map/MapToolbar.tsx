"use client";

import { useMemo } from "react";
import type { Store } from "@/types";
import { useDashboardStore } from "@/store/useDashboardStore";

interface MapToolbarProps {
  allStores: Store[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function MapToolbar({
  allStores,
  collapsed,
  onToggleCollapsed,
}: MapToolbarProps) {
  const currentDong = useDashboardStore((state) => state.currentDong);
  const categoryFilter = useDashboardStore((state) => state.categoryFilter);
  const dateFilter = useDashboardStore((state) => state.dateFilter);
  const showHeatmap = useDashboardStore((state) => state.showHeatmap);
  const setShowHeatmap = useDashboardStore((state) => state.setShowHeatmap);

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

  return (
    <div className="h-full flex flex-col bg-white">
      <div className={collapsed ? "p-2 border-b" : "p-4 border-b"}>
        {collapsed ? (
          <button
            onClick={onToggleCollapsed}
            className="w-full flex flex-col items-center gap-1 py-2 text-slate-600 hover:bg-slate-50 rounded"
            aria-label="펼치기"
            title="지도 도구 펼치기"
          >
            <span className="text-base">🗺️</span>
            <span className="text-[10px]">◀</span>
          </button>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
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
            <button
              onClick={onToggleCollapsed}
              className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 flex-shrink-0"
              aria-label="접기"
              title="접기"
            >
              <span className="text-sm">▶</span>
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 데이터 부족 동 경고 — LOCALDATA 주소 파싱 한계로 일부 행정동에 매장이 적음. */}
        {currentDong && filteredStores.length < 10 && (
          <div className="rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-600 p-3">
            <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              ⚠️ 이 동은 분석 데이터 부족
            </div>
            <div className="text-[11px] text-amber-800 dark:text-amber-300 mt-1.5 leading-snug">
              {currentDong} 폐업 매장 {filteredStores.length}개로 통계 신뢰도가
              낮습니다. (LOCALDATA 주소 파싱 한계)
            </div>
            <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5">
              <span className="font-semibold">분석 권장 동:</span> 역삼1동
              (1,137) · 논현1동 (684) · 신사동 (609) · 삼성1동 (585) · 대치1동
              (310) · 청담동 (245)
            </div>
          </div>
        )}

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

      </div>
      )}
    </div>
  );
}
