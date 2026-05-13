"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "trade2-theme";

// 발표용 기본값 dark. NEXT_PUBLIC_DEFAULT_THEME=light 시 라이트로 시작.
const DEFAULT_THEME: Theme =
  process.env.NEXT_PUBLIC_DEFAULT_THEME === "light" ? "light" : "dark";

// SSR-safe 초기값. layout의 인라인 스크립트가 html.dark를 paint 전에 칠하므로
// hook 첫 렌더에서 documentElement의 className으로부터 동기화.
function readInitialTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  // theme 변경 시 DOM + localStorage 동기화.
  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") html.classList.add("dark");
    else html.classList.remove("dark");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // private mode 등: 무시.
    }
  }, [theme]);

  const toggle = () => setThemeState((t) => (t === "dark" ? "light" : "dark"));

  return { theme, setTheme: setThemeState, toggle };
}

// layout.tsx <head>에 inline 주입해 paint 전 html.dark 셋팅 → FOUC 방지.
// localStorage 우선, 없으면 DEFAULT_THEME.
export const themeInitScript = `
(function(){
  try {
    var saved = localStorage.getItem('${STORAGE_KEY}');
    var fallback = '${DEFAULT_THEME}';
    var theme = saved === 'light' || saved === 'dark' ? saved : fallback;
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`;
