"use client";

import { memo, useMemo } from "react";
import type { Store } from "@/types";
import { analyzeSEG } from "@/lib/analysis";

interface SEGCardProps {
  store: Store;
  allStores: Store[];
}

function SEGCard({ store, allStores }: SEGCardProps) {
  const analysis = useMemo(
    () => analyzeSEG(store, allStores, 250),
    [store, allStores],
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
        장수 매장 분포
      </h3>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between items-end mb-1">
            <span className="text-xs text-slate-500">5년 이상 영업 비율</span>
            <span className="text-2xl font-bold text-blue-600">
              {analysis.longTermRate}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${analysis.longTermRate}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
          <span className="text-slate-500">평균 영업 기간</span>
          <span className="font-medium text-slate-900">
            {analysis.avgDuration}년
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-slate-500">반경 250m 내 장수 매장</span>
          <span className="font-medium text-slate-900">
            {analysis.nearbyLongTerm}개
          </span>
        </div>
      </div>

    </div>
  );
}

export default memo(SEGCard);
