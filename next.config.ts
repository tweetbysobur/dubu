import type { NextConfig } from "next";

// Optional deps pulled in by wallet connectors that Dubu never uses.
const UNUSED_OPTIONAL = [
  "@x402/core/client",
  "@x402/evm",
  "@x402/evm/exact/client",
  "@x402/evm/upto/client",
  "@x402/svm/exact/client",
  "@react-native-async-storage/async-storage",
];

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.alias = {
      ...config.resolve.alias,
      ...Object.fromEntries(UNUSED_OPTIONAL.map((m) => [m, false])),
    };
    return config;
  },
};

export default nextConfig;
