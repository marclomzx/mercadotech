"use client";

import { useCallback, useEffect, useState } from "react";

import * as questionService from "@/services/question.service";
import type { Question } from "@/types/question";

export function useQuestions(productId: string) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(() => {
    setLoading(true);
    setError(null);
    questionService
      .listByProduct(productId)
      .then(setQuestions)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudieron cargar las preguntas.");
      })
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const ask = useCallback(
    async (userId: string, question: string) => {
      const created = await questionService.create(productId, userId, question);
      setQuestions((prev) => [created, ...prev]);
    },
    [productId],
  );

  // Optimista: refleja la respuesta antes de que vuelva el servidor; si
  // falla (por ejemplo, el vendedor perdió el producto entre medio), se
  // revierte al estado anterior.
  const answer = useCallback(
    async (questionId: string, answerText: string) => {
      const previous = questions;
      setQuestions((prev) =>
        prev.map((question) =>
          question.id === questionId
            ? { ...question, answer: answerText, answered_at: new Date().toISOString() }
            : question,
        ),
      );
      try {
        const updated = await questionService.answer(questionId, answerText);
        setQuestions((prev) => prev.map((q) => (q.id === questionId ? updated : q)));
      } catch (err) {
        setQuestions(previous);
        throw err;
      }
    },
    [questions],
  );

  return { questions, loading, error, ask, answer, retry: fetchQuestions };
}
