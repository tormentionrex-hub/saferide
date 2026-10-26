---
id: T8
name: award-badges
description: |
  Evalúa diariamente qué usuarios califican para nuevos badges según
  reglas claras (km, rating, racha sin incidentes, etc.) y los otorga.
trigger: cron 4 AM diario
provider: none (reglas puras)
status: STUB
---

# T8 — award-badges (STUB)

## Catálogo de badges a implementar

| Badge | Requisito |
|-------|-----------|
| 🌱 Eco Rookie       | 1+ viaje completado |
| 🚗 Eco Driver       | 5+ viajes, rating ≥ 4.3 |
| 🏅 Eco Pro          | 50+ viajes, rating ≥ 4.5 |
| 🏆 Eco Champion     | 200+ viajes, rating ≥ 4.7 |
| ⏰ Always On Time   | punctuality ≥ 4.9, ≥30 viajes |
| 🛡️ Safety First    | safety ≥ 4.95, ≥30 viajes, 0 incidentes 90d |
| 🌍 CO₂ Saver        | > 500 kg CO₂ ahorrados (de metrics) |
| 🏢 Company Top 5%   | top 5% de su empresa en overall |
| 🌙 Night Owl        | 20+ viajes nocturnos, rating ≥ 4.5 |

## Lógica

1. Cargar usuarios con `reputationSnapshot.lastUpdate` reciente
2. Por cada usuario, evaluar reglas
3. Si nueva regla cumple Y badge no estaba → agregar a `reputationSnapshot.badges`
4. Si tenía badge y ya no cumple (degradado) → quitar
5. Encolar notification push: "¡Subiste a Eco Pro!"

Sin LLM. Reglas puras en JS.
