"use client";

import { useEffect, useState, type ReactNode } from "react";

interface Props {
  text: string;
  // storeId가 바뀌면 타이핑 다시 시작 (매장 변경 시 새 진단 등장 효과).
  storeId: string;
}

const TYPING_MS = 12;

// 타이핑 종료 후 색칠할 키워드. paradox.ts QUADRANT_DEFS의 label과 일치해야 색칠됨.
const HIGHLIGHTS: Array<{ kw: string; color: string }> = [
  { kw: "함정 자리", color: "#A855F7" },
  { kw: "위험 구간", color: "#DC2626" },
  { kw: "황금 구간", color: "#B45309" },
  { kw: "고요 구간", color: "#475569" },
  { kw: "보통 구간", color: "#475569" },
];

export default function AIConsultantCard({ text, storeId }: Props) {
  // 부모(ProgressiveCardStack)가 key={store.id}로 매장당 remount해주므로
  // 매장 변경 시 자동으로 displayed="" / done=false로 fresh start.
  // storeId prop은 이제 일관성 표시용 (직접 동작에 사용 X).
  void storeId;
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, TYPING_MS);
    return () => clearInterval(id);
  }, [text]);

  return (
    <div className="rounded-xl border-2 border-purple-200 p-4 shadow-sm bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-purple-950/40 dark:via-slate-800 dark:to-blue-950/40 dark:border-purple-700/60">
      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
        🤖 AI 진단
      </h3>

      <div
        className="text-[14px] text-slate-800"
        style={{ lineHeight: 1.65, minHeight: 110 }}
      >
        {done ? (
          renderHighlighted(displayed)
        ) : (
          <>
            {displayed}
            <span className="inline-block w-[2px] h-[14px] bg-purple-500 align-middle ml-[1px] animate-pulse" />
          </>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
        <span>자체 분석 엔진 · 50ms</span>
        <span className="opacity-70">Rule-based NLG · no LLM</span>
      </div>
    </div>
  );
}

// 키워드 ("함정 자리" 등)를 색칠한 React 노드 반환.
function renderHighlighted(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  while (cursor < text.length) {
    let nextHit: { idx: number; kw: string; color: string } | null = null;
    for (const h of HIGHLIGHTS) {
      const idx = text.indexOf(h.kw, cursor);
      if (idx >= 0 && (!nextHit || idx < nextHit.idx)) {
        nextHit = { idx, kw: h.kw, color: h.color };
      }
    }
    if (!nextHit) {
      parts.push(text.slice(cursor));
      break;
    }
    if (nextHit.idx > cursor) parts.push(text.slice(cursor, nextHit.idx));
    parts.push(
      <span
        key={`hl-${key++}`}
        className="font-bold"
        style={{ color: nextHit.color }}
      >
        {nextHit.kw}
      </span>,
    );
    cursor = nextHit.idx + nextHit.kw.length;
  }
  return parts;
}
