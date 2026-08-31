import type { ReactNode } from "react";

import { SellerSidebar } from "@/components/layout/SellerSidebar";
import { Container } from "@/components/shared/Container";

import { SellerGuard } from "./SellerGuard";

// Guard de rol conectado en la Fase 3.3: SellerGuard (Client Component)
// usa useAuth y expulsa a quien no sea seller/admin. El middleware ya
// cubrió antes el caso "sin sesión" redirigiendo a /login.
export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="border-b md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <SellerSidebar />
      </aside>
      <main className="flex-1">
        <Container className="py-6">
          <SellerGuard>{children}</SellerGuard>
        </Container>
      </main>
    </div>
  );
}
