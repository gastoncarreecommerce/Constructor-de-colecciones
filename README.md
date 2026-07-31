# Constructor de Colecciones — VTEX

Herramienta interna (Carrefour Argentina) para armar colecciones de
productos de VTEX a partir de uno o varios sellers 3P, de forma
semi-automática, a través de un wizard de 4 pasos: elegir sellers, elegir
criterios de scoring, revisar/reordenar (drag & drop), y exportar un
`.xlsx` que replica el template real de import de Colecciones de VTEX
(sheet "Collection", columna `SKUREFID` completada).

## Arquitectura

```
[GitHub Action nocturno]
   → pega a las APIs de VTEX (Search legacy, Catalog, Checkout, Logistics)
   → arma data/sellers/{sellerId}.json + data/sellers/index.json
   → commitea al repo → push a main

[Frontend (Vercel)]
   → auto-deploy en cada push a main
   → lee los JSON estáticos (public/data → symlink a data/)
   → aplica scoring/filtros en memoria, reordenamiento manual, export .xlsx
   → todo client-side, sin pegarle a VTEX en vivo
```

`/api/vtex-proxy.ts` queda preparado como proxy autenticado hacia VTEX por
si en el futuro el frontend necesita un dato en vivo (ver `NOTES.md`), pero
la v1 no lo usa: todo sale del JSON cacheado.

## Estructura del repo

```
/scripts                 Job de datos (Fase 1)
/src/lib                 Tipos compartidos, motor de scoring (Fase 2), export .xlsx, presets
/src/components          Componentes reusables (grilla, reorder, export)
/src/components/wizard   Los 4 pasos del wizard + indicador de progreso
/api                      Serverless functions de Vercel (proxy VTEX)
/data/sellers             JSON generados por el job (index.json + {sellerId}.json)
/.github/workflows        Cron nocturno
```

---

## Fase 1 — Job de datos: correrlo y probarlo en local

1. Instalá dependencias:
   ```bash
   npm install
   ```
2. Copiá `.env.example` a `.env` y completá tus credenciales de VTEX:
   ```bash
   cp .env.example .env
   ```
   ```
   VTEX_ACCOUNT_NAME=carrefourar        # tu account name de VTEX
   VTEX_APP_KEY=...
   VTEX_APP_TOKEN=...
   VTEX_SALES_CHANNEL=1
   ```
3. Corré el job para un seller puntual:
   ```bash
   npm run fetch-catalog -- <sellerId> "Nombre del Seller"
   ```
   Esto genera/actualiza:
   - `data/sellers/{sellerId}.json` (catálogo completo con score inputs)
   - `data/sellers/index.json` (índice de sellers disponibles)

4. Revisá el JSON generado. Si algún campo viene vacío (EAN, categoría,
   fecha de alta), mirá los `TODO` en `scripts/lib/vtexTypes.ts` y
   `scripts/fetch-seller-catalog.ts` — están marcados los puntos donde el
   nombre exacto de un campo puede variar según la config de la cuenta, y
   hay que confirmarlo contra una respuesta real.

> El repo ya incluye un seller de ejemplo (`seller-demo`) con datos
> ficticios en `data/sellers/`, para poder probar el frontend (Fases 2 y 3)
> sin necesidad de credenciales de VTEX.

## Fase 2 — Motor de scoring: correr los tests

```bash
npm run test
```

Corre los tests de Vitest sobre `src/lib/scoring.ts` (normalización,
pesos, filtros duros, cap por categoría).

## Fase 3 — Frontend: correrlo en local

```bash
npm run dev
```

Abrí `http://localhost:5173`. El frontend es un wizard de 4 pasos:

1. **Sellers** — elegí uno o varios sellers 3P (multi-select con buscador).
   Sus catálogos se combinan en una sola colección.
2. **Criterios** — activá qué priorizar (más vendidos/populares, recién
   catalogados, mejor financiación, mejor descuento, stock, calidad de
   contenido) con un nivel de importancia por criterio. "Mejor calificación"
   aparece deshabilitada: requiere integrar la API de Reviews & Ratings de
   VTEX, no está en el alcance actual. Filtros avanzados (stock mínimo, cap
   por categoría, cantidad final) y presets quedan colapsados abajo.
3. **Revisión** — grilla con el ranking automático (podés excluir productos
   puntuales o agregar alguno manualmente) + la lista final reordenable con
   drag & drop.
4. **Exportar** — resumen de la colección armada y el botón de descarga del
   `.xlsx`, con la estructura exacta que espera el import de Colecciones de
   VTEX (sheet "Collection", columnas `SKU`/`PRODUCT`/`SKUREFID`/
   `PRODUCTREFID`, solo `SKUREFID` completada — nada más).

Vas a ver el seller de ejemplo (`seller-demo`) disponible para elegir en el
paso 1. Una vez que corriste la Fase 1 con sellers reales, van a aparecer
ahí también (el índice se lee de `data/sellers/index.json`, servido vía el
symlink `public/data → ../data`).

Otros comandos útiles:

```bash
npm run typecheck   # chequeo de tipos de todo el proyecto (scripts + frontend + api)
npm run build       # build de producción (tsc -b && vite build)
npm run preview     # sirve el build de dist/ en local
```

---

## Fase 5 — Deploy (GitHub + Vercel)

### 1) Crear el repo y pushear

```bash
git init   # si todavía no es un repo git
git add .
git commit -m "Initial commit: Constructor de Colecciones"
git branch -M main
git remote add origin <URL_DE_TU_REPO>
git push -u origin main
```

### 2) Importar el proyecto en Vercel

1. En Vercel → **Add New → Project** → elegí el repo recién pusheado.
2. Framework preset: Vite (Vercel lo detecta solo gracias a `vercel.json`).
3. Build command / Output directory ya vienen seteados en `vercel.json`
   (`npm run build` → `dist`), no hace falta tocarlos.
4. Deploy.

### 3) Cargar las env vars en ambos lugares

**GitHub Secrets** (para el cron que corre `fetch-seller-catalog.ts`):

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

- `VTEX_ACCOUNT_NAME`
- `VTEX_APP_KEY`
- `VTEX_APP_TOKEN`
- `VTEX_SALES_CHANNEL`

**Vercel Environment Variables** (solo si vas a usar `/api/vtex-proxy.ts`;
la v1 no lo necesita para funcionar, pero no está de más dejarlo cargado):

Proyecto en Vercel → **Settings → Environment Variables**, mismas 4
variables, mismos valores.

> GitHub Secrets y Vercel Environment Variables son dos lugares
> completamente distintos — cargar en uno no carga en el otro.

### 4) Forzar la primera corrida del workflow (antes del primer deploy con datos reales)

1. Editá `.github/workflows/fetch-catalog.yml` y poné los `sellerId` reales
   de Carrefour AR en `DEFAULT_SELLER_IDS` (reemplazando `seller-demo`).
2. Repo → **Actions → Fetch VTEX Seller Catalogs → Run workflow**
   (`workflow_dispatch`). Podés pasar `sellerIds` puntuales en el input, o
   dejarlo vacío para que use `DEFAULT_SELLER_IDS`.
3. El workflow corre el job, commitea los JSON actualizados en
   `data/sellers/` y los pushea a `main`.
4. Ese push dispara automáticamente el redeploy de Vercel (auto-deploy en
   cada push a `main`) — no hace falta ningún paso manual extra en Vercel.

---

## Notas de datos

- `daysSinceCreated`, `salesRank`, `maxInstallmentsNoInterest` y `stock`
  vienen todos resueltos por el job de datos, no se recalculan en el
  frontend — el frontend solo normaliza y pondera lo que ya vino en el
  JSON.
- Ver `NOTES.md` para ideas de v2 (publicación directa a la Collection API
  de VTEX, colecciones "vivas" con scheduling, tracking con GA4).
