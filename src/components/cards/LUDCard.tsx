"use client";

import { memo, useMemo } from "react";
import type { Store } from "@/types";
import { analyzeLUD } from "@/lib/analysis";
import { getRiskLevel } from "@/lib/constants";

interface LUDCardProps {
  store: Store;
  allStores: Store[];
}

const colorClasses: Record<string, string> = {
  red: "bg-red-50 border-red-200 text-red-700",
  orange: "bg-orange-50 border-orange-200 text-orange-700",
  yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
  green: "bg-blue-50 border-blue-200 text-blue-700",
};

function LUDCard({ store, allStores }: LUDCardProps) {
  const analysis = useMemo(
    () => analyzeLUD(store, allStores, 250),
    [store, allStores],
  );

  const riskLevel = getRiskLevel(analysis.score);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
        폐업 위험도
      </h3>

      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-3xl font-bold text-slate-900">
            {analysis.score}
            <span className="text-lg text-slate-500">/100</span>
          </div>
          <div
            className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium border ${colorClasses[riskLevel.color]}`}
          >
            {riskLevel.label}
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-red-500">
            {analysis.nearbyClosedCount}
          </div>
          <div className="text-xs text-slate-500">
            반경 {analysis.radius}m 내 폐업
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">추정 패턴</span>
          <span className="font-medium text-slate-900">
            {analysis.patternLabel}
          </span>
        </div>

        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          {getPatternDescription(analysis.pattern)}
        </p>
      </div>

    </div>
  );
}

function getPatternDescription(pattern: string): string {
  const descriptions: Record<string, string> = {
    supply_excess:
      "동일 업종 매장이 과도하게 밀집되어 경쟁이 치열한 것으로 추정됩니다.",
    demand_decrease:
      "해당 지역의 유동인구 또는 소비 수요가 감소한 것으로 추정됩니다.",
    rental_pressure: "임대료 상승으로 인한 폐업 가능성이 있습니다.",
    unknown: "명확한 패턴을 파악하기 어렵습니다. 추가 데이터가 필요합니다.",
  };
  return descriptions[pattern] || descriptions.unknown;
}

export default memo(LUDCard);
