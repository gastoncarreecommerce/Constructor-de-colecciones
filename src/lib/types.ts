/**
 * Tipos compartidos entre el job de datos (scripts/fetch-seller-catalog.ts)
 * y el frontend (src/lib/scoring.ts, componentes).
 */

export interface Product {
  productId: string;
  skuId: string;
  ean: string;
  productName: string;
  categoryPath: string;
  imageUrl: string;
  price: number;
  listPrice: number;
  discountPct: number;
  dateCreated: string;
  daysSinceCreated: number;
  salesRank: number;
  stock: number;
  maxInstallmentsNoInterest: number;
  hasCompleteContent: boolean;
  linkText: string;
}

export interface SellerCatalog {
  sellerId: string;
  sellerName: string;
  generatedAt: string;
  products: Product[];
}

export interface SellerIndexEntry {
  sellerId: string;
  sellerName: string;
  productCount: number;
  generatedAt: string;
}

export type SellerIndex = SellerIndexEntry[];

/**
 * Pesos del motor de scoring, todos en escala 0-100.
 * Un peso en 0 desactiva ese criterio del score compuesto.
 */
export interface ScoringWeights {
  salesWeight: number;
  recencyWeight: number;
  noInterestWeight: number;
  discountWeight: number;
  stockWeight: number;
  contentQualityWeight: number;
}

/** Modo de interpretación del peso de stock. */
export type StockMode = "prefer-high-stock" | "prefer-low-stock";

export interface ScoringOptions {
  weights: ScoringWeights;
  /** Cantidad mínima de cuotas sin interés para que noInterestWeight otorgue el bonus completo. */
  noInterestThreshold: number;
  /** "prefer-high-stock" (default) penaliza poco stock; "prefer-low-stock" favorece liquidar stock bajo. */
  stockMode: StockMode;
}

export interface HardFilters {
  minStock: number;
  excludeOutOfStock: boolean;
  /** 0-1. Ej: 0.3 = ninguna categoría puede superar el 30% del resultado final. */
  maxCategoryShare: number | null;
  /** Cuotas sin interés mínimas para que el producto sobreviva al filtro (0 = sin filtro). */
  minInstallmentsNoInterest: number;
}

export interface ScoredProduct extends Product {
  score: number;
}

/**
 * Producto etiquetado con el seller de origen. El wizard siempre trabaja
 * con esta forma (incluso con un solo seller seleccionado) para no tener
 * que ramificar la UI entre modo "un seller" y "varios sellers".
 */
export interface SellerTaggedProduct extends Product {
  sellerId: string;
  sellerName: string;
}

export type ScoredSellerTaggedProduct = SellerTaggedProduct & { score: number };

export interface WeightPreset {
  name: string;
  weights: ScoringWeights;
  noInterestThreshold: number;
  stockMode: StockMode;
  hardFilters: HardFilters;
}
