---
id: T1
name: moderate-comment
description: |
  Modera el comentario en español de una reseña recién creada. Clasifica
  como SAFE / BORDERLINE / TOXIC y aplica side effects.

  Soporta DOS esquemas de review:
    - reviews_v2 (nuevo SafeScore): actualiza moderation embed + status
    - reviews legacy (backend del equipo): agrega campo ai_moderation con
      $set directo (sin tocar el schema del equipo, idempotente)
trigger: event 'safescore.review.created' (cuando hay comment)
provider: groq (Llama 3.1 8B Instant)
fallback: cerebras (Llama 3.1 8B), gemini (2.5-flash-lite)
needs_llm: true
input: { reviewId: string }
output: { decision, toxicity_score, reason, source: 'v2'|'legacy' }
idempotent: true (chequea moderation.decided_at o ai_moderation.decided_at)
max_tokens: 200
estimated_duration_ms: 200-1000
---

# T1 — moderate-comment

## ¿Qué hace?

Cuando una reseña llega con un `comment` no vacío:

1. Carga la review por `reviewId`:
   - **Primero** busca en `reviews_v2` (modelo nuevo SafeScore)
   - **Si no encuentra**, busca en `reviews` legacy (backend del equipo)
2. Si ya tiene moderación previa → skip (idempotente)
3. Llama al LLM con un prompt en español pidiendo clasificación + razón
4. Parsea el JSON de respuesta:
   ```json
   { "decision": "safe" | "borderline" | "toxic",
     "toxicity_score": 0.0-1.0,
     "reason": "explicación corta" }
   ```
5. Aplica side effects según el tipo de review:
   - **V2**: actualiza `review.moderation` + `review.status`
   - **Legacy**: agrega campo `ai_moderation` + `ai_moderated_at` con
     `$set` directo en la collection (NO modifica el schema del equipo)
6. Devuelve `{ decision, toxicity_score, reason, source: 'v2'|'legacy' }`

## Decisiones

| Decision | Toxicity | Acción en review V2 | Acción en review legacy |
|----------|----------|---------------------|--------------------------|
| `safe` | < 0.30 | sigue `pending_blind` | solo registra `ai_moderation` |
| `borderline` | 0.30-0.70 | `status='moderation_queue'` | solo registra `ai_moderation` |
| `toxic` | > 0.70 | `status='suppressed'` | solo registra `ai_moderation` |

**Nota sobre legacy:** las reviews del backend del equipo no tienen el concepto
de `status` ni `moderation`. La skill NO suprime estas reviews automáticamente
— solo deja constancia de la decisión IA en el campo nuevo `ai_moderation`.
Esto evita romper la lógica existente del equipo. El admin / panel de moderación
puede decidir qué hacer leyendo ese campo.

## ¿Por qué Llama 3.1 8B Instant?

- Sobra para clasificación binaria/ternaria en español
- 840 tok/s → respuesta <300ms
- 14,400 RPD free tier → no toca la cuota de tareas más complejas
- Soporta `response_format: json_object` (parsing limpio)

## Fallback

Si Groq falla (rate limit, network), el router prueba Cerebras (Llama 3.1 8B
también) y luego Gemini 2.5-flash-lite. Cualquiera procesa el mismo prompt.

## Idempotencia

Sí: la skill chequea `review.moderation.decided_at`. Si no es null, devuelve
el resultado previo sin volver a llamar al LLM.

## Cuidado con tokens

- max_tokens=200 (respuesta corta, JSON solamente)
- temperature=0.1 (consistencia para casos similares)
- prompt diseñado para ser <500 tokens (incluyendo few-shot examples)
- Total por moderación: ~250 input + ~80 output ≈ **330 tokens/job**

Con cuota Groq Llama 3.1 8B free de 14,400 req/día = capacidad de moderar
**~14k reseñas diarias** solo con Groq. Sobrado.

## Safety

- NO suprime sin trail: cada decisión queda en `review.moderation.reason`
- Admin siempre puede revertir desde `/admin/agent-jobs` o `/admin/reviews/:id`
- Si Borderline: humano decide (queue admin)
- Si Toxic: humano puede restaurar si fue falso positivo
