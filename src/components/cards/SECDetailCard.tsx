"use client";

import type { SECScore } from "@/lib/analysis";

interface SECDetailCardProps {
  sec: SECScore;
}

function scoreColor(score: number | undefined): string {
  if (score === undefined) return "text-slate-400";
  if (score >= 90) return "text-blue-600";
  if (score >= 70) return "text-green-600";
  if (score >= 50) return "text-purple-600";
  return "text-orange-500";
}

interface MetricCellProps {
  score?: number;
  label: string;
}

function MetricCell({ score, label }: MetricCellProps) {
  return (
    <div>
      <div className={`text-lg font-bold ${scoreColor(score)}`}>
        {score ?? "-"}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

export default function SECDetailCard({ sec }: SECDetailCardProps) {
  const isWorst = sec.kind === "worst";
  const theme = isWorst
    ? {
        wrap: "bg-gradient-to-br from-red-50 to-rose-50 border-red-400",
        avatarBg: "bg-gradient-to-br from-red-700 to-red-500",
        emoji: "⚠️",
        title: "최악 입지",
        subtitle: "Strategic Avoidance Candidate",
        titleColor: "text-red-900",
        subtitleColor: "text-red-700",
        scoreColor: "text-red-600",
        accent: "bg-red-500",
        badge: "text-red-800 bg-red-100 border-red-300",
        reasonHeading: "주의 이유",
      }
    : {
        wrap: "bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-400",
        avatarBg: "bg-gradient-to-br from-yellow-500 to-orange-500",
        emoji: "🏆",
        title: "최적 입지",
        subtitle: "Strategic Entry Candidate",
        titleColor: "text-yellow-900",
        subtitleColor: "text-yellow-700",
        scoreColor: "text-yellow-600",
        accent: "bg-yellow-500",
        badge: "text-yellow-800 bg-yellow-100 border-yellow-300",
        reasonHeading: "추천 이유",
      };

  return (
    <div className={`rounded-xl border-2 p-5 shadow-lg ${theme.wrap}`}>
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md ${theme.avatarBg}`}
        >
          <span className="text-white font-bold text-xl">{theme.emoji}</span>
        </div>
        <div>
          <h3 className={`text-lg font-bold ${theme.titleColor}`}>
            {theme.title}
          </h3>
          <p className={`text-xs ${theme.subtitleColor}`}>{theme.subtitle}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 mb-4">
        <h4 className="font-bold text-sm text-slate-900 mb-2">
          {sec.storeName}
        </h4>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
            폐업 매장
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 mb-4">
        <div className="text-center">
          <div className={`text-4xl font-bold mb-1 ${theme.scoreColor}`}>
            {sec.totalScore}
            <span className="text-lg text-slate-500">/100</span>
          </div>
          <div className="text-xs text-slate-600">종합 점수</div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-4 gap-3 text-center">
          <MetricCell score={sec.ludScore} label="입지 안전도" />
          <MetricCell score={sec.segScore} label="상권 안정성" />
          <MetricCell score={sec.trendScore} label="추세 점수" />
          <MetricCell score={sec.foottrafficScore} label="유동인구" />
          <MetricCell score={sec.categoryScore} label="업종 적합도" />
          <MetricCell score={sec.vacancyScore} label="공실 시기" />
          <MetricCell score={sec.longTermScore} label="장수 매장" />
          <MetricCell score={sec.areaScore} label="면적 적정성" />
        </div>
      </div>

      <div className="bg-white rounded-lg p-4">
        <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
          <span className={`w-1 h-4 rounded-full ${theme.accent}`}></span>
          {theme.reasonHeading}
        </h4>
        <p className="text-sm text-slate-700 leading-relaxed">
          {sec.reasoning}
        </p>
      </div>

      <div className="mt-4">
        <p className={`text-xs px-2.5 py-1.5 rounded-md border ${theme.badge}`}>
          <span className="font-semibold">Mock</span> ·{" "}
          {isWorst ? "출점 회피 분석" : "재출점 적정도 분석"} (MVP)
        </p>
      </div>
    </div>
  );
}
