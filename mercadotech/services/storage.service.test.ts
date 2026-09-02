import { describe, expect, it } from "vitest";

import { MAX_IMAGES_PER_PRODUCT } from "@/lib/constants/product";
import {
  PRODUCT_IMAGES_BUCKET,
  addProductImage,
  deleteProductImage,
  getPublicUrl,
  saveImageOrder,
  uploadProductImage,
} from "@/services/storage.service";
import { fail, mockSupabase, ok, pgError } from "@/services/test-utils/supabase-mock";

describe("getPublicUrl", () => {
  it("delega en el método de supabase-js en vez de armar la URL a mano", () => {
    const supabase = mockSupabase({ storage: { publicUrl: "https://cdn/x.jpg" } });

    expect(getPublicUrl(PRODUCT_IMAGES_BUCKET, "s1/p1/0.jpg", supabase)).toBe("https://cdn/x.jpg");
  });
});

describe("uploadProductImage", () => {
  it("arma el path {seller_id}/{product_id}/{n}.{ext} que exige la política del bucket", async () => {
    const supabase = mockSupabase();
    const file = new File(["x"], "foto.png", { type: "image/png" });

    const path = await uploadProductImage(file, "s1", "p1", 2, supabase);

    expect(path).toBe("s1/p1/2.png");
    expect(supabase.storageUploads()[0]).toMatchObject({
      bucket: PRODUCT_IMAGES_BUCKET,
      path: "s1/p1/2.png",
      options: { contentType: "image/png", upsert: true },
    });
  });

  it("la extensión sale del MIME real, no del nombre del archivo", async () => {
    const supabase = mockSupabase();
    // Renombrado a .jpg, pero el navegador reporta webp: manda el MIME.
    const file = new File(["x"], "renombrada.jpg", { type: "image/webp" });

    await expect(uploadProductImage(file, "s1", "p1", 0, supabase)).resolves.toBe("s1/p1/0.webp");
  });

  it("un MIME desconocido cae a jpg", async () => {
    const supabase = mockSupabase();
    const file = new File(["x"], "raro.bin", { type: "application/octet-stream" });

    await expect(uploadProductImage(file, "s1", "p1", 0, supabase)).resolves.toBe("s1/p1/0.jpg");
  });

  it("propaga el error de Storage", async () => {
    const supabase = mockSupabase({ storage: { upload: fail({ message: "quota exceeded" }) } });
    const file = new File(["x"], "foto.png", { type: "image/png" });

    await expect(uploadProductImage(file, "s1", "p1", 0, supabase)).rejects.toMatchObject({
      message: "quota exceeded",
    });
  });
});

describe("deleteProductImage", () => {
  it("borra primero en Storage y después la fila de product_images", async () => {
    const supabase = mockSupabase({ product_images: ok() });

    await deleteProductImage("i1", "s1/p1/0.jpg", supabase);

    expect(supabase.storageRemoves()[0]).toMatchObject({
      bucket: PRODUCT_IMAGES_BUCKET,
      paths: ["s1/p1/0.jpg"],
    });
    expect(supabase.deletes("product_images")).toBe(1);
    expect(supabase.filters("product_images")).toEqual([{ method: "eq", args: ["id", "i1"] }]);
  });

  it("si Storage falla, no borra la fila", async () => {
    const supabase = mockSupabase({ storage: { remove: fail({ message: "not found" }) } });

    await expect(deleteProductImage("i1", "s1/p1/0.jpg", supabase)).rejects.toMatchObject({
      message: "not found",
    });
    expect(supabase.deletes("product_images")).toBe(0);
  });

  it("propaga el error al borrar la fila", async () => {
    const supabase = mockSupabase({ product_images: { delete: fail(pgError("denied", "42501")) } });

    await expect(deleteProductImage("i1", "s1/p1/0.jpg", supabase)).rejects.toMatchObject({
      code: "42501",
    });
  });
});

describe("addProductImage", () => {
  it("registra la fila con su position", async () => {
    const supabase = mockSupabase({
      product_images: { single: { id: "i1", product_id: "p1", image_path: "s1/p1/1.jpg", position: 1 } },
    });

    const image = await addProductImage("p1", "s1/p1/1.jpg", 1, supabase);

    expect(supabase.inserts("product_images")).toEqual([
      { product_id: "p1", image_path: "s1/p1/1.jpg", position: 1 },
    ]);
    expect(image.position).toBe(1);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ product_images: { insert: fail(pgError("denied")) } });

    await expect(addProductImage("p1", "s1/p1/0.jpg", 0, supabase)).rejects.toMatchObject({
      message: "denied",
    });
  });
});

describe("saveImageOrder", () => {
  it("hace upsert con las FILAS COMPLETAS (image_path y product_id son NOT NULL)", async () => {
    const supabase = mockSupabase({ product_images: ok() });
    const items = Array.from({ length: MAX_IMAGES_PER_PRODUCT }, (_, index) => ({
      id: `i${index}`,
      product_id: "p1",
      image_path: `s1/p1/${index}.jpg`,
      position: index,
    }));

    await saveImageOrder(items, supabase);

    expect(supabase.upserts("product_images")).toEqual([items]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ product_images: { upsert: fail(pgError("denied")) } });

    await expect(
      saveImageOrder([{ id: "i1", product_id: "p1", image_path: "s1/p1/0.jpg", position: 0 }], supabase),
    ).rejects.toMatchObject({ message: "denied" });
  });
});
