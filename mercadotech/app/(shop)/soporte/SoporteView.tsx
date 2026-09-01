"use client";

import { ChatWindow } from "@/components/chat/ChatWindow";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { TicketCard } from "@/components/support/TicketCard";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { useMyTickets } from "@/hooks/useMyTickets";

// Conector hook ↔ componentes puros. La sesión ya la exige el middleware
// (decisión 3): si esta página se renderiza, hay sesión.
//
// AMPLÍA con voz en la sesión 8: el botón de micrófono se agrega junto al
// ChatInput de abajo — este layout ya le deja el espacio (el div que envuelve
// el chat tiene ancho fijo, no full-bleed, para que quepa al lado).
export function SoporteView() {
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useChat("soporte");
  const { tickets, loading: ticketsLoading, error: ticketsError, retry } = useMyTickets(
    user?.id ?? null,
  );

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Soporte</h1>
          {/* Textos MÁS cortos que en /asistente: en la sesión 8 se leen en
              voz alta (ver lib/ai/prompts.ts, SUPPORT_SYSTEM_INSTRUCTIONS). */}
          <p className="text-sm text-muted-foreground">Escribe tu consulta.</p>
        </div>
        <ChatWindow
          messages={messages}
          loading={loading}
          onSend={sendMessage}
          emptyTitle="¿En qué te ayudamos?"
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Mis tickets</h2>
        {ticketsLoading ? (
          <LoadingState lines={3} />
        ) : ticketsError ? (
          <ErrorState onRetry={retry} />
        ) : tickets.length === 0 ? (
          <EmptyState
            title="Todavía no tienes tickets"
            description="Si el asistente no puede resolver tu consulta, te sugerirá crear uno."
          />
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
