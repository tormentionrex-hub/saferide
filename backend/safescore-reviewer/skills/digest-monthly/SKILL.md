---
id: T9
name: digest-monthly
description: |
  Primer día de cada mes: genera un reporte ejecutivo por empresa ancla
  (Intel, Cargill, etc.) con métricas de reputación, CO₂ ahorrado,
  top conductores, casos de moderación. Salida en JSON estructurado y
  un resumen en español para enviar por email a RH.
trigger: cron 1° del mes
provider: gemini (2.5-flash, 1M context)
status: STUB
---

# T9 — digest-monthly (STUB)

## Lógica a implementar

1. Por cada empresa del enum User.company:
   - Total viajes del mes
   - Total km, kg CO₂
   - Promedio reputación de empleados activos
   - Top 5 conductores
   - Casos de moderación
   - Apelaciones
2. Pasar datos a Gemini para generar reporte ejecutivo
3. Guardar en collection `monthly_digests`
4. (Futuro) enviar por email a contacto de RH de cada empresa
