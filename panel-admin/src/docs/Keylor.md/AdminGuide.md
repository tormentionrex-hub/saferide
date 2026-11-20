# SafeRide Admin Dashboard Guide

Esta guía contiene la información necesaria para construir un panel de administración para SafeRide, detallando las rutas disponibles, los datos a monitorear y las consideraciones clave del backend.

## 1. Rutas Principales para el Admin

Todas las rutas del API están bajo el prefijo `/api/v1/`.

### 📊 Métricas Globales (Dashboard Principal)
*   **Endpoint**: `GET /metrics/global`
*   **Acceso**: Solo rol `administrador`.
*   **Datos que retorna**:
    *   `totalKilometers`: Distancia total recorrida en el sistema.
    *   `totalCarbonSaved`: Huella de carbono evitada (en kg).
    *   `totalRides`: Cantidad total de viajes creados.
    *   `totalPassengers`: Cantidad total de pasajeros transportados.
    *   `totalUsers`: Usuarios totales registrados.
    *   `totalDrivers`: Conductores activos.

### 👥 Gestión de Usuarios
*   **Listar Usuarios**: `GET /users` (Paginado). Permite ver todos los perfiles, empresas y roles.
*   **Eliminar Usuario**: `DELETE /users/:id`.
*   **Estadísticas de Usuario**: `GET /users/:id/stats`. Muestra el impacto individual de sostenibilidad.
*   **Leaderboard**: `GET /metrics/leaderboard`. Útil para mostrar un ranking de sostenibilidad en el dashboard.

### 🚗 Monitoreo de Viajes (Rides)
*   **Listar todos los viajes**: `GET /rides` (Usar query params como `status` para filtrar por `scheduled`, `in progress`, `completed`, `cancelled`).
*   **Detalle de Viaje**: `GET /rides/:id`. Incluye información del conductor, pasajeros y reservaciones.

### 📅 Gestión de Reservaciones (Bookings)
*   **Listar todas las reservaciones**: `GET /bookings`. (Los administradores ven las de todos los usuarios).
*   **Actualizar Estado**: `PATCH /bookings/:id/status`. Para intervenir en estados de reservación.
*   **Verificar Pagos**: `PATCH /bookings/:id/payment`. Para confirmar que el pago de una reservación ha sido procesado.

---

## 2. Modelos de Datos Clave

### Usuario (`User`)
*   **Campos a cuidar**: `type` (admin, conductor, pasajero), `company` (Intel, Cargill, etc.), `rating` (1-5).
*   **Sostenibilidad**: El modelo de métricas está vinculado a cada `userId`.

### Viaje (`Ride`)
*   **Estados**: `scheduled`, `in progress`, `completed`, `cancelled`.
*   **Geolocalización**: `origin` y `destination` contienen `name` y `coordinates` (lat, lng).

### Reservación (`Booking`)
*   **Estados**: `pending`, `confirmed`, `cancelled`, `completed`.
*   **Pago**: `payment_status` (`pending`, `completed`).

---

## 3. Consideraciones Técnicas Importantes

### Autenticación
1.  **Token JWT**: Se debe enviar en el header `Authorization: Bearer <TOKEN>`.
2.  **Rol**: Asegúrate de que tu usuario tenga el tipo correcto. *Nota: Existe una inconsistencia entre el modelo (`admin`) y las rutas (`administrador`). Se recomienda verificar el valor exacto en la base de datos o usar 'administrador' al registrarse vía API.*

### Jobs Automáticos
El sistema corre procesos automáticos cada cierto tiempo:
*   `metrics`: Calcula métricas diariamente (2:00 AM).
*   `cleanup`: Cancela viajes expirados cada 30 min.
*   `reminders`: Envía recordatorios cada 6 horas.

En modo **development**, puedes forzarlos manualmente con:
`POST /jobs/run/:jobName` (Ej: `metrics`, `cleanup`, `reminders`).

---

## 4. Sugerencias para el Dashboard
*   **KPI Cards**: Usa los datos de `/metrics/global` para las tarjetas superiores.
*   **Gráficos**: El leaderboard puede usarse para un Top 10 de usuarios más eco-friendly.
*   **Tabla de Usuarios**: Implementa búsqueda por email o nombre usando el listado de `/users`.
*   **Mapa en tiempo real**: Puedes usar `/rides?status=in progress` para mostrar viajes activos en un mapa (si tienes las coordenadas).
