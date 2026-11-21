# Documentación Completa del API de SafeRide

Esta documentación detalla todos los endpoints disponibles en el backend de SafeRide, organizados por módulos.

## Información General
*   **Base URL**: `http://localhost:8080/api/v1`
*   **Formato de Datos**: JSON
*   **Autenticación**: JWT (Bearer Token) en el header `Authorization`.
    *   Ejemplo: `Authorization: Bearer <tu_token_aqui>`

---

## 🔐 1. Autenticación (`/auth`)

| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/auth/register` | Público | Registra un nuevo usuario (pasajero, conductor o administrador). |
| POST | `/auth/login` | Público | Autentica un usuario y devuelve los tokens de acceso y refresco. |
| POST | `/auth/refresh` | Público | Genera un nuevo Access Token usando un Refresh Token. |
| POST | `/auth/logout` | Privado | Invalida la sesión actual del usuario. |
| GET | `/auth/me` | Privado | Obtiene la información del perfil del usuario autenticado. |
| POST | `/auth/send-verification-code` | Público | Envía un código de 6 dígitos al correo del usuario. |
| POST | `/auth/verify-code` | Público | Verifica si el código enviado al correo es válido. |
| POST | `/auth/reset-password` | Público | Restablece la contraseña usando el código de verificación. |
| PUT | `/auth/password` | Privado | Cambia la contraseña actual por una nueva. |
| POST | `/auth/push-token` | Privado | Registra o actualiza el token de notificaciones push (Expo). |

---

## 👥 2. Usuarios (`/users`)

| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/users` | Admin | Obtiene una lista paginada de todos los usuarios registrados. |
| GET | `/users/profile` | Privado | Obtiene el perfil completo del usuario autenticado. |
| PUT | `/users/profile` | Privado | Actualiza los datos del perfil propio. |
| GET | `/users/:id` | Privado | Obtiene los detalles públicos de cualquier usuario. |
| PUT | `/users/:id` | Privado | Actualiza un usuario específico (usualmente restringido al propio usuario). |
| POST | `/users/:id/image` | Privado | Sube o cambia la foto de perfil (Multipart/form-data). |
| DELETE | `/users/:id` | Admin | Elimina un usuario del sistema permanentemente. |
| GET | `/users/:id/stats` | Privado | Obtiene las estadísticas de viajes y sostenibilidad de un usuario. |

---

## 🚗 3. Vehículos (`/vehicles`)

| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/vehicles` | Conductor | Registra un nuevo vehículo para el conductor. |
| GET | `/vehicles/:id` | Privado | Obtiene los detalles de un vehículo por su ID. |
| PUT | `/vehicles/:id` | Conductor | Actualiza la información de un vehículo registrado. |
| DELETE | `/vehicles/:id` | Conductor/Admin | Elimina un vehículo del sistema. |
| GET | `/vehicles/driver/:driverId` | Privado | Lista todos los vehículos vinculados a un conductor específico. |
| POST | `/vehicles/:id/image` | Conductor | Sube una fotografía del vehículo. |

---

## 🛣️ 4. Viajes (`/rides`)

| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/rides` | Conductor | Crea un nuevo viaje disponible. |
| GET | `/rides` | Público | Busca viajes disponibles (permite filtros por origen, destino, fecha). |
| GET | `/rides/:id` | Público | Obtiene los detalles completos de un viaje, incluyendo reservaciones. |
| PUT | `/rides/:id` | Conductor | Edita los detalles de un viaje (antes de iniciar). |
| PATCH | `/rides/:id/start` | Conductor | Cambia el estado del viaje a "in progress". |
| PATCH | `/rides/:id/complete` | Conductor | Finaliza el viaje y actualiza las métricas. |
| PATCH | `/rides/:id/cancel` | Conductor | Cancela el viaje y notifica a los pasajeros. |
| GET | `/rides/driver/:driverId` | Privado | Historial de viajes creados por un conductor. |

---

## 📅 5. Reservaciones (`/bookings`)

| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/bookings` | Pasajero | Crea una solicitud de reserva en un viaje. |
| GET | `/bookings` | Privado/Admin | Lista las reservaciones (Propias o todas si es Admin). |
| GET | `/bookings/:id` | Privado | Detalles de una reservación específica. |
| DELETE | `/bookings/:id` | Pasajero | Cancela una reserva antes de que el viaje inicie. |
| PATCH | `/bookings/:id/canceled` | Conductor | El conductor cancela una reserva confirmada. |
| PATCH | `/bookings/:id/status` | Conductor/Admin | Cambia el estado de la reserva (`confirmed`, `completed`). |
| PATCH | `/bookings/:id/payment` | Conductor/Admin | Confirma que el pasajero ha pagado. |
| GET | `/bookings/passenger/:passengerId`| Privado | Lista las reservaciones de un pasajero. |
| GET | `/bookings/ride/:rideId` | Conductor | Lista todas las reservaciones vinculadas a un viaje. |

---

## 📈 6. Métricas (`/metrics`)

| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/metrics/global` | Admin | Obtiene las estadísticas acumuladas de todo el sistema. |
| GET | `/metrics/user/:userId` | Privado | Obtiene las métricas de sostenibilidad detalladas de un usuario. |
| GET | `/metrics/leaderboard` | Público | Ranking de usuarios por mayor impacto ecológico. |
| POST | `/metrics/calculate/:userId` | Admin | Fuerza el recálculo manual de las métricas de un usuario. |

---

## 💬 7. Reseñas y Calificaciones (`/reviews`)

| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/reviews` | Privado | Crea una calificación para un conductor o pasajero tras un viaje. |
| GET | `/reviews/user/:userId` | Privado | Lista todas las reseñas recibidas por un usuario. |
| GET | `/reviews/ride/:rideId` | Privado | Obtiene las reseñas vinculadas a un viaje específico. |

---

## 🔔 8. Notificaciones (`/notifications`)

| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/notifications` | Privado | Obtiene la lista de notificaciones del usuario autenticado. |
| PATCH | `/notifications/:id/read` | Privado | Marca una notificación específica como leída. |
| PATCH | `/notifications/read-all` | Privado | Marca todas las notificaciones del usuario como leídas. |

---

## 📍 9. Localización (`/location`)

| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/location/update` | Privado | Actualiza las coordenadas actuales (lat/lng) del usuario. |

---

## 🛠️ 10. Utilidades (Modo Dev)

| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/health` | Público | Verifica si el API y la base de datos están activos. |
| POST | `/jobs/run/:jobName`| Dev | Ejecuta manualmente tareas de fondo (`metrics`, `cleanup`, `reminders`). |
