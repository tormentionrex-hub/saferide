# SafeScore Reviewer Agent — README

Agente operacional para el subsistema de reseñas y reputación de SafeRide.

## TL;DR

```bash
# 1. Variables en el .env del backend (ver .env.example del agente)
SAFESCORE_ENABLED=true
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIzaSy...
CEREBRAS_API_KEY=csk-...

# 2. Instalar deps del backend (se hace una sola vez)
cd saferide-backend/
npm install

# 3. Verificar integridad del agente
node safescore-reviewer/verify.js

# 4. Iniciar el backend (incluye el agente)
npm run dev
```

Cuando el backend arranca con `SAFESCORE_ENABLED=true`, verás en consola:

```
[SAFESCORE] 🚀 Agent v0.1.0 initialized
[SAFESCORE] 📡 Listeners suscritos: review.created, review.published, complaint.created
[SAFESCORE] ⏰ Cron jobs registrados: publish-blind (15min), antifraud (3AM), badges (4AM), digest (mensual)
[SAFESCORE] 👷 Worker started (polling every 2000ms)
[SAFESCORE] 🧠 LLM providers ready: groq ✓ cerebras ✓ gemini ✓
```

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `SKILL.md` | Documento canónico de la skill maestra |
| `MANIFEST.md` | **Lista TODOS los archivos creados/modificados** |
| `agent/` | Runtime del agente (router LLM, cola, worker) |
| `skills/` | Una carpeta por skill (T1-T10) |
| `tests/` | Tests con fixtures en español |
| `docs/` | Documentación técnica detallada |
| `install.js` | Aplica cambios al backend (para nuevas versiones) |
| `uninstall.js` | Revierte todos los cambios al backend |
| `verify.js` | Chequea que todo esté en orden |

## Modos de operación

### Modo activo

```bash
SAFESCORE_ENABLED=true
```

El agente:
- Procesa cada reseña creada (modera, detecta retaliación)
- Recomputa snapshots cuando se publican
- Publica reseñas expiradas del doble ciego cada 15min
- Otorga badges y niveles diariamente
- Genera digest mensual el día 1

### Modo standby

```bash
SAFESCORE_ENABLED=false
```

El backend funciona **exactamente como sin el agente**:
- Listeners no se registran (no escuchan eventos)
- Cron jobs del agente no se programan
- `emit()` desde controllers del backend es no-op (no falla, no hace nada)
- La carpeta `agents/` queda inerte
- Solo se carga el módulo al hacer `require()` específicos

### Modo desinstalado

```bash
node safescore-reviewer/uninstall.js
# Después: borrar la carpeta agents/ manualmente
```

Revierte los 15 cambios en 6 archivos del backend (identificados por marcadores
`[SAFESCORE-AGENT]`).

## Monitoreo

### Desde el panel admin

`GET /api/v1/admin/agent-jobs?status=pending|running|done|failed`

Devuelve los jobs con paginación. El admin React tendrá una página `/admin/agent-jobs`
para mostrarlos.

### Desde MongoDB Compass

Conectarse a `mongodb://127.0.0.1:27017/SafeRide_Local_Dev` y abrir la colección
`agent_jobs`. Cada documento tiene:

- `task` — qué skill ejecuta
- `status` — pending / running / done / failed
- `payload` — input
- `result` — output del job
- `error` — si falló, qué pasó
- `llm_provider_used` — qué proveedor usó
- `llm_tokens_used` — tokens consumidos
- `duration_ms` — cuánto tardó

### Estadísticas de cuota

`GET /api/v1/admin/agent-jobs/stats`

Devuelve:

```json
{
  "today": {
    "groq": { "requests": 12, "tokens": 1847, "quota_pct": 0.83 },
    "gemini": { "requests": 0, "tokens": 0, "quota_pct": 0 },
    "cerebras": { "requests": 1, "tokens": 64, "quota_pct": 0.06 }
  },
  "jobs": { "pending": 0, "running": 0, "done": 142, "failed": 1 }
}
```

## Cuidando los free tiers durante desarrollo

El agente trae salvaguardas para no gastar todos los tokens gratis al debuggear:

1. **Quota tracker** — registra requests por provider, si llegás al 80% del límite
   diario el router rebalancea al fallback.
2. **Mocking en tests** — los tests usan fixtures + mocks, NUNCA llaman LLMs reales.
3. **Smoke test único** — el script `verify.js --smoke` hace UNA sola llamada real
   (~50 tokens) para confirmar conectividad.

## Solución de problemas

| Problema | Solución |
|----------|----------|
| `Agent not initialized` | Verificar `SAFESCORE_ENABLED=true` en `.env` |
| `LLM provider X error` | Verificar API key en `.env`. Probar con `node verify.js --smoke` |
| `Jobs pending no se procesan` | Verificar logs `[SAFESCORE] 👷 Worker started`. Si no aparece, revisar `agent/queue/worker.js` |
| `429 Quota exceeded` | El quotaTracker debería evitarlo, pero si pasa esperar al reset del provider o cambiar fallback chain en `agent/llm/fallbackChain.js` |
| `Tests fallan después de cambio del equipo` | Correr `node verify.js` — te dice si marcadores `[SAFESCORE-AGENT]` siguen presentes |

## Para extender el agente

Ver `docs/ADDING_NEW_SKILL.md`. En resumen:

1. Crear carpeta `skills/mi-skill/`
2. Agregar `SKILL.md`, `skill.js`, `prompt.md` (si usa LLM), `schema.js`
3. Registrarla en `agent/queue/dispatcher.js`
4. (Si tiene trigger) registrarla en `agent/listeners.js` o `agent/cronJobs.js`
5. Agregar test en `tests/skills/mi-skill.test.js`

## Contacto / handoff

Ver `docs/HANDOFF.md` para preparar el handoff al equipo.
