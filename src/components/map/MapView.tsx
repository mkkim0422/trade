"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardStore } from "@/store/useDashboardStore";
import { detectDong } from "@/lib/gangnam-dongs";
import { getDistance } from "@/lib/constants";
import { createMarkerHTML, getMarkerDesign } from "@/lib/marker-design";
import DateFilterBar from "@/components/panels/DateFilterBar";
import FilterBar from "@/components/panels/FilterBar";
import ParadoxLayer from "@/components/map/ParadoxLayer";
import VirtualStorePin from "@/components/map/VirtualStorePin";
import type { Store } from "@/types";

const INITIAL_CENTER = { lat: 37.5007, lng: 127.0368 };
const INITIAL_DONG = "역삼1동";
const DEFAULT_ZOOM = 3;
// 지도 중심 기준 고정 반경(m). 이 반경 안의 모든 폐점 매장을 표시하고
// 동일 반경의 가이드 원을 그려 "표시 영역 = 분석 영역"을 시각적으로 일치시킴.
// 강남구 평균 밀도 기준 100~150개 수준이며 box-shadow/will-change 최적화로 감당 가능.
const FIXED_RADIUS_METERS = 250;
const HEATMAP_LIMIT = 500;
// ~55m. 더 작은 움직임은 마커 재계산 스킵 (드래그 미세 떨림 무시).
const CENTER_EPSILON = 5e-4;

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  // ParadoxLayer 등 자식 컴포넌트가 prop으로 받기 위한 state 노출. ref와 별도 유지.
  const [mapInstance, setMapInstance] = useState<any>(null);
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
  const categoryFilterEnabled = useDashboardStore(
    (state) => state.categoryFilterEnabled,
  );
  const showHeatmap = useDashboardStore((state) => state.showHeatmap);
  const dateFilter = useDashboardStore((state) => state.dateFilter);
  const currentDong = useDashboardStore((state) => state.currentDong);
  const setCurrentDong = useDashboardStore((state) => state.setCurrentDong);
  const showGoldenPins = useDashboardStore((state) => state.showGoldenPins);
  const topSECByDong = useDashboardStore((state) => state.topSECByDong);
  const showWorstPins = useDashboardStore((state) => state.showWorstPins);
  const worstByDong = useDashboardStore((state) => state.worstByDong);
  const mapTargetCoord = useDashboardStore((state) => state.mapTargetCoord);
  const setMapTargetCoord = useDashboardStore(
    (state) => state.setMapTargetCoord,
  );
  const virtualStoreVisible = useDashboardStore(
    (state) => state.virtualStoreVisible,
  );
  const virtualStorePosition = useDashboardStore(
    (state) => state.virtualStorePosition,
  );
  const setVirtualStorePosition = useDashboardStore(
    (state) => state.setVirtualStorePosition,
  );
  const heatmapRef = useRef<any[]>([]);
  const goldenPinsRef = useRef<any[]>([]);
  const worstPinsRef = useRef<any[]>([]);
  const boundaryCircleRef = useRef<any>(null);
  const radiusLineRef = useRef<any>(null);
  const radiusLabelRef = useRef<any>(null);
  const markerNodesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const markerStoreMapRef = useRef<Map<string, Store>>(new Map());
  const prevSelectedIdRef = useRef<string | null>(null);
  const lastCenterRef = useRef<{ lat: number; lng: number }>(INITIAL_CENTER);
  const lastZoomRef = useRef<number>(DEFAULT_ZOOM);
  // 프로그래매틱 pan(setMapTargetCoord 경유) 시 다음 idle에서 dong 자동 변경 억제.
  // 매장 클릭 → 자동 setCenter → idle → detectDong → setCurrentDong이 우패널 TOP3를
  // 의도치 않게 변경하던 버그 방지. 사용자 드래그는 영향 없음 (suppress 안 셋팅).
  const suppressDongDetectRef = useRef<boolean>(false);
  const nearbyStoresRef = useRef<Store[]>([]);
  const overlayMapRef = useRef<Map<string, any>>(new Map());
  const currentDongRef = useRef<string | null>(null);
  const topSECByDongRef = useRef<Record<string, any>>({});
  const worstByDongRef = useRef<Record<string, any>>({});
  currentDongRef.current = currentDong;
  topSECByDongRef.current = topSECByDong;
  worstByDongRef.current = worstByDong;

  // 카테고리(선택 시) + 날짜 필터를 적용. 업태 필터 마스터 스위치는 마커에만 영향
  // (heatmap은 항상 전체 표시). 따라서 여기서는 zero-out 하지 않는다.
  const filteredStores = useMemo(() => {
    return stores.filter((s) => {
      if (
        categoryFilterEnabled &&
        categoryFilter &&
        s.category !== categoryFilter
      )
        return false;
      if (dateFilter.startDate || dateFilter.endDate) {
        if (!s.closeDate) return false;
        if (dateFilter.startDate && s.closeDate < dateFilter.startDate)
          return false;
        if (dateFilter.endDate && s.closeDate > dateFilter.endDate)
          return false;
      }
      return true;
    });
  }, [stores, categoryFilter, categoryFilterEnabled, dateFilter]);

  const dongFilteredStores = useMemo(() => {
    if (!currentDong) return filteredStores;
    return filteredStores.filter((s) => s.dong === currentDong);
  }, [currentDong, filteredStores]);

  // 1차 lat/lng 박스 필터로 후보 축소 → Haversine은 후보에만 적용.
  // FIXED_RADIUS_METERS를 위/경도 도(°)로 환산해 박스 컷:
  //   1° lat ≈ 111,000m
  //   1° lng ≈ 111,000m × cos(lat)  (Seoul ~37.5°에서 ~88,400m)
  // 박스가 원을 포함하므로 false negative 없음.
  const nearbyDisplayStores = useMemo(() => {
    // 업태 필터 마스터 스위치 OFF → 마커 모두 숨김 (히트맵엔 영향 X).
    if (!categoryFilterEnabled) return [];
    const cLat = mapCenter.lat;
    const cLng = mapCenter.lng;
    const latDelta = FIXED_RADIUS_METERS / 111_000;
    const lngDelta =
      FIXED_RADIUS_METERS / (111_000 * Math.cos((cLat * Math.PI) / 180));
    const result: Store[] = [];
    for (const s of filteredStores) {
      if (Math.abs(s.lat - cLat) > latDelta) continue;
      if (Math.abs(s.lng - cLng) > lngDelta) continue;
      if (getDistance(cLat, cLng, s.lat, s.lng) <= FIXED_RADIUS_METERS) {
        result.push(s);
      }
    }
    return result;
  }, [filteredStores, mapCenter, categoryFilterEnabled]);

  // 히트맵은 pan에 따라 재계산하지 않음 — 동(行政洞) 단위로만 갱신.
  // pan마다 500개 Circle을 파괴/재생성하던 비용 제거.
  const heatmapStores = useMemo(() => {
    if (!showHeatmap) return [];
    const source = currentDong ? dongFilteredStores : filteredStores;
    if (source.length <= HEATMAP_LIMIT) return source;
    return source.slice(0, HEATMAP_LIMIT);
  }, [showHeatmap, currentDong, dongFilteredStores, filteredStores]);

  nearbyStoresRef.current = nearbyDisplayStores;

  // ID 집합이 실제로 바뀐 경우에만 마커 diff 트리거.
  // 미세한 pan(에피실론 이하)에서는 nearbyDisplayStores 참조만 새로 만들어지고
  // 내용은 동일한 경우가 잦음 — 불필요한 setState/useEffect 캐스케이드를 방지.
  const prevDisplayedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const prev = prevDisplayedIdsRef.current;
    let changed = nearbyDisplayStores.length !== prev.size;
    if (!changed) {
      for (const s of nearbyDisplayStores) {
        if (!prev.has(s.id)) {
          changed = true;
          break;
        }
      }
    }
    if (changed) {
      prevDisplayedIdsRef.current = new Set(
        nearbyDisplayStores.map((s) => s.id),
      );
      setMarkerVersion((v) => v + 1);
      // 시각/AI 진단 카운트 불일치 디버그용. 가상 매장 클릭 시 자동 setCenter 후
      // 이 값이 AI 진단 nearbyClosedCount(250m)와 근사해야 정상.
      console.log(
        `📍 가시 영역 매장: ${nearbyDisplayStores.length}개 (300m 박스 · 중심 ${mapCenter.lat.toFixed(5)},${mapCenter.lng.toFixed(5)})`,
      );
    }
  }, [nearbyDisplayStores, mapCenter]);

  const dongCount = dongFilteredStores.length;

  useEffect(() => {
    fetch("/data/stores-recent.json")
      .then((res) => {
        if (!res.ok) throw new Error("stores-recent.json 로드 실패");
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
          setMapInstance(mapInstanceRef.current);
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

  // 우패널 접기/펼치기로 컨테이너 폭이 바뀌면 카카오맵이 자동 relayout 안 함 →
  // 회색 빈 영역이 우측에 남음. ResizeObserver로 감지해서 강제 relayout.
  useEffect(() => {
    const container = mapRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const map = mapInstanceRef.current;
      if (map && typeof map.relayout === "function") {
        map.relayout();
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
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

      // hover 시 transform만 변경 (filter 변경은 GPU 부담이 큼).
      // box-shadow는 marker-design.ts에서 직접 입혀져 있으므로 hover에서 건드리지 않음.
      node.addEventListener("mouseenter", () => {
        const inner = node.querySelector(
          ".pinterest-marker",
        ) as HTMLElement | null;
        if (!inner) return;
        inner.style.transform = "scale(1.15) translateY(-3px)";
      });
      node.addEventListener("mouseleave", () => {
        const inner = node.querySelector(
          ".pinterest-marker",
        ) as HTMLElement | null;
        if (!inner) return;
        inner.style.transform = "scale(1) translateY(0)";
      });
      node.addEventListener("click", () => {
        setSelectedStore(store);
        setClusterStores(null);
        setSelectedSEC(null);
        // zoom 5 ≈ 1km 범위 — 300m 표시 박스 안 매장이 화면 중앙 부근에 분포해
        // AI 진단 "반경 250m N건"과 시각 마커 갯수가 일치.
        setMapTargetCoord({ lat: store.lat, lng: store.lng, zoom: 5 });
      });

      markerNodesRef.current.set(store.id, node);
      markerStoreMapRef.current.set(store.id, store);

      const overlay = new window.kakao.maps.CustomOverlay({
        position,
        content: node,
        yAnchor: 1,
        zIndex: 1,
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
      if (boundaryCircleRef.current) {
        boundaryCircleRef.current.setMap(null);
        boundaryCircleRef.current = null;
      }
      if (radiusLineRef.current) {
        radiusLineRef.current.setMap(null);
        radiusLineRef.current = null;
      }
      if (radiusLabelRef.current) {
        radiusLabelRef.current.setMap(null);
        radiusLabelRef.current = null;
      }
    };
  }, []);

  // 고정 반경 바운더리 원 (= FIXED_RADIUS_METERS) + 가로 반지름 점선 + 라벨.
  // 위치만 갱신하고 반지름은 불변. setPosition으로 재활용해 GC 비용 최소화.
  useEffect(() => {
    if (!mapInstanceRef.current || isLoading) return;
    if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) {
      return;
    }

    const center = new window.kakao.maps.LatLng(mapCenter.lat, mapCenter.lng);
    // 가로 반지름 — 동쪽 끝점 (위도 동일, 경도 +R).
    const lngDelta =
      FIXED_RADIUS_METERS / (111000 * Math.cos((mapCenter.lat * Math.PI) / 180));
    const east = new window.kakao.maps.LatLng(
      mapCenter.lat,
      mapCenter.lng + lngDelta,
    );
    const mid = new window.kakao.maps.LatLng(
      mapCenter.lat,
      mapCenter.lng + lngDelta / 2,
    );

    if (boundaryCircleRef.current) {
      boundaryCircleRef.current.setPosition(center);
    } else {
      const circle = new window.kakao.maps.Circle({
        center,
        radius: FIXED_RADIUS_METERS,
        strokeWeight: 2,
        strokeColor: "#3B82F6",
        strokeOpacity: 0.7,
        strokeStyle: "dashed",
        fillColor: "#3B82F6",
        fillOpacity: 0.1,
      });
      circle.setMap(mapInstanceRef.current);
      boundaryCircleRef.current = circle;
    }

    if (radiusLineRef.current) {
      radiusLineRef.current.setPath([center, east]);
    } else {
      const line = new window.kakao.maps.Polyline({
        path: [center, east],
        strokeWeight: 2,
        strokeColor: "#3B82F6",
        strokeOpacity: 0.85,
        strokeStyle: "dashed",
      });
      line.setMap(mapInstanceRef.current);
      radiusLineRef.current = line;
    }

    if (radiusLabelRef.current) {
      radiusLabelRef.current.setPosition(mid);
    } else {
      const content = document.createElement("div");
      content.style.cssText =
        "font-size:10px;color:#94A3B8;font-weight:500;white-space:nowrap;transform:translateY(-12px);pointer-events:none;text-shadow:0 0 2px rgba(255,255,255,0.8);";
      content.textContent = `반지름 ${FIXED_RADIUS_METERS}m`;
      const overlay = new window.kakao.maps.CustomOverlay({
        position: mid,
        content,
        yAnchor: 1,
        xAnchor: 0.5,
        zIndex: 2,
      });
      overlay.setMap(mapInstanceRef.current);
      radiusLabelRef.current = overlay;
    }
  }, [mapCenter, isLoading]);

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
      if (dong) {
        if (suppressDongDetectRef.current) {
          // 프로그래매틱 pan 직후 — 첫 idle은 소비만 하고 dong 변경 안 함.
          suppressDongDetectRef.current = false;
        } else {
          setCurrentDong(dong.name);
        }
      }

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
        setMapTargetCoord({ lat: sec.lat, lng: sec.lng, zoom: 3 });
      };

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(sec.lat, sec.lng),
        content,
        yAnchor: 1,
        zIndex: 100,
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

  useEffect(() => {
    worstPinsRef.current.forEach((overlay) => overlay.setMap(null));
    worstPinsRef.current = [];

    if (
      !mapInstanceRef.current ||
      !showWorstPins ||
      !currentDong ||
      isLoading
    ) {
      return;
    }
    if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) {
      return;
    }

    const currentWorst = worstByDong[currentDong] || [];
    if (currentWorst.length === 0) {
      console.log("⚠️ 최악 핀 없음:", currentDong);
      return;
    }

    console.log("⚠️ 최악 핀 생성 시작...");

    const newPins: any[] = [];
    currentWorst.forEach((sec, index) => {
      const content = document.createElement("div");
      content.style.cssText =
        "position:relative;width:40px;height:50px;cursor:pointer;transition:transform 0.2s;";
      content.innerHTML = `
        <div style="position:absolute;width:40px;height:40px;background:linear-gradient(135deg,#7F1D1D 0%,#DC2626 100%);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 8px rgba(0,0,0,0.4);"></div>
        <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);color:white;font-weight:bold;font-size:18px;text-shadow:0 1px 2px rgba(0,0,0,0.6);z-index:10;">${index + 1}</div>
      `;

      content.onmouseenter = () => {
        content.style.transform = "scale(1.1)";
      };
      content.onmouseleave = () => {
        content.style.transform = "scale(1.0)";
      };
      content.onclick = () => {
        console.log(`⚠️ 최악 ${index + 1}위 클릭:`, sec.storeName);
        setSelectedSEC(sec);
        setSelectedStore(null);
        setClusterStores(null);
        setMapTargetCoord({ lat: sec.lat, lng: sec.lng, zoom: 3 });
      };

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(sec.lat, sec.lng),
        content,
        yAnchor: 1,
        zIndex: 100,
      });
      overlay.setMap(mapInstanceRef.current);
      newPins.push(overlay);
    });

    worstPinsRef.current = newPins;
    console.log(`✅ 최악 핀 ${newPins.length}개 생성 완료`);
  }, [
    showWorstPins,
    currentDong,
    worstByDong,
    isLoading,
    setSelectedSEC,
    setSelectedStore,
    setClusterStores,
  ]);

  useEffect(() => {
    if (!showWorstPins || !mapInstanceRef.current || isLoading) return;
    if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) {
      return;
    }

    const dong = currentDongRef.current;
    if (!dong) return;
    const currentWorst = worstByDongRef.current[dong] || [];
    if (currentWorst.length === 0) return;

    console.log("🔍 최악 TOP3 영역으로 자동 줌 (꽉차게)...");

    const bounds = new window.kakao.maps.LatLngBounds();
    currentWorst.forEach((sec: any) => {
      bounds.extend(new window.kakao.maps.LatLng(sec.lat, sec.lng));
    });

    mapInstanceRef.current.setBounds(bounds, 60, 60, 60, 60);
    lastZoomRef.current = mapInstanceRef.current.getLevel();

    console.log(`✅ 자동 줌 완료 (레벨 ${mapInstanceRef.current.getLevel()})`);
  }, [showWorstPins, isLoading]);

  // 가상 매장 모드 — 지도 클릭 시 그 좌표에 가상 핀 배치 (드래그/이동은 핀 컴포넌트가 담당).
  useEffect(() => {
    if (!mapInstanceRef.current || isLoading) return;
    if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) {
      return;
    }
    if (!virtualStoreVisible) return;

    const map = mapInstanceRef.current;
    const handleClick = (mouseEvent: any) => {
      const latlng = mouseEvent.latLng;
      if (!latlng) return;
      const lat = latlng.getLat();
      const lng = latlng.getLng();
      console.log(
        `🎯 가상 매장 배치: (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      );
      setVirtualStorePosition({ lat, lng });
      // 시각/데이터 일치: 가상 매장을 지도 중심으로 자동 이동. mapCenter 기준 300m 박스가
      // 가상 매장 250m AI 카운트와 겹쳐 화면 마커 ≈ "반경 250m N건"이 됨.
      // zoom 5 ≈ 1km 범위. zoom 3은 너무 깊어 250m 매장이 화면 끝으로 몰림.
      // 실 매장 클릭(line 285)도 동일하게 zoom 5로 이동.
      setMapTargetCoord({ lat, lng, zoom: 5 });
    };
    window.kakao.maps.event.addListener(map, "click", handleClick);
    return () => {
      window.kakao.maps.event.removeListener(map, "click", handleClick);
    };
  }, [
    virtualStoreVisible,
    isLoading,
    setVirtualStorePosition,
    setMapTargetCoord,
  ]);

  useEffect(() => {
    if (!mapTargetCoord || !mapInstanceRef.current || isLoading) return;
    if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) {
      return;
    }

    const map = mapInstanceRef.current;
    const { lat, lng, zoom } = mapTargetCoord;
    console.log(
      `🎯 지도 이동: (${lat.toFixed(5)}, ${lng.toFixed(5)})${zoom !== undefined ? `, 레벨 ${zoom}` : ""}`,
    );
    // 프로그래매틱 pan — 다음 idle의 dong 자동 변경 억제.
    suppressDongDetectRef.current = true;
    if (typeof map.relayout === "function") map.relayout();
    map.setCenter(new window.kakao.maps.LatLng(lat, lng));
    if (zoom !== undefined && map.getLevel() > zoom) {
      map.setLevel(zoom);
      lastZoomRef.current = zoom;
    }
    setMapTargetCoord(null);
  }, [mapTargetCoord, isLoading, setMapTargetCoord]);

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
        className={`absolute inset-0 ${
          virtualStoreVisible && !virtualStorePosition
            ? "map-virtual-mode"
            : ""
        }`}
        style={{ width: "100%", height: "100%" }}
      />

      {/* 함정 자리 격자 레이어 — 카카오맵에 직접 SVG 오버레이. DOM 없음 (return null). */}
      {mapInstance && stores.length > 0 && (
        <ParadoxLayer mapInstance={mapInstance} allStores={stores} />
      )}

      {/* 가상 매장 핀 (발표 클라이맥스). DOM 없음. */}
      {mapInstance && <VirtualStorePin mapInstance={mapInstance} />}

      {/* 가상 모드 안내 토스트 — position 없을 때만 노출. */}
      {virtualStoreVisible && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-full shadow-lg text-xs font-semibold"
          style={{ zIndex: 1000 }}
        >
          📍 지도 클릭으로 가상 매장 배치 · 드래그로 이동
        </div>
      )}

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
