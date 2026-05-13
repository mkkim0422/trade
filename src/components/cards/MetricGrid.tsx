"use client";

import { useMemo, useState } from "react";
import { useDashboardStore } from "@/store/useDashboardStore";
import {
  analyzeLUD,
  analyzeSEG,
  analyzeTrend,
  type SECScore,
} from "@/lib/analysis";
import type { Store } from "@/types";
import type { FootTrafficStats } from "@/lib/foottraffic";
import LUDCard from "./LUDCard";
import SEGCard from "./SEGCard";
import TrendCard from "./TrendCard";
import FootTrafficCard from "./FootTrafficCard";

interface Props {
  store: Store;
  allStores: Store[];
  foottrafficStats: FootTrafficStats;
  // SEC 8지표 — 하단 4개(업종/공실/장수/면적) 표시용. null이면 "—".
  sec: SECScore | null;
}

type ClickableMetric = "lud" | "seg" | "trend" | "foot";
type MetricKey = ClickableMetric | "category" | "vacancy" | "longterm" | "area";

interface MetricCell {
  key: MetricKey;
  label: string;
  score: number | null;
  clickable: boolean;
  hint?: string; // 하단 4개 hover tooltip — 지표 의미.
}

const SCORE_TONE = (s: number | null) => {
  if (s === null) return "text-slate-300";
  if (s >= 70) return "text-emerald-600";
  if (s >= 40) return "text-amber-600";
  return "text-red-500";
};

export default function MetricGrid({
  store,
  allStores,
  foottrafficStats,
  sec,
}: Props) {
  const expandedMetric = useDashboardStore((s) => s.expandedMetric);
  const setExpandedMetric = useDashboardStore((s) => s.setExpandedMetric);
  // 하단 4개 클릭 시 표시할 의미 — 상세 카드까지 안 가고 간단 설명만.
  const [hintCell, setHintCell] = useState<MetricKey | null>(null);

  const cells: MetricCell[] = useMemo(() => {
    const lud = analyzeLUD(store, allStores, 250);
    const seg = analyzeSEG(store, allStores, 250);
    const trend = analyzeTrend(store, allStores, 250);

    // SEC 함수의 점수 로직과 동일 변환 (analysis.ts 안 건드리고 단일 매장용 재현).
    const segScore = Math.min(100, Math.round(seg.avgDuration * 15));
    const trendScore =
      trend.trend === "decreasing"
        ? 80
        : trend.trend === "stable"
          ? 60
          : 30;

    const dailyScaled = foottrafficStats.dailyAvg * 1000;
    let footScore: number | null;
    if (foottrafficStats.gridCount === 0) footScore = null;
    else if (dailyScaled >= 50000) footScore = 100;
    else if (dailyScaled >= 30000) footScore = 90;
    else if (dailyScaled >= 20000) footScore = 80;
    else if (dailyScaled >= 10000) footScore = 70;
    else if (dailyScaled >= 5000) footScore = 60;
    else footScore = 50;

    return [
      { key: "lud", label: "입지", score: lud.score, clickable: true },
      { key: "seg", label: "상권", score: segScore, clickable: true },
      { key: "trend", label: "추세", score: trendScore, clickable: true },
      { key: "foot", label: "유동", score: footScore, clickable: true },
      {
        key: "category",
        label: "업종",
        score: sec?.categoryScore ?? null,
        clickable: false,
        hint: `이 자리의 업종(${store.category}) 폐업 위험도 — 동종 매장 장기 생존율 기반.`,
      },
      {
        key: "vacancy",
        label: "공실",
        score: sec?.vacancyScore ?? null,
        clickable: false,
        hint: "이 자리 인근 100m 최근 공실 기간 — 짧을수록 점수 높음.",
      },
      {
        key: "longterm",
        label: "장수",
        score: sec?.longTermScore ?? null,
        clickable: false,
        hint: "주변 250m 안 5년 이상 영업 매장 비율.",
      },
      {
        key: "area",
        label: "면적",
        score: sec?.areaScore ?? null,
        clickable: false,
        hint: "매장 면적 적합도 — 30~100㎡ 범위가 최적.",
      },
    ];
  }, [store, allStores, foottrafficStats, sec]);

  const expandedCard = (() => {
    switch (expandedMetric) {
      case "lud":
        return <LUDCard store={store} allStores={allStores} />;
      case "seg":
        return <SEGCard store={store} allStores={allStores} />;
      case "trend":
        return <TrendCard store={store} allStores={allStores} />;
      case "foot":
        return foottrafficStats.gridCount > 0 ? (
          <FootTrafficCard
            dailyAvg={foottrafficStats.dailyAvg}
            weekdayAvg={foottrafficStats.weekdayAvg}
            weekendAvg={foottrafficStats.weekendAvg}
          />
        ) : (
          <div className="bg-slate-50 rounded-xl border-2 border-slate-200 p-5 text-center text-sm text-slate-500">
            주변 250m 유동인구 데이터 없음
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
          📊 세부 점수
        </h3>
        <div className="grid grid-cols-4 gap-1.5">
          {cells.map((cell) => {
            const isExpanded = cell.clickable && expandedMetric === cell.key;
            const isHinted = !cell.clickable && hintCell === cell.key;
            return (
              <button
                key={cell.key}
                onClick={() => {
                  if (cell.clickable) {
                    setHintCell(null);
                    setExpandedMetric(cell.key as ClickableMetric);
                  } else {
                    setHintCell(hintCell === cell.key ? null : cell.key);
                  }
                }}
                title={cell.hint}
                className={`p-2 rounded-lg border transition-all text-center cursor-pointer ${
                  isExpanded
                    ? "bg-purple-100 border-purple-400 ring-2 ring-purple-200"
                    : isHinted
                      ? "bg-blue-50 border-blue-300 ring-2 ring-blue-100"
                      : "bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                }`}
                aria-label={`${cell.label} 지표${cell.clickable ? " · 클릭으로 상세 펼치기" : " · 클릭으로 설명 보기"}`}
              >
                <div className={`text-base font-bold ${SCORE_TONE(cell.score)}`}>
                  {cell.score !== null ? cell.score : "—"}
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  {cell.label}
                </div>
              </button>
            );
          })}
        </div>
        {hintCell &&
          (() => {
            const c = cells.find((x) => x.key === hintCell);
            if (!c || !c.hint) return null;
            return (
              <div className="mt-2 p-2 rounded bg-blue-50 border border-blue-200 text-[11px] text-slate-700 leading-snug">
                <span className="font-semibold text-blue-700">
                  {c.label} {c.score !== null ? c.score : "—"}
                </span>{" "}
                · {c.hint}
              </div>
            );
          })()}
      </div>

      {expandedCard}
    </div>
  );
}
