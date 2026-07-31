interface Step0ModeProps {
  onChooseFresh: () => void;
  onChooseReorder: () => void;
}

function CollectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" fill="currentColor" opacity="0.9" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M12 15.5V4" />
      <path d="M7 8.5 12 4l5 4.5" />
      <path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

interface ModeCardProps {
  icon: React.ReactNode;
  accent: string;
  title: string;
  description: string;
  bullets: string[];
  cta: string;
  onClick: () => void;
}

function ModeCard({ icon, accent, title, description, bullets, cta, onClick }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg"
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent} transition-transform group-hover:scale-105`}
      >
        {icon}
      </span>

      <div className="flex flex-col gap-1.5">
        <span className="text-base font-semibold text-slate-900">{title}</span>
        <span className="text-sm leading-relaxed text-slate-500">{description}</span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2 text-xs text-slate-500">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
            {bullet}
          </li>
        ))}
      </ul>

      <span className="mt-1 flex items-center gap-1 text-sm font-semibold text-indigo-600">
        {cta}
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </button>
  );
}

export default function Step0Mode({ onChooseFresh, onChooseReorder }: Step0ModeProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 py-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-slate-900">¿Cómo querés empezar?</h2>
        <p className="mt-1 text-sm text-slate-500">Elegí un punto de partida para tu colección.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ModeCard
          icon={<CollectionIcon />}
          accent="bg-indigo-100 text-indigo-600"
          title="Armar colección desde cero"
          description="Partís del catálogo completo de uno o varios sellers 3P y armás la colección con scoring."
          bullets={[
            "Elegís uno o varios sellers",
            "Definís criterios de scoring (ventas, financiación, descuento, etc.)",
            "Revisás, reordenás y exportás",
          ]}
          cta="Empezar desde cero"
          onClick={onChooseFresh}
        />

        <ModeCard
          icon={<UploadIcon />}
          accent="bg-emerald-100 text-emerald-600"
          title="Reordenar una colección existente"
          description="Ya tenés la lista de SKUs armada y solo querés reordenarla con un criterio."
          bullets={[
            'Subís un .xlsx con columna "SKUREFID"',
            "Buscamos cada SKU en todos los catálogos cacheados",
            "Elegís el criterio de orden y exportás",
          ]}
          cta="Subir colección existente"
          onClick={onChooseReorder}
        />
      </div>
    </div>
  );
}
