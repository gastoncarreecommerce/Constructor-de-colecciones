import { useMemo, useState } from "react";
import type { ScoredSellerTaggedProduct, SellerTaggedProduct } from "../lib/types";

const MAX_ROWS_SHOWN = 300;

interface ProductGridProps {
  /** Productos ya scoreados y filtrados por filtros duros, ordenados de mejor a peor. */
  scored: ScoredSellerTaggedProduct[];
  /** Catálogo combinado de los sellers elegidos (para el buscador de alta manual). */
  allProducts: SellerTaggedProduct[];
  excludedSkuIds: Set<string>;
  onToggleExclude: (skuId: string) => void;
  topN: number;
  finalSkuIds: Set<string>;
  onAddManual: (product: SellerTaggedProduct) => void;
}

function formatPrice(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

export default function ProductGrid({
  scored,
  allProducts,
  excludedSkuIds,
  onToggleExclude,
  topN,
  finalSkuIds,
  onAddManual,
}: ProductGridProps) {
  const [search, setSearch] = useState("");

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length < 2) return [];
    return allProducts
      .filter(
        (p) =>
          !finalSkuIds.has(p.skuId) &&
          (p.productName.toLowerCase().includes(query) ||
            p.ean.includes(query) ||
            p.skuId.includes(query)),
      )
      .slice(0, 20);
  }, [search, allProducts, finalSkuIds]);

  const visibleRows = scored.slice(0, MAX_ROWS_SHOWN);

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">
          Resultados ({scored.length} productos tras filtros)
        </h2>
        <span className="text-xs text-slate-500">
          Corte automático: primeros {topN} por score
        </span>
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Agregar manualmente: buscar por nombre, EAN o SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {searchResults.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
            {searchResults.map((p) => (
              <li
                key={p.skuId}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-slate-50"
              >
                <span className="truncate">
                  {p.productName}{" "}
                  <span className="text-slate-400">
                    · EAN {p.ean} · {p.sellerName}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onAddManual(p);
                    setSearch("");
                  }}
                  className="shrink-0 rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  Agregar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="max-h-[32rem] overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2">Incluir</th>
              <th className="px-2 py-2">Producto</th>
              <th className="px-2 py-2">Seller</th>
              <th className="px-2 py-2">Categoría</th>
              <th className="px-2 py-2">EAN</th>
              <th className="px-2 py-2 text-right">Precio</th>
              <th className="px-2 py-2 text-right">Sales rank</th>
              <th className="px-2 py-2 text-center">Sin interés</th>
              <th className="px-2 py-2 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((p, index) => {
              const included = !excludedSkuIds.has(p.skuId);
              const inAutoCut = included && index < topN;
              return (
                <tr
                  key={p.skuId}
                  className={`border-t border-slate-100 ${inAutoCut ? "" : "text-slate-400"}`}
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() => onToggleExclude(p.skuId)}
                      className="h-4 w-4 accent-indigo-600"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      {p.imageUrl && (
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-8 w-8 rounded object-cover"
                          loading="lazy"
                        />
                      )}
                      <span className="max-w-xs truncate">{p.productName}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-slate-500">{p.sellerName}</td>
                  <td className="px-2 py-2 text-slate-500">{p.categoryPath}</td>
                  <td className="px-2 py-2 font-mono text-xs">{p.ean}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatPrice(p.price)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">#{p.salesRank}</td>
                  <td className="px-2 py-2 text-center">
                    {p.maxInstallmentsNoInterest > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {p.maxInstallmentsNoInterest}x sin interés
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium">
                    {p.score.toFixed(3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {scored.length > MAX_ROWS_SHOWN && (
          <p className="mt-2 text-center text-xs text-slate-400">
            Mostrando los primeros {MAX_ROWS_SHOWN} de {scored.length} resultados.
          </p>
        )}
      </div>
    </div>
  );
}
