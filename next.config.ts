import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
