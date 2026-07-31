import type { Product } from "./types";

/** Escapa un valor para CSV (comillas dobles, comas, saltos de línea). */
function escapeCsvValue(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCollectionCsv(products: Product[]): string {
  const header = ["order", "ean", "skuId", "productName"];
  const rows = products.map((product, index) =>
    [index + 1, product.ean, product.skuId, product.productName].map(escapeCsvValue).join(","),
  );
  return [header.join(","), ...rows].join("\n") + "\n";
}

export function collectionCsvFileName(label: string, date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `coleccion_${label}_${yyyy}-${mm}-${dd}.csv`;
}

/** Dispara la descarga de un CSV en el navegador (100% client-side, sin backend). */
export function downloadCsv(fileName: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
