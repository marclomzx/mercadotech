import Link from "next/link";

import { Price } from "@/components/shared/Price";
import { ProductImage } from "@/components/shared/ProductImage";
import type { ChatSource } from "@/types/chat";

type SourcesListProps = {
  sources: ChatSource[];
};

// Puro: recibe las fuentes ya citadas por el modelo, nada de fetch ni de
// lib/ai/ acá. No arma mini-cards con ProductCard tal cual porque
// ChatSource.metadata NO trae todo lo que Product exige (image_url,
// condition, rating…) — solo lo que embedding.service copió al fichar
// (title, brand, category, price). Con ProductImage(null) cae al mismo
// placeholder que ya usa toda la app cuando no hay imagen real en Storage.
export function SourcesList({ sources }: SourcesListProps) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Fuentes</p>
      <ul className="space-y-1.5">
        {sources.map((source, index) => (
          <li key={`${source.sourceType}-${source.sourceId}`}>
            {source.sourceType === "producto" ? (
              <ProductSourceCard index={index + 1} source={source} />
            ) : (
              <ArticleSourceCard index={index + 1} source={source} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductSourceCard({ index, source }: { index: number; source: ChatSource }) {
  const price = source.metadata.price;

  return (
    <Link
      href={`/producto/${source.sourceId}`}
      className="flex items-center gap-2 rounded-lg border bg-card p-2 text-sm transition-colors hover:border-primary"
    >
      <span className="shrink-0 text-xs text-muted-foreground">[{index}]</span>
      <ProductImage src={null} alt={source.title} className="size-10 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 font-medium">{source.title}</p>
        {typeof price === "number" && <Price value={price} size="sm" />}
      </div>
    </Link>
  );
}

function ArticleSourceCard({ index, source }: { index: number; source: ChatSource }) {
  const category = source.metadata.category;

  return (
    // La página propia del artículo ("¿Cómo devuelvo un producto?" con su
    // contenido completo) no existe todavía en el proyecto — por eso ancla
    // a /soporte, la misma pantalla desde donde se pregunta. Cuando exista
    // esa página, este link cambia y nada más.
    <Link
      href="/soporte"
      className="flex items-center gap-2 rounded-lg border bg-card p-2 text-sm transition-colors hover:border-primary"
    >
      <span className="shrink-0 text-xs text-muted-foreground">[{index}]</span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 font-medium">{source.title}</p>
        {typeof category === "string" && (
          <p className="text-xs text-muted-foreground">{category}</p>
        )}
      </div>
    </Link>
  );
}
