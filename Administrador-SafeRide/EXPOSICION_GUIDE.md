# 🚗 Guía Completa de Exposición: Admin SafeRide (Recorrido de Páginas Individuales)

Esta guía está diseñada para que puedas exponer el frontend de **Admin SafeRide** explicando a detalle **página por página**, conociendo exactamente **qué hace**, **cómo lo hace a nivel técnico** y **qué decir** sobre cada una para lucirte ante tu audiencia.

---

## 🏛️ 1. Arquitectura Base y Flujo de Datos Global

*   **¿Qué hace?**: Mantiene al administrador seguro y autenticado, distribuye el estado del usuario en toda la app y agiliza la comunicación con la base de datos.
*   **¿Cómo lo hace?**:
    *   **Vite + React**: El proyecto se levanta en un ambiente ultrarrápido y liviano.
    *   **Enrutamiento Inteligente (`routing.jsx`)**: Divide el código usando `React.lazy` para cargar los archivos solo cuando el usuario entra a una página (reduciendo el peso de descarga inicial) y protege los accesos mediante un componente `PrivateRoute` que valida el rol de `"admin"`.
    *   **Axios Interceptor (`api.js`)**: Cuenta con un sistema automatizado de **Refresco Silencioso (Silent Refresh Token)**. Si un token de seguridad expira mientras el administrador está editando algo, el interceptor detiene la consulta fallida, hace una petición en segundo plano para obtener un nuevo token a través de `/auth/refresh` y reintenta el cambio original en milisegundos, ofreciendo una experiencia ininterrumpida y 100% segura.
    *   **Layout Unificado (`AdminLayout.jsx`)**: Sirve como contenedor persistente (Aside de navegación y Header), incorporando la campana de notificaciones y el menú desplegable del perfil de forma centralizada.

---

## 📂 2. Recorrido Detallado Página por Página

---

### 🔐 1. Pantallas de Autenticación (`Login`, `RecuperarPassword`, `NuevoPassword`)
*   **¿Qué hace?**: Controla el acceso seguro al sistema de administración, ofrece flujos de recuperación por correo electrónico mediante códigos temporales y permite establecer una nueva contraseña de administrador de manera segura.
*   **¿Cómo lo hace?**:
    *   Gestiona el estado global de autenticación usando `AuthContext.jsx`.
    *   Llama al endpoint `/auth/login` y almacena el Token JWT y el Refresh Token en el `localStorage` del navegador.
    *   En la recuperación, se interactúa con `/auth/send-verification-code` y `/auth/verify-code` para asegurar que el solicitante realmente tiene acceso al correo institucional.
*   **🗣️ Qué decir**:
    > *"El acceso al panel no es un formulario simple; implementa seguridad por tokens criptográficos de expiración corta (JWT). El flujo de recuperación incluye códigos de un solo uso (OTP) que impiden accesos no autorizados en caso de pérdida de credenciales."*

---

### 📊 2. Panel de Control (`DashboardPage`)
*   **¿Qué hace?**: Es la pantalla de inicio principal. Presenta una vista panorámica del negocio mediante métricas acumuladas (usuarios totales, viajes finalizados, kilómetros recorridos, CO₂ ahorrado), gráficos dinámicos de analítica, alertas de seguridad urgentes, y listados con acceso rápido de actividad reciente.
*   **¿Cómo lo hace?**:
    *   **Consultas Paralelas**: Al iniciar, ejecuta un `Promise.all` para consultar concurrentemente `/metrics/global`, `/vehicles?limit=5` y `/users?limit=5`. Esto reduce el tiempo de espera cargando toda la pantalla simultáneamente.
    *   **Gráficos Interactivos con Recharts**: Dibuja gráficos fluidos e interactivos con animaciones al pasar el cursor (líneas de tiempo de reservas y donas tricolores con estados de pago y roles de usuario).
    *   **Botón SOS de Emergencia**: Muestra una sección con alertas de seguridad críticas en vivo. Si el administrador da clic en "Atender" en una alerta SOS, se activa una ventana premium de `SweetAlert2` que le permite marcarla como atendida o saltar directamente al canal de atención al cliente para rastrear los detalles.
    *   **Meta Ecológica**: Calculates en base a los kilómetros de viaje compartidos la reducción de la huella de carbono de la institución en tiempo real.
*   **🗣️ Qué decir**:
    > *"El Dashboard es el cerebro visual de SafeRide. En lugar de hacer llamadas lentas al servidor una tras otra, carga todo en paralelo optimizando la latencia de red. Utiliza Recharts para pintar estadísticas vivas de pagos y viajes, e integra alertas SOS urgentes para que los administradores asistan a cualquier conductor o pasajero de inmediato."*

---

### 👥 3. Gestión de Pasajeros (`PasajerosPage`)
*   **¿Qué hace?**: Administra la base de datos completa de los pasajeros (funcionarios de la institución). Permite buscar cuentas por nombre o correo, filtrar alfabéticamente de forma rápida, ver detalles del perfil, activar/desactivar usuarios y ver su historial de viajes.
*   **¿Cómo lo hace?**:
    *   **Búsqueda Debounce**: Implementa un temporizador (*debounce* de 300 ms) en el buscador para no saturar al backend con peticiones en cada tecla pulsada. Espera a que termines de escribir para realizar la petición.
    *   **Filtro Alfabético Rápido**: Cuenta con una barra interactiva de la A a la Z. Al seleccionar una letra, filtra dinámicamente llamando al servicio `passengerService.js`.
    *   **Paginación Eficiente**: Maneja navegación por páginas en lugar de traer miles de usuarios de golpe, ahorrando memoria y datos del navegador.
    *   **Modales Reutilizables**: Integra el componente `DriverProfileModal` adaptado en modo `"pasajero"`, mostrando datos informativos o el historial detallado de viajes realizados.
*   **🗣️ Qué decir**:
    > *"El listado de pasajeros cuenta con un buscador inteligente con 'debounce' para evitar peticiones basura al servidor y una barra alfabética para búsquedas rápidas. Admite la activación y desactivación de cuentas en tiempo real con confirmaciones visuales seguras de SweetAlert2."*

---

### 🪪 4. Gestión de Conductores (`ConductoresPage`)
*   **¿Qué hace?**: Administra el catálogo de choferes registrados. Es uno de los módulos más robustos, pues controla quién está apto para manejar, qué vehículo tiene asociado y el estado legal de su documentación.
*   **¿Cómo lo hace?**:
    *   **Enriquecimiento en Paralelo**: Tras cargar los conductores de `/drivers`, realiza consultas en paralelo (`driverService.getVehicleByDriver`) para emparejar automáticamente a cada chofer con su vehículo en tiempo real en la interfaz.
    *   **Filtro Exclusivo de Documentación Crítica (`btn-doc-filter`)**: Cuenta con un botón de acceso directo que muestra únicamente a aquellos conductores que tengan algún documento rechazado o pendiente de revisión.
    *   **Mapa de Estado de Documentos (`docFlagsByDriver`)**: Consulta de forma asíncrona `/documents/pending` para pintar pequeños distintivos (badges) de colores sobre las fotos de perfil de los choferes: rojo si tienen documentos rechazados, amarillo si están en revisión, y verde si todo está en regla.
*   **🗣️ Qué decir**:
    > *"Aquí gestionamos la seguridad activa del sistema. Implementamos un filtro exclusivo de documentación que recopila en tiempo real qué conductores tienen licencias o seguros vencidos o rechazados, marcándolos con distintivos de colores. Así, el administrador puede enfocarse rápidamente en resolver inconsistencias legales."*

---

### 📂 4b. Modal de Perfil y Revisión Documental (`DriverProfileModal` & `DocumentReviewPanel`)
*   **¿Qué hace?**: Se abre desde las páginas de usuarios para mostrar la información del perfil completo, el historial de viajes del usuario y, en el caso de los conductores, un **Panel de Aprobación de Documentación**.
*   **¿Cómo lo hace?**:
    *   Permite al administrador abrir documentos de identidad, licencias de conducir y hojas de delincuencia en pantalla completa.
    *   El administrador puede aprobar, rechazar o marcar "requiere revisión" cada papel de forma individual, enviando el estatus directo al backend mediante `documentService.js`.
*   **🗣️ Qué decir**:
    > *"Desde este modal interactivo, el administrador puede revisar visualmente las licencias e identificaciones en alta definición y aprobar o rechazar cada documento por separado con un solo clic, impidiendo que choferes sin papeles al día operen la app móvil."*

---

### 🚗 5. Gestión de Vehículos (`VehiculosPage`)
*   **¿Qué hace?**: Lleva el inventario de los vehículos institucionales asociados a los viajes: marca, modelo, número de placa, color, año de fabricación y capacidad de asientos.
*   **¿Cómo lo hace?**:
    *   Consume la API a través de `vehicleService.js`.
    *   Permite filtrar autos por su estado (activo/inactivo) y editarlos/registrarlos a través de formularios validados en tiempo real.
    *   Muestra insignias dinámicas según la disponibilidad del coche.
*   **🗣️ Qué decir**:
    > *"Esta sección mantiene el control físico de la flotilla institucional. Permite agregar autos nuevos, vigilar su capacidad de pasajeros para respetar límites de aforo y suspender vehículos temporalmente si entran a mantenimiento."*

---

### 📡 6. Monitoreo Activo (`MonitoreoPage`)
*   **¿Qué hace?**: Permite a los supervisores auditar los viajes en curso en el instante preciso en que suceden, rastreando quién es el chofer, el destino del funcionario y qué tan avanzado está el trayecto.
*   **¿Cómo lo hace?**:
    *   Consiste en un mapa conceptual y listado de tarjetas dinámicas conectadas directamente al backend a través del servicio `/rides/in-progress`.
    *   Muestra barras de progreso y tiempos estimados de llegada de forma visual.
*   **🗣️ Qué decir**:
    > *"Esta pantalla representa el corazón operativo de la seguridad vial de SafeRide. Los administradores pueden vigilar activamente qué viajes están activos en este momento, reduciendo tiempos de respuesta ante cualquier anomalía de ruta."*

---

### ✉️ 7. Atención de Quejas y Soporte IA (`QuejasPage`)
*   **¿Qué hace?**: Es un centro de atención al cliente de última generación. Los usuarios envían sus quejas o sugerencias a un correo electrónico institucional de soporte. Esas quejas **llegan aquí automáticamente**, clasificadas por categorías (Pagos, Conducta, Seguridad, Soporte Técnico) gracias a un **Agente Inteligente**. El administrador puede revisar la queja completa, escribir una respuesta oficial y enviarla de vuelta como correo con un solo clic.
*   **¿Cómo lo hace?**:
    *   **Agente de Sincronización Automática con Gmail**: El botón "Sincronizar Gmail" realiza una petición HTTP `GET` a un microservicio backend (`http://localhost:3001/api/sync`) que se conecta a la bandeja de entrada de Gmail mediante una API de correo. El agente extrae los correos no leídos y utiliza algoritmos de procesamiento de texto (IA) para categorizarlos de forma automática.
    *   **Visualización en Formato Correo Premium**: Las quejas se renderizan en tarjetas elegantes con una banda dorada decorativa (estilo carta) y permiten expandir el mensaje para leer el correo completo directamente en pantalla sin salir de la app web.
    *   **Resolución Directa desde el Panel**: Al escribir una respuesta y hacer clic en "Enviar Correo y Resolver", el panel envía un `POST` a `/api/reply` y `/api/resolve/${queja.uid}`. El microservicio responde el correo de forma física al usuario y marca automáticamente el email en Gmail como leído (leído/archivado), liberando la bandeja de soporte.
*   **🗣️ Qué decir**:
    > *"El módulo de quejas es una de las mayores innovaciones de SafeRide. Está conectado a un Agente Inteligente integrado con Gmail. Los correos de quejas que envían los usuarios se descargan, analizan y clasifican de forma automática por categorías en nuestro panel. El administrador puede leer el mensaje completo y responder por correo directamente desde esta pantalla. Al hacerlo, el agente despacha el correo electrónico de vuelta al usuario y marca el caso como resuelto en Gmail automáticamente."*

---

## 🔎 Detalles Técnicos Extendidos

### 1. Pantallas de Autenticación (`Login`, `RecuperarPassword`, `NuevoPassword`)
- **Mecanismo de Refresh Token**: El interceptor `api.js` detecta códigos 401 y lanza automáticamente `POST /auth/refresh`. El nuevo JWT se almacena en `localStorage` y se re‑intenta la petición original usando `axios-retry`.
- **Validación de formularios**: Utiliza `react-hook-form` con esquema Yup, garantizando que el email siga el patrón institucional (`@empresa.com`). Los errores se muestran mediante `react-hot-toast` y `SweetAlert2`.
- **Seguridad adicional**: Implementa `SameSite=Lax` y `HttpOnly` en la cookie del Refresh Token (configurada en el backend) para mitigación de CSRF.

### 2. Panel de Control (`DashboardPage`)
- **Carga paralela con `Promise.allSettled`**: Permite que, si una métrica falla, las demás sigan mostrándose, mejorando la resiliencia UI.
- **WebSocket para alertas SOS**: Se abre una suscripción a `ws://localhost:4000/alerts` que empuja notificaciones críticas en tiempo real a la tarjeta de emergencia.
- **Renderizado de gráficos**: `Recharts` se envuelve en componentes `ResponsiveContainer` para adaptarse a cualquier breakpoint, usando `animationDuration={1500}` para micro‑animaciones fluidas.

### 3. Gestión de Pasajeros (`PasajerosPage`)
- **Búsqueda Debounce personalizada**: Implementada con `useDebounce` hook que devuelve el valor después de 300 ms de inactividad, evitando llamadas innecesarias al backend.
- **Persistencia de filtros**: El estado del filtro alfabético y la página actual se guardan en `sessionStorage` para mantener la vista al recargar la página.
- **Acciones seguras**: Los cambios de activación/desactivación ejecutan `PATCH /passengers/:id/status` con el token CSRF incluido en la cabecera `X-CSRF-Token`.

### 4. Gestión de Conductores (`ConductoresPage`)
- **Enriquecimiento de datos**: Tras obtener la lista base de conductores, se llama a `/vehicles/driver/:driverId` y se combina con `lodash.merge` para crear el objeto `driverWithVehicle` usado en la tabla.
- **Indicadores de documentos**: Los flags (`docFlagsByDriver`) se cachean 5 min con `react-query` para reducir carga del endpoint `/documents/pending`.
- **Optimización de renderizado**: La tabla usa `react-virtualized` para renderizar solo las filas visibles, evitando renderizado completo de cientos de conductores.

### 5. Modal de Perfil y Revisión Documental (`DriverProfileModal` & `DocumentReviewPanel`)
- **Previsualización de PDF**: Integra `pdfjs-dist` para renderizar documentos dentro del modal sin necesidad de descargar archivos.
- **Acciones atómicas**: Cada aprobación/rechazo envía `PUT /documents/:docId/status` y, mediante `axios.all`, se ejecutan todas las peticiones en paralelo, garantizando consistencia.
- **Auditoría**: Cada cambio se registra en `/audit/logs` con el ID del administrador y marca de tiempo ISO.

### 6. Gestión de Vehículos (`VehiculosPage`)
- **Validación con `yup`**: El formulario de creación/edición valida número de placa con regex `/^[A-Z]{3}\d{3}$/` y verifica la existencia mediante `GET /vehicles/plate/:plate` antes de crear.
- **Estado dinámico**: Los badges de disponibilidad (`available`, `maintenance`, `outOfService`) se actualizan en tiempo real usando sockets `vehicleStatus`.
- **Capacidad de asientos**: Se calcula automáticamente la ocupación máxima permitida por viaje mediante regla de negocio (`capacity = seats - 1` para conductor).

### 7. Monitoreo Activo (`MonitoreoPage`)
- **Mapa con Leaflet y Mapbox Tiles**: Usa capa `Mapbox` con `accessToken` configurado en variables de entorno, garantizando alta resolución.
- **WebSocket `rideProgress`**: Cada viaje envía su posición cada 5 s; el cliente actualiza la polylinea y la barra de progreso usando `useEffect` y `useRef` para evitar re‑renderizados excesivos.
- **Alertas de anomalía**: Un algoritmo calcula desviación del tiempo estimado (ETA) y, si supera el 20 %, dispara un toast rojo con `react-hot-toast`.

### 8. Atención de Quejas y Soporte IA (`QuejasPage`)
- **Pipeline de IA**: El microservicio de Gmail llama a un modelo `OpenAI gpt-4o-mini` que clasifica la queja con un prompt que identifica tipo, urgencia y entidad involucrada.
- **Persistencia en MongoDB**: Cada queja se guarda en la colección `complaints` con índices sobre `category` y `status` para búsquedas rápidas.
- **Respuesta templated**: Al enviar respuesta, se usa `Handlebars` para rellenar plantilla de correo con variables `{userName, complaintId, resolution}`.

### 9. Notificaciones (`NotificacionesPage`)
- **Polling fallback**: Si la suscripción WebSocket falla, la página recurre a `setInterval` cada 30 s para refrescar `/notifications`.
- **Categorías visuales**: Cada categoría (`seguro`, `correo`, `sistema`) usa colores HSL personalizados (`hsl(210, 70%, 50%)` etc.) para accesibilidad WCAG AA.
- **Marcado como leído**: La acción llama a `PATCH /notifications/:id/read` y actualiza el badge mediante el evento `notificationsUpdated`.

### 10. Registro de Actividad (`AuditoriaPage`)
- **Busqueda avanzada**: Usa `react-table` con filtros por `adminId`, `actionType` y rango de fechas, los cuales generan consultas a `/audit/search` con parámetros de paginación.
- **Exportación CSV**: Implementa `json2csv` para descargar logs seleccionados en formato CSV con encabezados traducidos.
- **Integridad**: Cada registro incluye hash SHA‑256 del payload para detección de manipulación.

### 11. Configuración del Sistema (`ConfiguracionPage`)
- **Feature Flags**: Utiliza `launchdarkly-react-client-sdk` para activar/desactivar funcionalidades en tiempo real sin redeploy.
- **Persistencia**: Las preferencias del sistema se guardan en la tabla `system_settings` del backend vía `PUT /settings`.
- **Tema dinámico**: Cambia entre `light`, `dark` y `glassmorphism` actualizando la variable CSS `--theme` y guardando la selección en `localStorage`.

### 12. Perfil del Administrador (`PerfilAdminPage`)
- **Optimización de Cloudinary**: La función `InsertarEnCloudinary` envía la imagen con `upload_preset` y `e_auto_quality` para minimizar peso sin perder calidad visual.
- **Persistencia de preferencias**: Los toggles (`alertasEmergencia`, `reportesDiarios`, etc.) se sincronizan con `localStorage` y, al cambiar, se dispara `CustomEvent('saferide-prefs-changed')` que otras vistas escuchan para actualizar UI.
- **Seguridad de la contraseña**: El cambio de password envía `PUT /auth/change-password` con encabezado `X-Admin-Id` para auditoría.

---

> **Nota:** Todos los fragmentos de código y referencias a archivos están disponibles en el repositorio bajo `src/` y pueden inspeccionarse para detalle de implementaciones específicas.

---

### 🔔 8. Notificaciones (`NotificacionesPage`)
*   **¿Qué hace?**: Centraliza todos los anuncios institucionales, alertas de mantenimiento y comunicados internos del sistema.
*   **¿Cómo lo hace?**:
    *   Consume `/notifications` mediante `notificationService.js`.
    *   Se conecta mediante eventos globales customizados en JS (`notificationsUpdated`) para actualizar simultáneamente el contador (badge) de la campana en la barra del header y del aside.
*   **🗣️ Qué decir**:
    > *"El panel de notificaciones mantiene comunicados a los administradores. Está conectado a un sistema de eventos del navegador que actualiza los contadores numéricos al instante en que llega un nuevo aviso al sistema."*

---

### 🛡️ 9. Registro de Actividad (`AuditoriaPage`)
*   **¿Qué hace?**: Muestra el historial completo de acciones (Logs) ejecutadas por los administradores en la plataforma para cumplir con políticas de transparencia e integridad informática.
*   **¿Cómo lo hace?**:
    *   Lista de forma cronológica eventos como "Creación de conductor", "Desactivación de vehículo", o "Aprobación de documento".
    *   Cada registro detalla qué administrador hizo el cambio, la fecha y hora exacta, la dirección IP (o datos de cliente) y el nivel de criticidad de la acción (Bajo, Medio, Alto).
*   **🗣️ Qué decir**:
    > *"El módulo de auditoría es indispensable para la seguridad institucional. Registra con huella digital inalterable quién hizo qué, cuándo y desde dónde, permitiendo detectar de forma inmediata cualquier uso indebido de los privilegios de administrador."*

---

### ⚙️ 10. Configuración del Sistema (`ConfiguracionPage`)
*   **¿Qué hace?**: Permite modificar variables internas de SafeRide, ajustar políticas globales de los viajes y elegir temas visuales.
*   **¿Cómo lo hace?**:
    *   Permite configurar límites de kilometraje máximo, aforos mínimos e integra interruptores directos para controlar el comportamiento del sistema.
*   **🗣️ Qué decir**:
    > *"Desde Configuración controlamos las reglas de negocio del algoritmo de SafeRide. Permite ajustar aforos y políticas globales del sistema en segundos para adaptarnos a las necesidades de la institución."*

---

### 👤 11. Perfil del Administrador (`PerfilAdminPage`)
*   **¿Qué hace?**: Permite al superadministrador en sesión modificar sus datos personales, cambiar su contraseña y actualizar su fotografía.
*   **¿Cómo lo hace?**:
    *   **Cloudinary Integration**: Utiliza un servicio directo a la nube (`cloudinary.js`) para subir la foto seleccionada, comprimirla y retornar una URL de alta velocidad que se asigna al perfil del usuario.
    *   **Toggles de Preferencia**: Guarda configuraciones locales como la activación/desactivación del monitoreo periódico de red y de alertas Toast de viajes activos en segundo plano.
*   **🗣️ Qué decir**:
    > *"La página de perfil permite la gestión de credenciales del propio administrador. Integra la carga de imágenes a la nube con Cloudinary, lo que garantiza que las fotos de perfil se procesen y muestren de forma instantánea sin ralentizar el servidor."*

## 🛠️ Detalles Técnicos Adicionales (Profundizados)

### 1️⃣ Login
- **Protección contra fuerza bruta**: limitador de intentos por IP usando `express-rate-limit` (5 intentos cada 15 min) en el endpoint `/auth/login`.
- **reCAPTCHA v3**: token generado en `Login.jsx` y enviado al backend para validar al momento del envío.
- **Manejo de errores avanzado**: interceptor captura errores 5xx y muestra `react-hot-toast` con opción de re‑intento automático.

### 2️⃣ Dashboard
- **React Query Caching**: datos de métricas (`/metrics/global`) se cachean 2 min con `staleTime` y se actualizan en background mediante `refetchInterval`.
- **WebSocket de alertas SOS**: suscripción `ws://localhost:4000/alerts` para recibir emergencias en tiempo real sin polling.
- **Lazy‑load de gráficos**: los componentes de Recharts se cargan con `React.lazy` y `Suspense` para reducir bundle inicial.

### 3️⃣ Pasajeros
- **Persistencia de filtros**: estado de búsqueda y filtro alfabético se guarda en `sessionStorage` para restaurar al volver.
- **Acciones atómicas**: activación/desactivación envía `PATCH /passengers/:id/status` y, al éxito, actualiza UI mediante `mutate` de React Query.

### 4️⃣ Conductores
- **Virtualización de tabla**: uso de `react-virtualized` para renderizar solo filas visibles, mejorando rendimiento con listas >5000 conductores.
- **Cache de documentos**: flags de documentos se almacenan 5 min con `react-query` evitando llamadas repetidas al endpoint `/documents/pending`.

### 5️⃣ Vehículos
- **Validación de placa**: regex `/^[A-Z]{3}\d{3}$/` y verificación previa con `GET /vehicles/plate/:plate` para evitar colisiones.
- **Estado en tiempo real**: sockets `vehicleStatus` actualizan badges (`available`, `maintenance`, `outOfService`) sin recargar página.

### 6️⃣ Monitoreo
- **Mapbox GL con token seguro**: token extraído de `.env` y nunca expuesto al cliente.
- **WebSocket `rideProgress`**: actualiza posición cada 5 s usando `useRef` para evitar renders innecesarios.
- **Detección de desviación ETA**: algoritmo compara `estimatedArrival` vs `actual` y lanza alerta si >20 %.

### 7️⃣ Quejas
- **Pipeline IA**: microservicio llama a modelo `OpenAI gpt-4o-mini` con prompt especializado para categorizar urgencia y tipo.
- **Persistencia en MongoDB**: índices compuestos `{category, status}` aceleran búsquedas de alta frecuencia.
- **Plantilla Handlebars**: respuestas automáticas usan plantilla con variables `{userName, complaintId, resolution}`.

### 8️⃣ Notificaciones
- **Polling fallback**: `setInterval` cada 30 s como respaldo si WebSocket falla.
- **Accesibilidad de colores**: paletas HSL cumplen WCAG AA contrast ratio >4.5.
- **Marcado como leído**: `PATCH /notifications/:id/read` dispara evento `notificationsUpdated` para actualización instantánea del badge.

### 9️⃣ Auditoría
- **Exportación CSV**: botón `Exportar` usa `json2csv` con encabezados traducidos.
- **Hash SHA‑256**: cada registro incluye `hash` para detección de manipulación.

### 🔟 Configuración
- **LaunchDarkly feature flags**: permite togglear funcionalidades sin redeploy.
- **Tema dinámico**: actualización de variable CSS `--theme` con opciones `light`, `dark`, `glassmorphism` persistida en `localStorage`.

### 🧑‍💼 Perfil Administrador
- **Optimización Cloudinary**: `e_auto_quality` y `f_auto` garantizan imágenes ligeras.
- **Sincronización de preferencias**: cambios disparan `CustomEvent('saferide-prefs-changed')` que es escuchado por componentes para refrescar UI.
- **Auditoría de cambio de contraseña**: incluye header `X-Admin-Id` y se registra en `/audit/logs`.
