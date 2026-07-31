import { useEffect, useMemo, useState } from "react";
import StepIndicator from "./components/wizard/StepIndicator";
import Step1Sellers from "./components/wizard/Step1Sellers";
import Step2Criteria from "./components/wizard/Step2Criteria";
import Step3Review from "./components/wizard/Step3Review";
import Step4Export from "./components/wizard/Step4Export";
import { DEFAULT_HARD_FILTERS, DEFAULT_SCORING_WEIGHTS, scoreProducts } from "./lib/scoring";
import type {
  HardFilters,
  ScoringWeights,
  SellerCatalog,
  SellerIndex,
  SellerTaggedProduct,
  StockMode,
} from "./lib/types";

const DEFAULT_TOP_N = 40;

export default function App() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [sellers, setSellers] = useState<SellerIndex>([]);
  const [sellersLoading, setSellersLoading] = useState(true);
  const [sellersError, setSellersError] = useState<string | null>(null);

  const [selectedSellerIds, setSelectedSellerIds] = useState<string[]>([]);

  const [catalogs, setCatalogs] = useState<SellerCatalog[]>([]);
  const [catalogsLoading, setCatalogsLoading] = useState(false);
  const [catalogsError, setCatalogsError] = useState<string | null>(null);

  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_SCORING_WEIGHTS);
  const [noInterestThreshold, setNoInterestThreshold] = useState(6);
  const [stockMode, setStockMode] = useState<StockMode>("prefer-high-stock");
  const [hardFilters, setHardFilters] = useState<HardFilters>(DEFAULT_HARD_FILTERS);
  const [topN, setTopN] = useState(DEFAULT_TOP_N);
  const [noTopLimit, setNoTopLimit] = useState(false);
  const [interleaveBySeller, setInterleaveBySeller] = useState(true);

  const [excludedSkuIds, setExcludedSkuIds] = useState<Set<string>>(new Set());
  const [manualAdditions, setManualAdditions] = useState<SellerTaggedProduct[]>([]);
  const [finalOrder, setFinalOrder] = useState<string[]>([]);

  // Carga el índice de sellers disponibles.
  useEffect(() => {
    fetch("/data/sellers/index.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: SellerIndex) => setSellers(data))
      .catch((err) => setSellersError(`No se pudo cargar la lista de sellers: ${err.message}`))
      .finally(() => setSellersLoading(false));
  }, []);

  function toggleSeller(sellerId: string) {
    setSelectedSellerIds((prev) =>
      prev.includes(sellerId) ? prev.filter((id) => id !== sellerId) : [...prev, sellerId],
    );
  }

  async function handleNextFromStep1() {
    setCatalogsLoading(true);
    setCatalogsError(null);

    const results = await Promise.allSettled(
      selectedSellerIds.map(async (sellerId) => {
        const res = await fetch(`/data/sellers/${sellerId}.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as SellerCatalog;
      }),
    );

    const loaded: SellerCatalog[] = [];
    const failed: string[] = [];
    results.forEach((result, i) => {
      if (result.status === "fulfilled") loaded.push(result.value);
      else failed.push(selectedSellerIds[i]);
    });

    setCatalogs(loaded);
    setCatalogsLoading(false);

    if (failed.length > 0) {
      setCatalogsError(`No se pudo cargar el catálogo de: ${failed.join(", ")}`);
    }
    if (loaded.length > 0) {
      setStep(2);
    }
  }

  const mergedProducts = useMemo<SellerTaggedProduct[]>(
    () =>
      catalogs.flatMap((catalog) =>
        catalog.products.map((product) => ({
          ...product,
          sellerId: catalog.sellerId,
          sellerName: catalog.sellerName,
        })),
      ),
    [catalogs],
  );

  const scored = useMemo(
    () => scoreProducts(mergedProducts, { weights, noInterestThreshold, stockMode }, hardFilters),
    [mergedProducts, weights, noInterestThreshold, stockMode, hardFilters],
  );

  const productsBySkuId = useMemo(() => {
    const map = new Map<string, SellerTaggedProduct>();
    mergedProducts.forEach((p) => map.set(p.skuId, p));
    manualAdditions.forEach((p) => map.set(p.skuId, p));
    return map;
  }, [mergedProducts, manualAdditions]);

  // Selección automática: los mejores `topN` productos elegibles (no excluidos).
  // Con interleaveBySeller activo, en vez de cortar los N mejores del pool global
  // (donde un seller con mucho catálogo/venta puede acaparar todo), se turna:
  // el mejor producto pendiente de cada seller por vuelta, hasta llegar a N.
  const autoSelectedSkuIds = useMemo(() => {
    const eligible = scored.filter((p) => !excludedSkuIds.has(p.skuId));
    const limit = noTopLimit ? eligible.length : topN;

    if (!interleaveBySeller) {
      return eligible.slice(0, limit).map((p) => p.skuId);
    }

    const bySeller = new Map<string, typeof eligible>();
    for (const product of eligible) {
      const group = bySeller.get(product.sellerId);
      if (group) group.push(product);
      else bySeller.set(product.sellerId, [product]);
    }
    const sellerGroups = [...bySeller.values()];

    const result: string[] = [];
    for (let round = 0; result.length < limit; round += 1) {
      let addedInRound = false;
      for (const group of sellerGroups) {
        if (round >= group.length) continue;
        result.push(group[round].skuId);
        addedInRound = true;
        if (result.length >= limit) break;
      }
      if (!addedInRound) break; // ya no quedan más productos elegibles en ningún seller
    }
    return result;
  }, [scored, excludedSkuIds, topN, noTopLimit, interleaveBySeller]);

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
    () =>
      finalOrder
        .map((id) => productsBySkuId.get(id))
        .filter((p): p is SellerTaggedProduct => Boolean(p)),
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

  function handleAddManual(product: SellerTaggedProduct) {
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

  function handleRestart() {
    setStep(1);
    setSelectedSellerIds([]);
    setCatalogs([]);
    setCatalogsError(null);
    setWeights(DEFAULT_SCORING_WEIGHTS);
    setNoInterestThreshold(6);
    setStockMode("prefer-high-stock");
    setHardFilters(DEFAULT_HARD_FILTERS);
    setTopN(DEFAULT_TOP_N);
    setNoTopLimit(false);
    setInterleaveBySeller(true);
    setExcludedSkuIds(new Set());
    setManualAdditions([]);
    setFinalOrder([]);
  }

  const sellerNames = catalogs.map((c) => c.sellerName);
  const fileLabel =
    selectedSellerIds.length === 1 ? selectedSellerIds[0] : `multiseller-${selectedSellerIds.length}`;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Constructor de Colecciones — VTEX</h1>
        <p className="mb-4 text-sm text-slate-500">
          Carrefour Argentina · armado semi-automático de colecciones por seller 3P
        </p>
        <StepIndicator current={step} onJump={(s) => setStep(s as 1 | 2 | 3 | 4)} />
      </header>

      <main className="mx-auto max-w-7xl p-4">
        {step === 1 && (
          <Step1Sellers
            sellers={sellers}
            loading={sellersLoading}
            error={sellersError}
            selectedSellerIds={selectedSellerIds}
            onToggle={toggleSeller}
            onSelectAll={(ids) => setSelectedSellerIds(ids)}
            onClear={() => setSelectedSellerIds([])}
            onNext={handleNextFromStep1}
            nextLoading={catalogsLoading}
            nextError={catalogsError}
          />
        )}

        {step === 2 && (
          <Step2Criteria
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
            noTopLimit={noTopLimit}
            onNoTopLimitChange={setNoTopLimit}
            interleaveBySeller={interleaveBySeller}
            onInterleaveBySellerChange={setInterleaveBySeller}
            sellerCount={catalogs.length}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <Step3Review
            scored={scored}
            allProducts={mergedProducts}
            excludedSkuIds={excludedSkuIds}
            onToggleExclude={handleToggleExclude}
            autoSelectedSkuIds={new Set(autoSelectedSkuIds)}
            finalSkuIds={new Set(finalOrder)}
            onAddManual={handleAddManual}
            finalProducts={finalProducts}
            onReorder={setFinalOrder}
            onRemove={handleRemoveFromFinal}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <Step4Export
            finalProducts={finalProducts}
            sellerNames={sellerNames}
            weights={weights}
            fileLabel={fileLabel}
            onBack={() => setStep(3)}
            onRestart={handleRestart}
          />
        )}
      </main>
    </div>
  );
}
