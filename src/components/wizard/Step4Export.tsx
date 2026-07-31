import ExportButton from "../ExportButton";
import type { ScoringWeights, SellerTaggedProduct } from "../../lib/types";

interface Step4ExportProps {
  finalProducts: SellerTaggedProduct[];
  sellerNames: string[];
  weights: ScoringWeights;
  fileLabel: string;
  onBack: () => void;
  onRestart: () => void;
}

const CRITERIA_LABELS: Record<keyof ScoringWeights, string> = {
  salesWeight: "Más vendidos / populares",
  recencyWeight: "Recién catalogados",
  noInterestWeight: "Mejor financiación",
  discountWeight: "Mejor descuento",
  stockWeight: "Stock disponible",
  contentQualityWeight: "Calidad de contenido",
};

function importanceLabel(weight: number): string {
  if (weight >= 88) return "Muy alta";
  if (weight >= 63) return "Alta";
  if (weight >= 38) return "Media";
  return "Baja";
}

export default function Step4Export({
  finalProducts,
  sellerNames,
  weights,
  fileLabel,
  onBack,
  onRestart,
}: Step4ExportProps) {
  const activeCriteria = (Object.keys(weights) as Array<keyof ScoringWeights>).filter(
    (key) => weights[key] > 0,
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Colección lista</h2>
        <p className="text-sm text-slate-500">
          Revisá el resumen y exportá el archivo para importarlo en Colecciones de VTEX.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Sellers incluidos
          </span>
          <p className="text-sm text-slate-800">{sellerNames.join(", ")}</p>
        </div>

        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Criterios usados
          </span>
          {activeCriteria.length === 0 ? (
            <p className="text-sm text-slate-500">Ninguno (orden tal cual venía del catálogo).</p>
          ) : (
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {activeCriteria.map((key) => (
                <li
                  key={key}
                  className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700"
                >
                  {CRITERIA_LABELS[key]} · {importanceLabel(weights[key])}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Productos en la colección final
          </span>
          <p className="text-2xl font-semibold text-slate-900">{finalProducts.length}</p>
        </div>
      </div>

      <ExportButton products={finalProducts} fileLabel={fileLabel} />

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
          onClick={onRestart}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Empezar una colección nueva
        </button>
      </div>
    </div>
  );
}
