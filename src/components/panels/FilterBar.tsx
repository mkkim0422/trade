"use client";

import { useMemo, useState } from "react";
import { useDashboardStore } from "@/store/useDashboardStore";
import { getMarkerDesign } from "@/lib/marker-design";
import type { Store } from "@/types";

interface FilterBarProps {
  allStores: Store[];
}

export default function FilterBar({ allStores }: FilterBarProps) {
  const categoryFilter = useDashboardStore((state) => state.categoryFilter);
  const setCategoryFilter = useDashboardStore(
    (state) => state.setCategoryFilter,
  );
  const categoryFilterEnabled = useDashboardStore(
    (state) => state.categoryFilterEnabled,
  );
  const setCategoryFilterEnabled = useDashboardStore(
    (state) => state.setCategoryFilterEnabled,
  );
  const currentDong = useDashboardStore((state) => state.currentDong);
  const [collapsed, setCollapsed] = useState(false);

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
      <div
        className={`flex items-center justify-between ${collapsed ? "" : "mb-2"}`}
      >
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
          🏢 업태 필터
          {currentDong && (
            <span className="text-blue-600 normal-case">({currentDong})</span>
          )}
          <span
            className={`normal-case text-[10px] font-semibold ${categoryFilterEnabled ? "text-blue-600" : "text-slate-400"}`}
          >
            {categoryFilterEnabled ? "ON" : "OFF"}
          </span>
        </h3>
        <div className="flex items-center gap-2">
          {!collapsed && categoryFilterEnabled && categoryFilter && (
            <button
              onClick={() => setCategoryFilter(null)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              초기화
            </button>
          )}
          <button
            onClick={() => setCategoryFilterEnabled(!categoryFilterEnabled)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              categoryFilterEnabled ? "bg-blue-500" : "bg-slate-300"
            }`}
            aria-label="업태 필터 토글"
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                categoryFilterEnabled ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100"
            aria-label={collapsed ? "펼치기" : "접기"}
            title={collapsed ? "펼치기" : "접기"}
          >
            <span className="text-sm">{collapsed ? "▾" : "▴"}</span>
          </button>
        </div>
      </div>

      {!collapsed && (
      <div
        className={`flex flex-wrap gap-1.5 ${categoryFilterEnabled ? "" : "opacity-50"}`}
      >
        <button
          onClick={() => {
            setCategoryFilter(null);
            if (!categoryFilterEnabled) setCategoryFilterEnabled(true);
          }}
          className={chipClass(
            categoryFilterEnabled && categoryFilter === null,
          )}
        >
          전체 <span className="opacity-70">({dongStores.length})</span>
        </button>

        {categories.map(({ name, count }) => {
          const design = getMarkerDesign(name);
          return (
            <button
              key={name}
              onClick={() => {
                setCategoryFilter(name);
                if (!categoryFilterEnabled) setCategoryFilterEnabled(true);
              }}
              className={chipClass(
                categoryFilterEnabled && categoryFilter === name,
              )}
            >
              <span className="mr-1">{design.icon}</span>
              {name} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>
      )}
    </div>
  );
}
