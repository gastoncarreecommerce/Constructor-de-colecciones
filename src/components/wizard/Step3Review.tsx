import ProductGrid from "../ProductGrid";
import ReorderList from "../ReorderList";
import type { ScoredSellerTaggedProduct, SellerTaggedProduct } from "../../lib/types";

interface Step3ReviewProps {
  scored: ScoredSellerTaggedProduct[];
  allProducts: SellerTaggedProduct[];
  excludedSkuIds: Set<string>;
  onToggleExclude: (skuId: string) => void;
  topN: number;
  finalSkuIds: Set<string>;
  onAddManual: (product: SellerTaggedProduct) => void;
  finalProducts: SellerTaggedProduct[];
  onReorder: (newOrder: string[]) => void;
  onRemove: (skuId: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function Step3Review({
  scored,
  allProducts,
  excludedSkuIds,
  onToggleExclude,
  topN,
  finalSkuIds,
  onAddManual,
  finalProducts,
  onReorder,
  onRemove,
  onBack,
  onNext,
}: Step3ReviewProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Revisá y ajustá la colección</h2>
        <p className="text-sm text-slate-500">
          A la izquierda está el ranking automático según los criterios elegidos — desmarcá lo que no
          quieras o agregá algo puntual. A la derecha está el orden final: arrastrá para acomodarlo como
          quieras antes de exportar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <ProductGrid
          scored={scored}
          allProducts={allProducts}
          excludedSkuIds={excludedSkuIds}
          onToggleExclude={onToggleExclude}
          topN={topN}
          finalSkuIds={finalSkuIds}
          onAddManual={onAddManual}
        />
        <ReorderList products={finalProducts} onReorder={onReorder} onRemove={onRemove} />
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          ← Atrás
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={finalProducts.length === 0}
          className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
