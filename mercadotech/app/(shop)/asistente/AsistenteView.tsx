"use client";

import { ChatWindow } from "@/components/chat/ChatWindow";
import { useChat } from "@/hooks/useChat";

// Sugerencias realistas, sobre productos/categorías que existen de verdad en
// el seed — no genéricas.
const STARTER_SUGGESTIONS = [
  "¿qué laptop me recomiendas para diseño por menos de S/ 3,500?",
  "busco audífonos inalámbricos para hacer ejercicio",
  "necesito un monitor para trabajar desde casa",
];

// Conector hook ↔ componentes puros — vive en app/, no en components/chat/,
// por la regla de capas (components/ no importa hooks/). La sesión ya la
// exige el middleware (decisión 3): si esta página se renderiza, hay sesión.
export function AsistenteView() {
  const { messages, loading, sendMessage } = useChat("compras");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Asistente de compras</h1>
        <p className="text-sm text-muted-foreground">
          Cuéntame qué buscas y te recomiendo productos reales de MercadoTech.
        </p>
      </div>
      <ChatWindow
        messages={messages}
        loading={loading}
        onSend={sendMessage}
        emptyTitle="¿Qué estás buscando?"
        emptyDescription="Describe lo que necesitas, con tus propias palabras."
        suggestions={STARTER_SUGGESTIONS}
      />
    </div>
  );
}
