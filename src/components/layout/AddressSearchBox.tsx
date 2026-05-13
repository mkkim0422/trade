"use client";

// 주소 → 좌표 변환 → 가상 매장 자동 배치.
// 1차 상권분석 결과 주소를 입력받아 2차 검토로 즉시 진입하는 헤더 검색창.
// 카카오 Geocoding(services 라이브러리)을 사용. MapView가 SDK를 미리 로드.

import { useState } from "react";
import { useDashboardStore } from "@/store/useDashboardStore";
import { detectDong } from "@/lib/gangnam-dongs";
import { DEFAULT_BUSINESS } from "@/lib/virtual-store";

declare global {
  interface Window {
    kakao: any;
  }
}

export default function AddressSearchBox() {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

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
  const setMapTargetCoord = useDashboardStore((s) => s.setMapTargetCoord);
  const setCurrentDong = useDashboardStore((s) => s.setCurrentDong);

  const search = () => {
    const q = query.trim();
    if (!q) {
      setError(null);
      return;
    }
    if (
      typeof window === "undefined" ||
      !window.kakao?.maps?.services?.Geocoder
    ) {
      setError("지도 로딩 중, 잠시 후 다시");
      return;
    }
    setError(null);
    setSearching(true);
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(q, (result: any[], status: string) => {
      setSearching(false);
      if (
        status !== window.kakao.maps.services.Status.OK ||
        !result ||
        result.length === 0
      ) {
        setError("주소를 찾을 수 없습니다");
        return;
      }
      const lat = parseFloat(result[0].y);
      const lng = parseFloat(result[0].x);
      const dong = detectDong(lat, lng);
      if (!dong) {
        setError("강남구 안 주소만 분석 가능합니다");
        return;
      }
      // 가상 매장 자동 배치 — DashboardClient의 placeVirtual과 동일 흐름.
      setSelectedStore(null);
      setSelectedSEC(null);
      setVirtualStoreBusiness(DEFAULT_BUSINESS);
      setVirtualStoreVisible(true);
      setVirtualStorePosition({ lat, lng });
      setMapTargetCoord({ lat, lng, zoom: 5 });
      setCurrentDong(dong.name);
      console.log(
        `🔎 주소 검토: "${q}" → (${lat.toFixed(5)}, ${lng.toFixed(5)}) · ${dong.name}`,
      );
    });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center h-9 bg-white border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-400 transition-colors">
        <span className="pl-2.5 text-slate-400 text-sm leading-none">📍</span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") search();
          }}
          placeholder="주소로 자리 검토"
          aria-label="주소 검색"
          className="h-full px-2 text-sm w-[220px] bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
      </div>
      <button
        onClick={search}
        disabled={searching}
        className="h-9 px-4 rounded-md bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm"
      >
        {searching ? "…" : "검증"}
      </button>
      {error && (
        <span
          className="text-[11px] text-red-600 font-medium whitespace-nowrap"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
}
