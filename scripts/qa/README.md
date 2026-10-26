# Scripts de QA por API

Corren contra un backend levantado en `http://localhost:8080` apuntando a la
base de prueba (`COSMOS_DATABASE=SafeRide-Prueba`), nunca contra la base real.
Usan los usuarios del seed (`src/scripts/initDatabase.js`).

```bash
COSMOS_DATABASE=SafeRide-Prueba node server.js   # en otra terminal
npm run qa:ataques   # 103 casos: inyección, permisos, carreras, tokens, límites
npm run qa:flujos    # 92 casos: ciclo completo de viaje, reservas, pagos, reseñas
```

La sección 11 de `qa2-flujos.js` crea viajes a horas absolutas del mismo día
(23:54 hacia atrás), así que el script tiene que correr antes de las 17:30.
