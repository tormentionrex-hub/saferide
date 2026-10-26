---
id: T6
name: infer-tags
description: |
  Si una review llega con comentario pero pocos/ningún tag estructurado,
  el LLM infiere qué tags positivos/negativos aplican según el texto.
trigger: event 'safescore.review.created' (cuando hasComment && tags.length < threshold)
provider: groq (Llama 3.1 8B Instant)
status: STUB — pendiente de implementación
---

# T6 — infer-tags (STUB)

## Lógica a implementar

1. Cargar review por reviewId
2. Si ya tiene >2 tags total → skip (suficiente para análisis)
3. Pasar el comentario al LLM con la lista de tags válidos del catálogo
4. Pedirle: "¿Cuáles tags aplican según el texto?" (JSON con codes)
5. Mergear con tags existentes y guardar
6. NO afecta el rating, solo enriquece datos para analytics
