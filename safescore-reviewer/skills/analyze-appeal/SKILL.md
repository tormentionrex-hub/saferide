---
id: T7
name: analyze-appeal
description: |
  Cuando un usuario apela una review recibida, el agente lee la review +
  historial del reviewer/reviewee + contexto del ride y genera un resumen
  estructurado con recomendación para el admin.
trigger: event 'safescore.review.appealed'
provider: gemini (2.5-flash, 1M context)
status: STUB
---

# T7 — analyze-appeal (STUB)

## Lógica a implementar

1. Cargar review apelada, ride, ambos perfiles
2. Cargar historial: últimas 10 reviews recibidas por el apelante
3. Cargar historial del reviewer (¿tiene patrón de reviews bajos?)
4. Pasar todo a Gemini 2.5-flash con prompt pidiendo:
   - Probabilidad de que la apelación sea legítima
   - Resumen ejecutivo
   - Recomendación: aceptar / rechazar / investigar más
5. Guardar resultado en la review apelada
6. Notificar al admin con caso completo
