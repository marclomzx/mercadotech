"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { useRef, type ChangeEvent } from "react";

import { ProductImage } from "@/components/shared/ProductImage";
import { Button } from "@/components/ui/button";
import { MAX_IMAGES_PER_PRODUCT } from "@/lib/constants/product";
import { cn } from "@/lib/utils";

export type GalleryItem = {
  key: string;
  url: string;
};

type SortableImageGalleryProps = {
  items: GalleryItem[];
  error?: string;
  onReorder: (keys: string[]) => void;
  onAddFiles: (files: File[]) => void;
  onRemove: (key: string) => void;
};

// DRAG & DROP #1. Puro: recibe items (ya con la url resuelta) y emite el
// nuevo orden de keys — no sabe si son locales o persistidas, eso lo maneja
// useProductForm. KeyboardSensor activado para que el reorden funcione
// también con teclado (Tab al asa, Espacio, flechas, Espacio).
export function SortableImageGallery({
  items,
  error,
  onReorder,
  onAddFiles,
  onRemove,
}: SortableImageGalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 5px de tolerancia: distingue un clic (quitar) de un arrastre.
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.key === active.id);
    const newIndex = items.findIndex((item) => item.key === over.id);
    onReorder(arrayMove(items, oldIndex, newIndex).map((item) => item.key));
  }

  // Posición 1-based de una key, para los anuncios de accesibilidad.
  function position(key: string | number) {
    return items.findIndex((item) => item.key === key) + 1;
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) onAddFiles(files);
    // Permite volver a elegir el mismo archivo si se quitó antes.
    event.target.value = "";
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Imágenes</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={items.length >= MAX_IMAGES_PER_PRODUCT}
        >
          Agregar imágenes
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Seleccionar imágenes del producto"
      />

      <p className="text-xs text-muted-foreground">
        Arrastra para reordenar. La primera imagen es la portada. Máximo{" "}
        {MAX_IMAGES_PER_PRODUCT}, hasta 5 MB cada una (JPG, PNG o WebP).
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements: {
            // Se anuncia la POSICIÓN (1 de 3), no el id: las keys son uuids
            // o nombres internos y no le dicen nada a quien usa lector de
            // pantalla. La posición es justamente lo que se está cambiando.
            onDragStart: ({ active }) =>
              `Imagen ${position(active.id)} de ${items.length} tomada.`,
            onDragOver: ({ active, over }) =>
              over
                ? `Imagen ${position(active.id)} sobre la posición ${position(over.id)}.`
                : "",
            onDragEnd: ({ active, over }) =>
              over
                ? `Imagen movida a la posición ${position(over.id)} de ${items.length}.`
                : `Imagen ${position(active.id)} soltada sin cambios.`,
            onDragCancel: () => "Movimiento cancelado. La imagen vuelve a su posición.",
          },
        }}
      >
        <SortableContext items={items.map((item) => item.key)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {items.map((item, index) => (
              <SortableImage
                key={item.key}
                item={item}
                isCover={index === 0}
                position={index + 1}
                total={items.length}
                onRemove={onRemove}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

type SortableImageProps = {
  item: GalleryItem;
  isCover: boolean;
  position: number;
  total: number;
  onRemove: (key: string) => void;
};

function SortableImage({ item, isCover, position, total, onRemove }: SortableImageProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });

  // Los botones se identifican por posición: sin esto, un lector de pantalla
  // solo oiría "Quitar imagen" repetido N veces, sin saber cuál es cuál.
  const label = isCover
    ? `imagen ${position} de ${total} (portada)`
    : `imagen ${position} de ${total}`;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative overflow-hidden rounded-lg border",
        isDragging && "z-10 opacity-70",
        isCover && "border-primary",
      )}
    >
      {/* alt vacío a propósito: los botones de abajo ya nombran la imagen
          por su posición, así no se repite el mismo dato dos veces. */}
      <ProductImage src={item.url} alt="" className="aspect-square w-full" />

      {isCover && (
        <span className="absolute top-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
          Portada
        </span>
      )}

      <button
        type="button"
        className="absolute top-1 right-1 rounded bg-background/80 p-1 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onClick={() => onRemove(item.key)}
        aria-label={`Quitar ${label}`}
      >
        <X className="size-3" aria-hidden="true" />
      </button>

      {/* Asa dedicada: el arrastre solo empieza acá, así el botón de quitar
          sigue siendo clicable sin disparar un drag por accidente. */}
      <button
        type="button"
        className="absolute right-1 bottom-1 cursor-grab rounded bg-background/80 p-1 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={`Reordenar ${label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3" aria-hidden="true" />
      </button>
    </div>
  );
}
