import type { WeightPreset } from "./types";

const STORAGE_KEY = "constructor-colecciones:presets";

function readAll(): WeightPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(presets: WeightPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function listPresets(): WeightPreset[] {
  return readAll().sort((a, b) => a.name.localeCompare(b.name));
}

/** Guarda (o sobrescribe si ya existe un preset con el mismo nombre). */
export function savePreset(preset: WeightPreset): void {
  const presets = readAll().filter((p) => p.name !== preset.name);
  presets.push(preset);
  writeAll(presets);
}

export function deletePreset(name: string): void {
  writeAll(readAll().filter((p) => p.name !== name));
}
