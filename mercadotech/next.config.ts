import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Supabase local (Storage sirve /storage/v1/object/public/<bucket>/...).
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Proyecto Supabase hosted (cualquier sub-referencia *.supabase.co).
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
