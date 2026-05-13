"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  LabelList,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  loadGridAggregates,
  type GridAggregate,
} from "@/lib/grid-aggregates";
import { classifyStore, type QuadrantInfo } from "@/lib/paradox";
import { VIRTUAL_STORE_ID } from "@/lib/virtual-store";
import type { Store } from "@/types";

interface Props {
  store: Store | null;
  // SEC LUD 원시값 — 헤더 배지/AI 진단과 동일 스코프.
  nearbyClosedCount: number;
}

// 4사분면 경계 — paradox.ts 임계와 일치.
const X_BOUNDARY = 80; // 반경 250m 폐업
const Y_BOUNDARY = 50; // 격자 foot 원시 (×1000 = 50,000 명/일)

interface DotData {
  closures: number;
  foot: number;
}

export default function ScatterCard({ store, nearbyClosedCount }: Props) {
  const [grids, setGrids] = useState<GridAggregate[]>([]);

  useEffect(() => {
    loadGridAggregates()
      .then((d) => setGrids(d.grids))
      .catch((err) => console.error("격자 데이터 로드 실패:", err));
  }, []);

  // 4사분면 분류 — 헤더 배지와 동일 입력.
  const quadrant: QuadrantInfo | null = useMemo(() => {
    if (!store || grids.length === 0) return null;
    return classifyStore(store, grids, undefined, nearbyClosedCount);
  }, [store, grids, nearbyClosedCount]);

  // 매장 별 — X는 250m 반경 실측, Y는 격자 foot.
  const targetDot: DotData | null =
    quadrant?.grid != null
      ? { closures: nearbyClosedCount, foot: quadrant.grid.foot }
      : null;

  // 축 범위 — 임계선 보이도록 임계의 약 1.6배 확보.
  const xMax = useMemo(
    () => Math.max(160, nearbyClosedCount * 1.2, X_BOUNDARY * 2),
    [nearbyClosedCount],
  );
  const yMax = useMemo(() => {
    const focal = targetDot?.foot ?? 0;
    return Math.max(120, focal * 1.2, Y_BOUNDARY * 2);
  }, [targetDot]);

  const starColor = store?.id === VIRTUAL_STORE_ID ? "#F97316" : "#EF4444";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
        📊 자리별 위험도 분포
      </h3>
      <div className="text-[11px] text-slate-500 mb-2">
        유동인구 + 폐업 기준 자리 분류
      </div>

      {grids.length > 0 ? (
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 12, right: 16, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#F1F5F9" />
              <XAxis
                type="number"
                dataKey="closures"
                domain={[0, xMax]}
                tick={{ fontSize: 9, fill: "#94A3B8" }}
                axisLine={{ stroke: "#E2E8F0" }}
                label={{
                  value: "반경 250m 폐업 (건)",
                  position: "insideBottomRight",
                  offset: 0,
                  fontSize: 10,
                  fill: "#6B7280",
                }}
              />
              <YAxis
                type="number"
                dataKey="foot"
                domain={[0, yMax]}
                tick={{ fontSize: 9, fill: "#94A3B8" }}
                tickFormatter={(v) => (v * 1000).toLocaleString()}
                axisLine={{ stroke: "#E2E8F0" }}
                width={44}
                label={{
                  value: "일평균 유동 (명)",
                  angle: -90,
                  position: "insideLeft",
                  offset: 18,
                  fontSize: 10,
                  fill: "#6B7280",
                }}
              />
              {/* ZAxis range 키워 별이 크게. */}
              <ZAxis range={[600, 600]} />

              {/* 4사분면 배경 — 중앙 큰 라벨로 영역 의미 즉시 인지. */}
              <ReferenceArea
                x1={0}
                x2={X_BOUNDARY}
                y1={Y_BOUNDARY}
                y2={yMax}
                fill="#F59E0B"
                fillOpacity={0.18}
                label={{
                  value: "🏆 황금",
                  position: "center",
                  fontSize: 18,
                  fontWeight: 800,
                  fill: "#B45309",
                  fillOpacity: 0.85,
                }}
              />
              <ReferenceArea
                x1={X_BOUNDARY}
                x2={xMax}
                y1={Y_BOUNDARY}
                y2={yMax}
                fill="#A855F7"
                fillOpacity={0.18}
                label={{
                  value: "🟣 함정",
                  position: "center",
                  fontSize: 18,
                  fontWeight: 800,
                  fill: "#7C3AED",
                  fillOpacity: 0.85,
                }}
              />
              <ReferenceArea
                x1={0}
                x2={X_BOUNDARY}
                y1={0}
                y2={Y_BOUNDARY}
                fill="#94A3B8"
                fillOpacity={0.18}
                label={{
                  value: "🌙 고요",
                  position: "center",
                  fontSize: 18,
                  fontWeight: 800,
                  fill: "#475569",
                  fillOpacity: 0.85,
                }}
              />
              <ReferenceArea
                x1={X_BOUNDARY}
                x2={xMax}
                y1={0}
                y2={Y_BOUNDARY}
                fill="#EF4444"
                fillOpacity={0.18}
                label={{
                  value: "⚠️ 위험",
                  position: "center",
                  fontSize: 18,
                  fontWeight: 800,
                  fill: "#DC2626",
                  fillOpacity: 0.85,
                }}
              />

              {/* 임계선 + 라벨. */}
              <ReferenceLine
                x={X_BOUNDARY}
                stroke="#64748B"
                strokeWidth={1}
                strokeDasharray="3 3"
                ifOverflow="visible"
                label={{
                  value: "폐업 많음 기준 (80건)",
                  position: "insideTopRight",
                  fontSize: 9,
                  fill: "#475569",
                  offset: 4,
                }}
              />
              <ReferenceLine
                y={Y_BOUNDARY}
                stroke="#64748B"
                strokeWidth={1}
                strokeDasharray="3 3"
                ifOverflow="visible"
                label={{
                  value: "유동 많음 기준 (50,000명)",
                  position: "insideTopRight",
                  fontSize: 9,
                  fill: "#475569",
                  offset: 4,
                }}
              />

              {/* 매장 별 — 실 매장 빨강 / 가상 매장 주황. 배경 점 없이 별만 표시. */}
              {targetDot && (
                <Scatter
                  data={[targetDot]}
                  fill={starColor}
                  stroke="#fff"
                  strokeWidth={3}
                  shape="star"
                  legendType="none"
                >
                  <LabelList
                    dataKey="closures"
                    content={(props) => {
                      const x = props.x as number;
                      const y = props.y as number;
                      if (typeof x !== "number" || typeof y !== "number")
                        return null;
                      return (
                        <text
                          x={x + 18}
                          y={y + 5}
                          fontSize={13}
                          fontWeight={800}
                          fill={starColor}
                          style={{
                            paintOrder: "stroke",
                            stroke: "#fff",
                            strokeWidth: 4,
                          }}
                        >
                          ← 이 매장
                        </text>
                      );
                    }}
                  />
                </Scatter>
              )}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[240px] flex items-center justify-center text-xs text-slate-400">
          격자 데이터 로딩…
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-slate-100 text-xs leading-relaxed">
        {quadrant && quadrant.grid ? (
          <span className="text-slate-700">
            이 매장은{" "}
            <span
              className="font-bold px-1.5 py-0.5 rounded"
              style={{ background: quadrant.bg, color: quadrant.color }}
            >
              {quadrant.emoji} {quadrant.label}
            </span>{" "}
            <span className="text-slate-500">
              · 반경 250m 폐업 {nearbyClosedCount}건 · 일평균 유동{" "}
              {Math.round(quadrant.grid.foot * 1000).toLocaleString()}명
            </span>
          </span>
        ) : quadrant && !quadrant.grid ? (
          <span className="text-slate-500">
            매장 위치 인근 격자 데이터 부족, 산점도 별 표시 생략
          </span>
        ) : (
          <span className="text-slate-500">
            매장 선택 시 빨간 별로 위치 표시됩니다.
          </span>
        )}
      </div>
    </div>
  );
}
