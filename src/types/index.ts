declare global {
  interface Window {
    kakao: any;
  }
}

export interface Store {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  status: "active" | "closed";
  openDate: string;
  closeDate?: string;
  area: number;
  dong?: string;
}

export {};
