# NOTES — Ideas para v2

Este documento junta ideas para una segunda iteración del Constructor de
Colecciones. Nada de esto está implementado todavía; son notas de dirección,
no un compromiso de roadmap.

## 1. Publicar la colección directo en VTEX (saltear el archivo)

Hoy el flujo termina en un `.xlsx` que se importa a mano en el admin de
VTEX. El siguiente paso natural es que la app cree/actualice la colección
directo contra la Collection API:

- `POST /api/catalog/pvt/collection/{collectionId}/sku` para agregar SKUs a
  una colección existente, en el orden final elegido.
- Necesitaríamos primero resolver o crear el `collectionId` (`POST
  /api/catalog/pvt/collection/` si la colección es nueva).
- Esto implica mover esta llamada a una serverless function de `/api` (nunca
  desde el cliente, porque requiere AppKey/AppToken), y agregar un botón
  "Publicar en VTEX" al lado de "Exportar".
- Hay que pensar el modo "reemplazar colección completa" vs "agregar/mover
  SKUs existentes", porque la Collection API no tiene un endpoint atómico de
  "reemplazar todo el orden" — probablemente haya que traer el estado actual
  de la colección, diffear contra el orden final del usuario, y hacer los
  requests incrementales necesarios (altas, bajas, reordenamiento).
- Confirmar rate limits de esta API en cuentas grandes (colecciones de
  cientos de SKUs pueden implicar cientos de requests).

## 2. Scheduling de colecciones "vivas"

Hay colecciones que en teoría deberían actualizarse solas con el tiempo
(ej: "Más vendidos de la semana", "Recién llegados"), sin que nadie tenga
que volver a entrar a la herramienta:

- Guardar, por colección, el `sellerId` + preset de pesos + filtros duros +
  `collectionId` de destino usados para generarla.
- Un cron (GitHub Actions, ya corriendo el job nocturno) que, además de
  refrescar el catálogo, recalcule el score con el preset guardado y
  publique automáticamente vía Collection API (ver punto 1).
- Necesita un mecanismo de "aprobación" o al menos un modo dry-run/preview
  antes de publicar en automático, para que nadie se lleve una sorpresa con
  una colección que cambió sola de un día para el otro.
- Guardar un historial de qué se publicó en cada corrida (para poder
  auditar/revertir).

## 3. Tracking post-launch con GA4

Para saber si vale la pena mantener una combinación de pesos en vez de otra:

- Al generar la colección, taggear cada producto con un `item_list_id` /
  `item_list_name` (ej: `coleccion_{sellerId}_{fecha}` o el nombre del
  preset usado) para mandarlo en los eventos `view_item_list` /
  `select_item` de GA4 en el sitio.
- Esto requiere coordinación con el equipo de frontend del sitio (no de
  esta herramienta) para que el PLP/vitrina de la colección mande ese
  `item_list_id` en el dataLayer.
- Con eso en GA4/BigQuery se podría después cruzar: click-through rate y
  conversión por colección, y comparar qué combinación de pesos (qué
  preset) rindió mejor — cerrando el loop entre "qué armamos" y "qué
  funcionó".
- Posible vista futura en la propia app: un dashboard simple que traiga esas
  métricas desde BigQuery y las muestre al lado de cada preset guardado.

## Otras ideas sueltas (menor prioridad)

- Soporte multi-seller: armar una colección mezclando productos de más de
  un seller 3P (hoy el flujo asume un seller a la vez).
- Vista previa visual tipo "grilla de PLP" además de la tabla, para ver
  cómo quedaría la colección en el sitio antes de publicarla.
- Undo/redo sobre el reordenamiento manual.
- Exportar/importar el estado completo de una sesión (no solo el .xlsx final)
  como JSON, para retomar el armado de una colección otro día.
- Reemplazar el JSON estático por un blob storage con versionado si el
  catálogo crece mucho y el repo se vuelve pesado de clonar.
