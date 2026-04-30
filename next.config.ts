import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "t1.daumcdn.net",
      },
    ],
  },
};

export default nextConfig;
