import Link from "next/link";

import { Price } from "@/components/shared/Price";
import { ProductImage } from "@/components/shared/ProductImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import type { Product } from "@/types/product";

type ProductsTableProps = {
  products: Product[];
  onToggleActive: (productId: string, isActive: boolean) => void;
  onDelete: (productId: string) => void;
};

export function ProductsTable({ products, onToggleActive, onDelete }: ProductsTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <ProductImage
                    src={product.image_url}
                    alt={product.title}
                    className="size-12 shrink-0 rounded-md"
                  />
                  <span className="line-clamp-2 max-w-xs text-sm">{product.title}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Price value={product.price} size="sm" />
              </TableCell>
              <TableCell className="text-right">{product.stock}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    product.is_active
                      ? "border-transparent bg-success/10 text-success"
                      : "border-transparent bg-muted text-muted-foreground"
                  }
                >
                  {product.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/vendedor/productos/${product.id}/editar`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Editar
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleActive(product.id, !product.is_active)}
                  >
                    {product.is_active ? "Desactivar" : "Activar"}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => onDelete(product.id)}>
                    Eliminar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
