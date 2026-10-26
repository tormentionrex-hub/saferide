# Arquitectura del SafeScore Agent

## Vista de alto nivel

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Backend SafeRide (Express + Mongoose)                │
│                                                                       │
│  POST /api/v1/reviews                                                 │
│       └→ reviewController.createReview()                             │
│            └→ emit.onReviewCreated(review)   ← punto de integración  │
│                  └→ eventEmitter.emit('safescore.review.created')   │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│              agent/listeners.js — suscriptor                         │
│                                                                      │
│   eventEmitter.on('safescore.review.created', ...) {                │
│     agentQueue.enqueue('moderate-comment', {reviewId})              │
│   }                                                                  │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│              MongoDB collection 'agent_jobs'                         │
│              { task, payload, status, priority, ... }               │
└──────────────────────┬───────────────────────────────────────────────┘
                       │ poll cada 2s
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│              agent/queue/worker.js                                   │
│              findOneAndUpdate({status:pending}) → status:running    │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│              agent/queue/dispatcher.js                               │
│              require(`skills/${task}/skill.js`) → execute(ctx)      │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
┌──────────────────────┐  ┌──────────────────────┐
│  Skill SIN LLM       │  │  Skill CON LLM       │
│  (T3, T4, T8)        │  │  (T1, T2, T5, ...)   │
│                      │  │                      │
│  • Math / Mongo only │  │  • router.complete() │
│  • <100ms            │  │     ├── Groq         │
│                      │  │     ├── Cerebras     │
│                      │  │     └── Gemini       │
└──────────────────────┘  └──────────────────────┘
            │                     │
            └──────────┬──────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│              agentQueue.markDone() → status:done + metrics          │
│              o markFailed() → reintenta con backoff                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Triggers

### Por evento (síncronos al request HTTP)

| Evento | Emitido por | Listener encola |
|--------|-------------|-----------------|
| `safescore.review.created` | `reviewController.createReview` vía `emit.onReviewCreated` | `moderate-comment` (si hay comment), `detect-retaliation` (si overall ≤ 2) |
| `safescore.review.published` | `publish-blind-reviews` job O `createReviewV2` cuando ambos lados terminan | `recompute-reputation` |
| `safescore.complaint.created` | (futuro) `complaintController` | `draft-complaint-reply` |
| `safescore.review.appealed` | (futuro) `reviewV2Controller.appeal` | `analyze-appeal` |

### Por cron (programados)

| Cron | Skill |
|------|-------|
| `*/15 * * * *` | `publish-blind-reviews` |
| `0 3 * * *` | `antifraud-nightly` |
| `0 4 * * *` | `award-badges` |
| `0 0 1 * *` | `digest-monthly` |

## Modelo de cola

`agent_jobs` collection:

```js
{
  task: 'moderate-comment',
  payload: { reviewId: '...' },
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled',
  priority: 0-10,
  scheduled_for: Date,
  attempts: 0,
  max_attempts: 3,
  worker_id: 'hostname-pidN',
  locked_at: Date,
  result: {...},
  error: { message, stack, code },
  llm_provider_used: 'groq',
  llm_tokens_used: 187,
  duration_ms: 245,
  // + timestamps
}
```

Indexed by `{status, scheduled_for, priority}` para que el `findOneAndUpdate`
del worker sea O(log n).

## Atomicidad y concurrencia

- `dequeue()` usa `findOneAndUpdate` que es atómico en MongoDB.
- Aunque corramos 5 instancias del worker, cada job lo procesa solo 1.
- Si un worker muere a mitad de un job (status: running, locked_at viejo),
  cada 60s el método `releaseStuck` los devuelve a `pending`.
- `markFailed` con `retryable=true` reencola con backoff exponencial
  (10s → 60s → 5min).

## Fallback chain de LLM

Cuando una skill pide LLM:

1. El router lee `skill.llmRequirements.preferredProvider`
2. Arma una chain: [preferred, ...fallback, ...remaining]
3. Filtra: providers saturados (≥80% cuota) o unhealthy (3+ errors recientes)
   van al final.
4. Intenta uno por uno hasta que uno responda.
5. Si TODOS fallan, lanza error → `markFailed` con retry.

## Seguridad

- Endpoints admin del agente requieren `verifyToken` + `authorize('admin')`.
- API keys NUNCA en logs (logger sanitiza errores axios).
- Tokens consumidos se trackean para no agotar free tier.
- Skills LLM siempre pasan por moderation_queue si el JSON es inválido o
  toxicity es ambigua — el humano final decide.

## Opt-in / Standby

- `SAFESCORE_ENABLED=true`  → todo arriba
- `SAFESCORE_ENABLED=false` → init() es no-op, listeners no se suscriben,
                              cron jobs no se programan, emit() es no-op.
                              Backend funciona como sin el agente.
