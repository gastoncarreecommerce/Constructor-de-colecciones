/**
 * Shapes parciales de las respuestas de VTEX que consumimos.
 * Son intencionalmente laxos (la mayoría de los campos son opcionales)
 * porque las respuestas reales de VTEX varían según configuración de la
 * cuenta (specs habilitadas, etc).
 *
 * Usamos la Search API legacy (`/api/catalog_system/pub/products/search`)
 * en vez de Intelligent Search para traer el catálogo de un seller: contra
 * la cuenta de Carrefour AR, Intelligent Search ignoraba silenciosamente
 * `fq=seller:{sellerId}` y devolvía el top-ventas general sin filtrar
 * (confirmado en la corrida real del 2026-07-30 contra 3 sellers, que
 * devolvió el mismo catálogo genérico para los tres). La Search API legacy
 * soporta `fq=sellerId:{sellerId}` de forma documentada y confiable.
 */

export interface VtexSearchSku {
  itemId: string;
  name?: string;
  nameComplete?: string;
  // TODO: confirmar si el EAN viene en referenceId[].Value (RefId interno)
  // o si existe un campo ean/Ean dedicado en la respuesta de tu cuenta.
  referenceId?: Array<{ Key: string; Value: string }>;
  ean?: string;
  images?: Array<{ imageUrl: string }>;
  sellers?: Array<{
    sellerId: string;
    sellerDefault?: boolean;
    commertialOffer?: {
      Price?: number;
      ListPrice?: number;
      AvailableQuantity?: number;
    };
  }>;
}

export interface VtexSearchProduct {
  productId: string;
  productName: string;
  linkText?: string;
  brand?: string;
  categories?: string[];
  categoriesIds?: string[];
  // Confirmado contra datos reales: VTEX puede devolver esto como epoch en
  // milisegundos (number) o como ISO string según la cuenta/endpoint. Ver
  // extractDateCreated() en fetch-seller-catalog.ts, que normaliza ambos
  // casos a ISO string antes de guardar en el JSON final.
  releaseDate?: string | number;
  items: VtexSearchSku[];
}

/**
 * La Search API legacy devuelve un array de productos directo (sin wrapper
 * `{ products: [...] }` como Intelligent Search).
 */
export type VtexSearchResponse = VtexSearchProduct[];

/** Respuesta (parcial) de GET /api/catalog_system/pvt/sku/stockkeepingunitbyid/{skuId} */
export interface CatalogSkuById {
  Id: number;
  ProductId: number;
  RefId?: string | null;
  IsActive: boolean;
  DateUpdated?: string;
  ProductDescription?: string;
}

/** Respuesta (parcial) de POST /api/checkout/pub/orderForms/simulation */
export interface CheckoutSimulationResponse {
  items?: Array<{ id: string; availability?: string }>;
  paymentData?: {
    installmentOptions?: Array<{
      paymentSystem: string;
      paymentName?: string;
      installments: Array<{
        count: number;
        hasInterestRate: boolean;
        interestRate: number;
        value: number;
        total: number;
      }>;
    }>;
  };
  messages?: Array<{ code: string; text: string }>;
}

/** Respuesta (parcial) de GET /api/logistics/pvt/inventory/skus/{skuId} */
export interface InventoryResponse {
  skuId: string;
  balance: Array<{
    warehouseId: string;
    warehouseName?: string;
    totalQuantity: number;
    reservedQuantity: number;
    hasUnlimitedQuantity?: boolean;
  }>;
}
