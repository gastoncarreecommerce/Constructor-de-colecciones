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
const SKUREFID_HEADER = "skurefid";

/**
 * @param extraSkuRefIds SKUs que no se pudieron resolver contra ningún
 * catálogo (modo "reordenar colección existente"): van al final, tal
 * cual vinieron en el archivo subido, sin ningún otro dato.
 */
export function buildCollectionWorkbook(
  products: Product[],
  extraSkuRefIds: string[] = [],
): XLSX.WorkBook {
  const rows: (string | number)[][] = [
    HEADERS,
    ...products.map((product) => ["", "", product.ean, ""]),
    ...extraSkuRefIds.map((refId) => ["", "", refId, ""]),
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

/**
 * Lee un .xlsx subido por el usuario (mismo template que exportamos) y
 * devuelve la lista de SKUs de la columna SKUREFID, sin vacíos ni
 * duplicados, en el orden en que aparecen en el archivo.
 *
 * Tira un Error con mensaje legible si no encuentra la columna.
 */
export function parseSkuRefIdsFromWorkbook(buffer: ArrayBuffer): string[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames.includes(SHEET_NAME)
    ? SHEET_NAME
    : workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("El archivo no tiene ninguna hoja.");
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (rows.length === 0) {
    throw new Error("La hoja está vacía.");
  }

  const header = rows[0].map((cell) => String(cell ?? "").trim().toLowerCase());
  const columnIndex = header.indexOf(SKUREFID_HEADER);
  if (columnIndex === -1) {
    throw new Error('No se encontró la columna "SKUREFID" en la primera fila del archivo.');
  }

  const seen = new Set<string>();
  const refIds: string[] = [];
  for (const row of rows.slice(1)) {
    const raw = String(row[columnIndex] ?? "").trim();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    refIds.push(raw);
  }
  return refIds;
}
