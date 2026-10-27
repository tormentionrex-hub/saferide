# Prompt para Cowork — Documentación del Agente SafeScore

> Copiá TODO lo que sigue (desde la línea `=== PROMPT ===` hasta el final)
> y pegalo en Cowork. Generará la documentación completa en 3 secciones.

---

=== PROMPT ===

Necesito que generes documentación profesional, completa y bien estructurada del **agente SafeScore Reviewer** que construí dentro de mi proyecto SafeRide (plataforma de carpooling corporativo para empleados de empresas como Intel, Cargill, Deloitte, Nestlé, etc., en Costa Rica).

La documentación tiene que estar dividida en **tres apartados claramente separados**, cada uno con su propio tono y profundidad. Sigue exactamente la estructura que te pido abajo. No mezcles el contenido entre secciones — cada una está pensada para una audiencia distinta.

---

## CONTEXTO DEL PROYECTO

**SafeRide** es una app móvil de carpooling corporativo (estilo Uber/DiDi) entre empleados de empresas ancla en Costa Rica. Tiene tres tiers:

- App móvil React Native / Expo (pasajeros y conductores)
- Panel web admin (React + Vite)
- Backend Node.js + Express + MongoDB (Mongoose)

El backend del equipo NO usa Git por política de la empresa (se comparte por .zip). El móvil sí tiene repo.

**Problema que motivó el agente:** El sistema de reseñas existente era muy básico (rating 1-5 + comentario libre). Los problemas críticos detectados eran:

1. Comentarios tóxicos / insultos no se moderaban → riesgo de denuncias y conflicto entre empleados
2. La fórmula de rating estaba mal hecha (`(sum + 5) / (n + 1)`) inflando ratings
3. No había sistema de detección de venganza entre usuarios
4. No había badges, niveles ni gamificación
5. No había moderación automática

**Solución:** un agente operacional autónomo que vive dentro del backend y procesa todo lo relacionado con reseñas y reputación de forma automática, con costo cero, usando free tiers de LLMs gratuitos.

---

## HECHOS TÉCNICOS QUE DEBES INCLUIR

### Stack del agente

- **Lenguaje:** Node.js 22 (vive en el mismo proceso del backend)
- **Base de datos:** MongoDB local (reuso de la conexión Mongoose del backend, sin nueva infra)
- **Cola de trabajos:** custom sobre MongoDB con `findOneAndUpdate` atómico (no Redis, no Bull, no Docker)
- **Scheduler:** node-cron (ya estaba en el backend)
- **Bus de eventos:** EventEmitter de Node (ya estaba en el backend en `src/events/eventEmitter.js`)

### LLMs usados (todos free tier, sin tarjeta de crédito)

- **Groq Cloud** — Llama 3.1 8B Instant (rápido, 840 tok/s, 14,400 RPD), Llama 4 Scout (razonamiento medio, 1,000 RPD)
- **Google Gemini 2.5 Flash** — para tareas con contexto largo (1M ctx, 500 RPD)
- **Cerebras Llama 3.3 70B** — fallback de alta capacidad (1M tokens/día)

Los 3 son APIs externas reales, gratuitas, verificadas sin tarjeta. Las API keys se obtienen en:
- https://console.groq.com/keys
- https://aistudio.google.com/apikey
- https://cloud.cerebras.ai

### Arquitectura del agente

Carpeta dentro del backend: `safescore-reviewer/`

```
safescore-reviewer/
├── SKILL.md, README.md, MANIFEST.md
├── package.json, .env.example
├── install.js, uninstall.js, verify.js, demo-trigger.js
│
├── agent/                          ← runtime
│   ├── index.js                    (entry point)
│   ├── emit.js                     (helper opt-in para el backend)
│   ├── listeners.js                (suscripciones al EventEmitter)
│   ├── cronJobs.js                 (jobs programados)
│   ├── llm/
│   │   ├── router.js               (decide qué provider usar)
│   │   ├── fallbackChain.js        (ordena providers por salud)
│   │   ├── quotaTracker.js         (cuenta requests/tokens por día)
│   │   └── providers/
│   │       ├── groq.js
│   │       ├── gemini.js
│   │       └── cerebras.js
│   ├── queue/
│   │   ├── agentQueue.js           (cola persistente sobre Mongo)
│   │   ├── worker.js               (loop que procesa jobs)
│   │   └── dispatcher.js           (mapea task → skill)
│   ├── models/
│   │   ├── AgentJob.js             (collection 'agent_jobs')
│   │   └── ReviewV2.js             (collection 'reviews_v2')
│   ├── controllers/agentAdminController.js
│   ├── routes/agentAdminRoutes.js
│   └── utils/
│       ├── logger.js               (prefijo [SAFESCORE])
│       ├── jsonParser.js           (parser tolerante de outputs LLM)
│       └── promptLoader.js
│
└── skills/                          ← 10 skills (T1-T10)
    ├── moderate-comment/            (T1, implementada con LLM)
    ├── recompute-reputation/        (T3, implementada sin LLM)
    ├── publish-blind-reviews/       (T4, implementada sin LLM)
    ├── detect-retaliation/          (T2, stub)
    ├── antifraud-nightly/           (T5, stub)
    ├── infer-tags/                  (T6, stub)
    ├── analyze-appeal/              (T7, stub)
    ├── award-badges/                (T8, stub)
    ├── digest-monthly/              (T9, stub)
    └── draft-complaint-reply/       (T10, stub)
```

### Las 10 skills del agente

| ID | Skill | Trigger | Provider | Estado |
|----|-------|---------|----------|--------|
| T1 | **moderate-comment** | Cada nueva review con comentario | Groq Llama 3.1 8B | ✅ Implementada |
| T2 | detect-retaliation | Review ≤ 2★ | Groq Llama 4 Scout | Stub |
| T3 | **recompute-reputation** | Review publicada en reviews_v2 | Sin LLM (Bayesian + decay) | ✅ Implementada (en standby hasta que el móvil use /reviews/v2) |
| T4 | **publish-blind-reviews** | Cron cada 15 min | Sin LLM | ✅ Implementada |
| T5 | antifraud-nightly | Cron 3 AM | Gemini 2.5 Flash | Stub |
| T6 | infer-tags | Review con comment sin tags | Groq Llama 3.1 8B | Stub |
| T7 | analyze-appeal | Apelación recibida | Gemini 2.5 Flash | Stub |
| T8 | award-badges | Cron 4 AM | Sin LLM (reglas) | Stub |
| T9 | digest-monthly | Cron 1° de cada mes | Gemini 2.5 Flash | Stub |
| T10 | draft-complaint-reply | Queja recibida | Groq Llama 4 Scout | Stub |

### Integración con backend del equipo

Solo 15 líneas modificadas en 6 archivos del backend del equipo, todas marcadas con comentarios `[SAFESCORE-AGENT]` para que sean fáciles de identificar y revertir:

- `server.js` — inicializa el agente al arrancar
- `src/jobs/scheduledJobs.js` — registra los 4 cron jobs del agente
- `src/routes/index.js` — monta endpoints `/api/v1/admin/agent-jobs`
- `src/controllers/reviewController.js` — dispara evento cuando se crea una review
- `package.json` — suma 4 deps: `groq-sdk`, `@google/generative-ai`, `@cerebras/cerebras_cloud_sdk`, `zod`
- `.env` — variables `SAFESCORE_ENABLED=true` + las 3 API keys

### Comportamiento por tipo de comentario (skill moderate-comment)

| Categoría | Toxicity score | Acción en review V2 | Acción en review legacy | Ejemplo |
|-----------|---------------|---------------------|--------------------------|---------|
| **safe** | < 0.30 | sin cambio (sigue `pending_blind`) | agrega `ai_moderation` (informativo) | "Excelente conductor, muy puntual" |
| **borderline** | 0.30–0.70 | pasa a `moderation_queue` | agrega `ai_moderation` (informativo) | "Pasajero dudoso, no me convenció" |
| **toxic** | > 0.70 | pasa a `suppressed` (no se publica) | agrega `ai_moderation` (informativo) | "Este idiota es un imbécil, ojalá lo despidan" |

### Acciones de enforcement — qué hace el agente además de moderar

Cuando la skill detecta `toxic` o `borderline`, no se limita a clasificar: ejecuta acciones visibles para que el dashboard admin las consuma. Implementado en `agent/services/enforcement.js`.

**Acciones inmediatas (por cada reseña tóxica individual):**

1. **Reducir el peso de la reseña tóxica.** El campo `weight` baja a `0.1` (de `1.0`). Cuando se recalcula la reputación del conductor, esa reseña pesa 10 veces menos. Protege al conductor de reseñas vengativas individuales sin borrar la reseña (queda visible para auditoría).

2. **Strike al reviewer.** Incrementa `User.moderation_strikes` en el reviewer. Solo para auditoría — no genera flag automático con este contador (eso se decide con la regla de patrón abajo).

3. **Crear `ModerationAlert`** en la nueva collection `moderation_alerts` con:
   - El comentario completo
   - La decisión del LLM (categoría, score, razón)
   - **Una recomendación específica generada por el agente** con prioridad (low/medium/high/critical), acción sugerida y pasos concretos para el admin
   - Estado de atención (`pending` por default)

4. **Notificar a todos los admins** insertando documentos `type: 'system'` en la collection `notifications` existente del backend del equipo, con `relatedEntity` apuntando a la `ModerationAlert`. Los admins verán el aviso en su sección `/notificaciones` del dashboard.

**Regla de advertencia formal por patrón sistemático (la única acción automática "fuerte"):**

Si el reviewer cumple TODAS estas condiciones:
- Sus **últimas 10 reseñas** están moderadas
- **Las 10 son `toxic`**
- **Las 10 tienen `toxicity_score ≥ 0.80`** (palabras muy fuertes, no críticas con malas palabras)

Entonces el agente:
- Crea una `ModerationAlert` tipo `user_flagged` con severity `critical`
- Marca al usuario con `last_warning_at`, `warnings_count` incrementado, `warning_reason: 'systematic_toxic_pattern_10'`
- Notifica a TODOS los admins con un mensaje específico ("ADVERTENCIA FORMAL emitida al usuario X")
- La recomendación escala según `warnings_count`:
  - 1ra advertencia → "Emitir advertencia formal por escrito"
  - 2da advertencia (reincidencia) → "Considerar suspensión del usuario"

**Cooldown:** después de emitir una advertencia, el agente NO emite otra al mismo usuario durante 24 horas (anti-spam para no inundar al admin).

**Importante sobre el diseño:**
- El agente NUNCA suspende usuarios ni borra reseñas por sí mismo
- Todas las acciones son reversibles
- El humano (admin) siempre tiene la última palabra
- NO existe sistema de badges/premios — la mayoría de viajes son gratuitos en SafeRide, no hay incentivo de gamificación

### Soporte dual de reviews (Camino A implementado)

La skill `moderate-comment` busca primero en `reviews_v2` (modelo nuevo SafeScore con doble ciego), y si no encuentra, busca en `reviews` legacy del backend del equipo. Cuando es legacy:

- NO modifica el schema del equipo
- AGREGA un campo nuevo `ai_moderation` con `$set` directo en la collection
- También agrega `ai_moderated_at` como timestamp
- El rating, comment y demás campos del equipo quedan intactos

### Collections en MongoDB

- `agent_jobs` — cola persistente del agente (campos: task, payload, status, priority, scheduled_for, attempts, worker_id, locked_at, started_at, finished_at, duration_ms, result, llm_provider_used, llm_model_used, llm_tokens_used, tags, error)
- `reviews_v2` — reviews SafeScore multidimensionales (campos: ride_id, reviewer_id, reviewee_id, reviewer_role, overall, ratings, positive_tags, negative_tags, comment, status, visibility_at, weight, moderation, appealed)
- `moderation_alerts` — **collection nueva** donde el agente publica alertas con recomendaciones para el dashboard admin (campos: type, severity, source_collection, source_id, reviewer_id, reviewee_id, comment_excerpt, rating, decision, recommendation, reviewer_strikes, reviewer_flagged, status, admin_notes, resolved_by, resolved_at, resolution)
- Campos AGREGADOS a la collection `reviews` legacy (sin tocar schema del equipo): `ai_moderation`, `ai_moderated_at`
- Campos AGREGADOS a la collection `users` (sin tocar schema del equipo): `moderation_strikes`, `last_moderation_at`, `last_warning_at`, `warnings_count`, `warning_reason`

### Cómo se ejecuta el flow end-to-end

1. Pasajero deja review desde móvil → `POST /api/v1/reviews`
2. Backend crea documento en `reviews` legacy
3. Backend dispara evento `safescore.review.created`
4. Listener del agente encola job `moderate-comment` (priority 5) + opcionalmente `detect-retaliation` (priority 7 si rating ≤ 2)
5. Worker del agente (polling cada 2s) toma el job más prioritario
6. Dispatcher carga la skill y la ejecuta con el contexto (LLM router, mongoose, logger)
7. Skill `moderate-comment`:
   - Busca review en `reviews_v2` (no encuentra) → busca en `reviews` legacy → encuentra
   - Llama a Groq con prompt en español + few-shot examples
   - Parsea decisión `{ decision, toxicity_score, reason }`
   - Hace `updateOne` en collection `reviews` con `$set: { ai_moderation, ai_moderated_at }`
   - Marca el `agent_job` como `done` con metadata (tokens, provider, duration)

### Garantías del diseño

- **Costo total mensual: $0.00** — todos los LLMs son free tier sin tarjeta
- **Sin Docker, Redis, Ollama** — todo vive en el proceso Node + MongoDB que ya existían
- **Opt-in:** flag `SAFESCORE_ENABLED=false` en `.env` desactiva completamente el agente
- **Reversibilidad:** `node safescore-reviewer/uninstall.js` revierte todos los cambios al backend
- **Cero impacto en latencia del usuario:** el procesamiento es asíncrono
- **Resiliente:** jobs huérfanos (worker muerto) se detectan en 5 min y se reencolan
- **Idempotente:** un mismo job ejecutado 2 veces produce el mismo resultado, no duplica trabajo
- **Auditable:** cada acción queda en `agent_jobs` con worker_id, tokens, duration, result

### Visualización de reviews para usuarios finales en la app móvil

El agente no solo trabaja en background — también expone sus decisiones a los usuarios finales (pasajeros y conductores) en la app móvil React Native.

**Endpoint nuevo del agente:** `GET /api/v1/safescore/reviews/user/:userId`

- Lee reviews via collection nativa (garantiza incluir el campo `ai_moderation` que el modelo Mongoose del backend del equipo ignora por strict mode)
- Devuelve hasta `limit` reviews ordenadas por fecha descendente (más nuevas primero)
- Detecta vía JWT si el caller es el dueño del perfil. La privacidad se aplica de forma matizada:
  - **El `comment` (texto escrito por el reviewer) SIEMPRE se incluye.** Ocultarlo sería redundante: si el sistema ya clasificó la reseña como "Tóxica" o "Satisfecho", el comentario es la evidencia que sustenta esa clasificación. La transparencia ayuda a tomar decisiones informadas.
  - **El `reason` (razón interna del LLM, ej. "Insulto directo y crítica personal al manejo") SOLO se incluye cuando el caller es el dueño del perfil.** Es información de debug del agente — útil para el dueño que recibió la reseña (para entender por qué se clasificó así y poder apelar si cree que es injusto) pero no aporta a quien está evaluando con quién viajar.
- Traduce categorías internas a español humano:
  - `safe` → "Satisfecho" (verde, #16a34a)
  - `borderline` → "Regular" (amarillo, #eab308)
  - `toxic` → "Tóxica" (rojo, #dc2626)
  - Sin moderar → "Pendiente" (gris, #94a3b8)
- Devuelve stats agregadas (total, satisfecho, regular, tóxica, pendiente, avg_rating) sobre TODAS las reviews, no solo la página visible

**Componente reutilizable:** `saferide-frontend/src/components/ReviewsList.js`

Props: `userId`, `isOwn`, `compact`, `maxItems`. El componente:
- Carga reviews del endpoint
- Muestra header con stats (`8 Satisfechas · 1 Regular · 1 Tóxica`) calculadas sobre todas las reviews del usuario
- Lista cada review con estrellas, badge de clasificación coloreado, fecha, y el comentario real entre comillas
- Si la reseña no tenía comentario originalmente, muestra una nota sutil "Sin comentario." en gris
- Solo en perfil propio (`isOwn=true`): caja gris con la "Decisión del agente" mostrando el `reason` del LLM
- **Default `maxItems=5`**: solo las 5 reseñas más recientes son visibles. Las más viejas quedan fuera del corte automáticamente. Cuando llega una nueva reseña, el componente recarga y la más antigua del top 5 desaparece de la vista. Esto mantiene la información relevante sin saturar la UI ni penalizar al usuario por reseñas de hace mucho tiempo.

**Service:** `saferide-frontend/src/services/safescoreService.js` exporta `getUserReviews(userId, { limit, page })` que llama al endpoint.

### Justificación UX de la ubicación de las reviews

Este es un punto de diseño importante. El componente `ReviewsList` se monta SOLO en 4 lugares específicos, no en feeds ni listados generales. La razón:

> "Las reviews tienen impacto máximo cuando se muestran en el momento de la decisión — para que los usuarios tomen una decisión consciente de con quién van a viajar, ya sea solicitar unirse o aceptarlo a bordo."

**Las 4 ubicaciones implementadas:**

| Pantalla | Qué muestra | Detalles visibles | Razón |
|----------|-------------|-------------------|-------|
| `ListOfRequests.js` (conductor) | Reseñas del PASAJERO solicitante | Estrellas, fecha, comentario real, categoría (Tóxica/Regular/Satisfecho) | Justo antes de aceptar/rechazar al pasajero. Decisión "¿lo dejo subir?" |
| `RideDetail.js` (pasajero) | Reseñas del CONDUCTOR | Estrellas, fecha, comentario real, categoría | Justo antes del botón "Solicitar unirse". Decisión "¿confío en este conductor?" |
| `PasajeroProfileScreen.js` (pasajero) | Reseñas PROPIAS recibidas | Todo lo anterior + razón del agente IA (debug interno) en caja gris | El usuario ve cómo lo perciben y puede entender la razón técnica de cada clasificación |
| `ProfileConductor.js` (conductor) | Reseñas PROPIAS recibidas | Igual que el caso anterior | Mismo motivo |

**Política de privacidad aplicada:**

- El comentario del reviewer es PÚBLICO entre los usuarios que interactúan: si Pedro dejó "Es un imbécil maneja mal" sobre Juan, ese texto se ve en el perfil de Juan (perfil propio) y en `ListOfRequests` cuando Pedro solicita un viaje a otro conductor. Es la evidencia que sustenta la clasificación.
- La razón interna del LLM (ej. "Insulto directo y crítica personal al manejo") solo la ve el dueño del perfil, porque es debug técnico del agente, no aporta a otros.

**Donde NO se muestran (intencionalmente):**

- `SearchRide`, `BuscarViaje`, `DashboardPasajero` — listados / feeds, no hay decisión inmediata
- `ListOfDrivers` — la decisión se materializa en `RideDetail` (que sí las muestra)
- `History`, `PreviousTripsScreen` — historia, no decisión presente

Esta regla está documentada en el header del componente `ReviewsList.js` para que cualquier desarrollador que la quiera mover, lo piense dos veces.

---

## ESTRUCTURA DE LA DOCUMENTACIÓN QUE NECESITO

Genera la documentación con **exactamente estos tres apartados, en este orden**. Cada uno con su propio título grande y tono distinto. La explicación formal va PRIMERO porque la audiencia principal del documento es no técnica (equipo, profesores, clientes empresariales). La explicación técnica va después como referencia detallada para desarrolladores.

### 📗 Apartado 1 — Explicación formal

**Audiencia:** el equipo del proyecto, profesores, clientes empresariales (RRHH de Intel, Cargill, etc.), inversores, gerentes — gente que necesita entender qué se construyó, por qué importa y qué impacto tiene en SafeRide. Pueden o no tener formación técnica, pero el documento debe leerse fluido sin asumir conocimiento de programación.

**Tono:** narrativo, en primera persona desde mi punto de vista (yo, el dueño del proyecto). Cuento la historia de cómo llegué a construir esto con la ayuda de Claude (la IA conversacional de Anthropic). Sin jerga técnica innecesaria. Cuando aparezca un término técnico inevitable, explicarlo con analogías del mundo real. Profesional pero cercano — como una presentación a directivos.

**Estructura sugerida (podés mejorarla):**

1. **El problema que tenía SafeRide.**
   - Las reseñas eran básicas (solo 1-5 estrellas + comentario libre)
   - Los comentarios tóxicos no se moderaban
   - La fórmula de cálculo del rating estaba mal hecha
   - No había forma de detectar fraudes ni patrones sistemáticos de abuso
   - Riesgo real: empleados de Intel/Cargill insultándose, RRHH involucrado en disputas

2. **Por qué decidí construir un agente.**
   - No quería contratar moderadores humanos 24/7 (costo prohibitivo para un MVP)
   - Tampoco dejar el problema sin resolver (riesgo reputacional con las empresas ancla)
   - Necesitaba algo automático, escalable y barato

3. **El proceso de construcción con Claude.** Trabajé sesión tras sesión con Claude (IA conversacional de Anthropic) que me ayudó a:
   - Analizar el proyecto SafeRide completo y detectar puntos débiles
   - Investigar cómo funcionan los sistemas de reputación de Uber, Lyft, DiDi, Airbnb
   - Diseñar 18 ideas distintas de "skills" para sistemas de reseñas y elegir la mejor combinación
   - Buscar APIs gratuitas de inteligencia artificial (porque no tenía presupuesto)
   - Probar que cada API funcionara realmente (con tests reales contra los proveedores)
   - Escribir todo el código del agente paso a paso, archivo por archivo
   - Asegurar que NO rompiera el código existente del backend del equipo
   - Hacer pruebas exhaustivas antes de declararlo listo

4. **Lo que construimos juntos.** Un agente inteligente que vive dentro del servidor de SafeRide, totalmente gratis, que se ocupa de tareas que antes requerirían personas:
   - **Lee comentarios automáticamente** y decide si son ofensivos
   - **Toma acciones concretas** cuando detecta toxicidad (no solo "detecta y archiva"):
     - Marca la reseña con peso reducido (`weight=0.1`) para que cuando se implemente el sistema de reputación nuevo (Bayesian) esta reseña pese menos en el cálculo
     - Crea una alerta visible en el panel admin con una recomendación específica de qué hacer
     - Notifica a los administradores en la sección de notificaciones
   - **Detecta patrones sistemáticos:** si un usuario tiene 10 reseñas seguidas tóxicas con palabras muy fuertes, emite una advertencia formal automática para que el admin tome cartas (advertir o suspender). Si todas son toxic con score muy alto, no es accidente — es comportamiento sistemático.
   - **Diseñó un sistema de reputación nuevo** (la skill `recompute-reputation` con fórmula Bayesian) que reemplazará a la vieja en el futuro. Por ahora coexiste: la fórmula actual del backend del equipo sigue activa y los conductores siguen empezando con 5 estrellas. El agente NO modifica esa fórmula — solo prepara el terreno marcando reseñas tóxicas con peso reducido para cuando se active la nueva fórmula.

5. **Las APIs gratuitas que conseguimos.** Tres servicios externos que dan inteligencia artificial gratis sin pedir tarjeta de crédito:
   - **Groq** — la principal, super rápida (procesa reseñas en menos de 1 segundo)
   - **Google Gemini** — para tareas que requieren leer mucho texto (apelaciones, reportes mensuales)
   - **Cerebras** — de respaldo automático si las otras se saturan

6. **Las reseñas son visibles para los usuarios — en el momento correcto.**
   El agente no solo trabaja "tras bambalinas". Sus decisiones se muestran a los usuarios finales con categorías claras: **Satisfecho** (verde), **Regular** (amarillo), **Tóxica** (rojo), o **Pendiente** (gris).
   - El **conductor** ve las reseñas del pasajero solicitante justo antes de decidir si lo acepta a bordo
   - El **pasajero** ve las reseñas del conductor justo antes de solicitar unirse al viaje
   - El comentario real escrito por quien dejó la reseña SÍ se muestra en estos casos. Si el sistema clasificó una reseña como "Tóxica" y el comentario decía "Es un imbécil maneja mal", ese texto es la evidencia que sustenta la clasificación. Ocultarlo dejaría al usuario adivinando por qué se clasificó así.
   - La razón interna del agente IA (información de debug, ej. "Insulto directo y crítica personal al manejo") sí queda privada y solo la ve el dueño del perfil — esa información es para que la persona reseñada entienda la decisión, no para quien la está evaluando.
   - Cada usuario ve sus propias reseñas recibidas en su perfil completo con la razón del agente.
   - Solo se muestran las **5 reseñas más recientes** en cada vista. Las más antiguas salen del corte automáticamente cuando llegan reseñas nuevas. Esto evita saturar la UI con historial viejo y mantiene la información relevante.
   - El principio rector: **información en el momento de la decisión**. Reputación que aparece justo cuando el usuario debe decidir con quién va a viajar tiene impacto real en la confianza.

7. **Por qué el agente es importante para SafeRide.** Explicar el impacto en:
   - **Seguridad:** filtra contenido ofensivo automáticamente, protege a los empleados de las empresas ancla del acoso digital entre colegas
   - **Transparencia:** las decisiones de moderación quedan auditadas. Cada reseña tóxica genera una alerta visible para el admin con recomendación específica.
   - **Decisiones informadas:** pasajeros y conductores ven con quién van a viajar antes de comprometerse
   - **Costos:** $0 por mes para procesar miles de reseñas (todos los proveedores de IA gratis sin tarjeta)
   - **Escalabilidad:** funciona igual con 10 viajes/día que con 1.000
   - **Imagen corporativa:** empresas como Intel pueden confiar que sus empleados no sufrirán acoso digital en la plataforma
   - **Auditoría completa:** cada decisión queda registrada con razón, score, y proveedor de IA usado

   **Aclaración honesta sobre el rating numérico:** el "rating de 1 a 5 estrellas" que se muestra en la app sigue calculándose con la fórmula del backend del equipo (un conductor nuevo empieza con 5 estrellas y se ajusta con cada reseña). El agente NO reemplazó esa fórmula. Lo que el agente agrega es una **capa de moderación** encima: clasificación por categoría (Satisfecho/Regular/Tóxica/Pendiente), alertas al admin, advertencias por patrones sistemáticos, y el campo `weight` preparado para que cuando se active el nuevo sistema de cálculo (Bayesian, ya implementado en la skill `recompute-reputation`) las reseñas tóxicas pesen menos. La transición al nuevo sistema requiere que el móvil empiece a usar el endpoint `/reviews/v2`, lo que se hará en una iteración futura.

8. **Decisiones que tomamos juntos.** Cosas que Claude me preguntó y yo decidí:
   - No usar Docker porque mi laptop tiene poca RAM (8 GB)
   - No usar Ollama (modelos locales) por la misma razón
   - No comprar créditos de Anthropic ($4 USD que tenía no me alcanzaba para producción)
   - Hacer el agente "plug-and-play" para que mi equipo pueda activarlo o desactivarlo con un solo flag (`SAFESCORE_ENABLED=true/false`)
   - Que toda la moderación quede registrada para auditoría posterior
   - **NO implementar sistema de badges/premios** porque la mayoría de viajes en SafeRide son gratis y no hay sentido económico para gamificación. El agente premia solo con calidad de servicio, no con incentivos materiales.
   - **Regla de 10 reseñas tóxicas seguidas para advertencia formal**: no advertir por una sola reseña mala (eso puede ser un día puntual). Solo cuando hay patrón sistemático sin contexto legítimo (las 10 con palabras muy fuertes, ningún rescate, ninguna crítica constructiva entremezclada).

9. **Conclusión.** El agente está vivo, funcionando, y cuesta cero. Es como tener un equipo de moderadores invisibles 24/7 que nunca duermen, que toman decisiones consistentes, que respetan la privacidad de los usuarios y que dejan trazas auditables de todo lo que hacen.

**Importante:** este apartado debe leerse como una historia, no como una lista de bullets. Que se sienta humano. Que cualquier persona ajena al proyecto pueda leerlo en 7-10 minutos y entender qué se construyó y por qué importa.

### 📘 Apartado 2 — Explicación técnica para el programador

**Audiencia:** desarrolladores que se sumen al proyecto SafeRide y necesiten entender cómo funciona el agente para mantenerlo, extenderlo o conectarse con él.

**Tono:** técnico, preciso, con vocabulario de programación. Usa términos como "event emitter", "atomic findOneAndUpdate", "fallback chain", "idempotency", "schema strict mode", "race condition", "backoff exponencial", "side effect" — sin disculparte por la jerga (la audiencia la conoce).

**Debe incluir:**

- **Arquitectura completa** con diagrama ASCII del flow (review.created → listener → enqueue → worker → dispatcher → skill → enforcement → DB updates)

- **Estructura de carpetas** comentada (`safescore-reviewer/agent/...`, `safescore-reviewer/skills/...`, `safescore-reviewer/docs/...`)

- **Contrato técnico entre `agent/` y `skills/`** — cómo una skill expone su `execute({ input, llm, db, logger })` y qué garantiza el runtime

- **Schemas de las collections** con cada campo explicado:
  - `agent_jobs`
  - `reviews_v2`
  - `moderation_alerts` (collection nueva con `recommendation` embebida)
  - Campos AGREGADOS a `reviews` legacy (`ai_moderation`, `ai_moderated_at`)
  - Campos AGREGADOS a `users` (`moderation_strikes`, `last_moderation_at`, `last_warning_at`, `warnings_count`, `warning_reason`)

- **El servicio `enforcement.js`** del agente:
  - Las 4 acciones del enforcement individual (weight, strike, alert, notify admins)
  - La función `checkAndIssueWarning()` con la regla de 10 reviews
  - Umbral de score `>= 0.80` para considerar "palabras muy fuertes"
  - Cooldown de 24 horas entre advertencias formales
  - Por qué los strikes NO disparan flag automático (solo el patrón sistemático lo hace)

- **El componente `ReviewsList.js` del móvil:**
  - Props: `userId`, `isOwn`, `compact`, `maxItems`
  - Decisión de mostrar / ocultar `comment` según `is_own` (resuelto en backend, no en cliente)
  - Categorización visual: Satisfecho/Regular/Tóxica/Pendiente con colores
  - Stats agregadas en header

- **Endpoint nuevo del agente** `GET /api/v1/safescore/reviews/user/:userId`:
  - Detección de owner vía JWT
  - Lectura via collection nativa (bypass Mongoose strict)
  - Normalización dual (V2 + legacy en una sola respuesta)

- **Routing LLM con fallback chain** y quota tracking (Groq → Cerebras → Gemini)

- **Opt-in con `SAFESCORE_ENABLED`** — qué hace el flag a nivel código (listeners no se registran, cronJobs no se programan, emit() es no-op, init() retorna false)

- **Cómo agregar una nueva skill** (paso a paso técnico: crear carpeta, SKILL.md, schema.js, skill.js, prompt.md si usa LLM, registrar en VALID_TASKS)

- **Endpoints admin** disponibles (`GET /api/v1/admin/agent-jobs`, `/stats`, `:id/retry`, `enqueue`, `DELETE`)

- **Endpoint público del agente** `GET /api/v1/safescore/reviews/user/:userId` y su lógica de privacidad

- **Concurrencia y resiliencia:**
  - Jobs huérfanos detectados a los 5 min
  - Retry con backoff exponencial (10s → 60s → 5min)
  - Locks atómicos con `findOneAndUpdate`
  - Idempotencia en moderate-comment (skip si `decided_at` no nulo)

- **Cómo se conecta con el backend del equipo SIN romperlo:**
  - 15 líneas en 6 archivos con marcadores `[SAFESCORE-AGENT]`
  - Campos agregados a collections con `$set` directo (bypass schema strict)
  - Try/catch en cada punto de integración (si el agente falla, el backend no)

- **Comparativa con alternativas descartadas** y por qué (Redis/Bull, n8n, Anthropic API directa, Ollama local, OpenAI Moderation)

### 📙 Apartado 3 — Cómo funciona y cómo verificar que funcionó

**Audiencia:** la persona que tiene que demostrar que el agente NO es una simulación — al equipo, profesor o cliente.

**Tono:** instructivo, paso a paso, con comandos exactos para copiar. Mezcla de técnico y narrativo: claro pero ejecutable.

**Estructura:**

1. **Cómo arrancar el agente.** Comando `npm run dev` en el backend. Qué logs esperados aparecen (las 4 líneas con prefijo `[SAFESCORE]`).

2. **Las evidencias de que funciona** (no es simulación). Para cada una:
   - **Logs en consola** con prefijo `[SAFESCORE]`
   - **Collection `agent_jobs` en MongoDB** con jobs procesados con tokens reales y duración
   - **Collection `moderation_alerts`** con las alertas + recomendación visible
   - **Campo `ai_moderation` en `reviews`** con la decisión aplicada (legacy) o `moderation` embed en `reviews_v2`
   - **Collection `notifications`** con las notificaciones tipo `system` al admin
   - **Campos nuevos en `users`** del reviewer (strikes, warnings_count, last_warning_at)
   - **Endpoint admin** `GET /api/v1/admin/agent-jobs/stats` mostrando métricas en vivo
   - **Endpoint público** `GET /api/v1/safescore/reviews/user/:userId` devolviendo categorías humanas
   - **Dashboard externo de Groq** (https://console.groq.com/dashboard) mostrando requests facturadas

3. **Script de demo en 3 modos.** Cómo usar `safescore-reviewer/demo-trigger.js`:
   ```bash
   node safescore-reviewer/demo-trigger.js --safe        # comentario inocente
   node safescore-reviewer/demo-trigger.js --borderline  # caso ambiguo
   node safescore-reviewer/demo-trigger.js --toxic       # comentario ofensivo + verifica enforcement
   ```
   Y qué output exacto muestra cada uno (con tokens reales gastados, recomendación generada, alerta creada, admin notificado).

4. **Cómo probar la regla de 10 reseñas tóxicas.** Script de prueba que:
   - Crea un usuario temporal
   - Le crea 9 reseñas tóxicas → verifica que NO se emite advertencia (insuficiente)
   - Le crea 1 más → verifica que SÍ se emite advertencia con severity `critical`
   - Reintenta inmediatamente → verifica que respeta el cooldown de 24h
   - Limpia todo al final

5. **Cómo demostrar end-to-end desde el móvil.** Pasos para:
   - Tener el backend corriendo (`npm run dev`)
   - Tener MongoDB Compass abierto en `agent_jobs`, `moderation_alerts` y `reviews`
   - Completar un viaje desde la app móvil real
   - Calificar con un comentario tóxico
   - Mirar simultáneamente:
     - Logs del backend con `[SAFESCORE]`
     - `agent_jobs` (job nuevo aparece como done con tokens > 0)
     - `reviews` (campo `ai_moderation` agregado con weight=0.1)
     - `moderation_alerts` (alerta nueva con recomendación)
     - `notifications` (notificación al admin)
     - Groq dashboard externo (request facturada)
   - Después: ir al perfil propio en el móvil → ver la reseña recién creada con su categoría visible

6. **Cómo probar la visualización de reviews en el móvil.** Recorrido:
   - Como conductor en `ListOfRequests` → tocar "Ver detalles" de un pasajero → verificar que el modal muestra "RESEÑAS DEL PASAJERO" con stats, badges de categoría y el comentario real entre comillas (sin la razón del agente — esa solo aparece en perfil propio)
   - Como pasajero en `RideDetail` → verificar que aparece "RESEÑAS DEL CONDUCTOR" antes del botón "Solicitar unirse" con el mismo formato
   - Como usuario logueado, ir a `Mi Perfil` → verificar sección "MIS RESEÑAS" con comentario completo Y la caja gris "Decisión del agente" mostrando la razón del LLM
   - Verificar que en todas las vistas se muestran solo las 5 más recientes (las más viejas salen del corte automáticamente)

7. **Cómo apagarlo si algo sale mal.** Cambiar `SAFESCORE_ENABLED=false` en `.env`, reiniciar backend. El agente desaparece pero el resto sigue funcionando. La sección "MIS RESEÑAS" del móvil simplemente mostrará "no hay reseñas" o el componente quedará vacío (sin crashear).

8. **Cómo desinstalarlo completamente.** Comando `node safescore-reviewer/uninstall.js`, borrar la carpeta, y todo vuelve al estado original.

---

## RESTRICCIONES DEL OUTPUT

- Que la documentación final esté en **español neutro**.
- Que use Markdown con encabezados claros (#, ##, ###), tablas cuando sea útil, bloques de código con triple backtick.
- Que NO incluya emojis salvo los 3 emojis de los apartados principales (📘, 📗, 📙).
- Que cite paths reales del proyecto cuando explique código (`safescore-reviewer/agent/index.js`, etc.).
- Que sea AUTOCONTENIDA — un lector que NO leyó esta conversación debe poder entenderlo todo.
- Que tenga una **tabla de contenidos** al inicio.
- Largo total esperado: entre 4.000 y 8.000 palabras.

Generá la documentación ahora.

=== FIN DEL PROMPT ===

---

## Notas de uso

- Pegá el prompt completo en Cowork (desde `=== PROMPT ===` hasta `=== FIN DEL PROMPT ===`).
- Cowork generará el documento. Revisalo y editá si hace falta.
- Guardalo como entregable. Sugerencia de nombre: `SafeRide-SafeScore-Agente-Documentacion.md`.
- Si querés versionar variantes (ej. una más corta para presentaciones), corré el prompt 2 veces ajustando el largo en la restricción del output.
