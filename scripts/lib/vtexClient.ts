/**
 * Cliente HTTP delgado para las APIs de VTEX usadas por el job de catálogo.
 * Todas las requests van autenticadas con AppKey/AppToken (credenciales
 * privadas, nunca deben usarse desde el navegador).
 */

export interface VtexConfig {
  accountName: string;
  appKey: string;
  appToken: string;
  salesChannel: string;
}

export function loadVtexConfigFromEnv(): VtexConfig {
  const accountName = process.env.VTEX_ACCOUNT_NAME;
  const appKey = process.env.VTEX_APP_KEY;
  const appToken = process.env.VTEX_APP_TOKEN;
  const salesChannel = process.env.VTEX_SALES_CHANNEL;

  const missing = [
    !accountName && "VTEX_ACCOUNT_NAME",
    !appKey && "VTEX_APP_KEY",
    !appToken && "VTEX_APP_TOKEN",
    !salesChannel && "VTEX_SALES_CHANNEL",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno requeridas: ${missing.join(", ")}. Revisá .env.example.`,
    );
  }

  return { accountName: accountName!, appKey: appKey!, appToken: appToken!, salesChannel: salesChannel! };
}

function authHeaders(config: VtexConfig): Record<string, string> {
  return {
    "X-VTEX-API-AppKey": config.appKey,
    "X-VTEX-API-AppToken": config.appToken,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export function baseUrl(config: VtexConfig): string {
  return `https://${config.accountName}.vtexcommercestable.com.br`;
}

/** Delay simple, usado para espaciar batches y no pegar contra rate limits de VTEX. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FetchJsonOptions {
  method?: "GET" | "POST";
  body?: unknown;
  retries?: number;
}

/**
 * fetch con reintentos simples (backoff exponencial) para 429/5xx.
 * VTEX puede devolver 429 bajo carga; reintentamos hasta `retries` veces.
 */
export async function fetchJson<T>(
  url: string,
  config: VtexConfig,
  options: FetchJsonOptions = {},
): Promise<T> {
  const { method = "GET", body, retries = 3 } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: authHeaders(config),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`VTEX respondió ${res.status} en ${url}`);
        await sleep(2 ** attempt * 500);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`VTEX respondió ${res.status} en ${url}: ${text.slice(0, 500)}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      await sleep(2 ** attempt * 500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Procesa `items` en lotes de `batchSize`, ejecutando `handler` en paralelo
 * dentro de cada lote y esperando `delayMs` entre lotes. Evita pegarle a
 * VTEX con miles de requests simultáneas (rate limiting / 429s).
 */
export async function processBatched<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  handler: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, i) => handler(item, start + i)),
    );
    batchResults.forEach((r, i) => {
      results[start + i] = r;
    });
    if (start + batchSize < items.length) {
      await sleep(delayMs);
    }
  }
  return results;
}
