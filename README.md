<p align="center">
  <img src="backend/public/safe-ride-logo-inverted.png" alt="SafeRide" width="160">
</p>

<h1 align="center">SafeRide</h1>

<p align="center">
  Carpooling corporativo para Costa Rica: compañeros de una misma empresa comparten el viaje al trabajo,
  pagan menos y reducen tráfico y emisiones.
</p>

<p align="center">
  <img alt="Expo SDK 54" src="https://img.shields.io/badge/Expo-SDK%2054-000020">
  <img alt="React Native 0.81" src="https://img.shields.io/badge/React%20Native-0.81-61DAFB">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB">
  <img alt="Vite 8" src="https://img.shields.io/badge/Vite-8-646CFF">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%E2%89%A518-339933">
  <img alt="Express 5" src="https://img.shields.io/badge/Express-5-000000">
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-Cosmos%20DB-47A248">
</p>

---

## Qué es SafeRide

SafeRide conecta a **conductores** que tienen asientos libres con **pasajeros** de la misma empresa que van al
mismo destino. Solo se registran personas con **correo corporativo** (los correos personales como Gmail o
Hotmail se rechazan), así que cada quien viaja con compañeros de trabajo verificados.

- **El conductor** publica su ruta, la hora y los asientos libres; acepta o rechaza solicitudes; inicia el
  viaje, comparte su ubicación en vivo y, al llegar, confirma quién pagó.
- **El pasajero** busca viajes hacia su destino, ofrece un monto, espera la aceptación, sigue el carro en el
  mapa y paga en efectivo, por SINPE Móvil o (en beta) en línea.
- **Ambos** se califican al terminar, ven su historial y sus métricas de kilómetros compartidos y CO₂ ahorrado.
- **El administrador** supervisa todo desde un panel web: usuarios, conductores y sus vehículos, reservas y
  pagos, viajes en curso en un mapa, quejas, notificaciones y un registro de auditoría de cada acción sensible.

Este repositorio contiene el proyecto completo:

| Carpeta | Qué es | Tecnología |
|---|---|---|
| [`frontend/`](frontend) | App móvil para Android e iOS | Expo SDK 54, React Native 0.81, React Navigation |
| [`Administrador-SafeRide/`](Administrador-SafeRide) | Panel web de administración | Vite, React 19, React Router, Recharts, Leaflet |
| [`backend/`](backend) | API REST y trabajos programados, compartida por la app y el panel | Node.js, Express 5, MongoDB (Azure Cosmos DB), Mongoose |
| [`docs/`](docs) | Capturas de pantalla usadas en este README | |

El historial de commits de la app y del backend se conserva completo. El panel se incorporó desde su
repositorio original (rama `dev`) como copia de archivos, sin su historial, porque ese historial incluye
credenciales que no deben publicarse.

## Créditos

- **Aplicación móvil:** Christopher González.
- **Panel administrativo:** Keylor David y Naomy González.

---

## Progreso del proyecto

Estado al 23 de noviembre de 2026.

<p align="center">
  <img src="docs/progreso-proyecto.png" alt="Progreso del proyecto: aplicación móvil 92 %, backend 93 %, panel de administrador 90 %" width="900">
</p>

| Parte | Progreso |
|---|---|
| Aplicación móvil (frontend) | **92 %** |
| Backend | **93 %** |
| Panel de administrador | **90 %** |

### Qué falta para llegar al 100 %

**Aplicación móvil (92 %)**
1. Pantalla para que el conductor suba sus 6 documentos (cédula, licencia, póliza, marchamo, RTV y tarjeta
   de circulación). El panel exige los 6 aprobados para activar el vehículo y hoy la app solo envía la póliza.
2. Generar la app instalable y probarla en teléfonos reales; hasta ahora se probó en Expo Go.
3. Activar los pagos en línea: PayPal y tarjeta están listos en beta, falta la cuenta de comercio.
4. Clave de Google Maps de producción para el mapa nativo.
5. Publicar en Google Play y App Store.

**Backend (93 %)**
1. Publicarlo en la nube con dominio HTTPS y la base de producción.
2. Almacenamiento privado de archivos (Azure Blob) para guardar los documentos que suben los conductores.
3. Lectura automática de las fotos de los documentos; hoy se validan los datos con reglas.
4. Actualizar 6 dependencias con vulnerabilidades conocidas, ninguna crítica.
5. Reparar una prueba vieja de inicio de sesión que apunta a la base real.

**Panel de administrador (90 %)**
1. Publicarlo en un hosting con dominio propio.
2. Ver las imágenes reales de los documentos; depende del almacenamiento del backend.
3. Cambiar las claves de Gmail y Gemini que quedaron públicas en el repositorio original del panel (urgente).
4. Corregir 36 avisos del revisor de código, casi todos de estilo en hooks de React.
5. Probar a mano dos flujos: el borrado con anonimización y «Añadir vehículo».

---

## Capturas de la app móvil

Tomadas en un Samsung Galaxy A34 real con Expo Go durante las pruebas de la entrega.

### Registro e inicio de sesión

| Inicio de sesión | Elegir rol | Verificación del correo |
|:---:|:---:|:---:|
| <img src="docs/screenshots/01-inicio-sesion.jpg" width="230"> | <img src="docs/screenshots/02-elegir-rol.jpg" width="230"> | <img src="docs/screenshots/03-pin-verificacion.jpg" width="230"> |

### Pasajero: buscar y reservar

| Inicio | Buscar viaje | Autocompletado de destino |
|:---:|:---:|:---:|
| <img src="docs/screenshots/04-inicio-pasajero.jpg" width="230"> | <img src="docs/screenshots/05-buscar-viaje.jpg" width="230"> | <img src="docs/screenshots/06-autocompletado.jpg" width="230"> |

| Detalle y oferta | Esperando al conductor | Viaje confirmado |
|:---:|:---:|:---:|
| <img src="docs/screenshots/07-detalle-viaje.jpg" width="230"> | <img src="docs/screenshots/08-esperando-respuesta.jpg" width="230"> | <img src="docs/screenshots/09-viaje-confirmado.jpg" width="230"> |

### Pasajero: viaje, pago y calificación

| Viaje en curso | Método de pago | Pago con tarjeta (beta) | Calificar |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/10-viaje-en-curso.jpg" width="175"> | <img src="docs/screenshots/11-metodo-de-pago.jpg" width="175"> | <img src="docs/screenshots/12-pago-tarjeta-beta.jpg" width="175"> | <img src="docs/screenshots/13-calificar.jpg" width="175"> |

### Conductor

| Inicio | Publicar viaje | Viaje en curso | Editar viaje |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/14-inicio-conductor.jpg" width="175"> | <img src="docs/screenshots/15-publicar-viaje.jpg" width="175"> | <img src="docs/screenshots/16-gestionar-viaje.jpg" width="175"> | <img src="docs/screenshots/17-editar-viaje.jpg" width="175"> |

### Historial, métricas y cuenta

| Historial del conductor | Métricas | Notificaciones | Modo oscuro | Perfil |
|:---:|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/18-historial-conductor.jpg" width="140"> | <img src="docs/screenshots/19-metricas.jpg" width="140"> | <img src="docs/screenshots/20-notificaciones.jpg" width="140"> | <img src="docs/screenshots/21-modo-oscuro.jpg" width="140"> | <img src="docs/screenshots/22-perfil.jpg" width="140"> |

## Capturas del panel de administración

Tomadas en el navegador con datos de prueba, a 1440 × 900 y reducidas a 1280 px de ancho.

### Acceso y vista general

| Inicio de sesión | Panel principal |
|:---:|:---:|
| <img src="docs/screenshots/panel/01-inicio-sesion.jpg" width="420"> | <img src="docs/screenshots/panel/02-inicio.jpg" width="420"> |

### Personas y vehículos

| Pasajeros | Conductores |
|:---:|:---:|
| <img src="docs/screenshots/panel/03-usuarios.jpg" width="420"> | <img src="docs/screenshots/panel/04-conductores.jpg" width="420"> |

| Vehículos y documentos | Monitoreo de viajes en curso |
|:---:|:---:|
| <img src="docs/screenshots/panel/05-vehiculos.jpg" width="420"> | <img src="docs/screenshots/panel/08-monitoreo.jpg" width="420"> |

### Reservas y pagos

| Reservas | Pagos |
|:---:|:---:|
| <img src="docs/screenshots/panel/06-reservas.jpg" width="420"> | <img src="docs/screenshots/panel/07-pagos.jpg" width="420"> |

### Soporte y control

| Notificaciones | Quejas |
|:---:|:---:|
| <img src="docs/screenshots/panel/09-notificaciones.jpg" width="420"> | <img src="docs/screenshots/panel/10-quejas.jpg" width="420"> |

| Auditoría | Configuración | Mi perfil |
|:---:|:---:|:---:|
| <img src="docs/screenshots/panel/11-auditoria.jpg" width="280"> | <img src="docs/screenshots/panel/12-configuracion.jpg" width="280"> | <img src="docs/screenshots/panel/13-mi-perfil.jpg" width="280"> |

---

## Flujo de un viaje

```mermaid
flowchart TD
    A[Registro con correo corporativo] --> B[PIN de verificación por correo]
    B --> C{Rol}
    C -->|Conductor| D[Registra su vehículo]
    C -->|Pasajero| E[Busca un viaje: origen, destino, fecha]
    D --> F[Publica el viaje: ruta, hora, asientos]
    F --> G[(Viaje programado)]
    E --> G
    G --> H[Pasajero solicita asiento y ofrece un monto]
    H --> I{Conductor responde}
    I -->|Rechaza o no responde en 2 min| E
    I -->|Acepta| J[Reserva confirmada]
    J --> K[Conductor inicia el viaje]
    K --> L[Ubicación del conductor en vivo en el mapa del pasajero]
    L --> M[Conductor finaliza el viaje]
    M --> N[Pasajero paga: efectivo, SINPE Móvil o en línea]
    N --> O[Conductor verifica quién pagó]
    O --> P[Se califican mutuamente]
    P --> Q[Historial, métricas y TrustScore actualizados]
```

**Estados de una reserva:** `pending` → `confirmed` → `completed`, con salidas a `deny` (el conductor rechaza)
o `cancelled` (el pasajero cancela antes de que el carro salga). Una vez que el viaje inició, una reserva
confirmada ya no se puede cancelar, y quien tiene un cobro pendiente no puede reservar otro viaje hasta pagarlo.

---

## Panel de administración

El panel es una aplicación web aparte, en [`Administrador-SafeRide/`](Administrador-SafeRide), que usa **la misma API** que la app
móvil. No tiene base de datos propia: todo lo que muestra y cada cambio que hace pasa por el backend, que
valida que quien llama sea administrador.

| Sección | Qué permite |
|---|---|
| Panel principal | Totales de usuarios, viajes, kilómetros y CO₂, reservas por día, distribución de pagos y usuarios por rol |
| Pasajeros y Conductores | Buscar, filtrar por inicial, ver el perfil completo, activar o desactivar cuentas, ajustar el TrustScore y borrar definitivamente |
| Vehículos | Inventario de la flota y revisión de los 6 documentos del conductor (cédula, licencia, póliza, marchamo, RTV y tarjeta de circulación); el vehículo se activa solo cuando los 6 están aprobados |
| Reservas | Todas las reservas con filtros por estado, pago, método y fechas, y búsqueda por pasajero o conductor |
| Pagos | Totales cobrados, pagados, pendientes y exonerados, y el detalle de cada cobro |
| Monitoreo | Mapa con los viajes en curso y la última posición de cada conductor |
| Notificaciones y Quejas | Avisos del sistema; las quejas se guardan en el backend y se responden o se marcan como atendidas desde el panel |
| Auditoría | Registro de cada acción sensible de un administrador: quién, qué, sobre qué y cuándo |
| Configuración y Mi perfil | Meta mensual de carbono ahorrado, preferencias, cambio de contraseña y cerrar todas las sesiones |

### Flujo del administrador

```mermaid
flowchart TD
    A[Administrador abre el panel] --> B[Inicia sesión con su correo institucional]
    B --> C{¿La cuenta es de administrador?}
    C -->|No| D[Acceso denegado: se limpia la sesión y vuelve al inicio de sesión]
    C -->|Sí| E[Panel principal con los totales del sistema]
    E --> F[Pasajeros y Conductores]
    E --> G[Vehículos y documentos]
    E --> H[Reservas y Pagos]
    E --> I[Monitoreo en vivo]
    E --> J[Quejas y Notificaciones]
    F --> F1[Activar, desactivar, ajustar TrustScore o borrar definitivamente]
    G --> G0[Validación automática por reglas cada 10 minutos]
    G0 --> G1[Aprobar, rechazar o pedir reenvío con motivo]
    G1 --> G2[Con los 6 documentos aprobados, el vehículo se activa]
    J --> J1[Responder o marcar como atendida]
    B --> K
    F1 --> K[(Registro de auditoría)]
    G1 --> K
    J1 --> K
    K --> L[Página de Auditoría]
```

El borrado definitivo nunca se aplica sobre uno mismo ni sobre otro administrador, y se bloquea si la persona
tiene viajes o reservas activas o cobros pendientes. Si otros usuarios tienen historial con ella (viajes
compartidos, reseñas), la cuenta se anonimiza en lugar de borrarse, para no romper ese historial.

### Arquitectura del panel

```mermaid
flowchart LR
    subgraph Navegador[Panel web - Administrador-SafeRide/]
        P[Páginas React + React Router]
        RUTA[Ruta privada: solo rol admin]
        SVC[Servicios con Axios y renovación de token]
    end
    subgraph Local[Agente de quejas - scripts/sync_complaints.cjs]
        AG[Servidor local en 127.0.0.1:3001]
    end
    API[Backend SafeRide - la misma API de la app]
    DB[(MongoDB)]
    GMAIL[Correo de soporte por IMAP y SMTP]
    IA[Gemini: clasifica y redacta respuestas]

    JOBS[Trabajo programado: validación de documentos]

    P --> RUTA --> SVC --> API --> DB
    JOBS --> DB
    AG -.opcional.-> GMAIL
    AG --> IA
```

- **Acceso:** el panel solo deja entrar a cuentas con rol de administrador; si un pasajero o conductor
  intenta usarlo, se limpia la sesión y vuelve al inicio de sesión. Aun así, el control real está en el
  backend: cada ruta de administración vuelve a comprobar el rol.
- **Datos en pantalla:** los nombres y textos que escriben los usuarios se escapan antes de insertarse en
  cualquier diálogo, para que nadie pueda ejecutar código en la sesión del administrador poniendo HTML en su
  nombre.
- **Quejas:** se guardan en el backend (`/complaints`) y el panel las lista, responde y marca como atendidas.
  El agente local de correo (`scripts/sync_complaints.cjs`) queda como herramienta opcional: lee el correo de
  soporte, usa Gemini para clasificar y proponer respuestas, escucha solo en `127.0.0.1` y solo responde a
  quien escribió.
- **Documentos:** un trabajo programado valida cada 10 minutos los documentos pendientes con reglas (datos
  presentes, fechas vigentes, que coincidan con el conductor y el vehículo). Lo que no se puede decidir solo
  queda para revisión manual del administrador.
- **Auditoría:** se registran los inicios de sesión del panel, la revisión de documentos y quejas, la
  aprobación de vehículos, los cambios de cuenta y de TrustScore, y el borrado definitivo.

---

## Arquitectura

```mermaid
flowchart LR
    subgraph Telefono[App móvil - frontend/]
        UI[Pantallas React Native]
        AX[Cliente HTTP con renovación de token]
    end
    subgraph Web[Panel de administración - Administrador-SafeRide/]
        PA[Páginas React]
    end
    subgraph API[Backend - backend/]
        EX[Express 5 + validación + rate limit]
        JOB[Trabajos programados: recordatorios, limpieza, métricas]
    end
    DB[(MongoDB / Azure Cosmos DB)]
    GM[Google Maps: rutas, Places, geocodificación]
    PP[PayPal Orders API]
    EXPO[Expo Push]

    UI --> AX --> EX
    PA -->|solo rol admin| EX
    EX --> DB
    JOB --> DB
    EX -->|proxy con clave del servidor| GM
    EX --> PP
    EX --> EXPO
```

- **Estado en vivo:** las pantallas de espera, de viaje en curso y la ubicación del conductor se actualizan
  consultando la API cada pocos segundos, y se pausan cuando la app pasa a segundo plano.
- **Autenticación:** JWT de acceso (1 h) y de renovación, con rotación y revocación guardando solo el hash
  del token. Cada token lleva una versión de sesión: recuperar la contraseña o "cerrar todas las sesiones"
  invalida todos los tokens anteriores. Límites de peticiones por usuario y por IP.
- **Registro verificado:** la cuenta solo se crea si el correo corporativo se verificó antes con el PIN de 6
  dígitos, que tiene un tope de intentos y no sirve dos veces.
- **Entradas:** una capa global rechaza cualquier operador de base de datos (`$`) en lo que se envía, y cada
  ruta valida tipos, largos y rangos; los nombres no aceptan HTML.
- **Google Maps va por el backend:** la app no lleva en el bundle la clave de rutas, Places ni geocodificación;
  el backend hace de proxy con su propia clave restringida. La app solo usa la clave del SDK nativo del mapa.
- **Pagos:** el efectivo y SINPE Móvil funcionan completos. El pago en línea (PayPal, tarjeta, Apple Pay,
  Google Pay) está construido y probado contra el sandbox de PayPal, pero se entrega en **estado beta**
  detrás de la bandera `ONLINE_PAYMENTS_LIVE` en
  [`PayPalCheckoutScreen.js`](frontend/src/screens/pasajero/PayPalCheckoutScreen.js): se ve el formulario
  y el botón Pagar queda en gris con el aviso de beta.

---

## Estructura

```
saferide/
├── frontend/                 App móvil (Expo)
│   ├── App.js                Navegación: pila de conductor y de pasajero
│   ├── app.config.js         Configuración de Expo y EAS
│   ├── src/screens/          pasajero/, conductor/, register/
│   ├── src/components/       Checkout, mapas, modales, selector de ubicación
│   ├── src/services/         Cliente de la API y servicios por módulo
│   ├── src/context/          Tema claro/oscuro
│   └── __tests__/            Pruebas con Jest
├── Administrador-SafeRide/   Panel web de administración (Vite + React)
│   ├── src/pages/            Inicio, Pasajeros, Conductores, Vehículos, Reservas, Pagos, Monitoreo, ...
│   ├── src/components/       Tablas, modales de perfil, revisión de documentos, rutas privadas
│   ├── src/services/         Cliente de la API y servicios por módulo
│   └── scripts/              Agente local de quejas (sync_complaints.cjs)
├── backend/                  API REST
│   ├── server.js
│   ├── src/routes/           auth, rides, bookings, reviews, maps, paypal, ...
│   ├── src/controllers/      Lógica de negocio
│   ├── src/models/           Esquemas de Mongoose
│   ├── src/jobs/             Recordatorios, limpieza y métricas programadas
│   ├── src/scripts/          initDatabase.js (datos de prueba)
│   └── scripts/qa/           Pruebas de ataques y de flujos contra la API
└── docs/screenshots/         Capturas de la app y, en panel/, del panel
```

Documentación más detallada de la API en [`backend/README.md`](backend/README.md) y
[`backend/ENDPOINTS.md`](backend/ENDPOINTS.md).

---

## Cómo correrlo en local

Requisitos: Node.js 18 o superior, una base MongoDB (Azure Cosmos DB o local) y la app **Expo Go** del
SDK 54 en el teléfono.

### 1. Backend

```bash
cd backend
cp .env.example .env        # completar COSMOS_CONNECTION_STRING, JWT_SECRET, REFRESH_TOKEN_SECRET, ...
npm install
npm run db:init             # opcional: crea usuarios y viajes de prueba
npm start                   # http://localhost:8080/api/v1
```

Usa una base de pruebas (`COSMOS_DATABASE=...`) distinta de la de producción: `db:init` y los scripts de QA
crean y modifican datos.

### 2. App móvil

```bash
cd frontend
cp .env.example .env        # EXPO_PUBLIC_API_URL puede quedar vacía en desarrollo
npm install
npm start                   # escanear el QR con Expo Go
```

Si `EXPO_PUBLIC_API_URL` queda vacía, en desarrollo la app usa la IP de la PC que sirve Expo en el puerto 8080.
Con el teléfono por USB también funciona `adb reverse tcp:8080 tcp:8080`. Para verla sin teléfono, `npm run web`
la abre en el navegador (el mapa no se dibuja en web).

### 3. Panel de administración

```bash
cd Administrador-SafeRide
cp .env.example .env        # VITE_API_URL apunta al backend (por defecto http://localhost:8080/api/v1)
npm install
npm run dev                 # http://localhost:5173, entrar con una cuenta de rol admin
npm run sync-complaints     # opcional: agente local de quejas (necesita SUPPORT_EMAIL y GEMINI_API_KEY)
```

### 4. Pruebas

```bash
cd frontend    && npm test             # 75 pruebas unitarias de la app
cd backend     && npm run qa:ataques   # 348 casos: permisos, inyección, carreras, tokens, límites, archivos
cd backend     && npm run qa:flujos    # 114 casos: ciclo de viaje, reservas, pagos, reseñas, documentos, auditoría
cd Administrador-SafeRide && npm run build        # compilación del panel
```

Los scripts de QA necesitan el backend corriendo contra la base de pruebas; ver
[`backend/scripts/qa/README.md`](backend/scripts/qa/README.md).

---

## Qué se hizo en la entrega (octubre 2026)

### Funcionalidad terminada
- Checkout de pago con tarjeta, PayPal, Apple Pay y Google Pay, con los colores de SafeRide; el flujo real de
  PayPal funciona en sandbox y se entrega en beta.
- Direcciones, autocompletado de lugares y geocodificación a través del backend, sin claves en la app.
- Listados completos (historial, solicitudes, viajes) sin el límite de 10 resultados.
- Editar un viaje publicado (hora y asientos) y cancelarlo con confirmación en dos pasos.
- Eliminar la cuenta desde la app, como exigen Google Play y App Store; el backend anonimiza los datos y lo
  bloquea si hay viajes activos o cobros pendientes.
- Configuración por entorno y proyecto de EAS listo para generar los binarios.

### Cinco rondas de QA

| Ronda | Qué se probó | Resultado |
|---|---|---|
| 1. Ataques | 103 ataques contra la API: datos con tipos inválidos, acceso a datos de otros usuarios, escritura de ubicación ajena, carreras al reservar el último asiento, tokens falsificados o vencidos, CORS, Swagger expuesto | 103/103 tras los arreglos |
| 2. Flujos | 93 casos del negocio: reservar, aceptar, iniciar, cancelar en cada estado, pagar, verificar pagos, calificar, conflictos de horario, cobros pendientes | 93/93 tras los arreglos |
| 3. Teléfono real | Recorrido completo de pasajero y conductor en un Galaxy A34, incluyendo diseño, modo oscuro y textos | 9 problemas de pantalla arreglados |
| 4. Revisión crítica | Revisión del código desde cuatro perspectivas con una síntesis final | 3 riesgos arreglados antes de la entrega |
| 5. Regresión | Todo lo anterior otra vez con el código final, más pruebas unitarias y compilación del bundle | Sin fallos |

Algunos de los arreglos que salieron de esas rondas:
- La confirmación y la cancelación de reservas son atómicas: dos pasajeros ya no pueden quedarse con el
  mismo último asiento ni descuadrar el conteo.
- Un pasajero que se cansa de esperar ya no puede cancelar por accidente una reserva que el conductor acababa de
  aceptar.
- El backend hace cumplir las mismas reglas que la app: no se publica un viaje con otro en curso, no se reserva
  con un cobro pendiente, solo califica quien viajó.
- Todos los montos se muestran con el mismo formato de colones (`₡5,022`).

## Auditoría de seguridad e integración del panel (noviembre 2026)

Se atacó a propósito cada endpoint de la API y cada pantalla de la app y del panel. Cada vez que algo cedía,
se reforzó con varias capas de defensa y se volvió a atacar con al menos cuatro variantes del mismo ataque,
hasta que ninguna pasara. Cada variante quedó como prueba automática.

| Qué | Antes | Después |
|---|---|---|
| Ataques automatizados contra la API | 103 | 348, todos rechazados |
| Flujos de negocio automatizados | 93 | 114, todos correctos |
| Pruebas unitarias de la app | 13 | 75 |
| Vulnerabilidades conocidas en dependencias del backend | 28 (3 críticas) | 6, sin críticas |
| Vulnerabilidades conocidas en dependencias del panel | 14 (1 crítica) | 4, sin críticas |
| Rutas que el panel llamaba y no existían en el backend | 10 | 0 |

Lo más importante que se cerró:
- **Pagos:** con un identificador de orden manipulado se podía ordenar un reembolso de PayPal con la cuenta del
  comercio; ahora el identificador, el monto, la moneda y el estado de la captura deben coincidir.
- **Registro:** se podía crear una cuenta sin verificar el correo, lo que dejaba sin efecto el filtro de correo
  corporativo. El PIN de verificación también se podía saltar con un truco de inyección o adivinar a fuerza de
  intentos.
- **Deudas:** un pasajero con un viaje sin pagar podía marcarlo como cancelado y volver a reservar.
- **Panel:** el nombre de un usuario con HTML se ejecutaba en la sesión del administrador; un token de pasajero
  provocaba recargas sin fin; los documentos simulados se podían "aprobar" como si fueran reales; y el agente
  de quejas escuchaba en toda la red sin restricciones.
- **Datos personales:** los teléfonos y correos de conductores eran visibles para cualquier usuario, y en un
  caso sin iniciar sesión.

Integración del panel: se movió a su propia carpeta, se conectó a las diez rutas nuevas del backend
(auditoría, documentos de vehículos, borrado definitivo, cambio de contraseña y cerrar todas las sesiones),
se construyeron las páginas de Reservas y Pagos que estaban sin hacer, se reemplazaron los datos inventados
por datos reales, y las cuentas eliminadas ya no aparecen en los listados salvo que se pidan.

El 22 de noviembre Naomy González integró en `dev` su versión del panel en `Administrador-SafeRide/`, con
quejas en el backend, validación automática de documentos, aprobación de vehículos por documentos, monitoreo
y meta de carbono. Al unir las dos ramas se dejó su trabajo como base y se sumó encima lo de seguridad: en
cada choque quedó su versión. Las pruebas de ataques y de flujos se adaptaron a su modelo de documentos y
auditoría, y se corrigió que un pasajero con reserva activa no pudiera ver el vehículo de su conductor.

---

## Pendiente

Lo que depende de cuentas, credenciales o dinero, y por eso no se activó en esta entrega:

- Pagos en línea en producción: cuenta de comercio de PayPal, tasa de cambio definitiva, Apple Pay y Google Pay.
- Clave de Google Maps de producción para el SDK nativo, restringida al paquete `cr.saferide.app`.
- Backend publicado en la nube con dominio HTTPS.
- Publicación en Google Play y App Store.

- Almacenamiento privado de archivos (Azure Blob) para los documentos de vehículos: sin él, la subida responde
  que el almacenamiento no está configurado.
- Lectura automática (OCR) de las fotos de los documentos: la validación actual revisa los datos registrados con
  reglas, no lee la imagen.

Deuda técnica conocida:
- El tiempo de espera de una solicitud se calcula con el reloj del teléfono, y todo se probó en Expo Go, no en
  el binario final de EAS.
- Seis vulnerabilidades de dependencias del backend (zod, nodemailer, bull, passport-azure-ad) y cuatro del
  agente de quejas del panel (nodemailer, semver) requieren versiones mayores que pueden romper código.
- El panel tiene 25 avisos del revisor de código, sobre todo patrones de hooks de React sin un bug
  identificado.
- Qué viajes ya calificó cada persona se recuerda en el dispositivo; en otro dispositivo, el botón de
  calificar vuelve a aparecer hasta tocarlo, y el backend responde que ya se calificó.
- Si un administrador desactiva un vehículo, el conductor puede registrar otro; la propuesta para bloquearlo
  requiere un campo nuevo y cambios en la app y el panel.
