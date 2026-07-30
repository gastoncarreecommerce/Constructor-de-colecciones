import { useEffect, useState } from "react";
import { deletePreset, listPresets, savePreset } from "../lib/presets";
import type { HardFilters, ScoringWeights, StockMode, WeightPreset } from "../lib/types";

interface FilterPanelProps {
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
}

const WEIGHT_FIELDS: Array<{ key: keyof ScoringWeights; label: string }> = [
  { key: "salesWeight", label: "Más vendidos" },
  { key: "recencyWeight", label: "Recién catalogados" },
  { key: "noInterestWeight", label: "Cuotas sin interés" },
  { key: "discountWeight", label: "Descuento" },
  { key: "stockWeight", label: "Stock" },
  { key: "contentQualityWeight", label: "Calidad de contenido" },
];

export default function FilterPanel({
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
}: FilterPanelProps) {
  const [presets, setPresets] = useState<WeightPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");

  useEffect(() => {
    setPresets(listPresets());
  }, []);

  function updateWeight(key: keyof ScoringWeights, value: number) {
    onWeightsChange({ ...weights, [key]: value });
  }

  function handleSavePreset() {
    const name = presetName.trim();
    if (!name) return;
    const preset: WeightPreset = {
      name,
      weights,
      noInterestThreshold,
      stockMode,
      hardFilters,
    };
    savePreset(preset);
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
  }

  function handleDeletePreset() {
    if (!selectedPreset) return;
    deletePreset(selectedPreset);
    setPresets(listPresets());
    setSelectedPreset("");
  }

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Presets</h2>
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
        <div className="mt-2 flex gap-2">
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

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Pesos del scoring</h2>
        <div className="flex flex-col gap-4">
          {WEIGHT_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <div className="mb-1 flex justify-between text-sm text-slate-600">
                <span>{label}</span>
                <span className="tabular-nums font-medium text-slate-800">{weights[key]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={weights[key]}
                onChange={(e) => updateWeight(key, Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-800">Ajustes finos</h2>

        <label className="flex items-center justify-between text-sm text-slate-600">
          <span>Mínimo de cuotas sin interés para el bonus</span>
          <input
            type="number"
            min={0}
            max={24}
            value={noInterestThreshold}
            onChange={(e) => onNoInterestThresholdChange(Number(e.target.value))}
            className="w-16 rounded-md border border-slate-300 px-2 py-1 text-right"
          />
        </label>

        <label className="flex items-center justify-between text-sm text-slate-600">
          <span>Modo stock</span>
          <select
            value={stockMode}
            onChange={(e) => onStockModeChange(e.target.value as StockMode)}
            className="rounded-md border border-slate-300 px-2 py-1"
          >
            <option value="prefer-high-stock">Priorizar más stock</option>
            <option value="prefer-low-stock">Liquidación (priorizar stock bajo)</option>
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-800">Filtros duros</h2>

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
            onChange={(e) =>
              onHardFiltersChange({ ...hardFilters, minStock: Number(e.target.value) })
            }
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

      <div>
        <label className="flex items-center justify-between text-sm text-slate-600">
          <span className="font-semibold text-slate-800">Cantidad final de productos</span>
          <input
            type="number"
            min={1}
            value={topN}
            onChange={(e) => onTopNChange(Number(e.target.value))}
            className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right"
          />
        </label>
      </div>
    </div>
  );
}
