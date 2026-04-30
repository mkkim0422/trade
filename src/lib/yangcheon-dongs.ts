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

export const YANGCHEON_DONGS: DongInfo[] = [
  {
    name: "신정1동",
    center: { lat: 37.5247, lng: 126.8561 },
    bounds: { north: 37.53, south: 37.519, east: 126.863, west: 126.849 },
  },
  {
    name: "신정2동",
    center: { lat: 37.5191, lng: 126.8563 },
    bounds: { north: 37.525, south: 37.513, east: 126.863, west: 126.849 },
  },
  {
    name: "신정3동",
    center: { lat: 37.5147, lng: 126.8608 },
    bounds: { north: 37.521, south: 37.508, east: 126.868, west: 126.854 },
  },
  {
    name: "신정4동",
    center: { lat: 37.509, lng: 126.8625 },
    bounds: { north: 37.515, south: 37.503, east: 126.87, west: 126.855 },
  },
  {
    name: "신정6동",
    center: { lat: 37.5203, lng: 126.8486 },
    bounds: { north: 37.526, south: 37.514, east: 126.856, west: 126.841 },
  },
  {
    name: "신정7동",
    center: { lat: 37.5147, lng: 126.8486 },
    bounds: { north: 37.521, south: 37.508, east: 126.856, west: 126.841 },
  },
  {
    name: "목1동",
    center: { lat: 37.5324, lng: 126.8753 },
    bounds: { north: 37.538, south: 37.527, east: 126.883, west: 126.868 },
  },
  {
    name: "목2동",
    center: { lat: 37.5385, lng: 126.8648 },
    bounds: { north: 37.544, south: 37.533, east: 126.872, west: 126.858 },
  },
  {
    name: "목3동",
    center: { lat: 37.528, lng: 126.8648 },
    bounds: { north: 37.534, south: 37.522, east: 126.872, west: 126.858 },
  },
  {
    name: "목4동",
    center: { lat: 37.5324, lng: 126.8542 },
    bounds: { north: 37.538, south: 37.527, east: 126.861, west: 126.847 },
  },
  {
    name: "목5동",
    center: { lat: 37.5435, lng: 126.8753 },
    bounds: { north: 37.549, south: 37.538, east: 126.883, west: 126.868 },
  },
  {
    name: "신월1동",
    center: { lat: 37.5191, lng: 126.8347 },
    bounds: { north: 37.525, south: 37.513, east: 126.842, west: 126.827 },
  },
  {
    name: "신월2동",
    center: { lat: 37.509, lng: 126.8347 },
    bounds: { north: 37.515, south: 37.503, east: 126.842, west: 126.827 },
  },
  {
    name: "신월3동",
    center: { lat: 37.5034, lng: 126.8347 },
    bounds: { north: 37.509, south: 37.498, east: 126.842, west: 126.827 },
  },
  {
    name: "신월4동",
    center: { lat: 37.509, lng: 126.8208 },
    bounds: { north: 37.515, south: 37.503, east: 126.828, west: 126.814 },
  },
  {
    name: "신월5동",
    center: { lat: 37.5147, lng: 126.8208 },
    bounds: { north: 37.521, south: 37.508, east: 126.828, west: 126.814 },
  },
  {
    name: "신월6동",
    center: { lat: 37.5034, lng: 126.8208 },
    bounds: { north: 37.509, south: 37.498, east: 126.828, west: 126.814 },
  },
  {
    name: "신월7동",
    center: { lat: 37.4978, lng: 126.8208 },
    bounds: { north: 37.504, south: 37.492, east: 126.828, west: 126.814 },
  },
];

export function detectDong(lat: number, lng: number): DongInfo | null {
  for (const dong of YANGCHEON_DONGS) {
    if (
      lat >= dong.bounds.south &&
      lat <= dong.bounds.north &&
      lng >= dong.bounds.west &&
      lng <= dong.bounds.east
    ) {
      return dong;
    }
  }
  return null;
}

export function extractDongFromAddress(address: string): string | null {
  for (const dong of YANGCHEON_DONGS) {
    const dongName = dong.name.replace(/[0-9]/g, "");
    if (address.includes(dongName) || address.includes(dong.name)) {
      return dong.name;
    }
  }
  return null;
}
