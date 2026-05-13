"use client";

import { useEffect, useState } from "react";
import CountUpRaf from "@/components/CountUpRaf";
import {
  loadGridAggregates,
  type GridData,
  type IntroSplit,
} from "@/lib/grid-aggregates";

interface Props {
  // head: 최근 3년 누적 한 숫자 + 일평균. split: 상위/하위 30% 분할 비교.
  // 자동 타이머 없음 — 발표자가 IntroOverlay에서 Space로 진행.
  stage: "head" | "split";
}

export default function IntroPhase1({ stage }: Props) {
  const [data, setData] = useState<GridData | null>(null);

  useEffect(() => {
    // 2.21 MB grid-aggregates.json JSON.parse가 메인 스레드 50~150ms 블로킹 →
    // 1.5초 CountUp 도중 jank. 카운트업 종료(+200ms 버퍼) 후 fetch.
    // 데이터 기본값(totalStores=3940)은 실제 값과 일치, split 화면은 사용자가
    // Space로 넘어가는 시점에 이미 fetch 완료.
    const timer = setTimeout(() => {
      loadGridAggregates()
        .then(setData)
        .catch((err) => console.error("격자 데이터 로드 실패:", err));
    }, 1700);
    return () => clearTimeout(timer);
  }, []);

  const totalStores = data?.totalStores ?? 3940;
  const split: IntroSplit | null = data?.introSplit ?? null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-white select-none">
      {stage === "head" ? (
        <Headline totalStores={totalStores} />
      ) : (
        <Split split={split} />
      )}

      <PresenterCue stage={stage} />
    </div>
  );
}

// 분석 기간 = 3년 (precompute의 RECENT_CUTOFF 2023-05-12 ~ 2026-05-12).
const ANALYSIS_DAYS = 1096;

function Headline({ totalStores }: { totalStores: number }) {
  // 일평균은 제거. 도구 정체를 먼저 알린 뒤, 작은 텍스트로 데이터 규모만 명시.
  void totalStores;
  return (
    <div className="text-center intro-fade-in px-8 max-w-4xl">
      <h1
        className="font-bold tracking-tighter text-white intro-glow"
        style={{ fontSize: "72px", lineHeight: 1.05, letterSpacing: "-0.03em" }}
      >
        신규출점 2차 검증 도구
      </h1>
      <p className="mt-8 text-2xl md:text-3xl text-slate-200 font-light tracking-tight">
        1차 상권분석 결과를{" "}
        <span className="text-white font-semibold">2차로 검증</span>합니다
      </p>
      <div className="mt-24 text-sm text-slate-400 tracking-wide">
        강남구 매장{" "}
        <span className="text-slate-200 font-semibold">
          <CountUpRaf end={totalStores} duration={1.2} separator="," />
        </span>
        개 폐업 데이터 기반 (최근 3년)
      </div>
    </div>
  );
}

function Split({ split }: { split: IntroSplit | null }) {
  const top = split?.topClosures ?? 0;
  const bottom = split?.bottomClosures ?? 0;
  const topPct = split?.top ?? 30;
  const bottomPct = split?.bottom ?? 30;
  const ratio =
    bottom > 0 ? Math.round((top / bottom) * 10) / 10 : 0;

  return (
    <div className="text-center intro-fade-in w-full px-12 max-w-6xl">
      <div className="text-sm text-slate-400 tracking-wider mb-10 uppercase">
        1차 도구의 가정 vs 실제 데이터
      </div>
      <div className="grid grid-cols-2 gap-16">
        {/* 좌: 1차의 가정 (텍스트). */}
        <div>
          <div className="text-sm text-slate-500 mb-4 tracking-wide uppercase">
            1차의 가정
          </div>
          <div className="text-4xl md:text-5xl font-bold text-slate-300 tracking-tight leading-tight">
            유동인구
            <br />
            많은 곳
          </div>
          <div className="mt-6 text-xl text-slate-500">= 좋은 자리</div>
        </div>
        {/* 우: 실제 데이터 (숫자). */}
        <div>
          <div className="text-sm text-slate-500 mb-4 tracking-wide uppercase">
            실제 데이터
          </div>
          <div className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
            유동 상위{" "}
            <span className="text-red-400">
              <CountUpRaf end={top} duration={1.5} separator="," />
            </span>
            <br />
            vs 하위{" "}
            <span className="text-slate-400">
              <CountUpRaf end={bottom} duration={1.5} separator="," />
            </span>
          </div>
          <div className="mt-6 text-xl text-slate-400">개 매장 폐업</div>
        </div>
      </div>

      <div className="mt-20 text-4xl font-bold text-white tracking-tight">
        사람 많은 곳이{" "}
        <span className="text-red-400">{ratio}배</span> 더 망합니다
      </div>
      <div className="mt-4 text-lg text-slate-300 tracking-tight">
        1차 분석으로는 안 보이는{" "}
        <span className="text-purple-400 font-semibold">위험</span>
      </div>
    </div>
  );
}

function PresenterCue({ stage }: { stage: "head" | "split" }) {
  const text =
    stage === "head"
      ? "스페이스 또는 → 키로 진행"
      : "스페이스 = 함정 자리 보기";
  return (
    <div
      className="absolute bottom-6 right-6 tracking-wide text-slate-400"
      style={{ fontSize: "11px", opacity: 0.5 }}
    >
      {text}
    </div>
  );
}
