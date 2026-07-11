import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["recharts"],
  webpack: (webpackConfig) => {
    // exceljs pulls Node built-ins; disable them for the browser bundle.
    webpackConfig.resolve = webpackConfig.resolve ?? {};
    webpackConfig.resolve.fallback = {
      ...webpackConfig.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      child_process: false,
    };
    return webpackConfig;
  },
};

export default config;
