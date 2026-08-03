/** @type {import('next').NextConfig} */
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        // The offline snapshot is regenerated after every backend scan — never
        // let a CDN/browser keep a stale copy.
        source: "/data/:path*",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

module.exports = nextConfig;
