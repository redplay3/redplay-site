import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "vpsocmwsvwyavrmduzth.supabase.co" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/publications/main-replica",
        destination: "/lineage-2/main/updates/replica",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
