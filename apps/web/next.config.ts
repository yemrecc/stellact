import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace paketleri .ts kaynak olarak yayınlanıyor (main: ./src/index.ts) — Next derlesin.
  transpilePackages: ["@stellact/dna", "@stellact/stellar"],
};

export default nextConfig;
