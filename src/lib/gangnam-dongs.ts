export interface DongInfo {
  name: string;
  center: { lat: number; lng: number };
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export const GANGNAM_DONGS: DongInfo[] = [
  {
    name: "역삼1동",
    center: { lat: 37.5007, lng: 127.0368 },
    bounds: { north: 37.507, south: 37.494, east: 127.044, west: 127.03 },
  },
  {
    name: "역삼2동",
    center: { lat: 37.4951, lng: 127.0368 },
    bounds: { north: 37.501, south: 37.489, east: 127.044, west: 127.03 },
  },
  {
    name: "논현1동",
    center: { lat: 37.5063, lng: 127.0228 },
    bounds: { north: 37.512, south: 37.5, east: 127.03, west: 127.016 },
  },
  {
    name: "논현2동",
    center: { lat: 37.5119, lng: 127.0298 },
    bounds: { north: 37.518, south: 37.506, east: 127.037, west: 127.023 },
  },
  {
    name: "대치1동",
    center: { lat: 37.495, lng: 127.0635 },
    bounds: { north: 37.501, south: 37.489, east: 127.071, west: 127.056 },
  },
  {
    name: "대치2동",
    center: { lat: 37.5006, lng: 127.0565 },
    bounds: { north: 37.507, south: 37.494, east: 127.064, west: 127.049 },
  },
  {
    name: "대치4동",
    center: { lat: 37.4894, lng: 127.0565 },
    bounds: { north: 37.496, south: 37.483, east: 127.064, west: 127.049 },
  },
  {
    name: "삼성1동",
    center: { lat: 37.5147, lng: 127.0565 },
    bounds: { north: 37.521, south: 37.508, east: 127.064, west: 127.049 },
  },
  {
    name: "삼성2동",
    center: { lat: 37.5147, lng: 127.0495 },
    bounds: { north: 37.521, south: 37.508, east: 127.057, west: 127.042 },
  },
  {
    name: "청담동",
    center: { lat: 37.5203, lng: 127.0495 },
    bounds: { north: 37.527, south: 37.514, east: 127.057, west: 127.042 },
  },
  {
    name: "압구정동",
    center: { lat: 37.5259, lng: 127.0298 },
    bounds: { north: 37.532, south: 37.52, east: 127.037, west: 127.023 },
  },
  {
    name: "신사동",
    center: { lat: 37.5203, lng: 127.0228 },
    bounds: { north: 37.527, south: 37.514, east: 127.03, west: 127.016 },
  },
  {
    name: "개포1동",
    center: { lat: 37.4838, lng: 127.0495 },
    bounds: { north: 37.49, south: 37.477, east: 127.057, west: 127.042 },
  },
  {
    name: "개포2동",
    center: { lat: 37.4782, lng: 127.0635 },
    bounds: { north: 37.485, south: 37.472, east: 127.071, west: 127.056 },
  },
  {
    name: "개포4동",
    center: { lat: 37.4894, lng: 127.0425 },
    bounds: { north: 37.496, south: 37.483, east: 127.05, west: 127.035 },
  },
  {
    name: "일원본동",
    center: { lat: 37.4838, lng: 127.0775 },
    bounds: { north: 37.49, south: 37.477, east: 127.085, west: 127.07 },
  },
  {
    name: "일원1동",
    center: { lat: 37.4894, lng: 127.0845 },
    bounds: { north: 37.496, south: 37.483, east: 127.092, west: 127.077 },
  },
  {
    name: "일원2동",
    center: { lat: 37.495, lng: 127.0915 },
    bounds: { north: 37.501, south: 37.489, east: 127.099, west: 127.084 },
  },
  {
    name: "수서동",
    center: { lat: 37.4838, lng: 127.1055 },
    bounds: { north: 37.49, south: 37.477, east: 127.113, west: 127.098 },
  },
  {
    name: "세곡동",
    center: { lat: 37.467, lng: 127.1055 },
    bounds: { north: 37.474, south: 37.46, east: 127.113, west: 127.098 },
  },
  {
    name: "자곡동",
    center: { lat: 37.4726, lng: 127.0915 },
    bounds: { north: 37.479, south: 37.466, east: 127.099, west: 127.084 },
  },
  {
    name: "율현동",
    center: { lat: 37.467, lng: 127.0775 },
    bounds: { north: 37.474, south: 37.46, east: 127.085, west: 127.07 },
  },
];

const BOUNDS_EXPAND = 0.003;
const FALLBACK_TOLERANCE = 0.005;

export function detectDong(lat: number, lng: number): DongInfo | null {
  for (const dong of GANGNAM_DONGS) {
    if (
      lat >= dong.bounds.south - BOUNDS_EXPAND &&
      lat <= dong.bounds.north + BOUNDS_EXPAND &&
      lng >= dong.bounds.west - BOUNDS_EXPAND &&
      lng <= dong.bounds.east + BOUNDS_EXPAND
    ) {
      return dong;
    }
  }

  for (const dong of GANGNAM_DONGS) {
    if (
      lat >= dong.bounds.south - FALLBACK_TOLERANCE &&
      lat <= dong.bounds.north + FALLBACK_TOLERANCE &&
      lng >= dong.bounds.west - FALLBACK_TOLERANCE &&
      lng <= dong.bounds.east + FALLBACK_TOLERANCE
    ) {
      return dong;
    }
  }

  return null;
}

export function extractDongFromAddress(address: string): string | null {
  for (const dong of GANGNAM_DONGS) {
    if (address.includes(dong.name)) {
      return dong.name;
    }
  }
  if (address.includes("역삼동")) return "역삼1동";
  if (address.includes("논현동")) return "논현1동";
  if (address.includes("대치동")) return "대치1동";
  if (address.includes("삼성동")) return "삼성1동";
  if (address.includes("개포동")) return "개포1동";
  if (address.includes("일원동")) return "일원본동";
  return null;
}
