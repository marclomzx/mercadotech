// Tunables de la capa de IA. TODOS viven acá: ningún umbral, límite ni
// nombre de modelo se hardcodea en lib/ai/ ni en los services.
//
// Los valores vienen calibrados de ReadHub (el proyecto anterior que ya
// integró Hugging Face); cada uno lleva el porqué encima, porque el número
// solo no dice nada y el siguiente que lo toque necesita saber qué se rompe.

// ============================================================
// Embeddings
// ============================================================

// Dimensión del vector que devuelve all-MiniLM-L6-v2. NO es un tunable
// libre: está grabada en la columna `embedding vector(384)` de
// knowledge_embeddings y en la firma de match_knowledge. Cambiarla exige una
// migración (ALTER COLUMN + recrear índice HNSW y función) y re-generar
// todas las fichas — los vectores de dos modelos distintos no son
// comparables entre sí.
export const EMBEDDING_DIMENSIONS = 384;

// Modelo de embeddings por defecto. Se puede sobreescribir con
// HUGGINGFACE_EMBEDDING_MODEL, pero SOLO por otro modelo de 384 dimensiones
// (ver comentario de arriba).
export const EMBEDDING_MODEL_DEFAULT = "sentence-transformers/all-MiniLM-L6-v2";

// MiniLM acepta como máximo 256 tokens (~1000 caracteres) y lo que sobra lo
// DESCARTA EN SILENCIO: no lanza error, simplemente vectoriza un texto
// recortado, y la búsqueda se degrada sin que nadie se entere. Por eso se
// trunca explícitamente acá, y por eso el texto a vectorizar se arma con las
// señales más densas primero (título, marca, categoría) y la descripción
// larga al final: si algo se corta, se corta lo menos importante.
export const MAX_EMBEDDING_INPUT_CHARS = 1000;

// ============================================================
// Búsqueda vectorial
// ============================================================

// Cuántas fichas devuelve una búsqueda si el caller no pide otra cosa. 5 es
// suficiente para que el modelo tenga de dónde elegir sin inflar el contexto.
export const VECTOR_SEARCH_DEFAULT_TOP_K = 5;

// Tope duro: el endpoint recorta cualquier pedido mayor. Evita que un caller
// (o alguien jugando con la API) pida cientos de fichas y haga explotar el
// contexto y la cuota del proveedor.
export const VECTOR_SEARCH_MAX_TOP_K = 20;

// Similitud mínima para considerar relevante una ficha.
// CALIBRADO en la Fase 4.8 con 8 consultas reales (docs/RAG.md): se queda
// en 0.3, pero NO porque sea el número ideal — los datos muestran que
// ningún threshold separa limpiamente señal de ruido en este catálogo. El
// mejor resultado real de una consulta legítima ("audífonos para
// gimnasio", 0.3798) puntúa MÁS BAJO que el peor ruido de una consulta
// irrelevante ("autos usados", 0.4058): subir el umbral lo suficiente para
// filtrar ese ruido también mataría el caso insignia de la búsqueda
// semántica. Es un límite de all-MiniLM-L6-v2 (modelo chico, español
// débil) sobre un catálogo temáticamente homogéneo, no un problema de
// calibración — moverlo cambia qué caso falla, no si alguno falla.
export const VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD = 0.3;

// ============================================================
// Constructor de contexto (se usa en la Fase 4.5)
// ============================================================

// Cuántas fuentes entran como máximo al contexto del modelo. Más fuentes no
// significa mejor respuesta: diluyen la señal y gastan presupuesto.
export const CONTEXT_BUILDER_DEFAULT_MAX_SOURCES = 5;

// El constructor vuelve a filtrar por similitud aunque la búsqueda ya lo
// hizo: puede recibir resultados de otra fuente o con otro umbral, y no debe
// confiar en que vengan filtrados.
//
// Mismo valor y mismo diagnóstico que VECTOR_SEARCH_DEFAULT_SIMILARITY_
// THRESHOLD (ver ese comentario y docs/RAG.md): calibrado en la Fase 4.8,
// se queda en 0.3 porque subirlo no separa señal de ruido en este catálogo.
export const CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY = 0.3;

// Una ficha con menos de 20 caracteres de contenido no aporta nada al modelo
// (un título suelto, un campo vacío) y sí ocupa lugar y confunde.
export const CONTEXT_BUILDER_MIN_CONTENT_LENGTH = 20;

// Presupuesto total de caracteres del contexto. ~8000 caracteres son ~2000
// tokens: deja aire de sobra dentro de la ventana del modelo de chat para el
// system prompt, la pregunta y la respuesta.
export const CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS = 8000;

// Si a la última fuente que entra le quedan menos de 200 caracteres de
// presupuesto, se descarta ENTERA en vez de incluirla cortada: media frase
// sin contexto confunde al modelo más de lo que aporta.
export const CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS = 200;

// ============================================================
// Chat
// ============================================================

// Modelo de chat por defecto. Se sobreescribe con HUGGINGFACE_CHAT_MODEL.
// La disponibilidad de modelos gratuitos ROTA sin aviso: cuando este deje de
// tener proveedor, se cambia la VARIABLE DE ENTORNO por un candidato probado
// contra la API real — cero cambios de código. Ese es justamente el motivo
// de que el nombre del modelo sea configurable y no una constante fija.
export const HUGGINGFACE_CHAT_MODEL_DEFAULT = "meta-llama/Llama-3.1-8B-Instruct";

// Tope de tokens de la respuesta. 1024 alcanza para una recomendación con
// varias opciones citadas; sin tope, una respuesta desbocada gasta cuota.
export const HUGGINGFACE_CHAT_MAX_TOKENS = 1024;

// Largo máximo de la consulta del usuario. Corta payloads absurdos antes de
// gastar una llamada al proveedor (lo valida el endpoint, no el modelo).
export const CHAT_QUERY_MAX_CHARS = 4000;
