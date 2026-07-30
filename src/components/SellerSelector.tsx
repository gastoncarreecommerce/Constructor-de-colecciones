import type { SellerIndexEntry } from "../lib/types";

interface SellerSelectorProps {
  sellers: SellerIndexEntry[];
  selectedSellerId: string | null;
  onChange: (sellerId: string) => void;
  loading?: boolean;
  error?: string | null;
}

export default function SellerSelector({
  sellers,
  selectedSellerId,
  onChange,
  loading,
  error,
}: SellerSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="seller-select" className="text-sm font-medium text-slate-700">
        Seller 3P
      </label>
      <select
        id="seller-select"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        value={selectedSellerId ?? ""}
        disabled={loading || sellers.length === 0}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          {loading ? "Cargando sellers..." : "Elegí un seller"}
        </option>
        {sellers.map((seller) => (
          <option key={seller.sellerId} value={seller.sellerId}>
            {seller.sellerName} ({seller.productCount} productos)
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
