import { useEffect, useState } from "react";
import { deletePreset, listPresets, savePreset } from "../../lib/presets";
import type { HardFilters, ScoringWeights, StockMode, WeightPreset } from "../../lib/types";

interface Step2CriteriaProps {
  weights: ScoringWeights;
  onWeightsChange: (weights: ScoringWeights) => void;
  noInterestThreshold: number;
  onNoInterestThresholdChange: (value: number) => void;
  stockMode: StockMode;
  onStockModeChange: (mode: StockMode) => void;
  hardFilters: HardFilters;
  onHardFiltersChange: (filters: HardFilters) => void;
  topN: number;
  onTopNChange: (value: number) => void;
  noTopLimit: boolean;
  onNoTopLimitChange: (value: boolean) => void;
  interleaveBySeller: boolean;
  onInterleaveBySellerChange: (value: boolean) => void;
  sellerCount: number;
  availableCategories: string[];
  onBack: () => void;
  onNext: () => void;
}

const IMPORTANCE_LEVELS: Array<{ label: string; value: number }> = [
  { label: "Baja", value: 25 },
  { label: "Media", value: 50 },
  { label: "Alta", value: 75 },
  { label: "Muy alta", value: 100 },
];

const DEFAULT_IMPORTANCE_ON_ACTIVATE = 75;
const FALLBACK_TOP_N = 40;

const CRITERIA: Array<{ key: keyof ScoringWeights; label: string; description: string }> = [
  {
    key: "salesWeight",
    label: "Más vendidos / populares",
    description: "Prioriza productos mejor posicionados en el ranking de ventas de los últimos 90 días.",
  },
  {
    key: "recencyWeight",
    label: "Recién catalogados",
    description: "Prioriza productos dados de alta hace poco tiempo.",
  },
  {
    key: "noInterestWeight",
    label: "Mejor financiación",
    description: "Prioriza productos con más cuotas sin interés.",
  },
  {
    key: "discountWeight",
    label: "Mejor descuento",
    description: "Prioriza productos con mayor % de descuento sobre el precio de lista.",
  },
  {
    key: "stockWeight",
    label: "Stock disponible",
    description: "Prioriza según disponibilidad de stock (alto o bajo, según el modo elegido abajo).",
  },
  {
    key: "contentQualityWeight",
    label: "Calidad de contenido",
    description: "Prioriza productos con ficha completa (imagen, categoría, EAN, precio).",
  },
];

function nearestImportanceLabel(weight: number): string {
  if (weight <= 0) return "";
  let closest = IMPORTANCE_LEVELS[0];
  let bestDiff = Math.abs(weight - closest.value);
  for (const level of IMPORTANCE_LEVELS) {
    const diff = Math.abs(weight - level.value);
    if (diff < bestDiff) {
      closest = level;
      bestDiff = diff;
    }
  }
  return closest.label;
}

export default function Step2Criteria({
  weights,
  onWeightsChange,
  noInterestThreshold,
  onNoInterestThresholdChange,
  stockMode,
  onStockModeChange,
  hardFilters,
  onHardFiltersChange,
  topN,
  onTopNChange,
  noTopLimit,
  onNoTopLimitChange,
  interleaveBySeller,
  onInterleaveBySellerChange,
  sellerCount,
  availableCategories,
  onBack,
  onNext,
}: Step2CriteriaProps) {
  const [presets, setPresets] = useState<WeightPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [categorySearch, setCategorySearch] = useState("");

  const selectedCategories = hardFilters.categoryPaths ?? [];
  const filteredCategories = categorySearch.trim()
    ? availableCategories.filter((c) => c.toLowerCase().includes(categorySearch.trim().toLowerCase()))
    : availableCategories;

  function toggleCategory(category: string) {
    const next = selectedCategories.includes(category)
      ? selectedCategories.filter((c) => c !== category)
      : [...selectedCategories, category];
    onHardFiltersChange({ ...hardFilters, categoryPaths: next.length > 0 ? next : null });
  }

  useEffect(() => {
    setPresets(listPresets());
  }, []);

  function toggleCriterion(key: keyof ScoringWeights) {
    const isActive = weights[key] > 0;
    onWeightsChange({ ...weights, [key]: isActive ? 0 : DEFAULT_IMPORTANCE_ON_ACTIVATE });
  }

  function setImportance(key: keyof ScoringWeights, value: number) {
    onWeightsChange({ ...weights, [key]: value });
  }

  function handleSavePreset() {
    const name = presetName.trim();
    if (!name) return;
    savePreset({
      name,
      weights,
      noInterestThreshold,
      stockMode,
      hardFilters,
      topN,
      noTopLimit,
      interleaveBySeller,
    });
    setPresets(listPresets());
    setSelectedPreset(name);
    setPresetName("");
  }

  function handleLoadPreset(name: string) {
    setSelectedPreset(name);
    const preset = presets.find((p) => p.name === name);
    if (!preset) return;
    onWeightsChange(preset.weights);
    onNoInterestThresholdChange(preset.noInterestThreshold);
    onStockModeChange(preset.stockMode);
    onHardFiltersChange(preset.hardFilters);
    // Fallback para presets guardados antes de que existieran estos campos.
    onTopNChange(preset.topN ?? FALLBACK_TOP_N);
    onNoTopLimitChange(preset.noTopLimit ?? false);
    onInterleaveBySellerChange(preset.interleaveBySeller ?? true);
  }

  function handleDeletePreset() {
    if (!selectedPreset) return;
    deletePreset(selectedPreset);
    setPresets(listPresets());
    setSelectedPreset("");
  }

  const activeCount = CRITERIA.filter((c) => weights[c.key] > 0).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">¿Qué querés priorizar?</h2>
        <p className="text-sm text-slate-500">
          Activá los criterios que te importan y elegí qué tan fuerte pesa cada uno. Podés combinar
          varios — el score final es un promedio ponderado de todos los activos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CRITERIA.map((criterion) => {
          const active = weights[criterion.key] > 0;
          return (
            <div
              key={criterion.key}
              className={`flex flex-col gap-3 rounded-lg border p-4 transition-colors ${
                active ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-white"
              }`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleCriterion(criterion.key)}
                  className="mt-0.5 h-4 w-4 accent-indigo-600"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-800">{criterion.label}</span>
                  <span className="block text-xs text-slate-500">{criterion.description}</span>
                </span>
              </label>

              {active && (
                <div className="flex flex-wrap gap-1.5 pl-7">
                  {IMPORTANCE_LEVELS.map((level) => {
                    const isSelected = nearestImportanceLabel(weights[criterion.key]) === level.label;
                    return (
                      <button
                        key={level.label}
                        type="button"
                        onClick={() => setImportance(criterion.key, level.value)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "bg-white text-slate-500 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {level.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {active && criterion.key === "noInterestWeight" && (
                <label className="flex items-center justify-between pl-7 text-xs text-slate-600">
                  <span>Mínimo de cuotas sin interés</span>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={noInterestThreshold}
                    onChange={(e) => onNoInterestThresholdChange(Number(e.target.value))}
                    className="w-14 rounded-md border border-slate-300 px-2 py-1 text-right"
                  />
                </label>
              )}

              {active && criterion.key === "stockWeight" && (
                <label className="flex items-center justify-between pl-7 text-xs text-slate-600">
                  <span>Modo</span>
                  <select
                    value={stockMode}
                    onChange={(e) => onStockModeChange(e.target.value as StockMode)}
                    className="rounded-md border border-slate-300 px-2 py-1"
                  >
                    <option value="prefer-high-stock">Priorizar más stock</option>
                    <option value="prefer-low-stock">Liquidación (stock bajo)</option>
                  </select>
                </label>
              )}
            </div>
          );
        })}

        <div className="flex flex-col gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 opacity-60">
          <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
            Mejor calificación
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
              Próximamente
            </span>
          </span>
          <span
            className="text-xs text-slate-400"
            title="Requiere integrar la API de Reviews & Ratings de VTEX, todavía no está conectada en este pipeline."
          >
            Falta conectar la API de Reviews &amp; Ratings de VTEX para tener este dato.
          </span>
        </div>
      </div>

      {activeCount === 0 && (
        <p className="text-sm text-amber-600">
          No activaste ningún criterio: el orden va a quedar tal cual viene del catálogo. Activá al menos
          uno para que el score haga algo.
        </p>
      )}

      <div className="flex flex-col gap-4 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
        <h3 className="text-sm font-semibold text-slate-800">Composición final</h3>

        <label className="flex items-center justify-between text-sm text-slate-700">
          <span className="font-medium">Cantidad final de productos</span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={topN}
              disabled={noTopLimit}
              onChange={(e) => onTopNChange(Number(e.target.value))}
              className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right disabled:bg-slate-100 disabled:text-slate-400"
            />
          </span>
        </label>
        <label className="flex items-center justify-between text-sm text-slate-600">
          <span>Sin límite (traer todos los que matcheen los filtros)</span>
          <input
            type="checkbox"
            checked={noTopLimit}
            onChange={(e) => onNoTopLimitChange(e.target.checked)}
            className="h-4 w-4 accent-indigo-600"
          />
        </label>

        <div className="border-t border-indigo-100 pt-3">
          <label className="flex items-center justify-between text-sm text-slate-700">
            <span>
              <span className="font-medium">Intercalar por seller (round-robin)</span>
              <span className="block text-xs font-normal text-slate-500">
                En vez de agarrar los N mejores de todo el pool (donde un seller grande puede
                comerse toda la colección), va turnando: el mejor de cada seller, después el
                segundo mejor de cada uno, y así.
              </span>
            </span>
            <input
              type="checkbox"
              checked={interleaveBySeller}
              onChange={(e) => onInterleaveBySellerChange(e.target.checked)}
              disabled={sellerCount < 2}
              className="h-4 w-4 shrink-0 accent-indigo-600 disabled:opacity-40"
            />
          </label>
          {sellerCount < 2 && (
            <p className="mt-1 text-xs text-slate-400">
              Elegiste un solo seller, así que esto no tiene efecto.
            </p>
          )}
        </div>
      </div>

      <details className="rounded-lg border border-slate-200 bg-white p-4" open={selectedCategories.length > 0}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          Categorías{" "}
          {selectedCategories.length > 0 && (
            <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {selectedCategories.length} elegida{selectedCategories.length === 1 ? "" : "s"}
            </span>
          )}
        </summary>
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-xs text-slate-500">
            Sin nada elegido acá entran todas las categorías. Útil para armar una colección de un
            seller pero solo de una categoría puntual (ej: "Electrolux, pero solo Heladeras").
          </p>
          {availableCategories.length === 0 ? (
            <p className="text-sm text-slate-400">
              Todavía no hay categorías disponibles (elegí sellers primero).
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Buscar categoría..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="min-w-[14rem] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => onHardFiltersChange({ ...hardFilters, categoryPaths: null })}
                  disabled={selectedCategories.length === 0}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  Limpiar selección
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border border-slate-100">
                {filteredCategories.length === 0 ? (
                  <p className="p-3 text-center text-sm text-slate-400">
                    Sin resultados para "{categorySearch}".
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {filteredCategories.map((category) => (
                      <li key={category}>
                        <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(category)}
                            onChange={() => toggleCategory(category)}
                            className="h-4 w-4 shrink-0 accent-indigo-600"
                          />
                          <span className="truncate text-slate-700">{category}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </details>

      <details className="rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Filtros avanzados</summary>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex items-center justify-between text-sm text-slate-600">
            <span>Excluir sin stock</span>
            <input
              type="checkbox"
              checked={hardFilters.excludeOutOfStock}
              onChange={(e) =>
                onHardFiltersChange({ ...hardFilters, excludeOutOfStock: e.target.checked })
              }
              className="h-4 w-4 accent-indigo-600"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-slate-600">
            <span>Stock mínimo</span>
            <input
              type="number"
              min={0}
              value={hardFilters.minStock}
              onChange={(e) => onHardFiltersChange({ ...hardFilters, minStock: Number(e.target.value) })}
              className="w-16 rounded-md border border-slate-300 px-2 py-1 text-right"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-slate-600">
            <span>Mínimo de cuotas sin interés (excluyente)</span>
            <input
              type="number"
              min={0}
              max={24}
              value={hardFilters.minInstallmentsNoInterest}
              onChange={(e) =>
                onHardFiltersChange({
                  ...hardFilters,
                  minInstallmentsNoInterest: Number(e.target.value),
                })
              }
              className="w-16 rounded-md border border-slate-300 px-2 py-1 text-right"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-slate-600">
            <span>Cap por categoría (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              placeholder="Sin cap"
              value={hardFilters.maxCategoryShare === null ? "" : hardFilters.maxCategoryShare * 100}
              onChange={(e) => {
                const raw = e.target.value;
                onHardFiltersChange({
                  ...hardFilters,
                  maxCategoryShare: raw === "" ? null : Number(raw) / 100,
                });
              }}
              className="w-16 rounded-md border border-slate-300 px-2 py-1 text-right"
            />
          </label>
        </div>
      </details>

      <details className="rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          Presets guardados
        </summary>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              value={selectedPreset}
              onChange={(e) => handleLoadPreset(e.target.value)}
            >
              <option value="">Elegir preset guardado...</option>
              {presets.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleDeletePreset}
              disabled={!selectedPreset}
              className="rounded-md border border-red-200 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              Borrar
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder='Nombre (ej: "Semana sin interés")'
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
        </div>
      </details>

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
          className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
