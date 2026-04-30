"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardStore } from "@/store/useDashboardStore";
import { detectDong } from "@/lib/gangnam-dongs";
import { getDistance } from "@/lib/constants";
import { createMarkerHTML, getMarkerDesign } from "@/lib/marker-design";
import DateFilterBar from "@/components/panels/DateFilterBar";
import FilterBar from "@/components/panels/FilterBar";
import type { Store } from "@/types";

const INITIAL_CENTER = { lat: 37.5007, lng: 127.0368 };
const INITIAL_DONG = "역삼1동";
const DEFAULT_ZOOM = 3;
const NEAREST_MARKER_COUNT = 100;
const HEATMAP_LIMIT = 500;
const CENTER_EPSILON = 1e-4;

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [mapCenter, setMapCenter] = useState(INITIAL_CENTER);
  const [markerVersion, setMarkerVersion] = useState(0);

  const setSelectedStore = useDashboardStore((state) => state.setSelectedStore);
  const setClusterStores = useDashboardStore((state) => state.setClusterStores);
  const setSelectedSEC = useDashboardStore((state) => state.setSelectedSEC);
  const selectedStore = useDashboardStore((state) => state.selectedStore);
  const categoryFilter = useDashboardStore((state) => state.categoryFilter);
  const showHeatmap = useDashboardStore((state) => state.showHeatmap);
  const dateFilter = useDashboardStore((state) => state.dateFilter);
  const currentDong = useDashboardStore((state) => state.currentDong);
  const setCurrentDong = useDashboardStore((state) => state.setCurrentDong);
  const showGoldenPins = useDashboardStore((state) => state.showGoldenPins);
  const topSECByDong = useDashboardStore((state) => state.topSECByDong);
  const heatmapRef = useRef<any[]>([]);
  const goldenPinsRef = useRef<any[]>([]);
  const markerNodesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const markerStoreMapRef = useRef<Map<string, Store>>(new Map());
  const prevSelectedIdRef = useRef<string | null>(null);
  const lastCenterRef = useRef<{ lat: number; lng: number }>(INITIAL_CENTER);
  const lastZoomRef = useRef<number>(DEFAULT_ZOOM);
  const nearbyStoresRef = useRef<Store[]>([]);
  const overlayMapRef = useRef<Map<string, any>>(new Map());
  const currentDongRef = useRef<string | null>(null);
  const topSECByDongRef = useRef<Record<string, any>>({});
  currentDongRef.current = currentDong;
  topSECByDongRef.current = topSECByDong;

  const filteredStores = useMemo(() => {
    return stores.filter((s) => {
      if (categoryFilter && s.category !== categoryFilter) return false;
      if (dateFilter.startDate || dateFilter.endDate) {
        if (!s.closeDate) return false;
        if (dateFilter.startDate && s.closeDate < dateFilter.startDate)
          return false;
        if (dateFilter.endDate && s.closeDate > dateFilter.endDate)
          return false;
      }
      return true;
    });
  }, [stores, categoryFilter, dateFilter]);

  const dongFilteredStores = useMemo(() => {
    if (!currentDong) return filteredStores;
    return filteredStores.filter((s) => s.dong === currentDong);
  }, [currentDong, filteredStores]);

  const nearbyDisplayStores = useMemo(() => {
    const pool = currentDong ? dongFilteredStores : filteredStores;
    if (pool.length <= NEAREST_MARKER_COUNT) {
      console.log(
        `📍 중심(${mapCenter.lat.toFixed(4)}, ${mapCenter.lng.toFixed(4)})에서 가까운 ${pool.length}개`,
      );
      return pool;
    }
    const withDistance = pool.map((store) => ({
      store,
      distance: getDistance(mapCenter.lat, mapCenter.lng, store.lat, store.lng),
    }));
    withDistance.sort((a, b) => a.distance - b.distance);
    const nearest = withDistance
      .slice(0, NEAREST_MARKER_COUNT)
      .map((item) => item.store);
    console.log(
      `📍 중심(${mapCenter.lat.toFixed(4)}, ${mapCenter.lng.toFixed(4)})에서 가까운 ${nearest.length}개`,
    );
    return nearest;
  }, [currentDong, dongFilteredStores, filteredStores, mapCenter]);

  const heatmapStores = useMemo(() => {
    return currentDong
      ? dongFilteredStores
      : filteredStores.slice(0, HEATMAP_LIMIT);
  }, [currentDong, dongFilteredStores, filteredStores]);

  nearbyStoresRef.current = nearbyDisplayStores;

  useEffect(() => {
    setMarkerVersion((v) => v + 1);
  }, [filteredStores, currentDong, mapCenter]);

  const dongCount = dongFilteredStores.length;

  useEffect(() => {
    fetch("/data/stores.json")
      .then((res) => {
        if (!res.ok) throw new Error("stores.json 로드 실패");
        return res.json();
      })
      .then((data: Store[]) => {
        setStores(data);
        console.log(`📍 매장 데이터 로드: ${data.length}개`);
      })
      .catch((err) => {
        console.error("매장 데이터 로드 실패:", err);
      });
  }, []);

  useEffect(() => {
    const loadKakaoScript = () => {
      return new Promise<boolean>((resolve, reject) => {
        if (window.kakao && window.kakao.maps) {
          resolve(true);
          return;
        }

        const script = document.createElement("script");
        script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_API_KEY}&libraries=services,clusterer,drawing&autoload=false`;
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error("카카오 SDK 로드 실패"));
        document.head.appendChild(script);
      });
    };

    const initMap = async () => {
      try {
        await loadKakaoScript();

        if (!mapRef.current) return;

        window.kakao.maps.load(() => {
          const container = mapRef.current;
          if (!container) return;

          const options = {
            center: new window.kakao.maps.LatLng(
              INITIAL_CENTER.lat,
              INITIAL_CENTER.lng,
            ),
            level: DEFAULT_ZOOM,
          };

          mapInstanceRef.current = new window.kakao.maps.Map(container, options);
          setIsLoading(false);
          setCurrentDong(INITIAL_DONG);
          console.log(
            `✅ 카카오 지도 마운트 성공 · 초기 동: ${INITIAL_DONG}`,
          );
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "지도 로드 실패");
        setIsLoading(false);
        console.error("❌ 지도 로드 실패:", err);
      }
    };

    initMap();
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || stores.length === 0 || isLoading) {
      return;
    }

    if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) {
      console.warn("⚠️ 카카오 SDK가 아직 준비되지 않음");
      return;
    }

    const storesToShow = nearbyStoresRef.current;
    const map = mapInstanceRef.current;
    const newIds = new Set(storesToShow.map((s) => s.id));
    let removed = 0;
    let added = 0;

    overlayMapRef.current.forEach((overlay, id) => {
      if (!newIds.has(id)) {
        overlay.setMap(null);
        overlayMapRef.current.delete(id);
        markerNodesRef.current.delete(id);
        markerStoreMapRef.current.delete(id);
        if (prevSelectedIdRef.current === id) {
          prevSelectedIdRef.current = null;
        }
        removed++;
      }
    });

    storesToShow.forEach((store) => {
      if (overlayMapRef.current.has(store.id)) return;

      const position = new window.kakao.maps.LatLng(store.lat, store.lng);
      const isSelected = prevSelectedIdRef.current === store.id;
      const node = document.createElement("div");
      node.innerHTML = createMarkerHTML(store.category, isSelected);

      const design = getMarkerDesign(store.category);
      const baseFilter = `drop-shadow(0 4px 8px ${design.shadowColor})`;
      const hoverFilter = `drop-shadow(0 6px 12px ${design.shadowColor})`;

      node.addEventListener("mouseenter", () => {
        const inner = node.querySelector(
          ".pinterest-marker",
        ) as HTMLElement | null;
        if (!inner) return;
        inner.style.transform = "scale(1.15) translateY(-3px)";
        inner.style.filter = hoverFilter;
      });
      node.addEventListener("mouseleave", () => {
        const inner = node.querySelector(
          ".pinterest-marker",
        ) as HTMLElement | null;
        if (!inner) return;
        inner.style.transform = "scale(1) translateY(0)";
        inner.style.filter = baseFilter;
      });
      node.addEventListener("click", () => {
        setSelectedStore(store);
        setClusterStores(null);
        setSelectedSEC(null);
        map.setCenter(position);
        if (map.getLevel() > 3) map.setLevel(3);
      });

      markerNodesRef.current.set(store.id, node);
      markerStoreMapRef.current.set(store.id, store);

      const overlay = new window.kakao.maps.CustomOverlay({
        position,
        content: node,
        yAnchor: 1,
      });
      overlay.setMap(map);
      overlayMapRef.current.set(store.id, overlay);
      added++;
    });

    markersRef.current = Array.from(overlayMapRef.current.values());

    console.log(
      `📍 마커 차분 업데이트: 유지 ${overlayMapRef.current.size - added}, 추가 ${added}, 제거 ${removed}`,
    );
  }, [
    markerVersion,
    isLoading,
    setSelectedStore,
    setClusterStores,
    setSelectedSEC,
  ]);

  useEffect(() => {
    return () => {
      overlayMapRef.current.forEach((overlay) => overlay.setMap(null));
      overlayMapRef.current.clear();
      markerNodesRef.current.clear();
      markerStoreMapRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const newId = selectedStore?.id ?? null;
    const prevId = prevSelectedIdRef.current;
    if (prevId === newId) return;

    if (prevId) {
      const node = markerNodesRef.current.get(prevId);
      const store = markerStoreMapRef.current.get(prevId);
      if (node && store) {
        node.innerHTML = createMarkerHTML(store.category, false);
      }
    }
    if (newId) {
      const node = markerNodesRef.current.get(newId);
      const store = markerStoreMapRef.current.get(newId);
      if (node && store) {
        node.innerHTML = createMarkerHTML(store.category, true);
      }
    }
    prevSelectedIdRef.current = newId;
  }, [selectedStore]);

  useEffect(() => {
    if (heatmapRef.current.length > 0) {
      heatmapRef.current.forEach((circle) => circle.setMap(null));
      heatmapRef.current = [];
    }

    if (!mapInstanceRef.current || !showHeatmap || isLoading) return;
    if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) {
      return;
    }

    console.log(
      `🔥 히트맵 데이터: ${heatmapStores.length}개 (${currentDong || "전체"})`,
    );

    const circles = heatmapStores.map((store: Store) => {
      const circle = new window.kakao.maps.Circle({
        center: new window.kakao.maps.LatLng(store.lat, store.lng),
        radius: 100,
        strokeWeight: 0,
        fillColor: "#FF0000",
        fillOpacity: 0.3,
      });
      circle.setMap(mapInstanceRef.current);
      return circle;
    });

    heatmapRef.current = circles;
    console.log(`✅ 히트맵 ${circles.length}개 생성 완료`);

    return () => {
      circles.forEach((circle) => circle.setMap(null));
    };
  }, [showHeatmap, heatmapStores, currentDong, isLoading]);

  useEffect(() => {
    if (!mapInstanceRef.current || isLoading) return;
    if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) {
      return;
    }

    const map = mapInstanceRef.current;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const detect = () => {
      const center = map.getCenter();
      const lat = center.getLat();
      const lng = center.getLng();
      const zoom = map.getLevel();

      const dong = detectDong(lat, lng);
      if (dong) setCurrentDong(dong.name);

      const zoomChanged = zoom !== lastZoomRef.current;
      lastZoomRef.current = zoom;
      if (zoomChanged) {
        console.log(`🔍 줌 변경 (level ${zoom}) - 마커 유지`);
        return;
      }

      const dLat = Math.abs(lat - lastCenterRef.current.lat);
      const dLng = Math.abs(lng - lastCenterRef.current.lng);
      if (dLat <= CENTER_EPSILON && dLng <= CENTER_EPSILON) return;

      console.log(`🗺️ 중심 이동: (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
      setMapCenter({ lat, lng });
      lastCenterRef.current = { lat, lng };
    };

    const handleMapIdle = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(detect, 300);
    };

    window.kakao.maps.event.addListener(map, "idle", handleMapIdle);
    detect();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.kakao.maps.event.removeListener(map, "idle", handleMapIdle);
    };
  }, [isLoading, setCurrentDong]);

  useEffect(() => {
    goldenPinsRef.current.forEach((overlay) => overlay.setMap(null));
    goldenPinsRef.current = [];

    if (
      !mapInstanceRef.current ||
      !showGoldenPins ||
      !currentDong ||
      isLoading
    ) {
      return;
    }
    if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) {
      return;
    }

    const currentTopSEC = topSECByDong[currentDong] || [];
    if (currentTopSEC.length === 0) {
      console.log("⚠️ 황금 핀 없음:", currentDong);
      return;
    }

    console.log("🏆 황금 핀 생성 시작...");

    const newPins: any[] = [];
    currentTopSEC.forEach((sec, index) => {
      const content = document.createElement("div");
      content.style.cssText =
        "position:relative;width:40px;height:50px;cursor:pointer;transition:transform 0.2s;";
      content.innerHTML = `
        <div style="position:absolute;width:40px;height:40px;background:linear-gradient(135deg,#FFD700 0%,#FFA500 100%);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 8px rgba(0,0,0,0.3);"></div>
        <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);color:white;font-weight:bold;font-size:18px;text-shadow:0 1px 2px rgba(0,0,0,0.5);z-index:10;">${index + 1}</div>
      `;

      content.onmouseenter = () => {
        content.style.transform = "scale(1.1)";
      };
      content.onmouseleave = () => {
        content.style.transform = "scale(1.0)";
      };
      content.onclick = () => {
        console.log(`🏆 SEC ${index + 1}위 클릭:`, sec.storeName);
        setSelectedSEC(sec);
        setSelectedStore(null);
        setClusterStores(null);

        const map = mapInstanceRef.current;
        if (!map) return;
        map.setCenter(new window.kakao.maps.LatLng(sec.lat, sec.lng));
        if (map.getLevel() > 3) map.setLevel(3);
      };

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(sec.lat, sec.lng),
        content,
        yAnchor: 1,
      });
      overlay.setMap(mapInstanceRef.current);
      newPins.push(overlay);
    });

    goldenPinsRef.current = newPins;
    console.log(`✅ 황금 핀 ${newPins.length}개 생성 완료`);
  }, [
    showGoldenPins,
    currentDong,
    topSECByDong,
    isLoading,
    setSelectedSEC,
    setSelectedStore,
    setClusterStores,
  ]);

  useEffect(() => {
    if (!showGoldenPins || !mapInstanceRef.current || isLoading) return;
    if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) {
      return;
    }

    const dong = currentDongRef.current;
    if (!dong) return;
    const currentTopSEC = topSECByDongRef.current[dong] || [];
    if (currentTopSEC.length === 0) return;

    console.log("🔍 SEC TOP3 영역으로 자동 줌 (꽉차게)...");

    const bounds = new window.kakao.maps.LatLngBounds();
    currentTopSEC.forEach((sec: any) => {
      bounds.extend(new window.kakao.maps.LatLng(sec.lat, sec.lng));
    });

    mapInstanceRef.current.setBounds(bounds, 60, 60, 60, 60);
    lastZoomRef.current = mapInstanceRef.current.getLevel();

    console.log(`✅ 자동 줌 완료 (레벨 ${mapInstanceRef.current.getLevel()})`);
  }, [showGoldenPins, isLoading]);

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <p className="text-red-500 font-medium">지도 로드 실패</p>
          <p className="text-sm text-slate-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={mapRef}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-slate-600 mt-4">지도 로딩 중...</p>
          </div>
        </div>
      )}

      {currentDong ? (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-white px-5 py-2.5 rounded-full shadow-lg border-2 border-blue-500"
          style={{ zIndex: 1000 }}
        >
          <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="text-blue-500">📍</span>
            현재: {currentDong}
            <span className="mx-1 text-slate-300">|</span>
            <span className="text-red-500">
              폐업 {dongCount.toLocaleString()}개
            </span>
          </p>
        </div>
      ) : (
        stores.length > 0 && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-white px-5 py-2.5 rounded-full shadow-lg border-2 border-slate-300"
            style={{ zIndex: 1000 }}
          >
            <p className="text-sm font-bold text-slate-900">
              강남구 전체: 폐업{" "}
              <span className="text-red-500">
                {stores.length.toLocaleString()}개
              </span>
            </p>
          </div>
        )
      )}

      {stores.length > 0 && (
        <div
          className="absolute top-4 left-4 z-10 space-y-2"
          style={{ width: "320px" }}
        >
          <DateFilterBar />
          <FilterBar allStores={stores} />
        </div>
      )}
    </>
  );
}
