import { useState } from "react";

interface Step0UploadProps {
  onSkusExtracted: (refIds: string[]) => void;
  matchingLoading: boolean;
  matchingError: string | null;
  onBack: () => void;
}

export default function Step0Upload({
  onSkusExtracted,
  matchingLoading,
  matchingError,
  onBack,
}: Step0UploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [refIds, setRefIds] = useState<string[] | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParsing(true);
    setParseError(null);
    setRefIds(null);

    try {
      // Import diferido: la librería xlsx solo hace falta acá, no en el resto del wizard.
      const { parseSkuRefIdsFromWorkbook } = await import("../../lib/collectionExport");
      const buffer = await file.arrayBuffer();
      const parsed = parseSkuRefIdsFromWorkbook(buffer);
      if (parsed.length === 0) {
        setParseError("No se encontró ningún SKU en la columna SKUREFID.");
        return;
      }
      setRefIds(parsed);
    } catch (err) {
      setParseError((err as Error).message);
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Subí la colección a reordenar</h2>
        <p className="text-sm text-slate-500">
          Tiene que ser un .xlsx con el mismo formato que exportamos: hoja "Collection" con una columna
          "SKUREFID". Vamos a buscar cada SKU en todos los catálogos de sellers que tenemos cacheados.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
        <input
          type="file"
          accept=".xlsx"
          onChange={handleFileChange}
          className="mx-auto block text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-700"
        />
        {fileName && <p className="mt-3 text-xs text-slate-400">Archivo: {fileName}</p>}
        {parsing && <p className="mt-2 text-sm text-slate-500">Leyendo archivo...</p>}
        {parseError && <p className="mt-2 text-sm text-red-600">{parseError}</p>}
        {refIds && (
          <p className="mt-2 text-sm text-emerald-700">
            {refIds.length} SKU{refIds.length === 1 ? "" : "s"} encontrado{refIds.length === 1 ? "" : "s"}{" "}
            en el archivo.
          </p>
        )}
      </div>

      {matchingError && <p className="text-sm text-red-600">{matchingError}</p>}

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
          onClick={() => refIds && onSkusExtracted(refIds)}
          disabled={!refIds || matchingLoading}
          className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {matchingLoading ? "Buscando productos..." : "Buscar productos →"}
        </button>
      </div>
    </div>
  );
}
