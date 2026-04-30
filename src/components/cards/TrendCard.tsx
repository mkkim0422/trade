"use client";

import { memo, useMemo } from "react";
import type { Store } from "@/types";
import { analyzeTrend } from "@/lib/analysis";

interface TrendCardProps {
  store: Store;
  allStores: Store[];
}

const trendLabels = {
  increasing: { text: "증가 추세", color: "text-red-600" },
  stable: { text: "안정 추세", color: "text-slate-600" },
  decreasing: { text: "감소 추세", color: "text-blue-600" },
} as const;

function TrendCard({ store, allStores }: TrendCardProps) {
  const analysis = useMemo(
    () => analyzeTrend(store, allStores, 250),
    [store, allStores],
  );

  const maxCount = Math.max(
    ...analysis.yearlyClosures.map((y) => y.count),
    1,
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
        5년 추이
      </h3>

      <div className="mb-4">
        <span
          className={`text-sm font-medium ${trendLabels[analysis.trend].color}`}
        >
          {trendLabels[analysis.trend].text}
        </span>
      </div>

      <div className="space-y-2">
        {analysis.yearlyClosures.map(({ year, count }) => (
          <div key={year}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500">{year}년</span>
              <span className="font-medium text-slate-700">{count}개</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="bg-red-400 h-1.5 rounded-full transition-all"
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {analysis.yearlyClosures.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-4">
          데이터가 부족합니다
        </p>
      )}
    </div>
  );
}


export default memo(TrendCard);
