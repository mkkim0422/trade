"use client";

// Phase 3 — 후보 자리 주소 입력 전용 화면.
// Phase 2 (함정 자리 시각) → 여기서 사용자 후보 자리 입력 → 대시보드 진입.
// 검증 액션을 인트로 안에서 끝내 청중에게 도구 사용법을 한 단계로 보여줌.

import { useEffect, useRef, useState } from "react";
import { useDashboardStore } from "@/store/useDashboardStore";
import { detectDong } from "@/lib/gangnam-dongs";
import {
  DEFAULT_BUSINESS,
  DEMO_TRAP_COORD,
  DEMO_GOLDEN_COORD,
} from "@/lib/virtual-store";

declare global {
  interface Window {
    kakao: any;
  }
}

interface Props {
  onFinish: () => void;
}

export default function IntroPhase3({ onFinish }: Props) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 가상 매장 배치 + 인트로 종료 (대시보드 진입).
  // dong 정보 있으면 강남구 안 → onFinish, 없으면 강남구 밖 → 에러.
  const placeAndFinish = (lat: number, lng: number) => {
    const dong = detectDong(lat, lng);
    if (!dong) {
      setError("강남구 안 주소만 분석 가능합니다");
      return;
    }
    setSelectedStore(null);
    setSelectedSEC(null);
    setVirtualStoreBusiness(DEFAULT_BUSINESS);
    setVirtualStoreVisible(true);
    setVirtualStorePosition({ lat, lng });
    setMapTargetCoord({ lat, lng, zoom: 5 });
    setCurrentDong(dong.name);
    console.log(
      `🔎 인트로 Phase 3 → 대시보드: (${lat.toFixed(5)}, ${lng.toFixed(5)}) · ${dong.name}`,
    );
    onFinish();
  };

  const search = () => {
    const q = query.trim();
    if (!q) {
      setError("주소를 입력하세요");
      inputRef.current?.focus();
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
      placeAndFinish(lat, lng);
    });
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-8 intro-fade-in">
      <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-center">
        후보 자리 주소를 입력해보세요
      </h2>
      <p className="mt-4 text-xl text-slate-300 text-center">
        1차 상권분석에서 받은 자리, 2차로 검증합니다
      </p>

      <div className="mt-14 flex items-center gap-3 w-full max-w-3xl">
        <div className="flex items-center h-16 bg-white rounded-xl flex-1 shadow-2xl">
          <span className="pl-5 text-slate-400 text-xl">📍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") search();
            }}
            placeholder="예: 강남구 역삼동 123-45 · 강남구 테헤란로 123"
            aria-label="후보 자리 주소"
            className="flex-1 h-full px-4 text-lg bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <button
          onClick={search}
          disabled={searching}
          className="h-16 px-8 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-lg font-bold rounded-xl shadow-2xl disabled:opacity-50 transition-colors"
        >
          {searching ? "…" : "검증"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 text-red-400 text-sm font-medium" role="alert">
          {error}
        </div>
      ) : (
        <div className="mt-4 text-slate-500 text-xs">
          Enter 또는 검증 버튼 → 자동 분석
        </div>
      )}

      <div className="mt-12 text-sm text-slate-400 tracking-wide">
        또는 예시로 시작하기
      </div>
      <div className="mt-3 flex gap-3">
        <button
          onClick={() =>
            placeAndFinish(DEMO_TRAP_COORD.lat, DEMO_TRAP_COORD.lng)
          }
          className="px-5 py-3 bg-purple-700 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg border border-purple-500 transition-colors shadow-md"
          title="역삼동 한복판 · 함정 자리 · 250m 폐업 120건"
        >
          🟣 함정 자리 예시
        </button>
        <button
          onClick={() =>
            placeAndFinish(DEMO_GOLDEN_COORD.lat, DEMO_GOLDEN_COORD.lng)
          }
          className="px-5 py-3 bg-amber-700 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg border border-amber-500 transition-colors shadow-md"
          title="청담 명품거리 · 황금 자리 · 250m 폐업 19건"
        >
          🏆 황금 자리 예시
        </button>
      </div>

      <div
        className="absolute bottom-6 right-6 tracking-wide text-slate-400"
        style={{ fontSize: "11px", opacity: 0.5 }}
      >
        주소 입력 또는 예시 버튼 → 자동 분석
      </div>
    </div>
  );
}
