/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async rewrites() {
    // Proxy /api/* requests to the FastAPI backend.
    // Inside Docker the backend is reachable at http://backend:8000.
    // For local dev outside Docker, fall back to localhost:8000.
    const dest = process.env.BACKEND_INTERNAL_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${dest}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
