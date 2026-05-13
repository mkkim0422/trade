"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadGridAggregatesIntro,
  type GridAggregate,
  type GridData,
} from "@/lib/grid-aggregates";

interface Props {
  onFinish: () => void;
}

// 함정 14곳(역삼·논현·신논현 강남대로 동측 골목) 좌표 평균 ≈ (37.5025, 127.034).
// SKT 격자 누락 영역(강남역/선릉/삼성)을 화면 밖으로 빼고 데이터 풍부한 동측에 포커싱.
// level 5 ≈ 좌우 ~2km 범위 — 14곳 + 가로수길 일부 포착, 빈 영역 회피.
const GANGNAM_CENTER = { lat: 37.502, lng: 127.034 };
const GANGNAM_LEVEL = 5;
// 50m 격자 → 중심에서 ±25m.
const HALF_LAT = 25 / 111000;
const HALF_LNG = 25 / (111000 * Math.cos((37.5 * Math.PI) / 180));
// 발표용 시각 확대 — 격자 데이터는 그대로, 빨강/파랑만 1.7배로 그려 듬성듬성 → 면(面)처럼 보이게.
// 보라(함정)는 1.0 유지 (이미 임팩트 충분, 18곳 정확 위치 표시).
const VISUAL_SCALE_DENSITY = 1.7;
const SVG_NS = "http://www.w3.org/2000/svg";

// 격자 필터 임계값 (최근 3년 데이터 기준).
//   - 빨강: closures ≥ 2  → 반복 폐업 자리
//   - 파랑: foot ≥ 100    → 강남 평균 훨씬 위
//   - 보라: isParadox     → foot≥50 AND closures≥3 (paradox.ts와 동일 기준, "함정 자리")

type LayerKey = "closure" | "foot" | "paradox";
type LayerState = Record<LayerKey, boolean>;

export default function IntroPhase2({ onFinish }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlayRef = useRef<any>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const closureGroupRef = useRef<SVGGElement | null>(null);
  const footGroupRef = useRef<SVGGElement | null>(null);
  const paradoxGroupRef = useRef<SVGGElement | null>(null);
  const baseLevelRef = useRef<number>(GANGNAM_LEVEL);
  const zoomListenerRef = useRef<(() => void) | null>(null);

  const [layers, setLayers] = useState<LayerState>({
    closure: false,
    foot: false,
    paradox: false,
  });
  const [data, setData] = useState<GridData | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [layersReady, setLayersReady] = useState(false);

  // 격자 집계 로드. 인트로 전용(매장→격자 반경 250m)으로 SKT 격자 누락 영역 색칠 보완.
  useEffect(() => {
    loadGridAggregatesIntro()
      .then(setData)
      .catch((err) => console.error("인트로 격자 데이터 로드 실패:", err));
  }, []);

  // 카카오맵 init.
  useEffect(() => {
    const loadKakao = () =>
      new Promise<void>((resolve, reject) => {
        if (window.kakao && window.kakao.maps) return resolve();
        const script = document.createElement("script");
        script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_API_KEY}&libraries=services,clusterer&autoload=false`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("카카오 SDK 로드 실패"));
        document.head.appendChild(script);
      });
    loadKakao()
      .then(() => {
        window.kakao.maps.load(() => {
          if (!mapRef.current) return;
          const map = new window.kakao.maps.Map(mapRef.current, {
            center: new window.kakao.maps.LatLng(
              GANGNAM_CENTER.lat,
              GANGNAM_CENTER.lng,
            ),
            level: GANGNAM_LEVEL,
            draggable: true,
            scrollwheel: false,
          });
          // 인트로는 고정 뷰 — 줌 비활성화로 (1) 카카오 level 2배 가정의 위험 제거,
          // (2) 줌인 시 SVG rect angular 문제 회피. pan은 발표 중 자유롭게 허용.
          // 인트로 unmount 시 이 맵 인스턴스 자체가 파괴되므로 P2 대시보드 맵엔 무영향.
          map.setZoomable(false);
          mapInstanceRef.current = map;
          baseLevelRef.current = map.getLevel();
          setMapReady(true);
        });
      })
      .catch((err) => console.error(err));
  }, []);

  // SVG overlay 1회 빌드. CustomOverlay 1개 + SVG 1장 + 3개 <g> 그룹.
  // 모든 <rect>는 base zoom 좌표로 한 번만 그리고, zoom 변경 시 SVG transform: scale로 통째 변환.
  useEffect(() => {
    if (!mapReady || !data || layersReady) return;
    const map = mapInstanceRef.current;

    const closureGrids = data.grids.filter((g) => g.closures >= 2);
    const footGrids = data.grids.filter((g) => g.foot >= 100);
    const paradoxGrids = data.grids.filter((g) => g.isParadox);
    console.log(
      `🟦 인트로 SVG: 폐업 ${closureGrids.length} · 유동 ${footGrids.length} · 함정 ${paradoxGrids.length} (총 ${closureGrids.length + footGrids.length + paradoxGrids.length} <rect>)`,
    );

    const container = document.createElement("div");
    // translateZ(0)으로 GPU 합성 레이어 강제. pan 시 부모 reflow 차단.
    container.style.cssText =
      "position:absolute;top:0;left:0;pointer-events:none;transform:translateZ(0);";
    const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
    // opacity 0 시작 → setup 완료 후 1로 페이드인. 격자 init 50~100ms 동안 빈 지도 어색함 방지.
    svg.style.cssText =
      "position:absolute;top:0;left:0;overflow:visible;pointer-events:none;transform-origin:0 0;opacity:0;transition:opacity 500ms ease;";
    svg.setAttribute("overflow", "visible");
    container.appendChild(svg);

    const mkGroup = () => {
      const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
      g.setAttribute("opacity", "0");
      // will-change: transform으로 그룹마다 별도 GPU 레이어. opacity 토글 시 재합성만.
      (g.style as any).transition = "opacity 300ms ease";
      (g.style as any).willChange = "transform";
      return g;
    };
    const closureG = mkGroup();
    const footG = mkGroup();
    const paradoxG = mkGroup();

    // 강남구 중심을 anchor로. base zoom 시점의 좌표 변환을 한 번만 수행.
    const proj = map.getProjection();
    const anchor = proj.pointFromCoords(
      new window.kakao.maps.LatLng(GANGNAM_CENTER.lat, GANGNAM_CENTER.lng),
    );

    const appendRects = (
      group: SVGGElement,
      grids: GridAggregate[],
      fill: string,
      opacityOf: (g: GridAggregate) => number,
      stroke?: string,
      scale: number = 1.0,
    ) => {
      const hLat = HALF_LAT * scale;
      const hLng = HALF_LNG * scale;
      const frag = document.createDocumentFragment();
      for (const g of grids) {
        const nw = proj.pointFromCoords(
          new window.kakao.maps.LatLng(g.lat + hLat, g.lng - hLng),
        );
        const se = proj.pointFromCoords(
          new window.kakao.maps.LatLng(g.lat - hLat, g.lng + hLng),
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
        r.setAttribute("fill", fill);
        r.setAttribute("fill-opacity", String(opacityOf(g)));
        // 격자 경계선 anti-aliasing 비활성 → paint 비용 감소.
        r.setAttribute("shape-rendering", "crispEdges");
        if (stroke) {
          r.setAttribute("stroke", stroke);
          r.setAttribute("stroke-width", "1");
          r.setAttribute("stroke-opacity", "0.85");
        }
        frag.appendChild(r);
      }
      group.appendChild(frag);
    };

    // 색상 진하기는 단계화. 발표 임팩트 위해 base 강화 (0.3 → 0.55).
    const closureOpacity = (g: GridAggregate) =>
      g.closures >= 10
        ? 0.9
        : g.closures >= 5
          ? 0.8
          : g.closures >= 3
            ? 0.7
            : 0.55;
    const footOpacity = (g: GridAggregate) =>
      Math.min(0.85, 0.55 + ((g.foot - 100) / 200) * 0.3);

    appendRects(closureG, closureGrids, "#EF4444", closureOpacity, undefined, VISUAL_SCALE_DENSITY);
    appendRects(footG, footGrids, "#3B82F6", footOpacity, undefined, VISUAL_SCALE_DENSITY);
    appendRects(paradoxG, paradoxGrids, "#A855F7", () => 0.7, "#7C3AED");

    // z-order: 파랑(아래) → 빨강 → 보라(위).
    svg.appendChild(footG);
    svg.appendChild(closureG);
    svg.appendChild(paradoxG);

    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(
        GANGNAM_CENTER.lat,
        GANGNAM_CENTER.lng,
      ),
      content: container,
      xAnchor: 0,
      yAnchor: 0,
      zIndex: 1,
    });
    overlay.setMap(map);

    overlayRef.current = overlay;
    svgRef.current = svg;
    closureGroupRef.current = closureG;
    footGroupRef.current = footG;
    paradoxGroupRef.current = paradoxG;

    // zoom 변경 시 SVG 통째 스케일. 카카오 level 한 단계 = 2배 스케일 (메르카토르).
    const updateScale = () => {
      const currentLevel = map.getLevel();
      const scale = Math.pow(2, baseLevelRef.current - currentLevel);
      svg.style.transform = `scale(${scale})`;
    };
    updateScale();
    window.kakao.maps.event.addListener(map, "zoom_changed", updateScale);
    zoomListenerRef.current = updateScale;

    // 다음 frame에 페이드인 시작. requestAnimationFrame으로 init reflow 후 transition 적용.
    requestAnimationFrame(() => {
      svg.style.opacity = "1";
    });

    setLayersReady(true);
  }, [mapReady, data, layersReady]);

  // 레이어 토글 — group opacity만. CSS transition으로 페이드.
  useEffect(() => {
    if (!layersReady) return;
    closureGroupRef.current?.setAttribute(
      "opacity",
      layers.closure ? "1" : "0",
    );
    footGroupRef.current?.setAttribute("opacity", layers.foot ? "1" : "0");
    paradoxGroupRef.current?.setAttribute(
      "opacity",
      layers.paradox ? "1" : "0",
    );
  }, [layers, layersReady]);

  // unmount cleanup.
  useEffect(() => {
    return () => {
      const map = mapInstanceRef.current;
      if (map && zoomListenerRef.current) {
        window.kakao.maps.event.removeListener(
          map,
          "zoom_changed",
          zoomListenerRef.current,
        );
      }
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
      svgRef.current = null;
      closureGroupRef.current = null;
      footGroupRef.current = null;
      paradoxGroupRef.current = null;
      zoomListenerRef.current = null;
    };
  }, []);

  const toggle = (key: LayerKey) => {
    if (key === "paradox") {
      setLayers((prev) =>
        prev.paradox
          ? { ...prev, paradox: false }
          : { closure: false, foot: false, paradox: true },
      );
    } else {
      setLayers((prev) => ({ ...prev, [key]: !prev[key], paradox: false }));
    }
  };

  const paradoxCount = data?.paradoxGridCount ?? 0;

  return (
    <div className="absolute inset-0">
      <div ref={mapRef} className="absolute inset-0 bg-slate-900" />

      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/85 via-black/60 to-transparent pt-8 pb-16 pointer-events-none">
        <div className="text-center text-white intro-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            1차로 안 보이는 자리 — 함정 자리
          </h1>
          <p className="mt-3 text-base text-slate-300">
            사람은 흐르지만, 매장은 머물지 못하는 자리
          </p>
          <p className="mt-1 text-xs text-slate-500">
            세 레이어를 차례대로 켜보세요
          </p>
        </div>
      </div>

      <div className="absolute top-32 left-1/2 -translate-x-1/2 z-10 flex gap-3">
        <ToggleChip
          label="폐업 분포"
          colorClass="bg-red-500"
          active={layers.closure}
          onClick={() => toggle("closure")}
          disabled={!layersReady}
        />
        <ToggleChip
          label="유동인구"
          colorClass="bg-blue-500"
          active={layers.foot}
          onClick={() => toggle("foot")}
          disabled={!layersReady}
        />
        <ToggleChip
          label={`함정 자리${paradoxCount > 0 ? ` ${paradoxCount}곳` : ""}`}
          colorClass="bg-purple-500"
          active={layers.paradox}
          onClick={() => toggle("paradox")}
          disabled={!layersReady}
        />
      </div>

      {layers.paradox && paradoxCount > 0 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 intro-fade-in">
          <div className="bg-purple-950/90 border-2 border-purple-500 rounded-xl px-6 py-4 backdrop-blur shadow-2xl text-center max-w-md">
            <div className="text-purple-300 text-xs font-semibold tracking-wider mb-1">
              🟣 함정 자리 {paradoxCount}곳
            </div>
            <div className="text-white text-2xl font-bold">
              1차 상권분석으로 안 보이는 위험
            </div>
            <div className="text-purple-200 text-xs mt-1">
              14곳이 강남대로 동측 골목 · 4곳은 가로수길·대치·삼성
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none">
        <div className="text-slate-200 text-base font-medium tracking-wide">
          함정 자리 18곳 확인 완료 — 이제 당신 자리 검증
        </div>
        <div className="text-slate-500 text-[11px] tracking-wide mt-1">
          스페이스 = 다음
        </div>
      </div>

      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          지도 로딩…
        </div>
      )}
    </div>
  );
}

function ToggleChip({
  label,
  colorClass,
  active,
  onClick,
  disabled,
}: {
  label: string;
  colorClass: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-sm transition-all backdrop-blur ${
        active
          ? "bg-white text-slate-900 shadow-lg scale-105"
          : "bg-black/50 text-slate-200 border border-slate-700 hover:border-slate-500"
      } ${disabled ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
    >
      <span
        className={`w-3 h-3 rounded-full ${colorClass} ${active ? "" : "opacity-60"}`}
      />
      {label}
    </button>
  );
}
