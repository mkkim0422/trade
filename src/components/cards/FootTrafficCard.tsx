"use client";

import { memo } from "react";

interface FootTrafficCardProps {
  dailyAvg: number;
  weekdayAvg: number;
  weekendAvg: number;
}

function FootTrafficCard({
  dailyAvg,
  weekdayAvg,
  weekendAvg,
}: FootTrafficCardProps) {
  const scaledDaily = Math.round(dailyAvg * 1000);
  const scaledWeekday = Math.round(weekdayAvg * 1000);
  const scaledWeekend = Math.round(weekendAvg * 1000);

  const pattern =
    weekdayAvg > weekendAvg * 1.5
      ? "주중 중심 상권 (오피스/업무 지구)"
      : weekendAvg > weekdayAvg * 1.5
        ? "주말 중심 상권 (주거/상업 지구)"
        : "주중/주말 균형 상권";

  return (
    <div className="bg-white rounded-xl border-2 border-blue-200 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-md">
          <span className="text-white font-bold text-xl">👥</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">유동인구 분석</h3>
          <p className="text-xs text-slate-500">반경 250m 기준</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm text-slate-600">일평균</span>
          <span className="text-2xl font-bold text-blue-600">
            {scaledDaily.toLocaleString()}
            <span className="text-sm text-slate-500 ml-1">명</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">주중</div>
          <div className="text-lg font-bold text-slate-900">
            {scaledWeekday.toLocaleString()}
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">주말</div>
          <div className="text-lg font-bold text-slate-900">
            {scaledWeekend.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-3">
        <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
          <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
          상권 패턴
        </h4>
        <p className="text-sm text-slate-700">{pattern}</p>
      </div>

      <div className="mt-4">
        <p className="text-xs text-blue-800 bg-blue-100 px-2.5 py-1.5 rounded-md border border-blue-300">
          <span className="font-semibold">참고</span> · SKT 유동인구 (2024-2025, 추정치 ×1000)
        </p>
      </div>
    </div>
  );
}


export default memo(FootTrafficCard);
