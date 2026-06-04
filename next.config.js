const withPWA = require("next-pwa")({ dest: "public", disable: process.env.NODE_ENV === "development" });

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  webpack: (config, { nextRuntime }) => {
    // Vercel Edge Runtime does not expose process.version, but @supabase/supabase-js
    // reads it to detect the Node.js environment. Define it so it doesn't throw.
    if (nextRuntime === "edge") {
      const webpack = require("webpack");
      config.plugins.push(
        new webpack.DefinePlugin({
          "process.version": JSON.stringify("v18.0.0"),
        })
      );
    }
    return config;
  },
};

module.exports = withPWA(nextConfig);
