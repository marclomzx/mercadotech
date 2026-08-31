import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href="/" className="text-2xl font-bold text-primary">
        MercadoTech
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
