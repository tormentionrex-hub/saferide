---
id: T4
name: publish-blind-reviews
description: |
  Publica reseñas que estaban en `pending_blind` y cuya ventana de doble
  ciego (24h por defecto) ya expiró. Por cada reseña publicada, dispara
  el recompute de reputación del reviewee.
trigger: cron cada 15 min
provider: none
needs_llm: false
input: {} (no necesita input)
output: { published: number, recomputeEnqueued: number }
idempotent: true
estimated_duration_ms: 50-500 (depende de cuántas haya)
---

# T4 — publish-blind-reviews

## ¿Qué hace?

Cada 15 minutos (configurable):

1. Busca todas las `ReviewV2` con:
   - `status = 'pending_blind'`
   - `visibility_at <= now()`

2. Las actualiza atómicamente a `status = 'published'`

3. Por cada review publicada, encola un job `recompute-reputation` con el
   reviewee como user a recalcular

4. Devuelve métricas

## ¿Por qué doble ciego?

Patrón Airbnb. Evita la **retaliación reactiva**: "si vos me das 1★, yo te
doy 1★". Ninguna reseña se publica hasta que:
- Ambos lados (driver y passenger) la enviaron, OR
- Pasaron 24 horas desde la primera

## Trigger

Cron registrado en `scheduledJobs.js` del backend cada 15 min con timezone
`America/Costa_Rica`.

## Idempotencia

Sí. Si corre 2 veces en 1 segundo, la segunda ejecución encuentra
status='published' (no pending_blind) → no hace nada.

## Performance

Usa `updateMany` con índice `{ status: 1, visibility_at: 1 }`. Hasta miles
de reviews/batch deberían ejecutar en <500ms.

## No usa LLM

Solo Mongo + queue.enqueue.
