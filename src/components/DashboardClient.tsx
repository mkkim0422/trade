"use client";

import { useCallback, useEffect, useState } from "react";
import type { Store } from "@/types";
import MapView from "./map/MapView";
import LeftPanel from "./panels/LeftPanel";
import MapToolbar from "./map/MapToolbar";
import IntroOverlay from "./intro/IntroOverlay";
import VerificationModal from "./verify/VerificationModal";
import FooterStats from "./layout/FooterStats";
import AddressSearchBox from "./layout/AddressSearchBox";
import { useTheme } from "@/lib/theme";
import { useDashboardStore } from "@/store/useDashboardStore";
import { loadDongSEC } from "@/lib/dong-sec";
import {
  DEMO_TRAP_COORD,
  DEMO_GOLDEN_COORD,
  DEFAULT_BUSINESS,
} from "@/lib/virtual-store";

// 인트로 종료 후 카메라가 역삼1동으로 고정되도록 좌표 dispatch.
// 데이터 풍부한 동(1,137개)이라 발표 시연 안전 — 빈 동(대치2동 1개 등) 회피.
// MapView가 이미 INITIAL_CENTER로 마운트되지만, 발표 중 패닝 후 인트로 재진입해도
// 명시적으로 다시 잡아주도록 store에 dispatch.
const YEOKSAM_1_DONG = {
  name: "역삼1동",
  lat: 37.5007,
  lng: 127.0368,
  zoom: 5,
};

export default function DashboardClient() {
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [verifyOpen, setVerifyOpen] = useState(false);
  // 우패널 접기 — collapsed 시 aside 폭 축소(흰 배경 제거).
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();
  const setTopSECByDong = useDashboardStore((state) => state.setTopSECByDong);
  const setWorstByDong = useDashboardStore((state) => state.setWorstByDong);
  const setCurrentDong = useDashboardStore((state) => state.setCurrentDong);
  const setMapTargetCoord = useDashboardStore(
    (state) => state.setMapTargetCoord,
  );
  const selectedStore = useDashboardStore((state) => state.selectedStore);
  const selectedSEC = useDashboardStore((state) => state.selectedSEC);
  const showSECComparison = useDashboardStore(
    (state) => state.showSECComparison,
  );
  const clusterStores = useDashboardStore((state) => state.clusterStores);
  const virtualStoreVisible = useDashboardStore((s) => s.virtualStoreVisible);
  const virtualStorePosition = useDashboardStore((s) => s.virtualStorePosition);
  const setVirtualStoreVisible = useDashboardStore(
    (s) => s.setVirtualStoreVisible,
  );
  const setVirtualStorePosition = useDashboardStore(
    (s) => s.setVirtualStorePosition,
  );
  const setVirtualStoreBusiness = useDashboardStore(
    (s) => s.setVirtualStoreBusiness,
  );
  const setSelectedStore = useDashboardStore((s) => s.setSelectedStore);
  const setSelectedSEC = useDashboardStore((s) => s.setSelectedSEC);
  const virtualPanelActive = virtualStoreVisible && !!virtualStorePosition;
  const showLeftPanel =
    !!(selectedStore || selectedSEC || showSECComparison || clusterStores) ||
    virtualPanelActive;

  // 발표 단축 버튼: 사전 정의 좌표에 가상 핀 즉시 배치 + 지도 이동.
  // 함정/황금 둘 다 강남구 안, 실 격자/유동 데이터로 검증된 자리.
  const placeVirtual = useCallback(
    (coord: { lat: number; lng: number }) => {
      setSelectedStore(null);
      setSelectedSEC(null);
      setVirtualStoreBusiness(DEFAULT_BUSINESS);
      setVirtualStoreVisible(true);
      setVirtualStorePosition(coord);
      setMapTargetCoord({ lat: coord.lat, lng: coord.lng, zoom: 4 });
    },
    [
      setSelectedStore,
      setSelectedSEC,
      setVirtualStoreBusiness,
      setVirtualStoreVisible,
      setVirtualStorePosition,
      setMapTargetCoord,
    ],
  );

  const toggleVirtualMode = useCallback(() => {
    const next = !virtualStoreVisible;
    setVirtualStoreVisible(next);
    if (!next) {
      // OFF 시 핀도 함께 제거.
      setVirtualStorePosition(null);
    }
  }, [virtualStoreVisible, setVirtualStoreVisible, setVirtualStorePosition]);

  // 인트로 종료 + 초기 데이터 로드 완료 시 동시에 발동. 카메라 = 역삼1동 강제 고정.
  // 발표 시연 안전: 매장 1,137개로 데이터 풍부. setMapTargetCoord는 MapView가 watch.
  const focusYeoksam = useCallback(() => {
    // Phase 3에서 사용자가 이미 주소/예시를 선택한 경우 그 좌표 유지.
    // virtualStorePosition은 IntroPhase3.placeAndFinish가 미리 dispatch한 값.
    if (useDashboardStore.getState().virtualStorePosition) {
      console.log("Phase 3 사용자 좌표 유지 — focusYeoksam 스킵");
      return;
    }
    setCurrentDong(YEOKSAM_1_DONG.name);
    setMapTargetCoord({
      lat: YEOKSAM_1_DONG.lat,
      lng: YEOKSAM_1_DONG.lng,
      zoom: YEOKSAM_1_DONG.zoom,
    });
  }, [setCurrentDong, setMapTargetCoord]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // 매장 데이터 + 사전계산된 동별 SEC를 병렬 fetch. 런타임 SEC 계산 제거 (5-10초 → 0.3초).
        setLoadingProgress(20);
        const [storesRes, dongSec] = await Promise.all([
          fetch("/data/stores-recent.json"),
          loadDongSEC(),
        ]);
        setLoadingProgress(70);

        const data: Store[] = await storesRes.json();
        setAllStores(data);

        const topByDong: Record<string, typeof dongSec[string]["top3"]> = {};
        const worstByDong: Record<string, typeof dongSec[string]["bottom3"]> = {};
        for (const [dong, entry] of Object.entries(dongSec)) {
          topByDong[dong] = entry.top3;
          worstByDong[dong] = entry.bottom3;
        }
        setTopSECByDong(topByDong);
        setWorstByDong(worstByDong);

        setLoadingProgress(100);
        console.log(
          `✅ 동별 SEC 사전계산 로드: ${Object.keys(dongSec).length}개 동 (런타임 계산 0)`,
        );
        // 데이터 로드 완료 직후 역삼1동 카메라 강제 (?intro=skip / localStorage seen 경로 대응).
        focusYeoksam();
        setTimeout(() => setIsLoading(false), 150);
      } catch (err) {
        console.error("데이터 로드 실패:", err);
        setIsLoading(false);
      }
    };

    loadData();
  }, [setTopSECByDong, setWorstByDong, focusYeoksam]);

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
            {loadingProgress < 70 && "📦 사전계산 데이터 로드 중..."}
            {loadingProgress >= 70 && "✅ 준비 완료"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <IntroOverlay onComplete={focusYeoksam} />
      {verifyOpen && (
        <VerificationModal
          onClose={() => setVerifyOpen(false)}
          allStores={allStores}
        />
      )}
      <header className="h-16 bg-white border-b border-slate-200 shadow-sm">
        <div className="h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">GIS</span>
            </div>
            <div className="flex-shrink-0">
              <h1 className="text-sm font-bold text-slate-900 leading-tight whitespace-nowrap">
                신규출점 2차 검증 도구
              </h1>
              <p className="text-[10px] text-slate-500 leading-tight whitespace-nowrap">
                주소 입력 → 자동 분석
              </p>
            </div>
            <AddressSearchBox />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
              aria-label={theme === "dark" ? "라이트모드로" : "다크모드로"}
              title={theme === "dark" ? "라이트모드로" : "다크모드로"}
            >
              <span className="text-sm">{theme === "dark" ? "☀️" : "🌙"}</span>
            </button>
            <button
              onClick={() => setVerifyOpen(true)}
              className="px-2.5 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-semibold rounded-lg border border-purple-300 transition-colors flex items-center gap-1 whitespace-nowrap"
            >
              🔍 검증
            </button>
            {/* 발표 클라이맥스 — 가상 매장 시뮬레이션 단축 컨트롤. */}
            <button
              onClick={toggleVirtualMode}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1 whitespace-nowrap ${
                virtualStoreVisible
                  ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-700 shadow-sm"
                  : "bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-300"
              }`}
              title="지도 클릭으로 가상 매장 배치"
            >
              📍 가상 매장
            </button>
            {/* 예시 버튼은 가상 매장 모드일 때만 노출 — 헤더 한 줄 유지. */}
            {virtualStoreVisible && (
              <>
                <button
                  onClick={() => placeVirtual(DEMO_TRAP_COORD)}
                  className="px-2 py-1.5 text-xs font-semibold rounded-lg border border-purple-300 bg-white hover:bg-purple-50 text-purple-800 transition-colors whitespace-nowrap"
                  title="역삼동 한복판 · 함정 자리 · 250m 폐업 120건 · SEC ≈ 68"
                >
                  함정 예시
                </button>
                <button
                  onClick={() => placeVirtual(DEMO_GOLDEN_COORD)}
                  className="px-2 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 bg-white hover:bg-amber-50 text-amber-800 transition-colors whitespace-nowrap"
                  title="청담 명품거리 · 황금 자리 · 250m 폐업 19건 · SEC ≈ 74"
                >
                  황금 예시
                </button>
              </>
            )}
            <span
              className="text-[10px] text-slate-500 whitespace-nowrap"
              title="LOCALDATA 2023.05 ~ 2026.04"
            >
              최근 3년
            </span>
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
          {toolbarCollapsed && (
            <button
              onClick={() => setToolbarCollapsed(false)}
              className="absolute top-4 right-4 z-30 px-3 h-10 bg-white rounded-lg shadow-md border border-slate-200 flex items-center gap-1.5 text-slate-700 hover:bg-slate-50 transition-colors"
              title="지도 도구 펼치기"
              aria-label="지도 도구 펼치기"
            >
              <span className="text-base leading-none">🗺️</span>
              <span className="text-xs font-medium">◀</span>
            </button>
          )}
        </section>

        {!toolbarCollapsed && (
          <aside className="w-[340px] bg-white border-l border-slate-200 shadow-sm flex-shrink-0">
            <MapToolbar
              allStores={allStores}
              collapsed={false}
              onToggleCollapsed={() => setToolbarCollapsed(true)}
            />
          </aside>
        )}
      </main>

      <footer className="h-10 bg-white border-t border-slate-200">
        <div className="h-full px-6 flex items-center justify-between text-xs">
          <FooterStats totalStores={allStores.length} />
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
