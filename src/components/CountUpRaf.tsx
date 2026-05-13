"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  // 목표값.
  end: number;
  // 초 단위 (react-countup 호환).
  duration?: number;
  decimals?: number;
  // "," 등; 빈 문자열이면 그룹 구분 없음.
  separator?: string;
  onEnd?: () => void;
}

// rAF + ease-out cubic. react-countup 대체 — 같은 rAF 패턴이지만 의존성 줄임.
// 주된 효과는 호출부에서 무거운 JSON.parse를 카운트업 종료 후로 지연시키는 것과 짝.
export default function CountUpRaf({
  end,
  duration = 1.5,
  decimals = 0,
  separator = "",
  onEnd,
}: Props) {
  const [value, setValue] = useState(0);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    const durationMs = duration * 1000;
    if (durationMs <= 0 || end === 0) {
      setValue(end);
      onEndRef.current?.();
      return;
    }
    const startTime = performance.now();
    let rafId = 0;
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(end * eased);
      if (t < 1) rafId = requestAnimationFrame(tick);
      else onEndRef.current?.();
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [end, duration]);

  const fmt = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: !!separator,
  });
  return <>{fmt.format(value)}</>;
}
