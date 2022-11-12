/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  // put other next-pwa options here
});

const nextConfig = {
  reactStrictMode: true,
  serverRuntimeConfig: {
    PROJECT_ROOT: __dirname,
  },
  compiler: {
    emotion: true,
  },
  output: "standalone",
};

module.exports =
  process.env.NODE_ENV === "production" ? withPWA(nextConfig) : nextConfig;
