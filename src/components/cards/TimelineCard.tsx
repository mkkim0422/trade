"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Store } from "@/types";
import { loadMonthly, nearbyMonthAvg, type MonthRow } from "@/lib/monthly";
import { buildTimelineMessage } from "@/lib/narrative";

interface Props {
  store: Store | null;
}

const RANGE_START = "2020-01";
const RANGE_END = "2026-05";

export default function TimelineCard({ store }: Props) {
  const [allMonths, setAllMonths] = useState<MonthRow[]>([]);
  const [overallAvg, setOverallAvg] = useState(15.1);

  useEffect(() => {
    loadMonthly()
      .then((d) => {
        setAllMonths(d.months);
        setOverallAvg(d.totalStores / d.monthCount);
      })
      .catch((err) => console.error("월별 폐업 로드 실패:", err));
  }, []);

  const months = useMemo(
    () =>
      allMonths.filter((m) => m.month >= RANGE_START && m.month <= RANGE_END),
    [allMonths],
  );

  const targetMonth = store?.closeDate?.slice(0, 7) ?? null;
  const targetIdx = useMemo(
    () => (targetMonth ? months.findIndex((m) => m.month === targetMonth) : -1),
    [months, targetMonth],
  );

  const nearbyAvg = useMemo(
    () => (targetMonth ? nearbyMonthAvg(months, targetMonth) : null),
    [months, targetMonth],
  );

  const message = useMemo(
    () => buildTimelineMessage(targetMonth, nearbyAvg, overallAvg),
    [targetMonth, nearbyAvg, overallAvg],
  );

  // X축 ticks: 시작 / 중간 / 끝 + 폐업 시점.
  const xTicks = useMemo(() => {
    if (months.length === 0) return [];
    const ticks = new Set<string>([
      months[0].month,
      months[Math.floor(months.length / 2)].month,
      months[months.length - 1].month,
    ]);
    if (targetMonth && targetIdx >= 0) ticks.add(targetMonth);
    return Array.from(ticks).sort();
  }, [months, targetMonth, targetIdx]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2 flex-wrap">
        <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
        ⏱ 강남구 월별 폐업 추세
        <span className="ml-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-orange-100 text-orange-700 border border-orange-200">
          강남구 전체
        </span>
      </h3>
      <div className="text-[10px] text-slate-400 mb-2">
        {RANGE_START} ~ {RANGE_END} · 위 AI 진단(반경 250m)과 다른 범위
      </div>

      {months.length > 0 ? (
        <div style={{ width: "100%", height: 130 }}>
          <ResponsiveContainer>
            <BarChart
              data={months}
              margin={{ top: 8, right: 4, left: -22, bottom: 0 }}
            >
              <XAxis
                dataKey="month"
                tick={{ fontSize: 9, fill: "#94A3B8" }}
                axisLine={{ stroke: "#E2E8F0" }}
                ticks={xTicks}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#94A3B8" }}
                axisLine={{ stroke: "#E2E8F0" }}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "rgba(148,163,184,0.1)" }}
                contentStyle={{
                  fontSize: 11,
                  padding: "4px 8px",
                  border: "1px solid #CBD5E1",
                  borderRadius: 4,
                }}
                labelFormatter={(label) => `${label} · 강남구 전체`}
                formatter={(value) => [`${value}건`, "월 폐업"]}
              />
              <Bar dataKey="count" maxBarSize={6}>
                {months.map((m, i) => (
                  <Cell
                    key={m.month}
                    fill={i === targetIdx ? "#EF4444" : "#94A3B8"}
                  />
                ))}
              </Bar>
              {targetIdx >= 0 && (
                <ReferenceLine
                  x={months[targetIdx].month}
                  stroke="#EF4444"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  label={{
                    value: "이 매장",
                    fontSize: 10,
                    fill: "#EF4444",
                    position: "top",
                  }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[130px] flex items-center justify-center text-xs text-slate-400">
          월별 데이터 로딩…
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-slate-100 text-xs leading-relaxed">
        {targetMonth && nearbyAvg !== null ? (
          <span className="text-slate-700">
            <span className="font-semibold text-red-600">{targetMonth}</span>{" "}
            <span>{message}</span>
          </span>
        ) : (
          <span className="text-slate-500">{message}</span>
        )}
      </div>
    </div>
  );
}
