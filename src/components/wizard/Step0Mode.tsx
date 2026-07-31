interface Step0ModeProps {
  onChooseFresh: () => void;
  onChooseReorder: () => void;
}

export default function Step0Mode({ onChooseFresh, onChooseReorder }: Step0ModeProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">¿Qué querés hacer?</h2>
        <p className="text-sm text-slate-500">Elegí cómo arrancar.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={onChooseFresh}
          className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
        >
          <span className="text-base font-semibold text-slate-800">Armar colección desde cero</span>
          <span className="text-sm text-slate-500">
            Elegís uno o varios sellers, definís criterios de scoring y armamos la colección desde su
            catálogo completo.
          </span>
        </button>

        <button
          type="button"
          onClick={onChooseReorder}
          className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
        >
          <span className="text-base font-semibold text-slate-800">Reordenar una colección existente</span>
          <span className="text-sm text-slate-500">
            Subís un .xlsx con SKUs (mismo formato que exportamos), elegís un criterio de orden y
            exportás esos mismos SKUs reordenados.
          </span>
        </button>
      </div>
    </div>
  );
}
