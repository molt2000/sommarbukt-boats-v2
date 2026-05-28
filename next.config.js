const withPWA = require("next-pwa")({ dest: "public", disable: process.env.NODE_ENV === "development" });
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};
module.exports = withPWA(nextConfig);
