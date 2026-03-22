import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "radix-ui",
      "jspdf",
      "exceljs",
    ],
  },
};

export default nextConfig;
