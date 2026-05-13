"use client";

import { useEffect, useState } from "react";
import { useDashboardStore } from "@/store/useDashboardStore";
import {
  loadVerification,
  type VerificationData,
  type CaseStudy,
} from "@/lib/verification";
import type { Store } from "@/types";

interface Props {
  // 부모에서 verifyOpen일 때만 렌더 (mount 시점 = open). state 자연 reset.
  onClose: () => void;
  allStores: Store[];
  // 발표 직전 익명화 토글. 미지정 시 NEXT_PUBLIC_ANONYMIZE_VERIFY=true 환경변수로 ON.
  // 익명화 모드에서는 매장명 → "한식점 A" 형태로 치환되고 클릭이 비활성된다 (실명 노출 방지).
  anonymize?: boolean;
}

const QUADRANT_LABEL = {
  paradox: { label: "함정 자리", color: "#A855F7", emoji: "🟣" },
  golden: { label: "황금 구간", color: "#F59E0B", emoji: "🏆" },
  risk: { label: "위험 구간", color: "#EF4444", emoji: "⚠️" },
  calm: { label: "고요 구간", color: "#64748B", emoji: "🌙" },
} as const;

const MAX_STORES_PER_CASE = 6;
const ENV_ANONYMIZE = process.env.NEXT_PUBLIC_ANONYMIZE_VERIFY === "true";

// 0 → "A", 1 → "B", ..., 25 → "Z", 26 → "AA".
function letterFor(i: number): string {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export default function VerificationModal({
  onClose,
  allStores,
  anonymize = ENV_ANONYMIZE,
}: Props) {
  const [data, setData] = useState<VerificationData | null>(null);
  const [revealed, setRevealed] = useState(false); // 본문 페이드인 게이트 (AI다움 연출).
  const [caseIdx, setCaseIdx] = useState(0);
  const setSelectedStore = useDashboardStore((s) => s.setSelectedStore);

  useEffect(() => {
    loadVerification()
      .then(setData)
      .catch((err) => console.error("verification 로드 실패:", err));
    // 데이터 캐시되어 즉시 도달해도 350ms 후에 본문 노출.
    const t = setTimeout(() => setRevealed(true), 350);
    return () => clearTimeout(t);
  }, []);

  // Esc로 닫기.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const stats = data?.intervalStats;
  const cases = data?.caseStudies ?? [];
  const currentCase: CaseStudy | undefined = cases[caseIdx];

  // 막대 그래프 — 평균 간격 기준 길이 비례 (가장 긴 것 = 100%).
  const maxMean = stats
    ? Math.max(
        stats.paradox.meanMonths,
        stats.golden.meanMonths,
        stats.risk.meanMonths,
        stats.calm.meanMonths,
      )
    : 1;

  const handleStoreClick = (storeId: string) => {
    if (anonymize) return; // 익명화 모드: 좌패널이 실명을 드러내므로 클릭 차단.
    const store = allStores.find((s) => s.id === storeId);
    if (store) {
      setSelectedStore(store);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9000] bg-black/60 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            🔍 데이터 검증 · 함정 자리의 전염성
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-700 leading-relaxed">
            함정 자리는{" "}
            <span className="font-bold text-purple-600">전염성</span>을
            가집니다. 한 매장이 망하면 평균{" "}
            <span className="font-bold text-purple-600">
              {stats ? stats.paradox.meanMonths : 0.9}개월
            </span>{" "}
            안에 같은 자리(100m)에서 또 망합니다. 고요 구간은{" "}
            <span className="font-bold text-slate-700">
              {stats ? stats.calm.meanMonths : 2.1}개월
            </span>
            .{" "}
            <span className="font-bold text-purple-600">
              {stats
                ? (stats.calm.meanMonths / stats.paradox.meanMonths).toFixed(1)
                : "2.3"}
              배
            </span>{" "}
            빠릅니다.
          </p>

          {(!stats || !revealed) && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <span className="w-2 h-2 rounded-full bg-purple-500 pulse-dot" />
              <div className="text-sm text-slate-500">
                검증 데이터 로딩 중…
              </div>
            </div>
          )}

          {stats && revealed && (
            <section className="card-reveal bg-slate-50 rounded-xl p-5 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 mb-4">
                📊 100m 반경 폐업 간격 비교 (4사분면)
              </h3>
              <div className="space-y-3">
                {(
                  [
                    ["paradox", stats.paradox],
                    ["golden", stats.golden],
                    ["risk", stats.risk],
                    ["calm", stats.calm],
                  ] as const
                ).map(([key, s]) => {
                  const meta = QUADRANT_LABEL[key];
                  const widthPct = (s.meanMonths / maxMean) * 100;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span
                          className="font-semibold"
                          style={{ color: meta.color }}
                        >
                          {meta.emoji} {meta.label}
                        </span>
                        <span className="text-slate-600">
                          평균{" "}
                          <span
                            className="font-bold"
                            style={{ color: meta.color }}
                          >
                            {s.meanMonths}개월
                          </span>{" "}
                          · 중앙값 {s.medianMonths} ·{" "}
                          {(s.clusterRate * 100).toFixed(0)}%가 6개월 내 인근 폐업
                        </span>
                      </div>
                      <div className="h-6 bg-slate-200 rounded overflow-hidden">
                        <div
                          className="h-full rounded transition-all"
                          style={{
                            width: `${widthPct}%`,
                            background: meta.color,
                            opacity: 0.85,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-700">
                <span className="font-bold text-purple-600">함정 vs 고요</span>:{" "}
                {(stats.calm.meanMonths / stats.paradox.meanMonths).toFixed(1)}배
                빠름 · 함정 자리 매장의{" "}
                {(stats.paradox.clusterRate * 100).toFixed(0)}%가 6개월 내 인근
                폐업 경험
              </div>
            </section>
          )}

          {revealed && currentCase && (
            <section className="card-reveal bg-gradient-to-br from-purple-50 to-rose-50 dark:from-purple-950/40 dark:to-rose-950/40 rounded-xl p-5 border-2 border-purple-200 dark:border-purple-700/60">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-purple-900">
                  🔥 실제 사례: 함정 자리의 연쇄 폐업
                </h3>
                {cases.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setCaseIdx((i) => (i - 1 + cases.length) % cases.length)
                      }
                      className="w-7 h-7 rounded-full bg-white border border-purple-200 hover:border-purple-400 text-purple-600"
                      aria-label="이전 케이스"
                    >
                      ‹
                    </button>
                    <span className="text-xs text-purple-700">
                      {caseIdx + 1} / {cases.length}
                    </span>
                    <button
                      onClick={() => setCaseIdx((i) => (i + 1) % cases.length)}
                      className="w-7 h-7 rounded-full bg-white border border-purple-200 hover:border-purple-400 text-purple-600"
                      aria-label="다음 케이스"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>

              <div className="text-xs text-purple-700 mb-4">
                <span className="font-semibold">[{currentCase.location}]</span>{" "}
                · 100m 반경 · {currentCase.spanMonths}개월 안에{" "}
                <span className="font-bold">{currentCase.storeCount}개</span>{" "}
                매장 폐업
              </div>

              <ol className="space-y-2">
                {currentCase.stores
                  .slice(0, MAX_STORES_PER_CASE)
                  .map((s, i) => {
                    const displayName = anonymize
                      ? `${s.business} ${letterFor(i)}`
                      : s.name;
                    return (
                      <li key={s.id} className="flex items-stretch gap-3">
                        <div className="flex flex-col items-center pt-1">
                          <div className="w-2 h-2 rounded-full bg-purple-500" />
                          {i < currentCase.stores.length - 1 &&
                            i < MAX_STORES_PER_CASE - 1 && (
                              <div className="w-px flex-1 bg-purple-300 my-1" />
                            )}
                        </div>
                        <button
                          onClick={() => handleStoreClick(s.id)}
                          disabled={anonymize}
                          className={`flex-1 text-left bg-white rounded-lg px-3 py-2 border border-slate-200 transition-colors ${
                            anonymize
                              ? "cursor-default"
                              : "hover:border-purple-400"
                          }`}
                          aria-label={
                            anonymize ? undefined : `${displayName} 분석하기`
                          }
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-slate-500 mb-0.5">
                                {s.closeDate}
                                {s.gapFromPrevMonths !== null && (
                                  <span className="text-purple-600 font-semibold ml-2">
                                    ↓ {s.gapFromPrevMonths}개월
                                    {s.gapFromPrevMonths < 1 && (
                                      <span className="text-purple-500 font-normal ml-1">
                                        ({Math.round(s.gapFromPrevMonths * 30.44)}일)
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm font-medium text-slate-900 truncate">
                                {displayName}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {anonymize
                                  ? `영업 ${s.durationYears}년`
                                  : `${s.business} · 영업 ${s.durationYears}년`}
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
              </ol>

              {currentCase.stores.length > MAX_STORES_PER_CASE && (
                <div className="mt-2 text-[11px] text-slate-500 text-center">
                  외 {currentCase.stores.length - MAX_STORES_PER_CASE}개 매장 더
                  폐업
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-purple-200 text-xs text-purple-800 text-center">
                같은 100m 안에서 {currentCase.spanMonths}개월간 줄지어 폐업 →{" "}
                <span className="font-bold">
                  이 자리에 새 가게 내는 게 안전할까요?
                </span>
              </div>
            </section>
          )}
        </div>

        <footer className="px-6 py-3 border-t border-slate-200 text-[10px] text-slate-400 text-center">
          데이터: LOCALDATA 강남구 폐업 매장 {(allStores.length || 3940).toLocaleString()}개 (최근 3년) ·
          SKT 50m 격자 유동인구 · 사전 계산 (precompute-paradox.js)
        </footer>
      </div>
    </div>
  );
}
