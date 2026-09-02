"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

type ProductImageProps = {
  src: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  // Solo para la imagen que es el LCP de la pantalla (la portada
  // above-the-fold): la saca del lazy-load para que el navegador la
  // descubra de inmediato. Marcar varias compite entre sí y no sirve.
  priority?: boolean;
};

// Las imágenes del seed no existen todavía en Storage (gap conocido,
// documentado en supabase/seed.sql): sin src o si next/image dispara
// onError, se muestra un placeholder en vez de un ícono roto.
export function ProductImage({ src, alt, className, sizes, priority }: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !src || failed;

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {showPlaceholder ? (
        <div
          role="img"
          aria-label={alt}
          className="flex h-full w-full items-center justify-center text-muted-foreground"
        >
          <ImageOff className="size-8" aria-hidden="true" />
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes ?? "(min-width: 768px) 25vw, 50vw"}
          priority={priority}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
