import { useEffect, useMemo, useState } from "react";
import ExportButton from "./components/ExportButton";
import FilterPanel from "./components/FilterPanel";
import ProductGrid from "./components/ProductGrid";
import ReorderList from "./components/ReorderList";
import SellerSelector from "./components/SellerSelector";
import { DEFAULT_HARD_FILTERS, DEFAULT_SCORING_WEIGHTS, scoreProducts } from "./lib/scoring";
import type {
  HardFilters,
  Product,
  ScoringWeights,
  SellerCatalog,
  SellerIndex,
  StockMode,
} from "./lib/types";

const DEFAULT_TOP_N = 40;

export default function App() {
  const [sellers, setSellers] = useState<SellerIndex>([]);
  const [sellersLoading, setSellersLoading] = useState(true);
  const [sellersError, setSellersError] = useState<string | null>(null);

  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<SellerCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_SCORING_WEIGHTS);
  const [noInterestThreshold, setNoInterestThreshold] = useState(6);
  const [stockMode, setStockMode] = useState<StockMode>("prefer-high-stock");
  const [hardFilters, setHardFilters] = useState<HardFilters>(DEFAULT_HARD_FILTERS);
  const [topN, setTopN] = useState(DEFAULT_TOP_N);

  const [excludedSkuIds, setExcludedSkuIds] = useState<Set<string>>(new Set());
  const [manualAdditions, setManualAdditions] = useState<Product[]>([]);
  const [finalOrder, setFinalOrder] = useState<string[]>([]);

  // Carga el índice de sellers disponibles.
  useEffect(() => {
    fetch("/data/sellers/index.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: SellerIndex) => {
        setSellers(data);
        if (data.length > 0) setSelectedSellerId(data[0].sellerId);
      })
      .catch((err) => setSellersError(`No se pudo cargar la lista de sellers: ${err.message}`))
      .finally(() => setSellersLoading(false));
  }, []);

  // Carga el catálogo del seller elegido.
  useEffect(() => {
    if (!selectedSellerId) return;
    setCatalogLoading(true);
    setCatalogError(null);
    setExcludedSkuIds(new Set());
    setManualAdditions([]);
    setFinalOrder([]);

    fetch(`/data/sellers/${selectedSellerId}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: SellerCatalog) => setCatalog(data))
      .catch((err) => setCatalogError(`No se pudo cargar el catálogo: ${err.message}`))
      .finally(() => setCatalogLoading(false));
  }, [selectedSellerId]);

  const scored = useMemo(() => {
    if (!catalog) return [];
    return scoreProducts(catalog.products, { weights, noInterestThreshold, stockMode }, hardFilters);
  }, [catalog, weights, noInterestThreshold, stockMode, hardFilters]);

  const productsBySkuId = useMemo(() => {
    const map = new Map<string, Product>();
    catalog?.products.forEach((p) => map.set(p.skuId, p));
    manualAdditions.forEach((p) => map.set(p.skuId, p));
    return map;
  }, [catalog, manualAdditions]);

  // Selección automática: los mejores `topN` productos elegibles (no excluidos).
  const autoSelectedSkuIds = useMemo(() => {
    const eligible = scored.filter((p) => !excludedSkuIds.has(p.skuId));
    return eligible.slice(0, topN).map((p) => p.skuId);
  }, [scored, excludedSkuIds, topN]);

  const baseFinalSkuIds = useMemo(() => {
    const manualIds = manualAdditions
      .map((p) => p.skuId)
      .filter((id) => !excludedSkuIds.has(id) && !autoSelectedSkuIds.includes(id));
    return [...autoSelectedSkuIds, ...manualIds];
  }, [autoSelectedSkuIds, manualAdditions, excludedSkuIds]);

  // Reconcilia finalOrder con baseFinalSkuIds preservando el orden ya arrastrado
  // por el usuario para los productos que se mantienen, y agregando los nuevos al final.
  useEffect(() => {
    setFinalOrder((prev) => {
      const baseSet = new Set(baseFinalSkuIds);
      const kept = prev.filter((id) => baseSet.has(id));
      const keptSet = new Set(kept);
      const added = baseFinalSkuIds.filter((id) => !keptSet.has(id));
      const next = [...kept, ...added];
      const sameLength = next.length === prev.length;
      const sameOrder = sameLength && next.every((id, i) => id === prev[i]);
      return sameOrder ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseFinalSkuIds.join("|")]);

  const finalProducts = useMemo(
    () => finalOrder.map((id) => productsBySkuId.get(id)).filter((p): p is Product => Boolean(p)),
    [finalOrder, productsBySkuId],
  );

  function handleToggleExclude(skuId: string) {
    setExcludedSkuIds((prev) => {
      const next = new Set(prev);
      if (next.has(skuId)) next.delete(skuId);
      else next.add(skuId);
      return next;
    });
  }

  function handleAddManual(product: Product) {
    setExcludedSkuIds((prev) => {
      if (!prev.has(product.skuId)) return prev;
      const next = new Set(prev);
      next.delete(product.skuId);
      return next;
    });
    setManualAdditions((prev) =>
      prev.some((p) => p.skuId === product.skuId) ? prev : [...prev, product],
    );
  }

  function handleRemoveFromFinal(skuId: string) {
    setExcludedSkuIds((prev) => new Set(prev).add(skuId));
    setManualAdditions((prev) => prev.filter((p) => p.skuId !== skuId));
    setFinalOrder((prev) => prev.filter((id) => id !== skuId));
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          Constructor de Colecciones — VTEX
        </h1>
        <p className="text-sm text-slate-500">
          Carrefour Argentina · armado semi-automático de colecciones por seller 3P
        </p>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 lg:grid-cols-[320px_1fr_360px]">
        <aside className="flex flex-col gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <SellerSelector
              sellers={sellers}
              selectedSellerId={selectedSellerId}
              onChange={setSelectedSellerId}
              loading={sellersLoading}
              error={sellersError}
            />
          </div>
          <FilterPanel
            weights={weights}
            onWeightsChange={setWeights}
            noInterestThreshold={noInterestThreshold}
            onNoInterestThresholdChange={setNoInterestThreshold}
            stockMode={stockMode}
            onStockModeChange={setStockMode}
            hardFilters={hardFilters}
            onHardFiltersChange={setHardFilters}
            topN={topN}
            onTopNChange={setTopN}
          />
        </aside>

        <section className="flex flex-col gap-4">
          {catalogLoading && <p className="text-sm text-slate-500">Cargando catálogo...</p>}
          {catalogError && <p className="text-sm text-red-600">{catalogError}</p>}
          {catalog && (
            <ProductGrid
              scored={scored}
              allProducts={catalog.products}
              excludedSkuIds={excludedSkuIds}
              onToggleExclude={handleToggleExclude}
              topN={topN}
              finalSkuIds={new Set(finalOrder)}
              onAddManual={handleAddManual}
            />
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <ReorderList
            products={finalProducts}
            onReorder={setFinalOrder}
            onRemove={handleRemoveFromFinal}
          />
          {selectedSellerId && (
            <ExportButton products={finalProducts} sellerId={selectedSellerId} />
          )}
        </aside>
      </main>
    </div>
  );
}
