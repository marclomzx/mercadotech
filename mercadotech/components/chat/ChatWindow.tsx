"use client";

import { useEffect, useRef } from "react";

import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { LoadingMessage } from "@/components/chat/LoadingMessage";
import { Button } from "@/components/ui/button";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

type ChatWindowProps = {
  messages: ChatMessageType[];
  loading: boolean;
  onSend: (content: string) => void;
  // Estado vacío (sin mensajes todavía): título + sugerencias clicables.
  // /asistente pasa sugerencias reales; /soporte no pasa ninguna y el
  // bloque queda solo con el título — la lista "Mis tickets" va debajo del
  // componente, no acá.
  emptyTitle: string;
  emptyDescription?: string;
  suggestions?: string[];
};

// Compone la conversación completa. Puro: todo llega por props, no conoce
// el endpoint ni cómo se genera cada respuesta — eso lo resuelve useChat en
// el conector de cada página.
export function ChatWindow({
  messages,
  loading,
  onSend,
  emptyTitle,
  emptyDescription,
  suggestions,
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex h-[32rem] flex-col overflow-hidden rounded-lg border">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="font-medium">{emptyTitle}</p>
            {emptyDescription && (
              <p className="text-sm text-muted-foreground">{emptyDescription}</p>
            )}
            {suggestions && suggestions.length > 0 && (
              <div className="flex flex-col gap-2 pt-2">
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto whitespace-normal text-left"
                    onClick={() => onSend(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((message) => <ChatMessage key={message.id} message={message} />)
        )}
        {loading && <LoadingMessage />}
      </div>
      <ChatInput onSend={onSend} loading={loading} />
    </div>
  );
}
