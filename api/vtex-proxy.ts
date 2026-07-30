/**
 * Serverless function de Vercel: proxy autenticado hacia APIs de VTEX.
 *
 * El frontend NO debe llamar a VTEX directamente (expondría AppKey/AppToken
 * en el navegador). En la v1 esto no hace falta porque el frontend lee
 * únicamente el JSON estático generado por el job nocturno
 * (`data/sellers/{sellerId}.json`). Este endpoint queda listo para el
 * momento en que se necesite un dato "en vivo" (ej: stock actualizado al
 * segundo antes de exportar, o refrescar un seller fuera del horario del
 * cron).
 *
 * Uso: GET /api/vtex-proxy?path=/api/logistics/pvt/inventory/skus/12345
 *
 * Por seguridad, solo se permiten métodos GET y únicamente paths que
 * matcheen el allowlist de abajo (evita que este endpoint se convierta en
 * un proxy abierto hacia cualquier URL).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { baseUrl, loadVtexConfigFromEnv } from "../scripts/lib/vtexClient";

const ALLOWED_PATH_PREFIXES = [
  "/api/catalog_system/pub/products/search",
  "/api/catalog_system/pvt/sku/stockkeepingunitbyid/",
  "/api/logistics/pvt/inventory/skus/",
  "/api/checkout/pub/orderForms/simulation",
];

function isAllowedPath(path: string): boolean {
  return ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método no permitido, este proxy solo acepta GET." });
    return;
  }

  const rawPath = req.query.path;
  const path = Array.isArray(rawPath) ? rawPath[0] : rawPath;

  if (!path || !path.startsWith("/")) {
    res.status(400).json({ error: "Falta el query param 'path' (debe empezar con /)." });
    return;
  }

  if (!isAllowedPath(path)) {
    res.status(403).json({ error: "Path no permitido por el allowlist del proxy." });
    return;
  }

  let config;
  try {
    config = loadVtexConfigFromEnv();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
    return;
  }

  // Reconstruye la query string original salvo el propio param "path".
  const forwardedParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "path") continue;
    if (Array.isArray(value)) value.forEach((v) => forwardedParams.append(key, v));
    else if (value !== undefined) forwardedParams.append(key, value);
  }
  const queryString = forwardedParams.toString();
  const url = `${baseUrl(config)}${path}${queryString ? `?${queryString}` : ""}`;

  try {
    const vtexRes = await fetch(url, {
      headers: {
        "X-VTEX-API-AppKey": config.appKey,
        "X-VTEX-API-AppToken": config.appToken,
        Accept: "application/json",
      },
    });
    const body = await vtexRes.text();
    res.status(vtexRes.status);
    res.setHeader("Content-Type", vtexRes.headers.get("content-type") ?? "application/json");
    res.send(body);
  } catch (err) {
    res.status(502).json({ error: `Error consultando VTEX: ${(err as Error).message}` });
  }
}
