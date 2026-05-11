export interface MarkerDesign {
  icon: string;
  bgColor: string;
  shadowColor: string;
}

export const CATEGORY_DESIGNS: Record<string, MarkerDesign> = {
  한식: {
    icon: "🍚",
    bgColor: "#FF6B35",
    shadowColor: "rgba(255, 107, 53, 0.3)",
  },
  일식: {
    icon: "🍣",
    bgColor: "#FF1493",
    shadowColor: "rgba(255, 20, 147, 0.3)",
  },
  중식: {
    icon: "🥟",
    bgColor: "#EF4444",
    shadowColor: "rgba(239, 68, 68, 0.3)",
  },
  중국식: {
    icon: "🥡",
    bgColor: "#EF4444",
    shadowColor: "rgba(239, 68, 68, 0.3)",
  },
  경양식: {
    icon: "🍝",
    bgColor: "#FBBF24",
    shadowColor: "rgba(251, 191, 36, 0.3)",
  },
  분식: {
    icon: "🍜",
    bgColor: "#3B82F6",
    shadowColor: "rgba(59, 130, 246, 0.3)",
  },
  카페: {
    icon: "☕",
    bgColor: "#92400E",
    shadowColor: "rgba(146, 64, 14, 0.3)",
  },
  까페: {
    icon: "☕",
    bgColor: "#92400E",
    shadowColor: "rgba(146, 64, 14, 0.3)",
  },
  "호프/통닭": {
    icon: "🍺",
    bgColor: "#F59E0B",
    shadowColor: "rgba(245, 158, 11, 0.3)",
  },
  패스트푸드: {
    icon: "🍔",
    bgColor: "#DC2626",
    shadowColor: "rgba(220, 38, 38, 0.3)",
  },
  "외국음식전문점(인도,태국등)": {
    icon: "🌶️",
    bgColor: "#F97316",
    shadowColor: "rgba(249, 115, 22, 0.3)",
  },
  기타: {
    icon: "🍽️",
    bgColor: "#6B7280",
    shadowColor: "rgba(107, 114, 128, 0.3)",
  },
};

export function getMarkerDesign(category: string): MarkerDesign {
  return CATEGORY_DESIGNS[category] || CATEGORY_DESIGNS["기타"];
}

export function createMarkerHTML(
  category: string,
  isSelected: boolean = false,
): string {
  const design = getMarkerDesign(category);
  const border = isSelected ? "4px solid #FFD700" : "3px solid white";

  // drop-shadow filter는 합성기(compositor)에서 매 프레임 재래스터화되므로
  // 카카오 맵 드래그 시 100개 마커가 동시에 GPU를 점유해 버벅임을 유발.
  // box-shadow로 대체하여 합성 레이어 캐싱이 가능하도록 함.
  // will-change: transform으로 마커당 GPU 레이어 격리.
  return `
    <div class="pinterest-marker" style="position:relative;width:44px;height:54px;cursor:pointer;will-change:transform;transition:transform 0.2s ease,filter 0.2s ease;">
      <div style="position:absolute;top:0;left:0;width:44px;height:44px;background:${design.bgColor};border:${border};border-radius:50%;box-shadow:0 4px 8px ${design.shadowColor},0 2px 4px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;pointer-events:none;">
        <span style="font-size:22px;line-height:1;pointer-events:none;">${design.icon}</span>
      </div>
      <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:12px solid ${design.bgColor};pointer-events:none;"></div>
      ${isSelected ? `<div style="position:absolute;top:-4px;left:-4px;width:52px;height:52px;border:3px solid #FFD700;border-radius:50%;animation:pulsering 1.5s ease-in-out infinite;pointer-events:none;"></div>` : ""}
    </div>
  `;
}
