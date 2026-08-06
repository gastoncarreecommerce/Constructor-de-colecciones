import type { ExclusiveCriteria, HardFilters, Product, ScoringOptions, ScoringWeights } from "./types";

/** Valor neutro cuando no hay variación en el universo (evita división por cero). */
const NEUTRAL_SCORE = 0.5;

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  salesWeight: 25,
  recencyWeight: 20,
  noInterestWeight: 20,
  discountWeight: 20,
  stockWeight: 10,
  contentQualityWeight: 5,
};

export const DEFAULT_EXCLUSIVE_CRITERIA: ExclusiveCriteria = {
  salesWeight: false,
  recencyWeight: false,
  noInterestWeight: false,
  discountWeight: false,
  stockWeight: false,
  contentQualityWeight: false,
};

export const DEFAULT_SCORING_OPTIONS: ScoringOptions = {
  weights: DEFAULT_SCORING_WEIGHTS,
  noInterestThreshold: 6,
  stockMode: "prefer-high-stock",
  exclusiveCriteria: DEFAULT_EXCLUSIVE_CRITERIA,
  maxSalesRank: null,
  maxDaysSinceCreated: null,
};

export const DEFAULT_HARD_FILTERS: HardFilters = {
  minStock: 0,
  excludeOutOfStock: true,
  maxCategoryShare: null,
  minInstallmentsNoInterest: 0,
  categoryPaths: null,
};

/** Normaliza un array de números a escala 0-1 (min-max). */
function minMaxNormalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    return values.map(() => NEUTRAL_SCORE);
  }
  return values.map((v) => (v - min) / (max - min));
}

/**
 * Filtros duros derivados de marcar un criterio como "excluyente" en el
 * wizard: a diferencia del peso (que solo reordena), estos sacan del
 * resultado a cualquier producto que no cumpla el mínimo del criterio.
 * Solo aplican si el criterio también está activo (weight > 0).
 */
function applyExclusiveCriteria<T extends Product>(products: T[], options: ScoringOptions): T[] {
  const exclusive = { ...DEFAULT_EXCLUSIVE_CRITERIA, ...options.exclusiveCriteria };
  const { weights, noInterestThreshold } = options;
  const maxSalesRank = options.maxSalesRank ?? null;
  const maxDaysSinceCreated = options.maxDaysSinceCreated ?? null;

  return products.filter((p) => {
    if (weights.noInterestWeight > 0 && exclusive.noInterestWeight) {
      if (p.maxInstallmentsNoInterest < noInterestThreshold) return false;
    }
    if (weights.discountWeight > 0 && exclusive.discountWeight) {
      if (p.discountPct <= 0) return false;
    }
    if (weights.contentQualityWeight > 0 && exclusive.contentQualityWeight) {
      if (!p.hasCompleteContent) return false;
    }
    if (weights.stockWeight > 0 && exclusive.stockWeight) {
      if (p.stock <= 0) return false;
    }
    if (weights.salesWeight > 0 && exclusive.salesWeight && maxSalesRank !== null) {
      if (p.salesRank > maxSalesRank) return false;
    }
    if (weights.recencyWeight > 0 && exclusive.recencyWeight && maxDaysSinceCreated !== null) {
      if (p.daysSinceCreated > maxDaysSinceCreated) return false;
    }
    return true;
  });
}

function applyHardFilters<T extends Product>(products: T[], filters: HardFilters): T[] {
  return products.filter((p) => {
    if (filters.excludeOutOfStock && p.stock <= 0) return false;
    if (p.stock < filters.minStock) return false;
    if (
      filters.minInstallmentsNoInterest > 0 &&
      p.maxInstallmentsNoInterest < filters.minInstallmentsNoInterest
    ) {
      return false;
    }
    if (
      filters.categoryPaths &&
      filters.categoryPaths.length > 0 &&
      !filters.categoryPaths.includes(p.categoryPath)
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Recorre la lista ya ordenada por score y descarta productos que harían
 * que su categoría supere `maxCategoryShare` del total aceptado hasta ese
 * punto. El primer producto de cada categoría siempre entra, para no dejar
 * categorías enteras afuera cuando el cap es muy restrictivo.
 */
function applyCategoryShareCap<T extends Product>(
  sorted: (T & { score: number })[],
  maxCategoryShare: number | null,
): (T & { score: number })[] {
  if (maxCategoryShare === null || maxCategoryShare >= 1) return sorted;

  const result: (T & { score: number })[] = [];
  const categoryCounts = new Map<string, number>();

  for (const product of sorted) {
    const category = product.categoryPath || "(sin categoría)";
    const currentCount = categoryCounts.get(category) ?? 0;
    const wouldBeShare = (currentCount + 1) / (result.length + 1);

    if (currentCount === 0 || wouldBeShare <= maxCategoryShare) {
      result.push(product);
      categoryCounts.set(category, currentCount + 1);
    }
  }

  return result;
}

/**
 * Motor de scoring puro: recibe el universo de productos de un seller,
 * pesos (0-100) por criterio y filtros duros excluyentes; devuelve la
 * lista resultante ordenada de mayor a menor score.
 *
 * La normalización min-max de cada variable se calcula sobre TODO el
 * universo recibido (antes de aplicar filtros duros), para que el score
 * sea comparable sin importar qué sobrevive después.
 *
 * Genérica sobre T (por defecto Product) para que campos extra del
 * producto (ej. sellerId/sellerName en SellerTaggedProduct, usados por el
 * wizard multi-seller) se preserven en el resultado sin perder tipado.
 */
export function scoreProducts<T extends Product = Product>(
  products: T[],
  options: ScoringOptions = DEFAULT_SCORING_OPTIONS,
  hardFilters: HardFilters = DEFAULT_HARD_FILTERS,
): (T & { score: number })[] {
  if (products.length === 0) return [];

  const { weights, noInterestThreshold, stockMode } = options;
  const totalWeight =
    weights.salesWeight +
    weights.recencyWeight +
    weights.noInterestWeight +
    weights.discountWeight +
    weights.stockWeight +
    weights.contentQualityWeight;

  const salesRankNorm = minMaxNormalize(products.map((p) => p.salesRank));
  const recencyNorm = minMaxNormalize(products.map((p) => p.daysSinceCreated));
  const discountNorm = minMaxNormalize(products.map((p) => p.discountPct));
  const stockNorm = minMaxNormalize(products.map((p) => p.stock));

  const scoredAll: (T & { score: number })[] = products.map((product, i) => {
    const salesValue = 1 - salesRankNorm[i]; // rank 1 (mejor vendido) = score alto
    const recencyValue = 1 - recencyNorm[i]; // menos días desde alta = score alto
    const discountValue = discountNorm[i];
    const stockValue = stockMode === "prefer-low-stock" ? 1 - stockNorm[i] : stockNorm[i];
    const noInterestValue = product.maxInstallmentsNoInterest >= noInterestThreshold ? 1 : 0;
    const contentValue = product.hasCompleteContent ? 1 : 0;

    const weightedSum =
      weights.salesWeight * salesValue +
      weights.recencyWeight * recencyValue +
      weights.noInterestWeight * noInterestValue +
      weights.discountWeight * discountValue +
      weights.stockWeight * stockValue +
      weights.contentQualityWeight * contentValue;

    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return { ...product, score };
  });

  const filtered = applyExclusiveCriteria(applyHardFilters(scoredAll, hardFilters), options);

  const sorted = [...filtered].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.salesRank !== b.salesRank) return a.salesRank - b.salesRank;
    return a.skuId.localeCompare(b.skuId);
  });

  return applyCategoryShareCap(sorted, hardFilters.maxCategoryShare);
}
