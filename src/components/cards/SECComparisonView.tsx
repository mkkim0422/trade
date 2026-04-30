"use client";

import type { SECScore } from "@/lib/analysis";
import { useDashboardStore } from "@/store/useDashboardStore";

interface SECComparisonViewProps {
  topSEC: SECScore[];
}

function compareScoreColor(score: number | undefined): string {
  if (score === undefined) return "text-slate-400";
  if (score >= 90) return "text-blue-600";
  if (score >= 70) return "text-green-600";
  if (score >= 50) return "text-purple-600";
  return "text-orange-500";
}

function CompareCell({
  score,
  label,
}: {
  score?: number;
  label: string;
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-2 text-center">
      <div className={`text-base font-bold ${compareScoreColor(score)}`}>
        {score ?? "-"}
      </div>
      <div className="text-[10px] text-slate-600">{label}</div>
    </div>
  );
}

export default function SECComparisonView({ topSEC }: SECComparisonViewProps) {
  const setShowSECComparison = useDashboardStore(
    (state) => state.setShowSECComparison,
  );
  const setSelectedSEC = useDashboardStore((state) => state.setSelectedSEC);

  if (topSEC.length === 0) return null;

  const maxScore = Math.max(...topSEC.map((s) => s.totalScore));

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="p-5 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-slate-900">
            🏆 최적 입지 TOP 3 비교
          </h2>
          <button
            onClick={() => setShowSECComparison(false)}
            className="text-slate-400 hover:text-slate-600"
            aria-label="닫기"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-500">
          최적 입지 후보 3곳을 비교 분석합니다
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {topSEC.map((sec, index) => {
          const rank = index + 1;
          const isTop = rank === 1;

          return (
            <div
              key={sec.storeId}
              className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-lg ${
                isTop
                  ? "border-yellow-400 bg-gradient-to-br from-yellow-50 to-white"
                  : "border-slate-200 hover:border-blue-300"
              }`}
              onClick={() => {
                setSelectedSEC(sec);
                setShowSECComparison(false);
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      rank === 1
                        ? "bg-yellow-500 text-white"
                        : rank === 2
                          ? "bg-slate-400 text-white"
                          : "bg-orange-400 text-white"
                    }`}
                  >
                    {rank}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900">
                      {sec.storeName}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      클릭하여 상세보기
                    </div>
                  </div>
                </div>
                {isTop && (
                  <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full">
                    BEST
                  </span>
                )}
              </div>

              <div className="mb-3">
                <div className="flex items-end justify-between mb-1">
                  <span className="text-xs text-slate-600">종합 점수</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {sec.totalScore}
                    <span className="text-sm text-slate-500">/100</span>
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isTop
                        ? "bg-gradient-to-r from-yellow-400 to-orange-500"
                        : "bg-blue-500"
                    }`}
                    style={{
                      width: `${(sec.totalScore / maxScore) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <CompareCell score={sec.ludScore} label="입지" />
                <CompareCell score={sec.segScore} label="상권" />
                <CompareCell score={sec.trendScore} label="추세" />
                <CompareCell score={sec.foottrafficScore} label="유동" />
                <CompareCell score={sec.categoryScore} label="업종" />
                <CompareCell score={sec.vacancyScore} label="공실" />
                <CompareCell score={sec.longTermScore} label="장수" />
                <CompareCell score={sec.areaScore} label="면적" />
              </div>

              {!isTop && (
                <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                  <span className="font-medium">1위와 차이:</span>{" "}
                  <span className="text-red-600 font-bold">
                    -{(topSEC[0].totalScore - sec.totalScore).toFixed(1)}점
                  </span>
                  {sec.ludScore < topSEC[0].ludScore && (
                    <span className="ml-2 text-slate-500">
                      (입지 안전도 낮음)
                    </span>
                  )}
                  {sec.segScore < topSEC[0].segScore && (
                    <span className="ml-2 text-slate-500">
                      (상권 안정성 낮음)
                    </span>
                  )}
                </div>
              )}

              {isTop && (
                <div className="mt-3 pt-3 border-t border-yellow-200">
                  <div className="flex items-center gap-1 text-xs text-yellow-700">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="font-semibold">
                      가장 균형잡힌 최적 입지
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-white border-t border-slate-200">
        <p className="text-xs text-slate-500 text-center">
          💡 각 카드를 클릭하면 상세 정보를 볼 수 있습니다
        </p>
      </div>
    </div>
  );
}
