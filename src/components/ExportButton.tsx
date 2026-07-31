import { useState } from "react";
import type { Product } from "../lib/types";

interface ExportButtonProps {
  products: Product[];
  /** Identificador usado en el nombre del archivo (sellerId único, o un label combinado si son varios). */
  fileLabel: string;
}

export default function ExportButton({ products, fileLabel }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      // Import diferido: la librería xlsx pesa bastante y solo hace falta
      // en el momento del export, no en el resto del wizard.
      const { buildCollectionWorkbook, collectionFileName, downloadCollectionWorkbook } =
        await import("../lib/collectionExport");
      const workbook = buildCollectionWorkbook(products);
      const fileName = collectionFileName(fileLabel);
      downloadCollectionWorkbook(fileName, workbook);
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={products.length === 0 || exporting}
      className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {exporting ? "Generando archivo..." : `Exportar colección (${products.length} productos)`}
    </button>
  );
}
