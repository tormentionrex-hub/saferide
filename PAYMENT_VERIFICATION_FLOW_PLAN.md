# Plan: Reorganizar el "complete" hacia PaymentVerification

> **Archivo temporal de contexto.** Resume la conversación sobre rediseñar el
> punto donde se marca un viaje como `completed`, para que las barras
> inferiores ("Rutas" en conductor, "Tu Viaje" en pasajero) sigan redirigiendo
> a las pantallas del flujo de pago hasta que se complete realmente.

---

## 1. Lo que el usuario propuso

> "Me gustaría que al tocar 'Rutas' (conductor) o 'Tu Viaje' (pasajero) en la
> barra inferior, no terminen de mostrar hasta `CurrentTrip.js` /
> `TripInProgress.js`, sino que sigan redirigiendo hasta que en
> `PaymentVerification.js` se dé a 'Continuar'. Lo que pienso es que el
> complete esté hasta ahí: 'Finalizar viaje' solo sea una redirección a
> `PaymentVerification`, y el complete real (tanto en booking como en ride)
> esté en `PaymentVerification`."
>
> "Con ello permitir que al tocar 'Rutas' en `BottomNavigationDriver.js` te
> permita aún redirigir a `WaitingPaymentConfirmation.js`, y en el caso del
> pasajero al tocar 'Tu Viaje' te permita redirigirte aún a `PayForTravel.js`,
> `PayPalCheckoutScreen.js` y `WaitingPaymentConfirmation.js`, al menos
> mientras el viaje aún no esté complete o cancelled."
>
> "En cuanto a los cancelados, estos sigan sin ser afectados sus
> comportamientos en `TripInProgress.js`."

**Pantallas involucradas:**

- `src/screens/pasajero/BuscarViaje.js`
- `src/components/BottomNavigationDriver.js`
- `src/components/BottomNavigationBar.js`
- `src/screens/conductor/CurrentTrip.js`
- `src/screens/pasajero/TripInProgress.js`
- `src/screens/conductor/PaymentVerification.js`
- `src/screens/pasajero/WaitingPaymentConfirmation.js`
- `src/screens/pasajero/PayForTravel.js`
- `src/screens/pasajero/PayPalCheckoutScreen.js`

---

## 2. Cómo funciona hoy (estado actual)

### 2.1 `BuscarViaje.handleSearch` (pasajero)

Antes de redirigir a `ListOfDrivers` hace 4 chequeos sobre `/bookings`, en este
orden:

1. **Cobro pendiente** — `status: 'completed'` + `payment_status: 'pending'` +
   `charged_amount > 0` → bloquea y manda a `PendingPayment`.
2. **Booking `confirmed`** → "Ya estás abordo en otro viaje" → bloquea.
3. **Booking `pending`** — si tiene más de 3 min, lo auto-elimina; si no,
   "Solicitud pendiente" → bloquea.
4. **`payment_status === 'pending'`** (en cualquier booking) → "Cobro
   pendiente" → bloquea.

### 2.2 `BottomNavigationDriver.js` → "Rutas"

(Hipótesis basada en el flujo, no leído en esta conversación)

Consulta `sessionCache.getActiveRides()`:

- Si hay alguno con `status: 'in progress'` → `CurrentTrip`.
- Si solo hay `scheduled` → `ManageRides`.

### 2.3 `BottomNavigationBar.js` → "Tu Viaje" (pasajero)

(Similar hipótesis)

Consulta bookings:

- Si hay `confirmed` con ride `in progress` → `TripInProgress`.
- Si no → `SearchRide` / `BuscarViaje`.

### 2.4 Flujo "Finalizar viaje" hoy

1. Conductor en `CurrentTrip` toca **Finalizar viaje** →
   `PATCH /rides/:id/complete` → `ride.status = 'completed'` →
   `navigation.replace('PaymentVerification', { rideId })`.
2. Backend al marcar ride completed probablemente también marca los bookings
   como `completed` (por eso `TripInProgress` del pasajero detecta
   `booking.status === 'completed'` y salta a `PayForTravel`).
3. Pasajero en `TripInProgress` polling de `/bookings/:id` cada 4s:
   - `payment_type === 'gifted'` → `replace('RateDriver', { gifted: true })`.
   - `payment_status === 'paid'` → `replace('RateDriver', { paidConfirmed: true })`.
   - Caso pendiente → `replace('PayForTravel')`.
4. Pasajero en `PayForTravel`:
   - Continuar → `WaitingPaymentConfirmation` (polling de `payment_status`).
   - PayPal → `PayPalCheckoutScreen` → tras capture →
     `WaitingPaymentConfirmation`.
5. Conductor en `PaymentVerification` Continuar → `PATCH /bookings/:id/payment`
   por cada uno → `RatePassenger`.

---

## 3. Por qué la propuesta tal cual rompe cosas

Si solo movemos el `complete` a PaymentVerification sin tocar nada más,
cambia la semántica de `ride.status === 'in progress'`. Eso impacta a:

1. **`TripInProgress.js` (pasajero)** detecta `booking.status === 'completed'`
   para redirigir a PayForTravel. Si el booking no se completa, el pasajero
   queda atrapado en "Viaje en Curso" con el mapa y GPS del conductor
   mientras el conductor está en PaymentVerification, sin enterarse de que
   el viaje terminó.
2. **`ManageRides`** filtra por `status === 'scheduled' || 'in progress'` —
   el viaje "finalizado pero sin verificar pago" seguiría apareciendo como
   activo.
3. **`useLocationTracker` del conductor en `CurrentTrip`** sigue enviando
   GPS aunque ya llegó.
4. **`BuscarViaje`** checks 2 y 3 bloquean al pasajero por `confirmed`/`pending`
   — en realidad eso lo querés (no debería buscar nuevo viaje hasta pagar),
   pero el mensaje "Ya estás abordo en otro viaje" sería falso.
5. **`PaymentVerification`** hoy carga bookings con
   `status: 'confirmed' | 'completed' | 'cancelled'`. Si siguen como
   `confirmed`, sigue funcionando, pero el código que filtra `gifted` y
   otros asume que `completed` ya pasó.

---

## 4. Opciones evaluadas

### Opción A — Status nuevo en el ride: `awaiting_payment_verification`

**La más limpia arquitectónicamente.**

#### Mecánica

- Conductor "Finalizar viaje" → `PATCH /rides/:id/start-verification` → ride
  pasa a `awaiting_payment_verification`. Bookings siguen `confirmed`.
- PaymentVerification "Continuar" → llama al complete real del ride +
  actualiza `payment_status` de bookings → bookings pasan a `completed`.
- `TripInProgress` pasajero: detecta
  `ride.status === 'awaiting_payment_verification'` → redirige a PayForTravel
  (o ramificación gifted/paid).
- Navbars: si `ride.status === 'awaiting_payment_verification'`:
  - Conductor → PaymentVerification.
  - Pasajero → paso de pago que le toca según `booking.payment_status`.
- `ManageRides`: excluye `awaiting_payment_verification` de "activos" o lo
  muestra con badge distinto.
- `BuscarViaje`: agrega chequeo nuevo.

#### Backend requerido

- **Sí, requiere cambios de backend.**
- Nuevo status en el enum del modelo Ride.
- Endpoint nuevo (`/rides/:id/start-verification`) o flag en `complete`.
- Migración de datos: rides ya cancelados/completados quedan sin el nuevo
  status (no debería romper nada porque solo afecta a rides activos).

#### Pros

- Estado semánticamente correcto en BD.
- Cualquier consulta histórica/analítica refleja el flujo real.
- No hay flags paralelos que mantener sincronizados.

#### Contras

- Requiere coordinar cambios frontend + backend.
- Hay que actualizar todas las queries que filtran por status en backend
  (rides activos, métricas, dashboards de admin si los hay).

---

### Opción B — Flag separado en el ride: `payment_verification_completed: boolean`

**Menos invasiva en backend. Recomendación inicial.**

#### Mecánica

- `complete` sigue marcando ride como `completed` + bookings como `completed`
  (como hoy), **pero añade** `payment_verification_completed: false`.
- PaymentVerification Continuar setea `payment_verification_completed: true`.
- Navbars y pantallas leen este flag para enrutar al paso correcto:
  - Conductor: ride `completed` + `payment_verification_completed: false` →
    PaymentVerification.
  - Pasajero: booking `completed` + `payment_status: pending` → PayForTravel
    (ya existe esta lógica como "Cobro pendiente").
- `TripInProgress` y `CurrentTrip` mantienen su lógica actual (el ride se
  marca completed cuando físicamente termina).

#### Backend requerido

- **Sí, pero mínimo.**
- Un campo booleano nuevo en el modelo Ride, con default `true` para rides
  existentes (así no aparecen como "pendientes de verificar").
- En el endpoint `/complete` setear el flag a `false`.
- Endpoint nuevo o reutilizar uno para setear a `true` desde PaymentVerification.

#### Pros

- No cambia la semántica del status.
- Compatible con todas las consultas existentes (ManageRides, métricas,
  historiales) — un ride `completed` sigue siendo `completed`.
- Migración trivial (default true para datos viejos).
- El resto de la app sigue tratando el ride como completado.

#### Contras

- Hay un flag adicional que mantener sincronizado.
- Hay que tocar todas las pantallas que enrutan post-complete y agregar
  este check.
- El concepto de "ride completado pero con verificación pendiente" puede
  confundir a futuros desarrolladores si no se documenta.

---

### Opción C — Solo frontend, AsyncStorage por dispositivo

**La más rápida pero frágil.**

#### Mecánica

- Cuando conductor entra a PaymentVerification, guardar en AsyncStorage
  `pendingPaymentVerification: rideId`.
- Navbar "Rutas" lee primero AsyncStorage; si hay rideId, redirige a
  PaymentVerification.
- Limpia el AsyncStorage al apretar Continuar.
- Para el pasajero, similar con AsyncStorage tras llegar a PayForTravel,
  PayPalCheckout o WaitingPaymentConfirmation.

#### Backend requerido

- **Ninguno.**

#### Pros

- Cero cambios de backend.
- Implementación rápida (1-2 archivos por lado).
- No afecta semántica de status ni schemas.

#### Contras

- **Frágil**: si el usuario reinstala la app, cambia de teléfono, o limpia
  storage, pierde el contexto.
- Como mientras tanto el booking sigue `completed` + `payment_status: pending`,
  el chequeo 1 de `BuscarViaje` lo agarra como "Cobro pendiente" y lo manda
  a `PendingPayment` — eso es un fallback decente pero no exactamente lo
  que el usuario pidió (no lo manda a `WaitingPaymentConfirmation` si estaba
  en esa pantalla).
- No funciona en multi-dispositivo (usuario inicia sesión en otro celular,
  no ve el estado pendiente).
- Es estado oculto que debuggear es más difícil.

---

## 5. Recomendación

**Opción B** es el mejor equilibrio:

- Backend mínimo (un campo booleano).
- No cambia semántica del status (no rompe ManageRides ni métricas).
- Permite que cada pantalla decida si lee o no el flag.
- Migración trivial.

**Opción A** es la más "correcta" arquitectónicamente pero requiere más
coordinación.

**Opción C** sirve si no se quiere tocar backend, pero acepta pérdida de
resiliencia entre dispositivos/reinstalaciones.

---

## 6. Notas sobre cancelados (todas las opciones)

El flujo de cancelación está protegido porque `status === 'cancelled'` se
evalúa **antes** que `'in progress'` en todas las pantallas. Mientras no se
toque esa rama (y en ninguna de las 3 opciones es necesario), el
comportamiento actual de `TripInProgress` (`isCancellingRef`, modales,
navegación a `DashboardPasajero`) se mantiene intacto.

---

## 7. Pendiente de decisión

El usuario debe elegir entre A, B o C. Una vez elegida, los cambios
concretos a hacer en cada pantalla se diseñan a partir de la opción elegida.
