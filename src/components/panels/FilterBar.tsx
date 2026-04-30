"use client";

import { useMemo } from "react";
import { useDashboardStore } from "@/store/useDashboardStore";
import type { Store } from "@/types";

interface FilterBarProps {
  allStores: Store[];
}

export default function FilterBar({ allStores }: FilterBarProps) {
  const categoryFilter = useDashboardStore((state) => state.categoryFilter);
  const setCategoryFilter = useDashboardStore(
    (state) => state.setCategoryFilter,
  );
  const currentDong = useDashboardStore((state) => state.currentDong);

  const dongStores = useMemo(() => {
    return currentDong
      ? allStores.filter((s) => s.dong === currentDong)
      : allStores;
  }, [allStores, currentDong]);

  const categories = useMemo(() => {
    const countMap = new Map<string, number>();
    dongStores.forEach((store) => {
      const cat = store.category || "기타";
      countMap.set(cat, (countMap.get(cat) || 0) + 1);
    });
    return Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }, [dongStores]);

  const chipClass = (active: boolean) =>
    `px-2 py-1 text-xs font-medium rounded transition-all ${
      active
        ? "bg-blue-500 text-white shadow-sm"
        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
          🏢 업태 필터
          {currentDong && (
            <span className="text-blue-600 ml-1.5 normal-case">
              ({currentDong})
            </span>
          )}
        </h3>
        {categoryFilter && (
          <button
            onClick={() => setCategoryFilter(null)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            초기화
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setCategoryFilter(null)}
          className={chipClass(categoryFilter === null)}
        >
          전체 <span className="opacity-70">({dongStores.length})</span>
        </button>

        {categories.map(({ name, count }) => (
          <button
            key={name}
            onClick={() => setCategoryFilter(name)}
            className={chipClass(categoryFilter === name)}
          >
            {name} <span className="opacity-70">({count})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
