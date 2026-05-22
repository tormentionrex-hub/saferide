# Header `X-Client-Type` — App móvil SafeRide

## Resumen

A partir de esta versión, **todas** las peticiones HTTP que el cliente móvil envía al backend incluyen el header:

```
X-Client-Type: mobile
```

El header se inyecta por defecto en la instancia de `axios` (`src/services/api.js`) y también en la llamada directa a `/auth/refresh`. No requiere acción manual por parte de los desarrolladores frontend al consumir endpoints.

## Motivación

- **Telemetría**: permite al backend separar métricas (latencia, error rate, volumen) por tipo de cliente sin depender de heurísticas frágiles como User-Agent.
- **Logging diferenciado**: en incidentes, saber si un 5xx vino del panel web o del app móvil ahorra tiempo de diagnóstico.
- **Reglas específicas opcionales**: el backend puede aplicar políticas distintas por cliente sin acoplarse al User-Agent. Ejemplos posibles (a discreción del equipo backend):
  - Rate limits más laxos para móvil (pantallas con polling).
  - Versión mínima exigida del cliente (`X-Client-Version` futuro) para forzar actualización.
  - Bloquear ciertos endpoints administrativos al cliente móvil aunque el JWT sea válido.

## Valores definidos

| Valor    | Origen                                                          |
|----------|-----------------------------------------------------------------|
| `mobile` | App React Native / Expo (este repo, `saferide-frontend`).       |
| `web`    | Reservado para el panel web (cuando lo implementen, opcional).  |

Si el header está ausente, el backend debe asumir cliente desconocido. **No** se debe rechazar la petición por ausencia del header (no es un mecanismo de seguridad).

## Implementación en frontend (referencia)

```js
// src/services/api.js
const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        'X-Client-Type': 'mobile',
    },
});
```

La llamada directa a `/auth/refresh` (que usa `axios` global para no pasar por el interceptor) replica el header manualmente.

## Acciones sugeridas para el equipo backend

1. **Loguear** el valor de `X-Client-Type` en cada request (al menos en errores y endpoints de auth).
2. **Whitelist en CORS**: confirmar que `X-Client-Type` esté permitido en `Access-Control-Allow-Headers`. Si CORS está configurado para aceptar headers personalizados con `*` o lista explícita, agregar `X-Client-Type`.
3. **Métricas**: separar dashboards por `client_type` en logs estructurados / APM.

## No es

- **No** es un mecanismo de autenticación. Cualquier cliente puede enviar el header con cualquier valor.
- **No** sustituye la validación de JWT ni de roles.
- **No** debe usarse para tomar decisiones de seguridad. Solo informativo/telemetría.
