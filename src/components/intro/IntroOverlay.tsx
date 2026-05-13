"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import IntroPhase1 from "./IntroPhase1";
import IntroPhase2 from "./IntroPhase2";
import IntroPhase3 from "./IntroPhase3";

const STORAGE_KEY = "paradox_intro_seen_v1";

// Phase 1을 head/split 두 단계로 쪼개 발표자가 통제.
// Phase 3은 주소 입력 전용 — 가상 매장 자동 배치 후 finish 호출.
type Phase =
  | "loading"
  | "phase1-head"
  | "phase1-split"
  | "phase2"
  | "phase3-address"
  | "done";

interface Props {
  onComplete: () => void;
}

export default function IntroOverlay({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const containerRef = useRef<HTMLDivElement>(null);
  // onComplete를 ref로 보관해 부모 리렌더로 함수 identity가 바뀌어도
  // useEffect deps가 흔들리지 않게 한다. 그렇지 않으면 자식 setSelectedStore →
  // 부모 리렌더 → IntroOverlay useEffect 재실행 cascade가 일어남.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finish = useCallback(() => {
    setPhase("done");
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // localStorage 차단 환경(시크릿 등)에서는 무시.
      }
    }
    onCompleteRef.current();
  }, []);

  // 마운트 시 1회만:
  //   ?intro=skip  → 무조건 인트로 건너뛰기 (발표 리허설/오류 복구).
  //   ?intro=force → localStorage 무시하고 무조건 표시.
  //   파라미터 없음 → localStorage seen 확인.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const param = params.get("intro");
    if (param === "skip") {
      setPhase("done");
      onCompleteRef.current();
      return;
    }
    const force = param === "force";
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    if (!force && seen === "1") {
      setPhase("done");
      onCompleteRef.current();
      return;
    }
    setPhase("phase1-head");
  }, []);

  // 진입 시 컨테이너 자동 포커스 — 키 입력 안 먹는 사고 방지.
  // Phase 3은 input 자동 포커스가 우선이라 컨테이너 포커스 스킵.
  useEffect(() => {
    if (phase === "loading" || phase === "done" || phase === "phase3-address")
      return;
    containerRef.current?.focus();
  }, [phase]);

  // Space / → 키만 활성. Esc는 비활성 (발표 중 잘못 눌러 인트로 종료 방지).
  // document 레벨 리스너 — 컨테이너 포커스 잃어도 키 입력 받음.
  // Phase 3 (주소 입력)에서는 input에 타이핑이 우선 — input/textarea 포커스 시 키 핸들러 패스.
  useEffect(() => {
    if (phase === "loading" || phase === "done") return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
      if (e.code !== "Space" && e.code !== "ArrowRight") return;
      e.preventDefault();
      if (phase === "phase1-head") setPhase("phase1-split");
      else if (phase === "phase1-split") setPhase("phase2");
      else if (phase === "phase2") setPhase("phase3-address");
      // phase3-address: 키로 진행 X (사용자가 검색 or 예시 버튼 클릭으로 finish 호출).
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [phase, finish]);

  if (phase === "loading" || phase === "done") return null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onClick={(e) => {
        // input/button 등 인터랙티브 요소 클릭은 패스 — 그 요소가 포커스 받음.
        // 빈 배경 클릭일 때만 컨테이너로 포커스 복원 (키 핸들러 동작 보장용).
        const target = e.target as HTMLElement;
        if (target.closest("input, textarea, button, a, select")) return;
        containerRef.current?.focus();
      }}
      className="fixed inset-0 z-[9999] bg-black overflow-hidden outline-none"
    >
      {(phase === "phase1-head" || phase === "phase1-split") && (
        <IntroPhase1 stage={phase === "phase1-head" ? "head" : "split"} />
      )}
      {phase === "phase2" && (
        <IntroPhase2 onFinish={() => setPhase("phase3-address")} />
      )}
      {phase === "phase3-address" && <IntroPhase3 onFinish={finish} />}

      {/* 백업 진행 버튼 — Phase 1/2/3 모두 표시. 키 입력 실패 시 마우스 fallback. */}
      <button
        onClick={
          phase === "phase2"
            ? () => setPhase("phase3-address")
            : phase === "phase3-address"
              ? finish
              : finish
        }
        onMouseDown={(e) => e.preventDefault()}
        className="absolute top-6 right-6 z-[10000] text-xs text-slate-300 hover:text-white px-3 py-1.5 border border-slate-700 hover:border-slate-500 rounded-md bg-black/40 backdrop-blur transition-colors"
      >
        {phase === "phase3-address" ? "건너뛰기 →" : "내 자리 검증하러 →"}
      </button>
    </div>
  );
}
