"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

// globals.css define los tokens del tema oscuro bajo `.dark`
// (@custom-variant dark), pero hasta la Fase 3.8 NADA agregaba esa clase:
// el tema oscuro existía y era inalcanzable, incluso con el sistema
// operativo en modo oscuro. Este provider lo conecta:
//   attribute="class"  → escribe/quita la clase `dark` en <html>
//   defaultTheme="system" → sigue la preferencia del sistema operativo
// De paso arregla el <Toaster /> de shadcn, que ya llamaba a useTheme() de
// next-themes sin ningún provider montado.
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
