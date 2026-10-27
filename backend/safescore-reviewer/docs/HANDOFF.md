# Handoff al equipo — SafeScore Agent

> Documento para mostrar al equipo qué se agregó al backend cuando entregues
> el zip con el agente integrado.

## TL;DR para el equipo

Se agregó un **agente operacional** dentro del backend, en la carpeta
`safescore-reviewer/`. El agente:

- **Modera comentarios** de reseñas usando LLMs gratuitos
- **Recalcula reputaciones** con Bayesian average + decay temporal
- **Publica reseñas en doble ciego** cuando expiran las 24h
- Tiene **otras 7 skills** stubeadas (anti-fraude, badges, apelaciones, etc.)
- Es **100% opt-in**: si querés desactivarlo, `SAFESCORE_ENABLED=false`
- Costo operativo: **$0.00/mes** (free tiers Groq + Gemini + Cerebras, sin tarjeta)

## Lo que toca el backend del equipo

Solo **15 líneas en 6 archivos** (todas marcadas con `// [SAFESCORE-AGENT]`):

1. `server.js` — `+11 líneas` (init del agente al arrancar)
2. `src/jobs/scheduledJobs.js` — `+22 líneas` (4 cron jobs)
3. `src/routes/index.js` — `+7 líneas` (montar admin route)
4. `src/controllers/reviewController.js` — `+3 líneas` (emit event tras crear review)
5. `package.json` — `+4 deps` (groq-sdk, @google/generative-ai, @cerebras/cerebras_cloud_sdk, zod)
6. `.env` — `+5 entries` (SAFESCORE_ENABLED y 4 más)

Buscalas con:

```bash
grep -rn "SAFESCORE-AGENT" src/ server.js
```

## Cómo verificar que todo está en orden

```bash
cd saferide-backend/
node safescore-reviewer/verify.js
```

Te dice si todos los archivos del agente están + si los marcadores en el
backend siguen presentes + si las deps están instaladas.

Con `--smoke` hace UN ping real a cada provider LLM (~150 tokens totales).

## Cómo desactivar el agente sin desinstalar

```bash
# .env
SAFESCORE_ENABLED=false
```

Reiniciá el backend. El agente queda en standby completo: no consume
recursos, no escucha eventos, no programa crons.

## Cómo desinstalarlo completamente

```bash
node safescore-reviewer/uninstall.js
# Confirmá con "yes"
rm -r safescore-reviewer/    # opcional, para borrar la carpeta
npm prune                            # opcional, para limpiar node_modules
```

## Nuevas collections en MongoDB

| Collection | Para qué | Tamaño esperado |
|------------|----------|-----------------|
| `agent_jobs` | Cola persistente de trabajos del agente | KB-MB (TTL de 30 días en jobs done) |
| `reviews_v2` | Reseñas SafeScore (multidimensional + tags) | MB (crece con el uso) |

Ambas se crean automáticamente al primer uso. NO se tocan las collections
existentes (`reviews`, `users`, `bookings`, etc.) — el agente solo lee.

## Nuevos endpoints

| Endpoint | Auth | Propósito |
|----------|------|-----------|
| `GET /api/v1/admin/agent-jobs` | admin | Listar jobs del agente con filtros |
| `GET /api/v1/admin/agent-jobs/stats` | admin | Stats de uso + cuotas por provider |
| `GET /api/v1/admin/agent-jobs/:id` | admin | Detalle de un job |
| `POST /api/v1/admin/agent-jobs/:id/retry` | admin | Reencolar un job failed |
| `POST /api/v1/admin/agent-jobs/enqueue` | admin | Encolar manual (testing) |
| `DELETE /api/v1/admin/agent-jobs/:id` | admin | Cancelar un pending |

## Variables de entorno nuevas

```bash
SAFESCORE_ENABLED=true                 # flag maestro
GROQ_API_KEY=gsk_...                   # API key gratis de Groq
GEMINI_API_KEY=AIzaSy...               # API key gratis de Google AI Studio
CEREBRAS_API_KEY=csk-...               # API key gratis de Cerebras
SAFESCORE_BLIND_WINDOW_HOURS=24
SAFESCORE_WORKER_POLL_MS=2000
SAFESCORE_MAX_ATTEMPTS=3
SAFESCORE_QUOTA_GUARD_PCT=80
```

Las 3 API keys son free tier sin tarjeta de crédito requerida. Crearlas en:
- https://console.groq.com/keys
- https://aistudio.google.com/apikey
- https://cloud.cerebras.ai

## Cómo aplicar el agente a una versión nueva del backend

Si tu compañero te pasa un `saferide-backend-v2.zip` nuevo:

```bash
# 1. Descomprimir el nuevo
unzip saferide-backend-v2.zip

# 2. Copiar la carpeta del agente
cp -r saferide-backend/agents saferide-backend-v2/agents

# 3. Correr el installer (aplica los patches al backend nuevo)
cd saferide-backend-v2
node safescore-reviewer/install.js

# 4. Instalar deps
npm install

# 5. Copiar el .env (las API keys)
cp ../saferide-backend/.env .

# 6. Verificar
node safescore-reviewer/verify.js
```

NOTA: `install.js` aplica algunos patches automáticamente. Para los más
complejos puede ser necesario aplicar manualmente — el script avisa.

## FAQ del equipo

**¿El agente puede romper el backend?**
No. Todos los puntos de integración usan `try/catch`. Si la carpeta `agents/`
no existe, o las API keys faltan, o el módulo falla cargando, el backend
sigue funcionando normal.

**¿Consume recursos cuando no hay tráfico?**
Mínimo: un `setInterval(2000)` en el worker que hace 1 query `findOneAndUpdate`
sobre `agent_jobs`. Si no hay jobs pendientes, retorna en <5ms.

**¿Qué pasa si Groq cae?**
El router automáticamente cambia a Cerebras, y si ese también cae, a Gemini.
Solo si los 3 caen simultáneamente las skills LLM fallan (y los jobs se
marcan como `failed` con retry).

**¿Cómo monitoreo el agente?**
1. Endpoint `/api/v1/admin/agent-jobs/stats`
2. Logs en consola con prefijo `[SAFESCORE]`
3. MongoDB Compass → collection `agent_jobs`

**¿El agente envía datos a APIs externas?**
Solo a Groq/Gemini/Cerebras y solo el comentario de moderación + payload
mínimo. No envía datos personales. Si querés cero red, podés bajar Llama
Guard 3 vía Ollama y configurar el router para que solo use providers
locales (cambio en `agent/llm/fallbackChain.js`).

**¿Es escalable?**
Para SafeRide MVP (≤500 reviews/día) sobra y sobra. Si llegan a 5K reviews/día,
Groq Llama 4 Scout se acerca al límite — ahí el router rebalancea
automáticamente a Cerebras. A 50K reviews/día requeriría migrar a API
paga o agregar más providers free.

**¿Cómo lo apago en producción si rompe algo?**
`SAFESCORE_ENABLED=false` en `.env` + reiniciar backend. Listo en 5 segundos.
