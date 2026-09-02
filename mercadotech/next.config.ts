import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin esto, el watcher de `next dev` ve los archivos que Playwright escribe
  // en e2e/test-results y e2e/playwright-report DURANTE la corrida (traces,
  // videos, screenshots) como cambios de código y dispara Fast Refresh a
  // mitad del test — remonta la página bajo prueba y produce E2E flaky sin
  // ningún bug real detrás (Fase 6.4).
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/.next/**", "**/e2e/test-results/**", "**/e2e/playwright-report/**"],
    };
    return config;
  },
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
