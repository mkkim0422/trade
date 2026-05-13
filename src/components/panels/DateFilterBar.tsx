"use client";

import { useState } from "react";
import { useDashboardStore } from "@/store/useDashboardStore";

export default function DateFilterBar() {
  const currentDong = useDashboardStore((state) => state.currentDong);
  const dateFilter = useDashboardStore((state) => state.dateFilter);
  const setDateFilter = useDashboardStore((state) => state.setDateFilter);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  const applyPreset = (months: number | null) => {
    if (months === null) {
      setDateFilter({ startDate: null, endDate: null });
      setStartDate("");
      setEndDate("");
    } else {
      const today = new Date();
      const end = today.toISOString().split("T")[0];
      const startObj = new Date();
      startObj.setMonth(startObj.getMonth() - months);
      const start = startObj.toISOString().split("T")[0];
      setDateFilter({ startDate: start, endDate: end });
      setStartDate(start);
      setEndDate(end);
    }
    setShowCustom(false);
  };

  const applyCustom = () => {
    if (!startDate || !endDate) {
      alert("시작일과 종료일을 모두 입력해주세요");
      return;
    }
    if (startDate > endDate) {
      alert("시작일이 종료일보다 늦을 수 없습니다");
      return;
    }
    setDateFilter({ startDate, endDate });
  };

  const getActivePreset = () => {
    if (!dateFilter.startDate || !dateFilter.endDate) return "all";
    const today = new Date();
    const end = new Date(dateFilter.endDate);
    const start = new Date(dateFilter.startDate);
    const diffMonths =
      today.getMonth() -
      start.getMonth() +
      12 * (today.getFullYear() - start.getFullYear());
    const isToday =
      Math.abs(today.getTime() - end.getTime()) < 3 * 24 * 60 * 60 * 1000;
    if (isToday && diffMonths >= 2.5 && diffMonths <= 3.5) return "3m";
    if (isToday && diffMonths >= 5.5 && diffMonths <= 6.5) return "6m";
    if (isToday && diffMonths >= 11.5 && diffMonths <= 12.5) return "1y";
    return "custom";
  };

  const activePreset = getActivePreset();

  const presetClass = (active: boolean) =>
    `flex-1 px-2 py-1.5 text-xs font-medium rounded transition-all ${
      active
        ? "bg-blue-500 text-white shadow-sm"
        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
      <div
        className={`flex items-center justify-between ${collapsed ? "" : "mb-2"}`}
      >
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
          📅 폐업 기간
        </h3>
        <div className="flex items-center gap-2">
          {currentDong && (
            <span className="text-xs text-blue-600 font-medium">
              {currentDong}
            </span>
          )}
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
      <>
      <div className="flex gap-1.5 mb-2">
        <button
          onClick={() => applyPreset(3)}
          className={presetClass(activePreset === "3m")}
        >
          3개월
        </button>
        <button
          onClick={() => applyPreset(6)}
          className={presetClass(activePreset === "6m")}
        >
          6개월
        </button>
        <button
          onClick={() => applyPreset(12)}
          className={presetClass(activePreset === "1y")}
        >
          1년
        </button>
        <button
          onClick={() => applyPreset(null)}
          className={presetClass(activePreset === "all")}
        >
          전체
        </button>
      </div>

      <button
        onClick={() => setShowCustom(!showCustom)}
        className={`w-full px-2 py-1.5 text-xs font-medium rounded transition-all ${
          showCustom || activePreset === "custom"
            ? "bg-slate-700 text-white"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        {showCustom ? "▼ 직접설정" : "▶ 직접설정"}
      </button>

      {showCustom && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <div className="flex gap-1.5 items-center">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              max={endDate || undefined}
            />
            <span className="text-xs text-slate-400">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={startDate || undefined}
            />
            <button
              onClick={applyCustom}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium rounded transition-colors"
            >
              적용
            </button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
