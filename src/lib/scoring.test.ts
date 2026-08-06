import { describe, expect, it } from "vitest";
import { scoreProducts, DEFAULT_EXCLUSIVE_CRITERIA, DEFAULT_HARD_FILTERS, DEFAULT_SCORING_OPTIONS } from "./scoring";
import type { HardFilters, Product, ScoringOptions, ScoringWeights } from "./types";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    productId: overrides.productId ?? "p1",
    skuId: overrides.skuId ?? "sku1",
    ean: overrides.ean ?? "7790000000001",
    productName: overrides.productName ?? "Producto de prueba",
    categoryPath: overrides.categoryPath ?? "Categoria/Sub",
    imageUrl: overrides.imageUrl ?? "https://example.com/img.jpg",
    price: overrides.price ?? 1000,
    listPrice: overrides.listPrice ?? 1000,
    discountPct: overrides.discountPct ?? 0,
    dateCreated: overrides.dateCreated ?? "2026-01-01T00:00:00.000Z",
    daysSinceCreated: overrides.daysSinceCreated ?? 100,
    salesRank: overrides.salesRank ?? 1,
    stock: overrides.stock ?? 10,
    maxInstallmentsNoInterest: overrides.maxInstallmentsNoInterest ?? 0,
    hasCompleteContent: overrides.hasCompleteContent ?? true,
    linkText: overrides.linkText ?? "producto-de-prueba",
  };
}

const noHardFilters: HardFilters = {
  minStock: 0,
  excludeOutOfStock: false,
  maxCategoryShare: null,
  minInstallmentsNoInterest: 0,
  categoryPaths: null,
};

function onlyWeight(weight: keyof ScoringWeights, value = 100): ScoringOptions {
  const weights: ScoringWeights = {
    salesWeight: 0,
    recencyWeight: 0,
    noInterestWeight: 0,
    discountWeight: 0,
    stockWeight: 0,
    contentQualityWeight: 0,
  };
  weights[weight] = value;
  return { weights, noInterestThreshold: 6, stockMode: "prefer-high-stock" };
}

describe("scoreProducts", () => {
  it("devuelve [] para una lista vacía", () => {
    expect(scoreProducts([], DEFAULT_SCORING_OPTIONS, DEFAULT_HARD_FILTERS)).toEqual([]);
  });

  it("ordena por salesRank invertido cuando solo pesa salesWeight (rank 1 = primero)", () => {
    const products = [
      makeProduct({ skuId: "a", salesRank: 3 }),
      makeProduct({ skuId: "b", salesRank: 1 }),
      makeProduct({ skuId: "c", salesRank: 2 }),
    ];
    const result = scoreProducts(products, onlyWeight("salesWeight"), noHardFilters);
    expect(result.map((p) => p.skuId)).toEqual(["b", "c", "a"]);
    expect(result[0].score).toBeCloseTo(1);
    expect(result[2].score).toBeCloseTo(0);
  });

  it("favorece menor daysSinceCreated cuando solo pesa recencyWeight", () => {
    const products = [
      makeProduct({ skuId: "old", daysSinceCreated: 300 }),
      makeProduct({ skuId: "new", daysSinceCreated: 1 }),
      makeProduct({ skuId: "mid", daysSinceCreated: 150 }),
    ];
    const result = scoreProducts(products, onlyWeight("recencyWeight"), noHardFilters);
    expect(result.map((p) => p.skuId)).toEqual(["new", "mid", "old"]);
  });

  it("favorece mayor discountPct cuando solo pesa discountWeight", () => {
    const products = [
      makeProduct({ skuId: "low", discountPct: 5 }),
      makeProduct({ skuId: "high", discountPct: 40 }),
    ];
    const result = scoreProducts(products, onlyWeight("discountWeight"), noHardFilters);
    expect(result.map((p) => p.skuId)).toEqual(["high", "low"]);
  });

  it("noInterestWeight es un bonus binario según el threshold configurado", () => {
    const products = [
      makeProduct({ skuId: "under", maxInstallmentsNoInterest: 3 }),
      makeProduct({ skuId: "exact", maxInstallmentsNoInterest: 6 }),
      makeProduct({ skuId: "over", maxInstallmentsNoInterest: 12 }),
    ];
    const options = onlyWeight("noInterestWeight");
    options.noInterestThreshold = 6;
    const result = scoreProducts(products, options, noHardFilters);

    const byId = Object.fromEntries(result.map((p) => [p.skuId, p.score]));
    expect(byId.under).toBeCloseTo(0);
    expect(byId.exact).toBeCloseTo(1);
    expect(byId.over).toBeCloseTo(1);
  });

  it("stockWeight favorece más stock en modo prefer-high-stock y lo invierte en prefer-low-stock", () => {
    const products = [
      makeProduct({ skuId: "low", stock: 2 }),
      makeProduct({ skuId: "high", stock: 100 }),
    ];

    const highStockOptions = onlyWeight("stockWeight");
    highStockOptions.stockMode = "prefer-high-stock";
    const highResult = scoreProducts(products, highStockOptions, noHardFilters);
    expect(highResult.map((p) => p.skuId)).toEqual(["high", "low"]);

    const lowStockOptions = onlyWeight("stockWeight");
    lowStockOptions.stockMode = "prefer-low-stock";
    const lowResult = scoreProducts(products, lowStockOptions, noHardFilters);
    expect(lowResult.map((p) => p.skuId)).toEqual(["low", "high"]);
  });

  it("contentQualityWeight da bonus binario según hasCompleteContent", () => {
    const products = [
      makeProduct({ skuId: "incomplete", hasCompleteContent: false }),
      makeProduct({ skuId: "complete", hasCompleteContent: true }),
    ];
    const result = scoreProducts(products, onlyWeight("contentQualityWeight"), noHardFilters);
    expect(result.map((p) => p.skuId)).toEqual(["complete", "incomplete"]);
  });

  it("calcula el score compuesto como promedio ponderado de todos los criterios", () => {
    // Dos productos, criterios opuestos en cada eje, pesos iguales (25 c/u
    // en 2 criterios activos) → el score debe ser el promedio simple de
    // los dos valores normalizados por producto.
    const products = [
      makeProduct({ skuId: "a", salesRank: 1, discountPct: 0 }), // sales=1 (mejor), discount=0 (peor)
      makeProduct({ skuId: "b", salesRank: 2, discountPct: 50 }), // sales=0 (peor), discount=1 (mejor)
    ];
    const options: ScoringOptions = {
      weights: {
        salesWeight: 50,
        recencyWeight: 0,
        noInterestWeight: 0,
        discountWeight: 50,
        stockWeight: 0,
        contentQualityWeight: 0,
      },
      noInterestThreshold: 6,
      stockMode: "prefer-high-stock",
    };
    const result = scoreProducts(products, options, noHardFilters);
    const byId = Object.fromEntries(result.map((p) => [p.skuId, p.score]));
    // a: sales=1*0.5 + discount=0*0.5 = 0.5 ; b: sales=0*0.5 + discount=1*0.5 = 0.5
    expect(byId.a).toBeCloseTo(0.5);
    expect(byId.b).toBeCloseTo(0.5);
  });

  it("devuelve score 0 para todos si la suma de pesos es 0", () => {
    const products = [makeProduct({ skuId: "a" }), makeProduct({ skuId: "b" })];
    const options: ScoringOptions = {
      weights: {
        salesWeight: 0,
        recencyWeight: 0,
        noInterestWeight: 0,
        discountWeight: 0,
        stockWeight: 0,
        contentQualityWeight: 0,
      },
      noInterestThreshold: 6,
      stockMode: "prefer-high-stock",
    };
    const result = scoreProducts(products, options, noHardFilters);
    expect(result.every((p) => p.score === 0)).toBe(true);
  });

  describe("filtros duros", () => {
    it("excludeOutOfStock saca productos con stock <= 0", () => {
      const products = [
        makeProduct({ skuId: "in", stock: 5 }),
        makeProduct({ skuId: "out", stock: 0 }),
      ];
      const filters: HardFilters = { ...DEFAULT_HARD_FILTERS, excludeOutOfStock: true };
      const result = scoreProducts(products, DEFAULT_SCORING_OPTIONS, filters);
      expect(result.map((p) => p.skuId)).toEqual(["in"]);
    });

    it("minStock excluye productos por debajo del mínimo", () => {
      const products = [
        makeProduct({ skuId: "low", stock: 2 }),
        makeProduct({ skuId: "high", stock: 20 }),
      ];
      const filters: HardFilters = { ...noHardFilters, minStock: 5 };
      const result = scoreProducts(products, DEFAULT_SCORING_OPTIONS, filters);
      expect(result.map((p) => p.skuId)).toEqual(["high"]);
    });

    it("minInstallmentsNoInterest excluye productos con menos cuotas sin interés", () => {
      const products = [
        makeProduct({ skuId: "few", maxInstallmentsNoInterest: 3 }),
        makeProduct({ skuId: "many", maxInstallmentsNoInterest: 12 }),
      ];
      const filters: HardFilters = { ...noHardFilters, minInstallmentsNoInterest: 6 };
      const result = scoreProducts(products, DEFAULT_SCORING_OPTIONS, filters);
      expect(result.map((p) => p.skuId)).toEqual(["many"]);
    });

    it("maxCategoryShare limita cuántos productos de una misma categoría entran al resultado", () => {
      // 4 productos categoría A (mejor rankeados) + 1 producto categoría B.
      // Con cap 0.5, categoría A no puede superar el 50% del resultado final.
      const products = [
        makeProduct({ skuId: "a1", categoryPath: "A", salesRank: 1 }),
        makeProduct({ skuId: "a2", categoryPath: "A", salesRank: 2 }),
        makeProduct({ skuId: "a3", categoryPath: "A", salesRank: 3 }),
        makeProduct({ skuId: "a4", categoryPath: "A", salesRank: 4 }),
        makeProduct({ skuId: "b1", categoryPath: "B", salesRank: 5 }),
      ];
      const filters: HardFilters = { ...noHardFilters, maxCategoryShare: 0.5 };
      const result = scoreProducts(products, onlyWeight("salesWeight"), filters);

      const categoryACount = result.filter((p) => p.categoryPath === "A").length;
      const categoryBCount = result.filter((p) => p.categoryPath === "B").length;
      expect(categoryACount).toBe(1);
      expect(categoryBCount).toBe(1);
      expect(result.map((p) => p.skuId)).toEqual(["a1", "b1"]);
    });

    it("maxCategoryShare null no aplica ningún cap", () => {
      const products = [
        makeProduct({ skuId: "a1", categoryPath: "A" }),
        makeProduct({ skuId: "a2", categoryPath: "A" }),
        makeProduct({ skuId: "a3", categoryPath: "A" }),
      ];
      const filters: HardFilters = { ...noHardFilters, maxCategoryShare: null };
      const result = scoreProducts(products, DEFAULT_SCORING_OPTIONS, filters);
      expect(result).toHaveLength(3);
    });

    it("categoryPaths deja pasar solo las categorías incluidas en la lista", () => {
      const products = [
        makeProduct({ skuId: "a1", categoryPath: "Electro/Heladeras" }),
        makeProduct({ skuId: "a2", categoryPath: "Electro/Lavarropas" }),
        makeProduct({ skuId: "b1", categoryPath: "Hogar/Muebles" }),
      ];
      const filters: HardFilters = { ...noHardFilters, categoryPaths: ["Electro/Heladeras"] };
      const result = scoreProducts(products, DEFAULT_SCORING_OPTIONS, filters);
      expect(result.map((p) => p.skuId)).toEqual(["a1"]);
    });

    it("categoryPaths vacío o null no aplica ningún filtro", () => {
      const products = [
        makeProduct({ skuId: "a1", categoryPath: "Electro/Heladeras" }),
        makeProduct({ skuId: "b1", categoryPath: "Hogar/Muebles" }),
      ];
      const filtersEmpty: HardFilters = { ...noHardFilters, categoryPaths: [] };
      const filtersNull: HardFilters = { ...noHardFilters, categoryPaths: null };
      expect(scoreProducts(products, DEFAULT_SCORING_OPTIONS, filtersEmpty)).toHaveLength(2);
      expect(scoreProducts(products, DEFAULT_SCORING_OPTIONS, filtersNull)).toHaveLength(2);
    });
  });

  describe("criterios excluyentes", () => {
    it("noInterestWeight excluyente saca productos por debajo del threshold, no solo los peor rankea", () => {
      const products = [
        makeProduct({ skuId: "few", maxInstallmentsNoInterest: 3 }),
        makeProduct({ skuId: "many", maxInstallmentsNoInterest: 6 }),
      ];
      const options = onlyWeight("noInterestWeight");
      options.noInterestThreshold = 6;
      options.exclusiveCriteria = { ...DEFAULT_EXCLUSIVE_CRITERIA, noInterestWeight: true };
      const result = scoreProducts(products, options, noHardFilters);
      expect(result.map((p) => p.skuId)).toEqual(["many"]);
    });

    it("discountWeight excluyente saca productos sin descuento", () => {
      const products = [
        makeProduct({ skuId: "no-discount", discountPct: 0 }),
        makeProduct({ skuId: "discount", discountPct: 15 }),
      ];
      const options = onlyWeight("discountWeight");
      options.exclusiveCriteria = { ...DEFAULT_EXCLUSIVE_CRITERIA, discountWeight: true };
      const result = scoreProducts(products, options, noHardFilters);
      expect(result.map((p) => p.skuId)).toEqual(["discount"]);
    });

    it("contentQualityWeight excluyente saca productos con ficha incompleta", () => {
      const products = [
        makeProduct({ skuId: "incomplete", hasCompleteContent: false }),
        makeProduct({ skuId: "complete", hasCompleteContent: true }),
      ];
      const options = onlyWeight("contentQualityWeight");
      options.exclusiveCriteria = { ...DEFAULT_EXCLUSIVE_CRITERIA, contentQualityWeight: true };
      const result = scoreProducts(products, options, noHardFilters);
      expect(result.map((p) => p.skuId)).toEqual(["complete"]);
    });

    it("stockWeight excluyente saca productos sin stock", () => {
      const products = [
        makeProduct({ skuId: "out", stock: 0 }),
        makeProduct({ skuId: "in", stock: 5 }),
      ];
      const options = onlyWeight("stockWeight");
      options.exclusiveCriteria = { ...DEFAULT_EXCLUSIVE_CRITERIA, stockWeight: true };
      const result = scoreProducts(products, options, noHardFilters);
      expect(result.map((p) => p.skuId)).toEqual(["in"]);
    });

    it("salesWeight excluyente saca productos por debajo de la posición máxima de ranking", () => {
      const products = [
        makeProduct({ skuId: "good", salesRank: 5 }),
        makeProduct({ skuId: "bad", salesRank: 50 }),
      ];
      const options = onlyWeight("salesWeight");
      options.exclusiveCriteria = { ...DEFAULT_EXCLUSIVE_CRITERIA, salesWeight: true };
      options.maxSalesRank = 10;
      const result = scoreProducts(products, options, noHardFilters);
      expect(result.map((p) => p.skuId)).toEqual(["good"]);
    });

    it("recencyWeight excluyente saca productos más antiguos que el máximo de días", () => {
      const products = [
        makeProduct({ skuId: "new", daysSinceCreated: 10 }),
        makeProduct({ skuId: "old", daysSinceCreated: 200 }),
      ];
      const options = onlyWeight("recencyWeight");
      options.exclusiveCriteria = { ...DEFAULT_EXCLUSIVE_CRITERIA, recencyWeight: true };
      options.maxDaysSinceCreated = 30;
      const result = scoreProducts(products, options, noHardFilters);
      expect(result.map((p) => p.skuId)).toEqual(["new"]);
    });

    it("un criterio excluyente sin estar activo (weight 0) no filtra nada", () => {
      const products = [
        makeProduct({ skuId: "no-discount", discountPct: 0 }),
        makeProduct({ skuId: "discount", discountPct: 15 }),
      ];
      const options: ScoringOptions = {
        weights: {
          salesWeight: 100,
          recencyWeight: 0,
          noInterestWeight: 0,
          discountWeight: 0,
          stockWeight: 0,
          contentQualityWeight: 0,
        },
        noInterestThreshold: 6,
        stockMode: "prefer-high-stock",
        exclusiveCriteria: { ...DEFAULT_EXCLUSIVE_CRITERIA, discountWeight: true },
      };
      const result = scoreProducts(products, options, noHardFilters);
      expect(result).toHaveLength(2);
    });
  });
});
