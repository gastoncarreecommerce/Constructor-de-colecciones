const STEPS = ["Sellers", "Criterios", "Revisión", "Exportar"] as const;

interface StepIndicatorProps {
  current: number;
  onJump: (step: number) => void;
}

export default function StepIndicator({ current, onJump }: StepIndicatorProps) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const isCurrent = stepNum === current;
        const isDone = stepNum < current;
        const isClickable = isDone;

        return (
          <li key={label} className="flex items-center gap-1">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onJump(stepNum)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors ${
                isCurrent
                  ? "bg-indigo-600 text-white font-medium"
                  : isDone
                    ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 cursor-pointer"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  isCurrent
                    ? "bg-white text-indigo-600"
                    : isDone
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-300 text-white"
                }`}
              >
                {isDone ? "✓" : stepNum}
              </span>
              {label}
            </button>
            {stepNum < STEPS.length && <span className="px-1 text-slate-300">→</span>}
          </li>
        );
      })}
    </ol>
  );
}
