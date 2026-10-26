---
name: safescore-reviewer
description: |
  Agente autónomo de moderación, recompute de reputación y anti-fraude del subsistema
  de reseñas SafeScore en SafeRide. Procesa reseñas al ser creadas, modera comentarios
  en español, detecta retaliación entre colegas, recomputa snapshots con Bayesian
  average + decay temporal, publica reseñas en doble ciego cuando expiran, evalúa
  badges/niveles, asiste apelaciones y prepara drafts de respuestas a quejas.
version: 0.1.0
runtime: node-22
auth: multi-provider-free-tier
providers:
  reasoning_primary:   groq (Llama 4 Scout, Llama 3.1 8B Instant)
  reasoning_long_ctx:  gemini (2.5-flash, 1M context)
  reasoning_fallback:  cerebras (Llama 3.3 70B)
fallback_chain:
  - groq
  - cerebras
  - gemini
budget:
  cost: $0.00/mes (free tiers verificados)
  daily_requests_estimate: ~30 (MVP) / hasta 16,600 disponibles
  margin: ~550x antes de saturar
status: MVP
mvp_skills:
  - moderate-comment      # T1 — modera comentarios con LLM
  - recompute-reputation  # T3 — Bayesian + decay, sin LLM
  - publish-blind-reviews # T4 — batch publish, sin LLM
license: internal
---

# SafeScore Reviewer Agent

## What this agent does

SafeScore es un sistema de reputación bidireccional avanzado para SafeRide (plataforma
de carpooling corporativo entre empleados de Intel, Cargill, Deloitte, etc.). Este
agente opera ese sistema automáticamente — modera reseñas, calcula reputaciones,
otorga badges, detecta abusos — sin requerir intervención humana en el 90% de los
casos.

## When the agent triggers

| Trigger | Origen | Lleva a |
|---------|--------|---------|
| `review.created` | EventEmitter del backend tras `POST /reviews/v2` | Encolar `moderate-comment` (si hay comentario) + `detect-retaliation` (si overall ≤ 2) |
| `review.published` | EventEmitter cuando ambos lados completan o expira 24h | Encolar `recompute-reputation` |
| `complaint.created` | EventEmitter cuando llega queja | Encolar `draft-complaint-reply` |
| Cron 15min | node-cron | `publish-blind-reviews` |
| Cron 3 AM | node-cron | `antifraud-nightly` |
| Cron 4 AM | node-cron | `award-badges` |
| Cron 1° del mes | node-cron | `digest-monthly` |

## Architecture

```
backend EventEmitter → listeners.js → agentQueue.enqueue → worker → dispatcher → skill
                                              ↓
                                       MongoDB (agent_jobs)
                                              ↓
                                      LLM router (Groq/Gemini/Cerebras)
                                              ↓
                                          skill output
                                              ↓
                                         MongoDB updates
```

## Skills available

### Implemented (MVP)

| ID | Skill | Provider | Latency |
|----|-------|----------|---------|
| T1 | `moderate-comment` | Groq Llama 3.1 8B | ~200ms |
| T3 | `recompute-reputation` | — (no LLM) | ~50ms |
| T4 | `publish-blind-reviews` | — (no LLM) | ~100ms batch |

### Stub (a implementar)

| ID | Skill | Provider sugerido |
|----|-------|-------------------|
| T2 | `detect-retaliation` | Groq Llama 4 Scout |
| T5 | `antifraud-nightly` | Groq Llama 4 Scout |
| T6 | `infer-tags` | Groq Llama 3.1 8B |
| T7 | `analyze-appeal` | Gemini 2.5 Flash (contexto largo) |
| T8 | `award-badges` | — (reglas, no LLM) |
| T9 | `digest-monthly` | Gemini 2.5 Flash |
| T10 | `draft-complaint-reply` | Groq Llama 4 Scout |

## Skill contract

Cada skill exporta:

```js
module.exports = {
  name: 'skill-name',
  llmRequirements: {
    preferredProvider: 'groq' | 'gemini' | 'cerebras' | 'none',
    preferredModel: 'modelo-id',
    fallback: ['cerebras', 'gemini'],
    maxTokens: 500,
    needsLongContext: false,
  },
  schema: { input, output },  // Zod schemas
  async execute({ input, llm, db, logger }) { ... }
};
```

El runtime provee el `ctx` con `llm` (router con fallback), `db` (mongoose), y `logger`.

## Activation

El agente es **opt-in vía env flag**:

```bash
SAFESCORE_ENABLED=true   # activo
SAFESCORE_ENABLED=false  # listeners no se registran, cron jobs no corren, emit() es no-op
```

Con `SAFESCORE_ENABLED=false`, el backend funciona exactamente como sin el agente.

## Safety boundaries

- **No autonomía sobre usuarios:** el agente nunca suspende cuentas, banea, ni cambia
  trustScore por sí mismo. Solo flagea, prepara drafts y deja decisiones finales al admin.
- **Modera, no censura sin trail:** toda decisión de moderación queda registrada en
  `AgentJob.result` con justificación.
- **Idempotente:** todos los jobs pueden re-ejecutarse sin efectos colaterales.
- **Rate-limited en development:** quotaTracker previene gastar todos los tokens
  free tier durante debugging.

## Observability

- Logs con prefijo `[SAFESCORE]` (filtrable por grep)
- Collection `agent_jobs` con `result`, `error`, `duration_ms`, `llm_provider_used`,
  `llm_tokens_used` por job
- Endpoint `GET /api/v1/admin/agent-jobs` para inspección desde el panel admin

## How to add a new skill

Ver [docs/ADDING_NEW_SKILL.md](docs/ADDING_NEW_SKILL.md).

## Cost monitoring

Endpoint `GET /api/v1/admin/agent-jobs/stats` muestra:
- Requests por provider hoy
- Tokens consumidos hoy
- % de cuota usada

Si alguna cuota llega a 80%, el router rebalancea automáticamente al fallback.

## Reference

- Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para diagrama completo
- Ver [docs/PROVIDERS.md](docs/PROVIDERS.md) para criterios de elección de LLM
- Ver [docs/HANDOFF.md](docs/HANDOFF.md) para mostrar al equipo qué cambió
- Ver [MANIFEST.md](MANIFEST.md) para lista completa de archivos tocados
