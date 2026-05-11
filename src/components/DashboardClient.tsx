"use client";

import { useEffect, useState } from "react";
import type { Store } from "@/types";
import MapView from "./map/MapView";
import LeftPanel from "./panels/LeftPanel";
import MapToolbar from "./map/MapToolbar";
import { useDashboardStore } from "@/store/useDashboardStore";
import {
  calculateSECScoresWithFootTraffic,
  type SECScore,
} from "@/lib/analysis";
import { loadFootTraffic } from "@/lib/foottraffic";

const SEC_PER_DONG_LIMIT = 1000;

export default function DashboardClient() {
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const setTopSECByDong = useDashboardStore((state) => state.setTopSECByDong);
  const setWorstByDong = useDashboardStore((state) => state.setWorstByDong);
  const selectedStore = useDashboardStore((state) => state.selectedStore);
  const selectedSEC = useDashboardStore((state) => state.selectedSEC);
  const showSECComparison = useDashboardStore(
    (state) => state.showSECComparison,
  );
  const clusterStores = useDashboardStore((state) => state.clusterStores);
  const showLeftPanel =
    !!(selectedStore || selectedSEC || showSECComparison || clusterStores);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingProgress(10);

        const [storesRes, foottrafficData] = await Promise.all([
          fetch("/data/stores.json"),
          loadFootTraffic(),
        ]);
        setLoadingProgress(40);

        const data: Store[] = await storesRes.json();
        setLoadingProgress(60);

        setAllStores(data);
        setLoadingProgress(70);

        const byDong: Record<string, Store[]> = {};
        data.forEach((store) => {
          const dong = store.dong || "알 수 없음";
          if (!byDong[dong]) byDong[dong] = [];
          byDong[dong].push(store);
        });

        const dongEntries = Object.entries(byDong);
        const topByDong: Record<string, SECScore[]> = {};
        const worstByDong: Record<string, SECScore[]> = {};
        let i = 0;

        const processNextDong = () => {
          if (i >= dongEntries.length) {
            setTopSECByDong(topByDong);
            setWorstByDong(worstByDong);
            setLoadingProgress(100);
            console.log(
              `✅ 동별 SEC 계산 완료 (최적 + 최악): ${dongEntries.length}개 동`,
            );
            setTimeout(() => setIsLoading(false), 250);
            return;
          }
          const [dong, stores] = dongEntries[i];
          const limited = stores.slice(0, SEC_PER_DONG_LIMIT);
          const result = calculateSECScoresWithFootTraffic(
            limited,
            foottrafficData,
            250,
            dong,
          );
          topByDong[dong] = result.top3;
          worstByDong[dong] = result.bottom3;
          i++;
          setLoadingProgress(
            70 + Math.round((i / dongEntries.length) * 28),
          );
          setTimeout(processNextDong, 0);
        };

        setTimeout(processNextDong, 0);
      } catch (err) {
        console.error("데이터 로드 실패:", err);
        setIsLoading(false);
      }
    };

    loadData();
  }, [setTopSECByDong, setWorstByDong]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-white font-bold text-2xl">GIS</span>
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-2">
            폐업점포 기준 신규출점 분석
          </h2>
          <p className="text-sm text-slate-500 mb-8">
            데이터를 불러오는 중입니다...
          </p>

          <div className="w-80 mx-auto">
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {loadingProgress}% 완료
            </p>
          </div>

          <div className="mt-6 text-xs text-slate-600">
            {loadingProgress < 30 && "📦 데이터 파일 로딩..."}
            {loadingProgress >= 30 && loadingProgress < 50 && "🔄 데이터 파싱..."}
            {loadingProgress >= 50 &&
              loadingProgress < 70 &&
              "📊 매장 데이터 준비..."}
            {loadingProgress >= 70 &&
              loadingProgress < 90 &&
              "🏆 동별 최적 입지 분석..."}
            {loadingProgress >= 90 && "✅ 완료!"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="h-16 bg-white border-b border-slate-200 shadow-sm">
        <div className="h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">GIS</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                폐업점포 기준 신규출점 분석
              </h1>
              <p className="text-xs text-slate-500">
                Strategic Entry Analysis System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-slate-100 rounded-lg">
              <span className="text-xs font-medium text-slate-600">
                DATA: 2024.10
              </span>
            </div>
            <div className="px-3 py-1.5 bg-blue-50 rounded-lg">
              <span className="text-xs font-medium text-blue-700">
                MVP v1.0
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {showLeftPanel && (
          <aside className="w-[380px] bg-white border-r border-slate-200 shadow-sm overflow-y-auto flex-shrink-0">
            <LeftPanel />
          </aside>
        )}

        <section className="flex-1 bg-slate-100 relative">
          <MapView />
        </section>

        <aside className="w-[340px] bg-white border-l border-slate-200 shadow-sm flex-shrink-0">
          <MapToolbar allStores={allStores} />
        </aside>
      </main>

      <footer className="h-10 bg-white border-t border-slate-200">
        <div className="h-full px-6 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-slate-500">
            <span>© 2026 Strategic Entry Analysis</span>
            <span className="w-px h-3 bg-slate-300"></span>
            <span>데이터 출처: LOCALDATA</span>
            <span className="w-px h-3 bg-slate-300"></span>
            <span>총 {allStores.length.toLocaleString()}개소 분석 (강남구)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
              실데이터 (LOCALDATA 폐업일자)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
