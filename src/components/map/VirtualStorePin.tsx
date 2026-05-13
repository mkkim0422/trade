"use client";

import { useEffect, useRef } from "react";
import { useDashboardStore } from "@/store/useDashboardStore";

interface Props {
  mapInstance: any;
}

// 카카오맵 위에 가상 매장 핀(보라색 펄스) 오버레이를 그리고 드래그 처리.
// CustomOverlay는 기본 드래그를 지원하지 않으므로 mousedown/mousemove/mouseup으로 수동 처리.
// 드래그 중에는 지도 본체 드래그를 잠시 비활성화해 함께 끌리지 않게 함.
export default function VirtualStorePin({ mapInstance }: Props) {
  const visible = useDashboardStore((s) => s.virtualStoreVisible);
  const position = useDashboardStore((s) => s.virtualStorePosition);
  const setPosition = useDashboardStore((s) => s.setVirtualStorePosition);
  const setVisible = useDashboardStore((s) => s.setVirtualStoreVisible);

  const overlayRef = useRef<any>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!mapInstance) return;
    if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) {
      return;
    }
    if (!visible || !position) {
      // visible 토글 OFF 또는 position 없음 → 핀 제거.
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
        overlayRef.current = null;
        nodeRef.current = null;
      }
      return;
    }

    // 기존 오버레이 있으면 위치만 갱신.
    if (overlayRef.current) {
      overlayRef.current.setPosition(
        new window.kakao.maps.LatLng(position.lat, position.lng),
      );
      return;
    }

    const node = document.createElement("div");
    node.style.cssText = "position:relative;width:50px;height:64px;cursor:grab;";
    node.innerHTML = `
      <div style="position:absolute;left:50%;top:-22px;transform:translateX(-50%);
        background:#A855F7;color:#fff;font-size:10px;font-weight:700;
        padding:2px 6px;border-radius:4px;white-space:nowrap;
        box-shadow:0 2px 4px rgba(0,0,0,0.25);">📍 가상 매장</div>
      <div class="virtual-pin-pulse" style="position:absolute;left:50%;top:14px;
        transform:translate(-50%, 0);width:36px;height:36px;border-radius:50%;
        background:rgba(168,85,247,0.25);"></div>
      <div style="position:absolute;left:50%;top:18px;transform:translate(-50%, 0);
        width:28px;height:28px;border-radius:50%;background:#fff;
        border:3px dashed #A855F7;box-shadow:0 4px 8px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
        font-size:14px;line-height:1;font-weight:700;color:#A855F7;">📍</div>
      <button class="virtual-pin-close" aria-label="가상 매장 제거"
        style="position:absolute;right:-2px;top:6px;width:18px;height:18px;
        border-radius:50%;background:#fff;border:1px solid #A855F7;
        color:#7E22CE;font-size:11px;line-height:1;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 1px 2px rgba(0,0,0,0.2);padding:0;">×</button>
    `;
    nodeRef.current = node;

    // 닫기 버튼 — bubbling 차단 후 가상 모드 종료.
    const closeBtn = node.querySelector(
      ".virtual-pin-close",
    ) as HTMLButtonElement | null;
    if (closeBtn) {
      closeBtn.addEventListener("mousedown", (e) => {
        e.stopPropagation();
      });
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setPosition(null);
        setVisible(false);
      });
    }

    // 드래그 — 카카오맵 자체 드래그를 일시 비활성화하고 mousemove로 좌표 추적.
    node.addEventListener("mousedown", (e) => {
      if ((e.target as HTMLElement)?.classList.contains("virtual-pin-close")) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = true;
      node.style.cursor = "grabbing";
      mapInstance.setDraggable(false);

      const onMove = (ev: MouseEvent) => {
        if (!draggingRef.current || !mapInstance) return;
        const proj = mapInstance.getProjection();
        const container = mapInstance.getNode();
        const rect = container.getBoundingClientRect();
        const point = new window.kakao.maps.Point(
          ev.clientX - rect.left,
          ev.clientY - rect.top,
        );
        const latlng = proj.coordsFromContainerPoint(point);
        if (overlayRef.current) {
          overlayRef.current.setPosition(latlng);
        }
      };
      const onUp = () => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        node.style.cursor = "grab";
        mapInstance.setDraggable(true);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        // 최종 위치를 zustand에 commit.
        const finalLatLng = overlayRef.current?.getPosition?.();
        if (finalLatLng) {
          setPosition({
            lat: finalLatLng.getLat(),
            lng: finalLatLng.getLng(),
          });
        }
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(position.lat, position.lng),
      content: node,
      yAnchor: 1,
      xAnchor: 0.5,
      zIndex: 9999,
    });
    overlay.setMap(mapInstance);
    overlayRef.current = overlay;
  }, [mapInstance, visible, position, setPosition, setVisible]);

  // 언마운트 시 정리.
  useEffect(() => {
    return () => {
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }
    };
  }, []);

  return null;
}
