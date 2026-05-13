"use client";

import { useSyncExternalStore } from "react";
import CountUpRaf from "@/components/CountUpRaf";

interface Props {
  totalStores: number;
}

// 첫 진입 1회만 카운트업, 이후는 즉시 표시. 발표 인트로 후 푸터에 자리잡을 때 살짝 살아 움직임.
const FLAG_KEY = "trade2-footer-counted";
const STAT_DURATION = 1.5;

// no-op subscribe — sessionStorage는 cross-tab 이벤트가 없고, 우리는 1회 읽기만 필요.
const subscribe = () => () => {};
const getClientSnapshot = () => {
  try {
    return sessionStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
};
const getServerSnapshot = () => false;

export default function FooterStats({ totalStores }: Props) {
  // true면 카운트업 스킵 (이미 봤음).
  const animated = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const handleEnd = () => {
    try {
      sessionStorage.setItem(FLAG_KEY, "1");
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center gap-3 text-[11px] text-slate-600">
      <Stat
        label="폐업 매장"
        value={totalStores}
        animated={animated}
        onEnd={handleEnd}
      />
      <Divider />
      <Stat label="유동인구 격자" value={15241} animated={animated} />
      <Divider />
      <Stat label="분석 지표" value={8} animated={animated} suffix="개" />
      <Divider />
      <Stat label="분석 동" value={15} animated={animated} suffix="개" />
    </div>
  );
}

function Stat({
  label,
  value,
  animated,
  onEnd,
  suffix = "개",
}: {
  label: string;
  value: number;
  animated: boolean;
  onEnd?: () => void;
  suffix?: string;
}) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-slate-800 tabular-nums">
        {animated ? (
          <>{value.toLocaleString()}</>
        ) : (
          <CountUpRaf
            end={value}
            duration={STAT_DURATION}
            separator=","
            onEnd={onEnd}
          />
        )}
        {suffix}
      </span>
    </span>
  );
}

function Divider() {
  return <span className="w-px h-3 bg-slate-300" />;
}
