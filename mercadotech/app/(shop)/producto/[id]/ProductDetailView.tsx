"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { BuyBox } from "@/components/product/BuyBox";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { QuestionsSection } from "@/components/product/QuestionsSection";
import { ReviewsSection } from "@/components/product/ReviewsSection";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useFavorite } from "@/hooks/useFavorite";
import { useProduct } from "@/hooks/useProduct";
import { useQuestions } from "@/hooks/useQuestions";
import { useReviews } from "@/hooks/useReviews";

type ProductDetailViewProps = {
  productId: string;
};

// Conector hook ↔ componentes puros — vive en app/, no en components/product/,
// por la regla de capas (components/ no importa hooks/).
export function ProductDetailView({ productId }: ProductDetailViewProps) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;

  const { product, images, loading, error, retry } = useProduct(productId);
  const { questions, ask, answer } = useQuestions(productId);
  const {
    reviews,
    average,
    count,
    canReview,
    submit: submitReview,
  } = useReviews(productId, userId);
  const { isFavorite, toggle: toggleFavorite } = useFavorite(productId, userId);
  const { add: addToCart } = useCart(userId);

  function requireLogin() {
    router.push(`/login?redirectTo=/producto/${productId}`);
  }

  if (loading) return <LoadingState lines={8} />;
  if (error) return <ErrorState onRetry={retry} />;
  if (!product) {
    return (
      <EmptyState
        title="Producto no encontrado"
        description="Es posible que ya no esté disponible."
        action={<Button onClick={() => router.push("/")}>Ver catálogo</Button>}
      />
    );
  }

  // answer solo se ofrece si profile.id === product.seller_id — espejo
  // exacto de la condición que exige la política questions_update_seller_answers.
  const isOwner = profile?.id === product.seller_id;

  return (
    <div className="space-y-10">
      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery images={images} alt={product.title} />
        <div className="space-y-6">
          <ProductInfo product={product} />
          <BuyBox
            stock={product.stock}
            isActive={product.is_active}
            isOwnProduct={isOwner}
            hasSession={Boolean(user)}
            isFavorite={isFavorite}
            onAddToCart={(quantity) => {
              addToCart(productId, quantity)
                .then(() => toast.success("Agregado al carrito"))
                .catch((err) =>
                  toast.error(
                    err instanceof Error ? err.message : "No se pudo agregar al carrito",
                  ),
                );
            }}
            onToggleFavorite={() => {
              toggleFavorite().catch(() => toast.error("No se pudo actualizar tu favorito"));
            }}
            onRequireLogin={requireLogin}
          />
        </div>
      </div>

      <QuestionsSection
        questions={questions}
        hasSession={Boolean(user)}
        isOwner={isOwner}
        onAsk={async (question) => {
          if (!userId) return;
          try {
            await ask(userId, question);
          } catch {
            toast.error("No se pudo enviar tu pregunta");
          }
        }}
        onAnswer={async (id, text) => {
          try {
            await answer(id, text);
          } catch {
            toast.error("No se pudo guardar la respuesta");
          }
        }}
        onRequireLogin={requireLogin}
      />

      <ReviewsSection
        reviews={reviews}
        average={average}
        count={count}
        canReview={canReview.allowed}
        onSubmit={async (rating, comment) => {
          if (!userId) return;
          try {
            await submitReview({ buyerId: userId, rating, comment });
            toast.success("Reseña publicada");
          } catch {
            toast.error("No se pudo publicar la reseña");
          }
        }}
      />
    </div>
  );
}
