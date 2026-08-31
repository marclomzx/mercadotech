"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { ProductImage } from "@/components/shared/ProductImage";
import { cn } from "@/lib/utils";

type GalleryImage = {
  id: string;
  image_url: string;
};

type ProductGalleryProps = {
  images: GalleryImage[];
  alt: string;
};

// Puro: recibe las imágenes ya resueltas (image_url, ordenadas por
// position por el service). Navegación por teclado ←/→ mientras una
// miniatura o flecha tenga el foco.
export function ProductGallery({ images, alt }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return <ProductImage src={null} alt={alt} className="aspect-square w-full rounded-lg" />;
  }

  function goTo(nextIndex: number) {
    setIndex((nextIndex + images.length) % images.length);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowLeft") goTo(index - 1);
    if (event.key === "ArrowRight") goTo(index + 1);
  }

  return (
    <div className="space-y-3" onKeyDown={handleKeyDown}>
      <div className="relative">
        <ProductImage
          src={images[index].image_url}
          alt={`${alt} — imagen ${index + 1} de ${images.length}`}
          className="aspect-square w-full rounded-lg"
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Imagen anterior"
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Imagen siguiente"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2">
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ver imagen ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-md border-2",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                i === index ? "border-primary" : "border-transparent",
              )}
            >
              <ProductImage src={image.image_url} alt="" className="h-full w-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
