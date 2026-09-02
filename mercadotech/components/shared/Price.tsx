import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

type PriceProps = {
  value: number | string;
  size?: "sm" | "md" | "lg";
  className?: string;
  "data-testid"?: string;
};

const SIZE_CLASSES: Record<NonNullable<PriceProps["size"]>, string> = {
  sm: "text-sm font-medium",
  md: "text-base font-semibold",
  lg: "text-2xl font-bold",
};

export function Price({ value, size = "md", className, "data-testid": testId }: PriceProps) {
  return (
    <span className={cn(SIZE_CLASSES[size], className)} data-testid={testId}>
      {formatPrice(value)}
    </span>
  );
}
