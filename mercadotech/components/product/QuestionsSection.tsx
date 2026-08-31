"use client";

import { useState, type FormEvent } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Question } from "@/types/question";

type QuestionsSectionProps = {
  questions: Question[];
  hasSession: boolean;
  isOwner: boolean;
  onAsk: (question: string) => Promise<void>;
  onAnswer: (questionId: string, answer: string) => Promise<void>;
  onRequireLogin: () => void;
};

// profiles solo es legible por su dueño o admin (política
// profiles_select_own_or_admin) — no hay forma de leer el nombre de quien
// pregunta. Se muestra "Usuario" siempre. Una vista public_profiles
// resolvería esto pero está fuera de alcance de esta sesión (restricción
// explícita: no se crea ninguna migración nueva acá).
export function QuestionsSection({
  questions,
  hasSession,
  isOwner,
  onAsk,
  onAnswer,
  onRequireLogin,
}: QuestionsSectionProps) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAsk(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setSubmitting(true);
    try {
      await onAsk(draft.trim());
      setDraft("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Preguntas y respuestas</h2>

      {hasSession ? (
        <form onSubmit={handleAsk} className="flex flex-col gap-2 sm:flex-row">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escribe tu pregunta..."
            className="min-h-16"
            aria-label="Tu pregunta"
          />
          <Button type="submit" disabled={submitting || !draft.trim()}>
            Preguntar
          </Button>
        </form>
      ) : (
        <Button variant="outline" onClick={onRequireLogin}>
          Inicia sesión para preguntar
        </Button>
      )}

      {questions.length === 0 ? (
        <EmptyState title="Todavía no hay preguntas" description="Sé el primero en preguntar." />
      ) : (
        <ul className="space-y-4">
          {questions.map((question) => (
            <li key={question.id} className="space-y-1 border-b pb-3 last:border-0">
              <p className="text-sm">
                <span className="font-medium">Usuario:</span> {question.question}
              </p>
              {question.answer ? (
                <p className="pl-4 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Vendedor:</span> {question.answer}
                </p>
              ) : isOwner ? (
                <AnswerForm questionId={question.id} onAnswer={onAnswer} />
              ) : (
                <p className="pl-4 text-sm text-muted-foreground">Sin responder todavía.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type AnswerFormProps = {
  questionId: string;
  onAnswer: (questionId: string, answer: string) => Promise<void>;
};

function AnswerForm({ questionId, onAnswer }: AnswerFormProps) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!answer.trim()) return;
    setSubmitting(true);
    try {
      await onAnswer(questionId, answer.trim());
      setAnswer("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 pl-4 sm:flex-row">
      <Textarea
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Responde esta pregunta..."
        className="min-h-12"
        aria-label="Tu respuesta"
      />
      <Button type="submit" size="sm" disabled={submitting || !answer.trim()}>
        Responder
      </Button>
    </form>
  );
}
