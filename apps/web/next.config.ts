import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@erp/types", "@erp/shared", "@erp/config"],
};

export default nextConfig;
