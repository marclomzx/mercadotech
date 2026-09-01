"use client";

import { Send } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatInputProps = {
  onSend: (content: string) => void;
  loading: boolean;
};

// Puro: no conoce el endpoint, solo emite onSend con el texto. Enter envía;
// Shift+Enter agrega una línea (patrón estándar de chat).
export function ChatInput({ onSend, loading }: ChatInputProps) {
  const [value, setValue] = useState("");

  function submit() {
    if (!value.trim() || loading) return;
    onSend(value);
    setValue("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t p-3">
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribe tu consulta…"
        disabled={loading}
        rows={1}
        className="max-h-32 resize-none"
        aria-label="Escribe tu consulta"
      />
      <Button
        type="button"
        size="icon"
        onClick={submit}
        disabled={loading || !value.trim()}
        aria-label="Enviar"
      >
        <Send className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
