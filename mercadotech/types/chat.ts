// Tipos de la conversación con los asistentes (compras y soporte).

// Los dos asistentes de la sesión 4. El modo decide DOS cosas a la vez: en
// qué fuente busca y con qué instrucciones responde — ver MODE_CONFIG en
// services/chat.service.ts, el único lugar que hace ese mapeo.
export type ChatMode = "compras" | "soporte";

// Una fuente citada en la respuesta. El orden del array ES la numeración
// que el modelo usa al citar ([1], [2]…), así que la UI puede convertir
// cada cita en un enlace por índice.
export type ChatSource = {
  sourceType: string;
  // id del producto o del artículo: con esto la UI arma /producto/[id].
  sourceId: string;
  title: string;
  similarity: number;
  // Copia de los datos de presentación tomada AL FICHAR (título, categoría,
  // precio…). Sirve para pintar la fuente sin otra consulta, pero NO es
  // autoritativa: el precio real puede haber cambiado desde el indexado.
  // Para mostrar precio actual hay que hidratar contra `products`.
  metadata: Record<string, unknown>;
};

export type ChatResult = {
  query: string;
  answer: string;
  // false cuando ninguna ficha superó el umbral de similitud. La respuesta
  // igual existe: las instrucciones de cada modo dicen qué contestar en ese
  // caso ("no encontré productos…" / sugerir un ticket).
  hasRelevantContext: boolean;
  sources: ChatSource[];
  metadata: {
    model: string;
    // Cuántas fichas devolvió la búsqueda…
    retrievedCount: number;
    // …y cuántas de esas entraron de verdad al contexto. La diferencia entre
    // ambas es el insumo de la calibración de la Fase 4.8.
    usedSourceCount: number;
    contextTruncated: boolean;
  };
};

// Mensaje del historial en memoria del navegador (lo usa useChat en 4.7).
// La conversación NO se persiste: no hay tabla ni endpoint que la guarde.
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  // Solo los mensajes del asistente traen fuentes.
  sources?: ChatSource[];
};
