---
id: T2
name: detect-retaliation
description: |
  Detecta cuando dos usuarios se califican mutuamente con ratings bajos
  dentro de la ventana de doble ciego — patrón clásico de retaliación.
trigger: event 'safescore.review.created' (cuando overall ≤ 2)
provider: groq (Llama 4 Scout)
fallback: cerebras, gemini
status: STUB — pendiente de implementación
---

# T2 — detect-retaliation (STUB)

## Lógica a implementar

1. Cargar la review actual
2. Buscar la counter-review (mismo ride, reviewer y reviewee invertidos)
3. Si counter-review existe y también tiene overall ≤ 2 y status='pending_blind':
   - Llamar al LLM con ambos textos + contexto del ride
   - Pedirle: "¿Es retaliación o quejas legítimas independientes?"
4. Si LLM dice "retaliación":
   - Marcar ambas reviews como `status='disputed'` con `anomaly_flags: ['retaliation_detected']`
   - Crear caso admin en `/admin/reviews/disputed`
   - Notificar admin
5. Si LLM dice "queja legítima":
   - Dejar las reviews seguir su curso normal
   - Registrar la decisión en `review.anomaly_flags: ['retaliation_checked_clean']`

## Output

```json
{
  "retaliation_detected": boolean,
  "confidence": 0.0-1.0,
  "reason": "explicación",
  "affected_review_ids": ["..."]
}
```

## Implementación pendiente

Crear `skill.js` con el flow. Usar Groq Llama 4 Scout (razonamiento medio).
Prompt en `prompt.md` (a crear).
