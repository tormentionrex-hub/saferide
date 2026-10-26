---
id: T3
name: recompute-reputation
description: |
  Recalcula el reputationSnapshot de un usuario usando Bayesian average
  con prior empírico (4.0) y peso 10, aplicando decay exponencial
  con vida media de 180 días. Es la fórmula honesta que reemplaza al
  (sum + 5) / (n + 1) actual del backend.
trigger: event 'safescore.review.published' o cron 4 AM
provider: none (matemática pura)
needs_llm: false
input: { userIds: string[] }
output: { recomputed: number, snapshots: [{ userId, overall, samples, level }] }
idempotent: true
estimated_duration_ms: 50-200 (depende de cuántas reseñas tenga el user)
---

# T3 — recompute-reputation

## ¿Qué hace?

Toma una lista de userIds y, para cada uno:

1. Lee todas las `ReviewV2` con `status='published'` y `weight > 0` donde sea el reviewee
2. Calcula `overall` con **Bayesian average + decay temporal**:
   ```
   prior_mean = 4.0
   prior_weight = 10
   half_life_days = 180

   weight(review) = 0.5 ^ (age_days / half_life_days)
   bayesian_avg = (prior_mean * prior_weight + Σ(w * rating)) / (prior_weight + Σ w)
   ```
3. Calcula promedio por dimensión (safety, punctuality, etc.)
4. Determina nivel: `rookie / driver / pro / champion` según samples + overall
5. Actualiza `User.reputationSnapshot` y `User.rating` (mirror para back-compat)

## ¿Por qué Bayesian + decay?

- **Bayesian**: evita inflar a nuevos usuarios (con 1 reseña 5★ no es realista ser "5.0")
- **Decay**: una 1★ de hace 2 años no debe pesar igual que una 1★ de ayer
- **Prior 4.0**: media empírica esperada (no 5.0 — es honesto)
- **Prior weight 10**: necesitás >10 reseñas para que tu rating refleje principalmente tus reseñas, no el prior

## Niveles

| Nivel | Requisitos |
|-------|-----------|
| `rookie` | < 5 samples |
| `driver` | 5-49 samples |
| `pro` | 50-199 samples Y overall ≥ 4.5 |
| `champion` | ≥ 200 samples Y overall ≥ 4.7 |

## Trigger

- Listener `safescore.review.published` → encola con `{ userIds: [reviewer, reviewee] }`
- Cron 4 AM (futuro): batch sobre usuarios activos del día

## Idempotencia

Sí. Llamarlo N veces produce el mismo resultado (no acumula).

## No usa LLM

Cero llamadas a APIs externas. Solo Mongo aggregate + math.
