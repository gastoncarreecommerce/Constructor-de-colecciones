import { useMemo, useState } from "react";
import type { SellerIndex } from "../../lib/types";

interface Step1SellersProps {
  sellers: SellerIndex;
  loading: boolean;
  error: string | null;
  selectedSellerIds: string[];
  onToggle: (sellerId: string) => void;
  onSelectAll: (sellerIds: string[]) => void;
  onClear: () => void;
  onNext: () => void;
  nextLoading: boolean;
  nextError: string | null;
  onBack?: () => void;
}

export default function Step1Sellers({
  sellers,
  loading,
  error,
  selectedSellerIds,
  onToggle,
  onSelectAll,
  onClear,
  onNext,
  nextLoading,
  nextError,
  onBack,
}: Step1SellersProps) {
  const [search, setSearch] = useState("");
  const selectedSet = useMemo(() => new Set(selectedSellerIds), [selectedSellerIds]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sellers;
    return sellers.filter(
      (s) => s.sellerName.toLowerCase().includes(query) || s.sellerId.toLowerCase().includes(query),
    );
  }, [sellers, search]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="self-start text-sm text-slate-500 hover:text-slate-700"
        >
          ← Volver
        </button>
      )}
      <div>
        <h2 className="text-lg font-semibold text-slate-900">¿Con qué sellers armamos la colección?</h2>
        <p className="text-sm text-slate-500">
          Elegí uno o varios sellers 3P. Si elegís más de uno, sus catálogos se combinan en una sola
          colección para filtrar/ordenar juntos.
        </p>
      </div>

      {loading && <p className="text-sm text-slate-500">Cargando lista de sellers...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && sellers.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Buscar seller por nombre o id..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[16rem] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => onSelectAll(filtered.map((s) => s.sellerId))}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Seleccionar {search ? "filtrados" : "todos"}
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={selectedSellerIds.length === 0}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Limpiar selección
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-sm text-slate-400">Sin resultados para "{search}".</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtered.map((seller) => {
                  const checked = selectedSet.has(seller.sellerId);
                  return (
                    <li key={seller.sellerId}>
                      <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
                        <span className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggle(seller.sellerId)}
                            className="h-4 w-4 accent-indigo-600"
                          />
                          <span className="text-slate-800">{seller.sellerName}</span>
                        </span>
                        <span className="text-xs text-slate-400">{seller.productCount} productos</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {!loading && sellers.length === 0 && !error && (
        <p className="text-sm text-slate-400">
          Todavía no hay ningún catálogo generado. Corré el job nocturno (o disparalo manualmente) para
          que aparezcan sellers acá.
        </p>
      )}

      {nextError && <p className="text-sm text-red-600">{nextError}</p>}

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <span className="text-sm text-slate-500">
          {selectedSellerIds.length} seller{selectedSellerIds.length === 1 ? "" : "s"} seleccionado
          {selectedSellerIds.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={selectedSellerIds.length === 0 || nextLoading}
          className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {nextLoading ? "Cargando catálogos..." : "Siguiente →"}
        </button>
      </div>
    </div>
  );
}
