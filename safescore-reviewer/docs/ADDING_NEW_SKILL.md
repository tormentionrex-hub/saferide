# Cómo agregar una skill nueva al agente

## Paso 1 — Crear la carpeta de la skill

```bash
mkdir safescore-reviewer/skills/mi-nueva-skill
cd safescore-reviewer/skills/mi-nueva-skill
```

## Paso 2 — Escribir `SKILL.md`

Documenta:
- ID (Tn — el próximo número libre)
- Qué hace en una oración
- Trigger (event o cron)
- Provider sugerido y por qué
- Input/output schemas
- Idempotencia

Usá `skills/moderate-comment/SKILL.md` como ejemplo.

## Paso 3 — Escribir `skill.js`

Estructura mínima:

```js
module.exports = {
  name: 'mi-nueva-skill',

  llmRequirements: {
    preferredProvider: 'groq',  // o 'gemini', 'cerebras', 'none'
    preferredModel: 'reasoning_fast',
    fallback: ['cerebras'],
    maxTokens: 300,
    temperature: 0.2,
    jsonMode: true,
  },

  async execute({ input, llm, db, logger }) {
    // 1. Validar input
    // 2. (Si usa LLM) llamar a llm.complete({...})
    // 3. Parsear output (usar safeParseJSON del agent/utils)
    // 4. Aplicar side effects en DB
    // 5. Devolver { ...result }
  },
};
```

## Paso 4 — (Opcional) Prompt en `prompt.md`

Si la skill usa LLM, mantené el prompt en un archivo Markdown:

```markdown
Eres un X para SafeRide. Tu tarea es Y.

EJEMPLOS:
...

AHORA PROCESA:
{{variable_que_interpola}}

Responde SOLO con JSON:
```

Y cargalo desde `skill.js` con:

```js
const promptLoader = require('../../agent/utils/promptLoader');
const prompt = promptLoader.loadAndInterpolate('mi-nueva-skill', { variable_que_interpola: input.algo });
```

## Paso 5 — (Opcional) Schema en `schema.js`

Si la skill maneja input/output estructurado, definí schemas Zod:

```js
const z = require('zod');

const inputSchema = z.object({...});
const outputSchema = z.object({...});

module.exports = { inputSchema, outputSchema };
```

## Paso 6 — Registrar el trigger

### Si es trigger por evento:

Editá `agent/listeners.js` y agregá:

```js
eventEmitter.on('safescore.mi-evento', async (data) => {
  await queue.enqueue('mi-nueva-skill', data, { priority: 5 });
});
```

### Si es trigger por cron:

Editá `agent/cronJobs.js` para exportar el wrapper:

```js
async function miNuevoJob() {
  try {
    await queue.enqueue('mi-nueva-skill', { /* payload */ }, { priority: 2, tags: ['cron'] });
  } catch (err) { logger.error('cron mi-nuevo-job', err); }
}

module.exports = { ..., miNuevoJob };
```

Y en `src/jobs/scheduledJobs.js` (backend del equipo), dentro del bloque
`// [SAFESCORE-AGENT]`, agregá:

```js
cron.schedule('CRON_EXPR', safescoreCron.miNuevoJob, { timezone: 'America/Costa_Rica' });
```

## Paso 7 — Registrar la skill en VALID_TASKS

En `agent/models/AgentJob.js`, agregá `'mi-nueva-skill'` al array `VALID_TASKS`.

## Paso 8 — Test

Creá `tests/skills/mi-nueva-skill.test.js`:

```js
const skill = require('../../skills/mi-nueva-skill/skill');

test('skill ejecuta sin LLM real', async () => {
  const ctx = {
    input: { /* mock */ },
    llm: { complete: async () => ({ text: 'mock', tokensUsed: 0, provider: 'mock' }) },
    db: mongoose,
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  };
  const result = await skill.execute(ctx);
  expect(result).toBeDefined();
});
```

## Paso 9 — Verificar

```bash
node safescore-reviewer/verify.js
```

Debería listar tu nueva skill como presente.

## Paso 10 — Documentar en MANIFEST.md

Agregá tu skill a la sección "Skills" del MANIFEST.md.

---

## Buenas prácticas

- **Idempotencia**: tu skill debe poder ejecutarse 2x sin daños.
- **NO bloquear**: si el LLM falla, derivá a moderation_queue / admin.
- **Validar inputs**: no confiés en que la cola te trae datos válidos.
- **Logs estructurados**: usá `logger.info('mi mensaje', { meta })`.
- **Cuidá tokens**: maxTokens lo más bajo posible; jsonMode siempre que sea
  output estructurado.
- **Schema first**: definí el output esperado en `schema.js` antes de escribir
  el código de la skill.
