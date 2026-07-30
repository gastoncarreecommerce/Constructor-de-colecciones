/**
 * Shapes parciales de las respuestas de VTEX que consumimos.
 * Son intencionalmente laxos (la mayoría de los campos son opcionales)
 * porque las respuestas reales de VTEX varían según configuración de la
 * cuenta (Intelligent Search vs Legacy Search, specs habilitadas, etc).
 *
 * TODO: confirmar contra una respuesta real de la cuenta de Carrefour AR
 * los nombres exactos de campo marcados abajo.
 */

export interface IntelligentSearchSku {
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

export interface IntelligentSearchProduct {
  productId: string;
  productName: string;
  linkText?: string;
  brand?: string;
  categories?: string[];
  categoriesIds?: string[];
  releaseDate?: string;
  // TODO: confirmar el nombre exacto del campo de fecha de alta del producto;
  // en algunas cuentas viene como "releaseDate", en otras hay que resolverlo
  // aparte vía Catalog API (campo "DateOfCreation" del producto).
  items: IntelligentSearchSku[];
}

export interface IntelligentSearchResponse {
  products: IntelligentSearchProduct[];
  recordsFiltered?: number;
  correction?: unknown;
}

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
