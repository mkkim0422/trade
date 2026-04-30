"use client";

import { useDashboardStore } from "@/store/useDashboardStore";
import type { Store } from "@/types";

export default function ClusterStoreList() {
  const clusterStores = useDashboardStore((state) => state.clusterStores);
  const setClusterStores = useDashboardStore(
    (state) => state.setClusterStores,
  );
  const setSelectedStore = useDashboardStore(
    (state) => state.setSelectedStore,
  );

  if (!clusterStores || clusterStores.length === 0) return null;

  const groupedByCategory = clusterStores.reduce(
    (acc, store) => {
      const cat = store.category || "기타";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(store);
      return acc;
    },
    {} as Record<string, Store[]>,
  );

  return (
    <div className="absolute inset-0 bg-white z-30 flex flex-col">
      <div className="p-4 border-b bg-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-slate-900">
              이 영역의 폐업 매장
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              총 {clusterStores.length}개 매장
            </p>
          </div>
          <button
            onClick={() => setClusterStores(null)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.entries(groupedByCategory)
          .sort((a, b) => b[1].length - a[1].length)
          .map(([category, stores]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-slate-700 mb-2 sticky top-0 bg-white py-1">
                {category} ({stores.length})
              </h3>
              <div className="space-y-2">
                {stores.map((store) => (
                  <button
                    key={store.id}
                    onClick={() => {
                      setSelectedStore(store);
                      setClusterStores(null);
                    }}
                    className="w-full text-left p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition-colors"
                  >
                    <div className="font-medium text-sm text-slate-900">
                      {store.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {store.address}
                    </div>
                    <div className="text-xs text-red-600 mt-1">
                      폐업: {store.closeDate}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
