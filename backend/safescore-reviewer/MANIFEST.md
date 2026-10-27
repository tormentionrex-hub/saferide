# SAFESCORE AGENT — MANIFEST

> Fuente única de verdad de TODO lo que toca el agente.
> Si tu compañero cambia el backend y querés verificar que el agente sigue
> funcionando, corré: `node safescore-reviewer/verify.js`

Última actualización: 2026-05-27
Versión del agente: 0.1.0

---

## 📁 Archivos creados (TODOS dentro de `safescore-reviewer/`)

### Meta

```
SKILL.md                              # Documento canónico de la skill maestra
README.md                             # Guía de uso / debugging
MANIFEST.md                           # Este archivo
package.json                          # Referencial — las deps reales están en backend/package.json
.env.example                          # Plantilla de variables
install.js                            # Aplica los patches al backend (idempotente)
uninstall.js                          # Revierte todos los cambios
verify.js                             # Chequea integridad del setup
```

### Agent runtime (16 archivos en `agent/`)

```
agent/
├── index.js                          # Entry point (init() llamado desde server.js)
├── emit.js                           # Helper opt-in usado por reviewController
├── listeners.js                      # Suscripciones al EventEmitter del backend
├── cronJobs.js                       # Wrappers exportados a scheduledJobs.js
├── llm/
│   ├── router.js                     # Router multi-provider con fallback
│   ├── fallbackChain.js              # Ordena providers por saturación/salud
│   ├── quotaTracker.js               # Contador de requests/tokens por provider
│   └── providers/
│       ├── groq.js                   # Cliente Groq (Llama 4 Scout, 3.1 8B, DeepSeek)
│       ├── gemini.js                 # Cliente Gemini (2.5-flash default)
│       └── cerebras.js               # Cliente Cerebras (Llama 3.3 70B)
├── queue/
│   ├── agentQueue.js                 # API enqueue/dequeue/markDone/markFailed
│   ├── worker.js                     # Loop que procesa jobs (poll 2s default)
│   └── dispatcher.js                 # Mapea task → skill
├── models/
│   ├── AgentJob.js                   # Collection 'agent_jobs'
│   └── ReviewV2.js                   # Collection 'reviews_v2'
├── controllers/
│   └── agentAdminController.js       # Endpoints /admin/agent-jobs
├── routes/
│   └── agentAdminRoutes.js           # Routes Express del agente
└── utils/
    ├── logger.js                     # Wrapper con prefijo [SAFESCORE]
    ├── jsonParser.js                 # Parser tolerante de outputs LLM
    └── promptLoader.js               # Carga prompts .md con interpolación
```

### Skills (10 carpetas en `skills/`)

```
skills/
├── moderate-comment/                 # T1 — IMPLEMENTADA
│   ├── SKILL.md
│   ├── skill.js
│   ├── schema.js
│   └── prompt.md
├── recompute-reputation/             # T3 — IMPLEMENTADA (sin LLM)
│   ├── SKILL.md
│   ├── skill.js
│   └── schema.js
├── publish-blind-reviews/            # T4 — IMPLEMENTADA (sin LLM)
│   ├── SKILL.md
│   └── skill.js
├── detect-retaliation/               # T2 — STUB
│   ├── SKILL.md
│   └── skill.js
├── antifraud-nightly/                # T5 — STUB
│   ├── SKILL.md
│   └── skill.js
├── infer-tags/                       # T6 — STUB
│   ├── SKILL.md
│   └── skill.js
├── analyze-appeal/                   # T7 — STUB
│   ├── SKILL.md
│   └── skill.js
├── award-badges/                     # T8 — STUB
│   ├── SKILL.md
│   └── skill.js
├── digest-monthly/                   # T9 — STUB
│   ├── SKILL.md
│   └── skill.js
└── draft-complaint-reply/            # T10 — STUB
    ├── SKILL.md
    └── skill.js
```

### Docs (5 archivos)

```
docs/
├── ARCHITECTURE.md                   # Diagrama y flujos
├── PROVIDERS.md                      # Cuándo usar Groq / Gemini / Cerebras
├── PROMPTS.md                        # Guía de buenas prácticas
├── ADDING_NEW_SKILL.md               # Cómo agregar una skill nueva
└── HANDOFF.md                        # Guía para el equipo
```

---

## 🔧 Archivos del backend MODIFICADOS

Todos los cambios están marcados con `// [SAFESCORE-AGENT]` ... `// [SAFESCORE-AGENT] — fin`
para ser fácilmente identificables y reversibles con `uninstall.js`.

### `server.js` (+11 líneas, 1 bloque)

**Ubicación:** después de `initScheduledJobs()`, dentro de `startServer()`.

**Propósito:** Inicializar el agente si `SAFESCORE_ENABLED=true`. El try/catch
garantiza que si la carpeta `agents/` no existe, el backend sigue funcionando.

```js
    // [SAFESCORE-AGENT] — Inicializar agente SafeScore si SAFESCORE_ENABLED=true.
    try {
      const safescoreAgent = require('./safescore-reviewer/agent');
      safescoreAgent.init();
    } catch (err) {
      logger.warn('[SAFESCORE-AGENT] no disponible: ' + (err.message || err));
    }
    // [SAFESCORE-AGENT] — fin
```

---

### `src/jobs/scheduledJobs.js` (+22 líneas, 2 bloques)

**Bloque 1 — Top del archivo, lazy require de cronJobs del agente:**

```js
// [SAFESCORE-AGENT] — Carga lazy de cron jobs del agente.
let safescoreCron = null;
try {
  if (process.env.SAFESCORE_ENABLED === 'true') {
    safescoreCron = require('../../safescore-reviewer/agent/cronJobs');
  }
} catch (_) {}
// [SAFESCORE-AGENT] — fin
```

**Bloque 2 — Dentro de `initScheduledJobs()`, antes del log final:**

```js
  // [SAFESCORE-AGENT] — Cron jobs del agente (solo si está habilitado)
  if (safescoreCron) {
    cron.schedule('*/15 * * * *', safescoreCron.publishBlindReviewsJob, { timezone: 'America/Costa_Rica' });
    cron.schedule('0 3 * * *',    safescoreCron.antifraudNightlyJob,    { timezone: 'America/Costa_Rica' });
    cron.schedule('0 4 * * *',    safescoreCron.awardBadgesJob,         { timezone: 'America/Costa_Rica' });
    cron.schedule('0 0 1 * *',    safescoreCron.digestMonthlyJob,       { timezone: 'America/Costa_Rica' });
    logger.info('   - [SAFESCORE] publish-blind-reviews: Every 15 min');
    logger.info('   - [SAFESCORE] antifraud-nightly: Daily at 3:00 AM');
    logger.info('   - [SAFESCORE] award-badges: Daily at 4:00 AM');
    logger.info('   - [SAFESCORE] digest-monthly: First day of month');
  }
  // [SAFESCORE-AGENT] — fin
```

---

### `src/routes/index.js` (+7 líneas, 1 bloque)

**Ubicación:** después de las API Routes existentes.

**Propósito:** Montar `/api/v1/admin/agent-jobs` para visibilidad del admin.

```js
// [SAFESCORE-AGENT] — Endpoints admin del agente
try {
  const agentAdminRoutes = require('../../safescore-reviewer/agent/routes/agentAdminRoutes');
  router.use('/admin/agent-jobs', agentAdminRoutes);
} catch (_) {}
// [SAFESCORE-AGENT] — fin
```

---

### `src/controllers/reviewController.js` (+3 líneas, 1 bloque)

**Ubicación:** dentro de `createReview()`, después de actualizar `User.rating`.

**Propósito:** Emitir evento al agente. NO-OP si SAFESCORE_ENABLED=false.

```js
    // [SAFESCORE-AGENT] — Notifica al agente que se creó una review. No-op si está deshabilitado.
    try { require('../../safescore-reviewer/agent/emit').onReviewCreated(review); } catch (_) {}
    // [SAFESCORE-AGENT] — fin
```

---

### `package.json` (+4 deps)

```json
"@cerebras/cerebras_cloud_sdk": "^1.0.0",
"@google/generative-ai": "^0.21.0",
"groq-sdk": "^0.7.0",
"zod": "^3.23.0"
```

---

### `.env` (+5 entries del agente)

```bash
# [SAFESCORE-AGENT] — Flag maestro
SAFESCORE_ENABLED=true
SAFESCORE_BLIND_WINDOW_HOURS=24
SAFESCORE_WORKER_POLL_MS=2000
SAFESCORE_MAX_ATTEMPTS=3
SAFESCORE_QUOTA_GUARD_PCT=80
# [SAFESCORE-AGENT] — fin

# Y por supuesto, las 3 API keys que ya pusiste:
# GROQ_API_KEY, GEMINI_API_KEY, CEREBRAS_API_KEY
```

---

## 📦 Collections nuevas en MongoDB

| Collection | Propósito | Cuándo se llena |
|------------|-----------|-----------------|
| `agent_jobs` | Cola persistente de trabajos del agente | Cuando un listener encola un job o un cron dispara |
| `reviews_v2` | Reseñas SafeScore multidimensionales (paralelo a `reviews`) | Cuando el móvil empiece a usar `POST /reviews/v2` |

Ambas tienen índices automáticos. Ver `agent/models/AgentJob.js` y `agent/models/ReviewV2.js`.

---

## 📂 Archivos del backend del equipo que el agente LEE (sin modificar)

| Archivo | Para qué |
|---------|----------|
| `src/models/User.js` | actualizar `User.reputationSnapshot` + `User.rating` |
| `src/models/Bookings.js` | leer bookings para detección de participación |
| `src/models/Ride.js` | contexto del ride |
| `src/models/Review.js` | en stubs futuros (T2 detect-retaliation lee ambas versiones) |
| `src/events/eventEmitter.js` | bus interno donde se suscribe |
| `src/utils/logger.js` | wrapper del logger del backend |
| `src/middleware/auth.js` | verifyToken + authorize en rutas admin |

---

## ✅ Cómo verificar todo en orden

```bash
cd C:\Users\HP8CV\OneDrive\Desktop\SafeRide\saferide-backend\saferide-backend
node safescore-reviewer/verify.js
```

Si te pone todo en ✅ → listo.
Si hay ❌ → seguir las indicaciones de cada línea.

Con `--smoke` agregás un test real de los 3 providers (gasta ~150 tokens
totales — siempre dentro del free tier).

---

## 🚫 Para desactivar sin desinstalar

```bash
# En .env del backend
SAFESCORE_ENABLED=false
```

Reiniciá el backend. El agente queda en standby total. Cero overhead.

## 🗑️  Para desinstalar completamente

```bash
node safescore-reviewer/uninstall.js
# Después:
rm -r safescore-reviewer/
npm prune    # opcional, quita node_modules huérfanos
```
