"use client";

import { memo, useMemo } from "react";
import type { Store } from "@/types";
import {
  analyzeLUD,
  analyzeSEG,
  analyzeTrend,
  generateNarrative,
} from "@/lib/analysis";

interface NarrativeCardProps {
  store: Store;
  allStores: Store[];
}

function NarrativeCard({
  store,
  allStores,
}: NarrativeCardProps) {
  const narrative = useMemo(() => {
    const lud = analyzeLUD(store, allStores, 250);
    const seg = analyzeSEG(store, allStores, 250);
    const trend = analyzeTrend(store, allStores, 250);
    return generateNarrative(lud, seg, trend);
  }, [store, allStores]);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl border border-blue-200 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
        AI 전략 한 줄 평
      </h3>

      <p className="text-sm text-slate-700 leading-relaxed">{narrative}</p>

      <div className="mt-3 pt-3 border-t border-blue-200">
        <p className="text-xs text-blue-700">규칙 기반 자동 생성</p>
      </div>
    </div>
  );
}


export default memo(NarrativeCard);
