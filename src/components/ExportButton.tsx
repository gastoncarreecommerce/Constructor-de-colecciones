import { buildCollectionCsv, collectionCsvFileName, downloadCsv } from "../lib/csv";
import type { Product } from "../lib/types";

interface ExportButtonProps {
  products: Product[];
  sellerId: string;
}

export default function ExportButton({ products, sellerId }: ExportButtonProps) {
  function handleExport() {
    const csv = buildCollectionCsv(products);
    const fileName = collectionCsvFileName(sellerId);
    downloadCsv(fileName, csv);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={products.length === 0}
      className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      Exportar CSV ({products.length} productos)
    </button>
  );
}
