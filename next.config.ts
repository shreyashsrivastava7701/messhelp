import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // face-api's browser bundle contains an unused `require` that webpack warns about.
    config.ignoreWarnings = [...(config.ignoreWarnings ?? []), { module: /@vladmandic[\\/]face-api/ }];
    return config;
  },
};

export default nextConfig;
