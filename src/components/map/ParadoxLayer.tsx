"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useDashboardStore } from "@/store/useDashboardStore";
import {
  loadGridAggregates,
  type GridAggregate,
} from "@/lib/grid-aggregates";
import { getDistance } from "@/lib/constants";
import type { Store } from "@/types";

// 인트로 Phase 2와 같은 50m 격자 cell.
const HALF_LAT = 25 / 111000;
const HALF_LNG = 25 / (111000 * Math.cos((37.5 * Math.PI) / 180));
const SVG_NS = "http://www.w3.org/2000/svg";
// 격자 클릭 popup의 매장 검색 반경 (사전계산 시 매장→격자 할당이 100m 기준이라 동일).
const POPUP_GRID_RADIUS_M = 100;

interface Props {
  mapInstance: any | null;
  allStores: Store[];
}

export default function ParadoxLayer({ mapInstance, allStores }: Props) {
  const showParadoxLayer = useDashboardStore((s) => s.showParadoxLayer);
  const selectedGrid = useDashboardStore((s) => s.selectedParadoxGrid);
  const setSelectedGrid = useDashboardStore((s) => s.setSelectedParadoxGrid);
  const setSelectedStore = useDashboardStore((s) => s.setSelectedStore);

  const overlayRef = useRef<any>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const groupRef = useRef<SVGGElement | null>(null);
  const gridsRef = useRef<GridAggregate[]>([]);
  const popupOverlayRef = useRef<any>(null);
  const popupRootRef = useRef<Root | null>(null);
  const popupContainerRef = useRef<HTMLDivElement | null>(null);
  const zoomListenerRef = useRef<(() => void) | null>(null);
  const setSelectedGridRef = useRef(setSelectedGrid);
  setSelectedGridRef.current = setSelectedGrid;

  const [layerReady, setLayerReady] = useState(false);

  // SVG overlay 1회 셋업 (mapInstance 준비 시).
  // 인트로와 달리 줌 활성 — zoom_changed마다 좌표 재계산. 62개라 부담 없음.
  useEffect(() => {
    if (!mapInstance || layerReady) return;
    let cancelled = false;

    loadGridAggregates().then((data) => {
      if (cancelled) return;
      const paradoxGrids = data.grids.filter((g) => g.isParadox);
      gridsRef.current = paradoxGrids;
      console.log(`🟣 P2 함정 자리 레이어: ${paradoxGrids.length}개 격자 준비`);

      const container = document.createElement("div");
      container.style.cssText =
        "position:absolute;top:0;left:0;pointer-events:none;transform:translateZ(0);";
      const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
      // pointer-events: none on svg, auto on rect — popup 클릭이 격자 통해 빠져나가는 것 방지.
      svg.style.cssText =
        "position:absolute;top:0;left:0;overflow:visible;pointer-events:none;opacity:0;transition:opacity 300ms ease;";
      svg.setAttribute("overflow", "visible");
      container.appendChild(svg);

      const group = document.createElementNS(SVG_NS, "g") as SVGGElement;
      svg.appendChild(group);

      // 좌표 변환 — anchor는 첫 격자 LatLng 기준. CustomOverlay가 같은 LatLng에 anchor.
      const anchorLatLng = new window.kakao.maps.LatLng(
        paradoxGrids[0]?.lat ?? 37.4979,
        paradoxGrids[0]?.lng ?? 127.0476,
      );

      const updateCoords = () => {
        const proj = mapInstance.getProjection();
        const anchor = proj.pointFromCoords(anchorLatLng);

        // 그룹 비우고 새로 그리기 (62개 → 124회 변환, 빠름).
        while (group.firstChild) group.removeChild(group.firstChild);
        const frag = document.createDocumentFragment();
        for (const g of paradoxGrids) {
          const nw = proj.pointFromCoords(
            new window.kakao.maps.LatLng(g.lat + HALF_LAT, g.lng - HALF_LNG),
          );
          const se = proj.pointFromCoords(
            new window.kakao.maps.LatLng(g.lat - HALF_LAT, g.lng + HALF_LNG),
          );
          const x = nw.x - anchor.x;
          const y = nw.y - anchor.y;
          const w = se.x - nw.x;
          const h = se.y - nw.y;
          const r = document.createElementNS(SVG_NS, "rect");
          r.setAttribute("x", String(x));
          r.setAttribute("y", String(y));
          r.setAttribute("width", String(w));
          r.setAttribute("height", String(h));
          r.setAttribute("fill", "#A855F7");
          r.setAttribute("fill-opacity", "0.55");
          r.setAttribute("stroke", "#7C3AED");
          r.setAttribute("stroke-width", "1.5");
          r.setAttribute("stroke-opacity", "0.9");
          r.setAttribute("shape-rendering", "crispEdges");
          (r.style as any).pointerEvents = "auto";
          (r.style as any).cursor = "pointer";
          r.addEventListener("click", (e) => {
            e.stopPropagation();
            setSelectedGridRef.current(g);
          });
          r.addEventListener("mouseenter", () => {
            r.setAttribute("fill-opacity", "0.85");
          });
          r.addEventListener("mouseleave", () => {
            r.setAttribute("fill-opacity", "0.55");
          });
          frag.appendChild(r);
        }
        group.appendChild(frag);
      };

      const overlay = new window.kakao.maps.CustomOverlay({
        position: anchorLatLng,
        content: container,
        xAnchor: 0,
        yAnchor: 0,
        zIndex: 0, // 마커(zIndex 1)보다 아래. 마커 클릭이 격자보다 우선.
      });
      overlay.setMap(mapInstance);
      overlayRef.current = overlay;
      svgRef.current = svg;
      groupRef.current = group;

      updateCoords();
      window.kakao.maps.event.addListener(
        mapInstance,
        "zoom_changed",
        updateCoords,
      );
      zoomListenerRef.current = updateCoords;

      setLayerReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [mapInstance, layerReady]);

  // 가시성 토글: SVG opacity. OFF 시 popup도 닫음.
  useEffect(() => {
    if (!svgRef.current) return;
    svgRef.current.style.opacity = showParadoxLayer ? "1" : "0";
    if (!showParadoxLayer) setSelectedGrid(null);
  }, [showParadoxLayer, layerReady, setSelectedGrid]);

  // popup CustomOverlay 관리.
  useEffect(() => {
    if (!mapInstance) return;

    // 이전 popup 정리. root.unmount()는 React 렌더링 사이클과 동기로 호출하면
    // "synchronously unmount a root while React was already rendering" 에러 발생 →
    // queueMicrotask로 다음 microtask로 미뤄 race 회피.
    const oldRoot = popupRootRef.current;
    const oldOverlay = popupOverlayRef.current;
    if (oldRoot || oldOverlay) {
      queueMicrotask(() => {
        oldRoot?.unmount();
        oldOverlay?.setMap(null);
      });
    }
    popupRootRef.current = null;
    popupOverlayRef.current = null;
    popupContainerRef.current = null;

    if (!selectedGrid) return;

    const popupContainer = document.createElement("div");
    popupContainer.style.pointerEvents = "auto";
    popupContainerRef.current = popupContainer;
    const root = createRoot(popupContainer);
    root.render(
      <ParadoxGridPopup
        grid={selectedGrid}
        allStores={allStores}
        onClose={() => setSelectedGrid(null)}
        onStoreClick={(store) => {
          setSelectedStore(store);
          setSelectedGrid(null); // 매장 선택 후 popup 닫기 → 좌패널이 매장 카드로 전환
        }}
      />,
    );
    popupRootRef.current = root;

    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(
        selectedGrid.lat,
        selectedGrid.lng,
      ),
      content: popupContainer,
      xAnchor: 0.5,
      yAnchor: 1.15, // 격자 위쪽에 떠 있게
      zIndex: 200,
    });
    overlay.setMap(mapInstance);
    popupOverlayRef.current = overlay;
  }, [selectedGrid, mapInstance, allStores, setSelectedGrid, setSelectedStore]);

  // unmount cleanup. popup root.unmount()도 동일하게 microtask로 지연.
  useEffect(() => {
    return () => {
      if (mapInstance && zoomListenerRef.current) {
        window.kakao.maps.event.removeListener(
          mapInstance,
          "zoom_changed",
          zoomListenerRef.current,
        );
      }
      overlayRef.current?.setMap(null);
      const oldRoot = popupRootRef.current;
      const oldOverlay = popupOverlayRef.current;
      popupRootRef.current = null;
      popupOverlayRef.current = null;
      if (oldRoot || oldOverlay) {
        queueMicrotask(() => {
          oldRoot?.unmount();
          oldOverlay?.setMap(null);
        });
      }
    };
  }, [mapInstance]);

  return null;
}

interface PopupProps {
  grid: GridAggregate;
  allStores: Store[];
  onClose: () => void;
  onStoreClick: (store: Store) => void;
}

function ParadoxGridPopup({
  grid,
  allStores,
  onClose,
  onStoreClick,
}: PopupProps) {
  // 격자 100m 내 폐업 매장 (가까운 순). 더보기 제거, 전체를 스크롤 영역에 표시.
  const stores = (() => {
    const result: Array<{ store: Store; d: number }> = [];
    for (const s of allStores) {
      const d = getDistance(grid.lat, grid.lng, s.lat, s.lng);
      if (d <= POPUP_GRID_RADIUS_M) result.push({ store: s, d });
    }
    result.sort((a, b) => a.d - b.d);
    return result;
  })();

  // percentile은 "value 이하 비율"이라 상위% = 100 - pctile.
  const closureTopPct = (100 - grid.closurePctile).toFixed(1);
  const footTopPct = (100 - grid.footPctile).toFixed(1);

  return (
    <div className="bg-white rounded-xl shadow-2xl border-2 border-purple-400 w-72 overflow-hidden mb-2">
      <div className="bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2.5 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <span>🟣</span>
          <span className="font-bold text-sm">함정 자리 격자</span>
        </div>
        <button
          onClick={onClose}
          onMouseDown={(e) => e.preventDefault()}
          className="text-white/80 hover:text-white text-lg leading-none px-1"
          aria-label="닫기"
        >
          ×
        </button>
      </div>

      <div className="px-4 py-3 bg-purple-50 border-b border-purple-100">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-slate-500">폐업</div>
            <div className="text-red-600 font-bold text-lg leading-tight">
              {grid.closures}건
            </div>
            <div className="text-slate-400 text-[10px]">
              상위 {closureTopPct}%
            </div>
          </div>
          <div>
            <div className="text-slate-500">유동</div>
            <div className="text-blue-600 font-bold text-lg leading-tight">
              {grid.foot.toLocaleString()}/일
            </div>
            <div className="text-slate-400 text-[10px]">
              상위 {footTopPct}%
            </div>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-purple-700 font-medium">
          {grid.dong} · 격자 {grid.gid.slice(-6)}
        </div>
      </div>

      <div className="px-3 py-2">
        <div className="text-[11px] font-semibold text-slate-600 mb-1.5">
          격자 100m 내 폐업 매장 ({stores.length}개)
        </div>
        {stores.length === 0 ? (
          <div className="text-xs text-slate-400 py-2">매장 데이터 없음</div>
        ) : (
          <ul
            className="space-y-1 max-h-60 overflow-y-auto overscroll-contain"
            // 휠/터치 스크롤 이벤트를 지도(부모 카카오맵)로 전파시키지 않음.
            // overscroll-contain은 스크롤이 끝에 닿았을 때만 효과 있어 wheel을 명시적 stopPropagation.
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {stores.map(({ store, d }) => (
              <li key={store.id}>
                <button
                  onClick={() => onStoreClick(store)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-purple-50 transition-colors"
                >
                  <div className="text-xs font-medium text-slate-900 truncate">
                    {store.name}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {store.category} · {Math.round(d)}m · 폐업 {store.closeDate}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
