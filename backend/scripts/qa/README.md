# Scripts de QA por API

Corren contra un backend levantado apuntando a una base de prueba, nunca contra la base real: crean,
modifican y borran datos. Usan los usuarios de `DATOSPRUEBA/seed_completo.js` (clave `SafeRide2024!`).

```bash
COSMOS_DATABASE=SafeRide-Prueba node DATOSPRUEBA/seed_completo.js   # borra y llena esa base
COSMOS_DATABASE=SafeRide-Prueba node server.js                      # en otra terminal
npm run qa:ataques   # 354 casos: inyección, permisos por rol, carreras, tokens, límites, archivos
npm run qa:flujos    # 125 casos: viaje completo, reservas, pagos, reseñas, documentos, auditoría
```

Variables opcionales:

| Variable | Para qué | Por defecto |
|---|---|---|
| `QA_ORIGIN` | Backend contra el que se corre | `http://localhost:8080` |
| `QA_DB` | Base que los scripts leen y limpian directamente | `SafeRide-Prueba` |
| `QA_PAYPAL_MOCK` | `1` activa los casos de captura de PayPal | apagado |

Los casos de PayPal necesitan el simulador y el backend arrancado contra él:

```bash
node scripts/qa/mock-paypal.js                                     # escucha en 127.0.0.1:8099
PAYPAL_API_BASE=http://127.0.0.1:8099 COSMOS_DATABASE=SafeRide-Prueba node server.js
QA_PAYPAL_MOCK=1 npm run qa:ataques
```

Las cuentas que crean los scripts se llaman «(QA) …» y se borran al terminar. La sección 11 de
`qa2-flujos.js` crea viajes a horas absolutas del mismo día (23:54 hacia atrás), así que tiene que correr
antes de las 17:30.
