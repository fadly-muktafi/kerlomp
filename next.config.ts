import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // E2E memakai origin 127.0.0.1; izinkan resource dev (HMR) dari origin itu.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // @phosphor-icons/react bukan library yang dioptimasi default oleh Next.
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default nextConfig;