import * as XLSX from "xlsx";
import type { Product } from "./types";

/**
 * Estructura exacta del template de import de Colecciones de VTEX
 * (confirmado contra el archivo real que provee VTEX): un único sheet
 * llamado "Collection", con 4 columnas de header. Nosotros solo
 * completamos SKUREFID — el resto queda vacío a propósito, tal como pidió
 * Carrefour ("los skus van en SKUREFID y nada más").
 */
const SHEET_NAME = "Collection";
const HEADERS = ["SKU", "PRODUCT", "SKUREFID", "PRODUCTREFID"];

export function buildCollectionWorkbook(products: Product[]): XLSX.WorkBook {
  const rows: (string | number)[][] = [
    HEADERS,
    ...products.map((product) => ["", "", product.ean, ""]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);
  return workbook;
}

export function collectionFileName(label: string, date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `coleccion_${label}_${yyyy}-${mm}-${dd}.xlsx`;
}

/** Dispara la descarga del .xlsx en el navegador (100% client-side, sin backend). */
export function downloadCollectionWorkbook(fileName: string, workbook: XLSX.WorkBook): void {
  XLSX.writeFile(workbook, fileName);
}
