import type { ReactNode } from "react";

import { Container } from "@/components/shared/Container";

import { ShopNavbar } from "./ShopNavbar";

// El navbar se conecta a useAuth/useCategories desde ShopNavbar (Client
// Component colocado): un layout Server Component no puede usar hooks ni
// pasar funciones a través del límite server/client.
//
// Pendiente de conectar en fase posterior: CartIndicator ↔ useCart (3.6) —
// hoy sigue en 0.
export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <ShopNavbar />
      <main className="flex-1">
        <Container className="py-6">{children}</Container>
      </main>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <Container>© {new Date().getFullYear()} MercadoTech</Container>
      </footer>
    </div>
  );
}
