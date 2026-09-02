import { describe, expect, it } from "vitest";

import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_PRODUCT,
  TITLE_MAX,
  TITLE_MIN,
} from "@/lib/constants/product";
import {
  isValid,
  validateImageFile,
  validateProduct,
  type ProductInput,
} from "@/lib/validators/product";

const validInput: ProductInput = {
  title: "a".repeat(TITLE_MIN),
  description: "Descripción de prueba con detalle suficiente.",
  brand: "MarcaTest",
  categoryId: "cat-1",
  condition: "nuevo",
  price: 100,
  stock: 5,
  imageCount: 1,
};

describe("validateProduct — title", () => {
  it(`rechaza un título de ${TITLE_MIN - 1} caracteres y acepta uno de ${TITLE_MIN}`, () => {
    const short = validateProduct({ ...validInput, title: "a".repeat(TITLE_MIN - 1) });
    expect(short.title).toBe(`El título debe tener al menos ${TITLE_MIN} caracteres.`);

    const exact = validateProduct({ ...validInput, title: "a".repeat(TITLE_MIN) });
    expect(exact.title).toBeUndefined();
  });

  it(`acepta un título de ${TITLE_MAX} caracteres y rechaza uno de ${TITLE_MAX + 1}`, () => {
    const exact = validateProduct({ ...validInput, title: "a".repeat(TITLE_MAX) });
    expect(exact.title).toBeUndefined();

    const long = validateProduct({ ...validInput, title: "a".repeat(TITLE_MAX + 1) });
    expect(long.title).toBe(`El título no puede superar los ${TITLE_MAX} caracteres.`);
  });
});

describe("validateProduct — categoryId", () => {
  it("rechaza sin categoría", () => {
    const errors = validateProduct({ ...validInput, categoryId: "" });
    expect(errors.categoryId).toBe("Elige una categoría.");
  });

  it("acepta con categoría", () => {
    const errors = validateProduct({ ...validInput, categoryId: "cat-2" });
    expect(errors.categoryId).toBeUndefined();
  });
});

describe("validateProduct — price", () => {
  it("rechaza un precio que no es numérico (NaN)", () => {
    const errors = validateProduct({ ...validInput, price: "abc" });
    expect(errors.price).toBe("El precio debe ser mayor que 0.");
  });

  it("rechaza precio 0", () => {
    const errors = validateProduct({ ...validInput, price: 0 });
    expect(errors.price).toBe("El precio debe ser mayor que 0.");
  });

  it("rechaza precio negativo", () => {
    const errors = validateProduct({ ...validInput, price: -10 });
    expect(errors.price).toBe("El precio debe ser mayor que 0.");
  });

  it("acepta un precio válido (number)", () => {
    const errors = validateProduct({ ...validInput, price: 149.9 });
    expect(errors.price).toBeUndefined();
  });

  it("acepta un precio válido como string, como llega numeric desde PostgREST", () => {
    const errors = validateProduct({ ...validInput, price: "149.90" });
    expect(errors.price).toBeUndefined();
  });
});

describe("validateProduct — stock", () => {
  // El mensaje real habla de "negativo" aunque la causa sea no-entero: es el
  // comportamiento real del código (una sola rama de error para las dos
  // causas), no algo que este test deba maquillar.
  it("rechaza stock no entero", () => {
    const errors = validateProduct({ ...validInput, stock: 2.5 });
    expect(errors.stock).toBe("El stock no puede ser negativo.");
  });

  it("rechaza stock negativo", () => {
    const errors = validateProduct({ ...validInput, stock: -1 });
    expect(errors.stock).toBe("El stock no puede ser negativo.");
  });

  it("acepta stock 0 (límite inferior válido)", () => {
    const errors = validateProduct({ ...validInput, stock: 0 });
    expect(errors.stock).toBeUndefined();
  });

  it("acepta stock positivo", () => {
    const errors = validateProduct({ ...validInput, stock: 20 });
    expect(errors.stock).toBeUndefined();
  });
});

describe("validateProduct — imágenes", () => {
  it("rechaza sin imágenes", () => {
    const errors = validateProduct({ ...validInput, imageCount: 0 });
    expect(errors.images).toBe("Agrega al menos una imagen.");
  });

  it("acepta 1 imagen (mínimo)", () => {
    const errors = validateProduct({ ...validInput, imageCount: 1 });
    expect(errors.images).toBeUndefined();
  });

  it(`acepta ${MAX_IMAGES_PER_PRODUCT} imágenes (máximo)`, () => {
    const errors = validateProduct({ ...validInput, imageCount: MAX_IMAGES_PER_PRODUCT });
    expect(errors.images).toBeUndefined();
  });

  it(`rechaza ${MAX_IMAGES_PER_PRODUCT + 1} imágenes (excede el máximo)`, () => {
    const errors = validateProduct({
      ...validInput,
      imageCount: MAX_IMAGES_PER_PRODUCT + 1,
    });
    expect(errors.images).toBe(`Máximo ${MAX_IMAGES_PER_PRODUCT} imágenes por producto.`);
  });
});

describe("validateProduct — caso feliz completo", () => {
  it("no produce ningún error con datos válidos", () => {
    const errors = validateProduct(validInput);
    expect(isValid(errors)).toBe(true);
    expect(errors).toEqual({});
  });
});

describe("validateImageFile", () => {
  it("rechaza un tipo de imagen no permitido", () => {
    const file = new File(["contenido"], "foto.gif", { type: "image/gif" });
    expect(validateImageFile(file)).toBe(
      `"foto.gif": solo se permiten imágenes JPG, PNG o WebP.`,
    );
  });

  it(`rechaza un archivo que supera ${MAX_IMAGE_BYTES} bytes`, () => {
    const file = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "grande.jpg", {
      type: "image/jpeg",
    });
    expect(validateImageFile(file)).toBe(`"grande.jpg": supera el máximo de 5 MB.`);
  });

  it(`acepta un archivo de exactamente ${MAX_IMAGE_BYTES} bytes (límite)`, () => {
    const file = new File([new Uint8Array(MAX_IMAGE_BYTES)], "limite.jpg", {
      type: "image/jpeg",
    });
    expect(validateImageFile(file)).toBeNull();
  });

  it.each(ALLOWED_IMAGE_TYPES)("acepta un tipo permitido: %s", (type) => {
    const file = new File(["contenido"], "foto.bin", { type });
    expect(validateImageFile(file)).toBeNull();
  });
});

describe("isValid", () => {
  it("es true con un mapa de errores vacío", () => {
    expect(isValid({})).toBe(true);
  });

  it("es false si hay al menos un error", () => {
    expect(isValid({ price: "x" })).toBe(false);
  });
});
