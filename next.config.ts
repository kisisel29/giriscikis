import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/admin/reports/export": ["./assets/fonts/**/*"],
  },
};

export default nextConfig;
