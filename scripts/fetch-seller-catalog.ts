/**
 * Job de datos: trae el catálogo completo de un seller 3P de VTEX y arma
 * data/sellers/{sellerId}.json con toda la info necesaria para el motor
 * de scoring del frontend (sales rank, cuotas sin interés, stock, etc).
 *
 * Uso local:
 *   npm run fetch-catalog -- <sellerId> [sellerName]
 *
 * En CI (GitHub Actions) las env vars salen de Secrets; en local podés
 * copiar .env.example a .env y cargarlo (ver README).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Carga .env en desarrollo local si existe. En CI las env vars ya están
// seteadas por el workflow (Secrets), así que esto es un no-op silencioso.
try {
  const dotenv = await import("dotenv");
  dotenv.config();
} catch {
  // dotenv es una devDependency opcional; si no está instalada, seguimos.
}

import {
  baseUrl,
  fetchJson,
  loadVtexConfigFromEnv,
  processBatched,
  type VtexConfig,
} from "./lib/vtexClient.js";
import type {
  CatalogSkuById,
  CheckoutSimulationResponse,
  InventoryResponse,
  VtexSearchProduct,
  VtexSearchResponse,
} from "./lib/vtexTypes.js";
import type { Product, SellerCatalog, SellerIndex, SellerIndexEntry } from "../src/lib/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data/sellers");

const PAGE_SIZE = 50;
const CHECKOUT_BATCH_SIZE = 15;
const CHECKOUT_BATCH_DELAY_MS = 300;
const INVENTORY_BATCH_SIZE = 20;
const INVENTORY_BATCH_DELAY_MS = 200;
const MIN_INSTALLMENTS_NO_INTEREST_TO_CONSIDER = 0;

interface RawSkuRow {
  productId: string;
  skuId: string;
  ean: string;
  productName: string;
  categoryPath: string;
  imageUrl: string;
  price: number;
  listPrice: number;
  dateCreated: string;
  linkText: string;
  salesRank: number;
}

/**
 * Trae el catálogo completo del seller, paginando la Search API legacy de
 * VTEX (`/api/catalog_system/pub/products/search`), ordenado por ventas
 * (O=OrderByTopSaleDESC). Como VTEX no expone unidades vendidas
 * directamente, usamos la posición en este orden como salesRank (1 = más
 * vendido en los últimos 90 días).
 *
 * Usamos esta API (y no Intelligent Search) porque en una corrida real
 * contra la cuenta de Carrefour AR, Intelligent Search ignoraba el filtro
 * `fq=seller:{sellerId}` y devolvía el mismo top-ventas genérico sin
 * filtrar para cualquier sellerId. La Search API legacy soporta
 * `fq=sellerId:{sellerId}` de forma documentada.
 */
async function fetchSellerCatalogPages(
  config: VtexConfig,
  sellerId: string,
): Promise<RawSkuRow[]> {
  const rows: RawSkuRow[] = [];
  let from = 0;
  let rank = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const url =
      `${baseUrl(config)}/api/catalog_system/pub/products/search` +
      `?fq=sellerId:${encodeURIComponent(sellerId)}` +
      `&sc=${encodeURIComponent(config.salesChannel)}` +
      `&O=OrderByTopSaleDESC` +
      `&_from=${from}&_to=${to}`;

    const products = await fetchJson<VtexSearchResponse>(url, config);
    if (!products || products.length === 0) break;

    for (const product of products) {
      for (const sku of product.items ?? []) {
        const seller = sku.sellers?.find((s) => s.sellerId === sellerId) ?? sku.sellers?.[0];
        // La Search API legacy no siempre respeta fq=sellerId de forma
        // estricta (algunas cuentas devuelven productos donde el seller
        // pedido es apenas uno de varios sellers listados). Si el SKU no
        // tiene efectivamente ese seller, lo salteamos para no ensuciar el
        // catálogo con productos de otro seller.
        if (!sku.sellers?.some((s) => s.sellerId === sellerId)) continue;

        rank += 1;
        rows.push({
          productId: product.productId,
          skuId: sku.itemId,
          ean: extractEan(sku),
          productName: product.productName,
          categoryPath: extractCategoryPath(product),
          imageUrl: sku.images?.[0]?.imageUrl ?? "",
          price: seller?.commertialOffer?.Price ?? 0,
          listPrice: seller?.commertialOffer?.ListPrice ?? 0,
          dateCreated: extractDateCreated(product),
          linkText: product.linkText ?? "",
          salesRank: rank,
        });
      }
    }

    if (products.length < PAGE_SIZE) break; // última página
    from += PAGE_SIZE;
  }
  return rows;
}

function extractEan(sku: VtexSearchProduct["items"][number]): string {
  // TODO: confirmar en qué campo viene el EAN para tu catálogo. Probamos
  // referenceId[].Value primero (patrón común: RefId = EAN), después un
  // eventual campo "ean" plano. Si ninguno existe, se resuelve después
  // vía Catalog API (ver resolveMissingEans).
  const refValue = sku.referenceId?.find((r) => r.Value)?.Value;
  return refValue ?? sku.ean ?? "";
}

function extractCategoryPath(product: VtexSearchProduct): string {
  if (product.categories && product.categories.length > 0) {
    // VTEX suele devolver categorías como "/Departamento/Categoria/Subcategoria/"
    return product.categories[0].replace(/^\/|\/$/g, "");
  }
  return "";
}

/**
 * Normaliza releaseDate a ISO string. Confirmado contra datos reales que
 * VTEX puede devolver esto como epoch en milisegundos (number) además de
 * como ISO string, dependiendo de la cuenta.
 *
 * TODO: confirmar si releaseDate representa fecha de alta en catálogo o
 * fecha de "lanzamiento" comercial (pueden no ser lo mismo).
 */
function extractDateCreated(product: VtexSearchProduct): string {
  const raw = product.releaseDate;
  if (raw === undefined || raw === null || raw === "") return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** Completa el EAN vía Catalog API para los SKUs que vinieron sin referenceId. */
async function resolveMissingEans(config: VtexConfig, rows: RawSkuRow[]): Promise<void> {
  const missing = rows.filter((r) => !r.ean);
  if (missing.length === 0) return;

  console.log(`Resolviendo EAN vía Catalog API para ${missing.length} SKUs...`);

  await processBatched(missing, INVENTORY_BATCH_SIZE, INVENTORY_BATCH_DELAY_MS, async (row) => {
    try {
      const url = `${baseUrl(config)}/api/catalog_system/pvt/sku/stockkeepingunitbyid/${row.skuId}`;
      const sku = await fetchJson<CatalogSkuById>(url, config);
      row.ean = sku.RefId ?? "";
    } catch (err) {
      console.warn(`No se pudo resolver EAN para SKU ${row.skuId}:`, (err as Error).message);
    }
  });
}

/** Simula checkout por SKU y extrae el máximo de cuotas sin interés. */
async function fetchInstallments(
  config: VtexConfig,
  sellerId: string,
  rows: RawSkuRow[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  await processBatched(rows, CHECKOUT_BATCH_SIZE, CHECKOUT_BATCH_DELAY_MS, async (row) => {
    try {
      const url = `${baseUrl(config)}/api/checkout/pub/orderForms/simulation?sc=${encodeURIComponent(config.salesChannel)}`;
      const body = {
        items: [{ id: row.skuId, quantity: 1, seller: sellerId }],
        // TODO: confirmar si tu cuenta requiere country/postalCode para
        // simular correctamente (algunas cuentas de AR lo exigen).
        country: "ARG",
      };
      const sim = await fetchJson<CheckoutSimulationResponse>(url, config, {
        method: "POST",
        body,
      });

      let maxNoInterest = 0;
      for (const option of sim.paymentData?.installmentOptions ?? []) {
        for (const installment of option.installments ?? []) {
          const isNoInterest = !installment.hasInterestRate && installment.interestRate === 0;
          if (isNoInterest && installment.count > maxNoInterest) {
            maxNoInterest = installment.count;
          }
        }
      }
      result.set(row.skuId, maxNoInterest);
    } catch (err) {
      console.warn(`No se pudo simular checkout para SKU ${row.skuId}:`, (err as Error).message);
      result.set(row.skuId, MIN_INSTALLMENTS_NO_INTEREST_TO_CONSIDER);
    }
  });

  return result;
}

/** Trae stock disponible total (suma de todos los warehouses) por SKU. */
async function fetchStock(config: VtexConfig, rows: RawSkuRow[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  await processBatched(rows, INVENTORY_BATCH_SIZE, INVENTORY_BATCH_DELAY_MS, async (row) => {
    try {
      const url = `${baseUrl(config)}/api/logistics/pvt/inventory/skus/${row.skuId}`;
      const inventory = await fetchJson<InventoryResponse>(url, config);
      const total = (inventory.balance ?? []).reduce((sum, wh) => {
        if (wh.hasUnlimitedQuantity) return sum + Math.max(wh.totalQuantity, 1);
        return sum + Math.max(wh.totalQuantity - wh.reservedQuantity, 0);
      }, 0);
      result.set(row.skuId, total);
    } catch (err) {
      console.warn(`No se pudo traer stock para SKU ${row.skuId}:`, (err as Error).message);
      result.set(row.skuId, 0);
    }
  });

  return result;
}

/** Intenta resolver el nombre del seller vía Seller Management API. */
async function fetchSellerName(config: VtexConfig, sellerId: string): Promise<string> {
  try {
    // TODO: confirmar el endpoint exacto de Seller Management habilitado en
    // tu cuenta (puede variar entre /api/seller-register/pvt/sellers/{id}
    // y variantes del Marketplace API).
    const url = `${baseUrl(config)}/api/seller-register/pvt/sellers/${sellerId}`;
    const seller = await fetchJson<{ name?: string; Name?: string }>(url, config);
    return seller.name ?? seller.Name ?? sellerId;
  } catch {
    return sellerId;
  }
}

function buildProduct(
  row: RawSkuRow,
  installments: Map<string, number>,
  stock: Map<string, number>,
  generatedAt: string,
): Product {
  const discountPct =
    row.listPrice > 0 && row.price > 0 && row.listPrice > row.price
      ? Math.round((1 - row.price / row.listPrice) * 100)
      : 0;

  const daysSinceCreated = computeDaysSinceCreated(row.dateCreated, generatedAt);

  const hasCompleteContent = Boolean(
    row.productName && row.imageUrl && row.categoryPath && row.ean && row.price > 0,
  );

  return {
    productId: row.productId,
    skuId: row.skuId,
    ean: row.ean,
    productName: row.productName,
    categoryPath: row.categoryPath,
    imageUrl: row.imageUrl,
    price: row.price,
    listPrice: row.listPrice,
    discountPct,
    dateCreated: row.dateCreated,
    daysSinceCreated,
    salesRank: row.salesRank,
    stock: stock.get(row.skuId) ?? 0,
    maxInstallmentsNoInterest: installments.get(row.skuId) ?? 0,
    hasCompleteContent,
    linkText: row.linkText,
  };
}

/**
 * Días transcurridos desde dateCreated. Si no tenemos fecha confiable,
 * devolvemos un sentinel alto (9999) para que el producto se trate como
 * "viejo" en el scoring de recencia en vez de colarse como "recién
 * catalogado" por defecto.
 */
function computeDaysSinceCreated(dateCreated: string, generatedAt: string): number {
  if (!dateCreated) return 9999;
  const created = new Date(dateCreated).getTime();
  if (Number.isNaN(created)) return 9999;
  const now = new Date(generatedAt).getTime();
  return Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
}

function updateSellerIndex(entry: SellerIndexEntry): void {
  const indexPath = path.join(DATA_DIR, "index.json");
  let index: SellerIndex = [];
  if (existsSync(indexPath)) {
    try {
      index = JSON.parse(readFileSync(indexPath, "utf-8"));
    } catch {
      index = [];
    }
  }
  const filtered = index.filter((s) => s.sellerId !== entry.sellerId);
  filtered.push(entry);
  filtered.sort((a, b) => a.sellerName.localeCompare(b.sellerName));
  writeFileSync(indexPath, JSON.stringify(filtered, null, 2) + "\n", "utf-8");
}

async function main() {
  const [, , sellerIdArg, sellerNameArg] = process.argv;
  if (!sellerIdArg) {
    console.error("Uso: npm run fetch-catalog -- <sellerId> [sellerName]");
    process.exit(1);
  }
  const sellerId = sellerIdArg;

  const config = loadVtexConfigFromEnv();
  const generatedAt = new Date().toISOString();

  console.log(`[${sellerId}] Trayendo catálogo (ordenado por ventas)...`);
  const rows = await fetchSellerCatalogPages(config, sellerId);
  console.log(`[${sellerId}] ${rows.length} SKUs encontrados.`);

  if (rows.length === 0) {
    console.warn(`[${sellerId}] El seller no tiene productos activos o el filtro no matcheó nada.`);
  }

  await resolveMissingEans(config, rows);

  console.log(`[${sellerId}] Simulando cuotas sin interés...`);
  const installments = await fetchInstallments(config, sellerId, rows);

  console.log(`[${sellerId}] Trayendo stock...`);
  const stock = await fetchStock(config, rows);

  const sellerName = sellerNameArg ?? (await fetchSellerName(config, sellerId));

  const products = rows.map((row) => buildProduct(row, installments, stock, generatedAt));

  const catalog: SellerCatalog = {
    sellerId,
    sellerName,
    generatedAt,
    products,
  };

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  const outPath = path.join(DATA_DIR, `${sellerId}.json`);
  writeFileSync(outPath, JSON.stringify(catalog, null, 2) + "\n", "utf-8");
  console.log(`[${sellerId}] Catálogo guardado en ${outPath}`);

  updateSellerIndex({
    sellerId,
    sellerName,
    productCount: products.length,
    generatedAt,
  });
  console.log(`[${sellerId}] Índice de sellers actualizado.`);
}

main().catch((err) => {
  console.error("Error fatal en fetch-seller-catalog:", err);
  process.exit(1);
});
