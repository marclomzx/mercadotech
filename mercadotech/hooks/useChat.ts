"use client";

import { useCallback, useState } from "react";

import type { ChatMessage, ChatMode } from "@/types/chat";

const GENERIC_ERROR_TEXT = "No pude procesar tu consulta, intenta de nuevo.";

// hook → fetch → endpoint → service → lib/ai/ (regla de capas de la sesión
// 4): este hook no importa lib/ai ni conoce el proveedor, solo hace un POST
// y traduce la respuesta a estado.
//
// Parametrizado por modo: /asistente usa useChat("compras"),
// /soporte usa useChat("soporte"). El historial vive SOLO en memoria de
// este hook — no hay tabla ni endpoint que lo persista (se pierde al
// recargar, a propósito, fuera del alcance de esta sesión).
export function useChat(mode: ChatMode) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || loading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);

      try {
        const response = await fetch("/api/v1/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed, mode }),
        });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body?.error?.message ?? GENERIC_ERROR_TEXT);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: body.answer,
            sources: body.sources,
          },
        ]);
      } catch (error) {
        // La conversación NUNCA se rompe: un fallo del servidor (token
        // caído, modelo rotado, 401 por sesión expirada a mitad de charla)
        // se convierte en UN MENSAJE MÁS del asistente, no en una pantalla
        // de error aparte. Se registra el motivo real en consola para
        // depurar; el usuario ve siempre el mismo texto amable — el mensaje
        // técnico del servidor no se le expone.
        console.error("[useChat]", error instanceof Error ? error.message : error);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: GENERIC_ERROR_TEXT,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [mode, loading],
  );

  return { messages, loading, sendMessage };
}
