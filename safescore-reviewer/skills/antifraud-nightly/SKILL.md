---
id: T5
name: antifraud-nightly
description: |
  Análisis nocturno de patrones anómalos: velocity, clusters de mutual rating,
  cuentas nuevas con muchas reseñas extremas, reviews fuera del radio del destino.
trigger: cron 3 AM diario
provider: gemini (2.5-flash) por contexto largo
status: STUB — pendiente de implementación
---

# T5 — antifraud-nightly (STUB)

## Lógica a implementar

1. Tomar todas las reviews del día anterior (status='published')
2. Calcular métricas:
   - **Velocity**: usuarios con > 5 reviews/h
   - **Concentración bimodal**: usuarios con 90%+ ratings extremos (1 o 5)
   - **Clusters de mutuo elogio**: A→B 5★ + B→A 5★ + A→C 5★ + C→A 5★...
   - **GPS off**: reviews creadas a >1km del destino del ride
3. Pasar los flags al LLM con contexto agregado para que clasifique los casos como:
   - confirmed_fraud (acción: suprimir y notificar admin)
   - suspicious (acción: agregar `anomaly_flags` y dejarlas seguir)
   - false_positive (acción: ignorar)
4. Aplicar acciones y reportar al admin via summary

## Implementación pendiente

- Aprovechar Gemini 2.5-flash (1M context) para meter centenares de reviews en un prompt
- Output JSON estructurado con casos clasificados
- Implementar `award-badges` ANTES (algunos badges dependen de pasar el antifraud check)
