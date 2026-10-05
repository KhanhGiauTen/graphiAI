import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async redirects() {
    if (process.env.NEXT_PUBLIC_PUBLIC_DEMO !== "true") return []
    return ["/", "/upload", "/projects/:path*", "/settings", "/login", "/register", "/s/:path*"].map((source) => ({ source, destination: "/demo", permanent: false }))
  },
}

export default nextConfig
