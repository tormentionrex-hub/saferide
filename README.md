# Safe-Ride Backend API

> Backend REST API para la aplicación de carpooling empresarial Safe-Ride, desarrollada con Node.js, Express y Azure Cosmos DB.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

## 📋 Tabla de Contenidos

- [Descripción](#-descripción)
- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Uso](#-uso)
- [Endpoints de la API](#-endpoints-de-la-api)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Testing](#-testing)
- [Seguridad](#-seguridad)
- [Despliegue](#-despliegue)
- [Contribuir](#-contribuir)
- [Autor](#-autor)

## 🚀 Descripción

Safe-Ride es una plataforma backend para gestionar un sistema de carpooling empresarial que conecta conductores y pasajeros de diferentes empresas en Costa Rica. El sistema permite a los usuarios registrarse, crear viajes, realizar reservas, gestionar vehículos, y proporciona un sistema completo de autenticación, notificaciones y métricas.

### Motivación

Este proyecto nace de la necesidad de facilitar el transporte compartido entre empleados de empresas como Intel, Cargill, Deloitte, Citi, Experian, 3M, DHL, BGO, WeWork, Concentrix y Nestlé en Costa Rica, promoviendo la movilidad sostenible y reduciendo costos de transporte.

## ✨ Características

### Autenticación y Usuarios
- ✅ Registro de usuarios con validación completa
- ✅ Login con JWT (Access Token y Refresh Token)
- ✅ Autenticación con Azure Active Directory (Entra ID)
- ✅ Gestión de perfiles de usuario (conductores, pasajeros, administradores)
- ✅ Actualización de contraseña segura
- ✅ Subida de imágenes de perfil a Azure Blob Storage

### Gestión de Viajes
- ✅ Creación de viajes con origen, destino y horarios
- ✅ Búsqueda y filtrado de viajes disponibles
- ✅ Sistema de asientos disponibles
- ✅ Estados de viaje: programado, en progreso, completado, cancelado
- ✅ Geolocalización con coordenadas lat/lng

### Sistema de Reservas
- ✅ Reserva de asientos en viajes
- ✅ Gestión de estados: pendiente, confirmado, cancelado, completado
- ✅ Prevención de reservas duplicadas
- ✅ Validación de capacidad de asientos

### Vehículos
- ✅ Registro de vehículos con validación de placa
- ✅ Gestión de información: marca, modelo, año, color, capacidad
- ✅ Subida de imágenes de vehículos
- ✅ Asociación conductor-vehículo

### Reseñas y Calificaciones
- ✅ Sistema de reseñas entre usuarios
- ✅ Calificación de 1 a 5 estrellas
- ✅ Comentarios y feedback

### Notificaciones
- ✅ Sistema de notificaciones en tiempo real
- ✅ Notificaciones de reservas, confirmaciones y cancelaciones
- ✅ Estados: no leída, leída, archivada

### Métricas y Análisis
- ✅ Dashboard de métricas del sistema
- ✅ Estadísticas de usuarios, viajes y reservas
- ✅ Análisis de uso por empresa

### Seguridad
- ✅ Autenticación JWT con tokens de acceso y actualización
- ✅ Encriptación de contraseñas con bcrypt
- ✅ Helmet.js para headers de seguridad
- ✅ Rate limiting para prevenir abuso
- ✅ CORS configurado
- ✅ Validación de datos con express-validator
- ✅ Integración con Azure Key Vault

## 🛠️ Tecnologías

### Backend
- **Runtime:** Node.js (>=18.0.0)
- **Framework:** Express 5.1.0
- **Base de Datos:** Azure Cosmos DB for MongoDB (vCore) con Mongoose 8.19.3
- **Autenticación:** JWT, Passport, Azure AD

### Servicios Azure
- **Azure Cosmos DB:** Base de datos NoSQL
- **Azure Blob Storage:** Almacenamiento de imágenes
- **Azure Key Vault:** Gestión de secretos
- **Azure Active Directory:** Autenticación empresarial

### Seguridad y Middleware
- Helmet - Seguridad de headers HTTP
- CORS - Control de acceso cross-origin
- Express Rate Limit - Limitación de peticiones
- Bcrypt - Hashing de contraseñas
- Morgan - Logging de peticiones HTTP

### Desarrollo y Testing
- Jest - Framework de testing
- Supertest - Testing de APIs HTTP
- ESLint - Linting de código
- Nodemon - Auto-reload en desarrollo

## 📦 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** >= 18.0.0 ([Descargar](https://nodejs.org/))
- **npm** >= 9.0.0 (incluido con Node.js)
- **Git** ([Descargar](https://git-scm.com/))
- **Cuenta de Azure** (para Cosmos DB, Blob Storage y Key Vault)

## 🔧 Instalación

1. **Clonar el repositorio**

```bash
git clone https://github.com/jmunozc023/saferide-backend.git
cd saferide-backend
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar variables de entorno**

Crear un archivo `.env` en la raíz del proyecto:

```bash
cp .env.example .env
```

Editar `.env` con tus configuraciones (ver sección de [Configuración](#-configuración))

4. **Inicializar la base de datos**

```bash
npm run db:init
```

## ⚙️ Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Servidor
NODE_ENV=development
PORT=8080
API_VERSION=v1

# Cosmos DB
COSMOS_CONNECTION_STRING=mongodb://your-cosmos-account:key@your-cosmos-account.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb&retrywrites=false
COSMOS_DATABASE=Safe-RideDB

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRE=15m
REFRESH_TOKEN_SECRET=your-super-secret-refresh-token-key
REFRESH_TOKEN_EXPIRE=7d

# Azure Blob Storage
BLOB_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=your-account;AccountKey=your-key;EndpointSuffix=core.windows.net
AZURE_STORAGE_ACCOUNT=your-storage-account-name

# Azure Key Vault
KEY_VAULT_URL=https://your-keyvault.vault.azure.net/

# Azure AD (Entra ID)
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_TENANT_ID=your-tenant-id

# CORS
CORS_ORIGIN=http://localhost:3000,https://your-frontend-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Configuración de Cosmos DB

1. Crear una cuenta de Azure Cosmos DB for MongoDB (vCore)
2. Obtener la cadena de conexión desde Azure Portal
3. Configurar firewall para permitir tu IP
4. La base de datos se creará automáticamente al ejecutar `npm run db:init`

### Configuración de Azure Blob Storage

1. Crear una cuenta de Azure Storage
2. Crear contenedores: `profile-images`, `vehicle-images`
3. Obtener la cadena de conexión desde Azure Portal

## 🚀 Uso

### Desarrollo

Ejecutar el servidor en modo desarrollo con auto-reload:

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:8080`

### Producción

```bash
npm start
```

### Scripts Disponibles

```bash
# Iniciar servidor
npm start

# Modo desarrollo con nodemon
npm run dev

# Ejecutar tests
npm test

# Ejecutar tests con coverage
npm run test

# Linting
npm run lint

# Fix linting automático
npm run lint:fix

# Inicializar base de datos
npm run db:init

# Poblar base de datos con datos de prueba
npm run db:seed
```

### Health Check

Verificar que la API está funcionando:

```bash
curl http://localhost:8080/api/v1/health
```

Respuesta esperada:
```json
{
  "success": true,
  "message": "Safe-Ride API is running",
  "timestamp": "2025-11-08T07:25:00.000Z",
  "environment": "development"
}
```

## 📚 Endpoints de la API

### Base URL

```
http://localhost:8080/api/v1
```

### Autenticación (`/auth`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Registrar nuevo usuario | No |
| POST | `/auth/login` | Iniciar sesión | No |
| POST | `/auth/refresh` | Refrescar access token | No |
| POST | `/auth/logout` | Cerrar sesión | Sí |
| GET | `/auth/me` | Obtener usuario actual | Sí |
| PUT | `/auth/password` | Actualizar contraseña | Sí |

### Usuarios (`/users`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/users` | Listar usuarios | Sí (Admin) |
| GET | `/users/:id` | Obtener usuario por ID | Sí |
| PUT | `/users/:id` | Actualizar usuario | Sí |
| DELETE | `/users/:id` | Eliminar usuario | Sí (Admin) |
| POST | `/users/:id/profile-image` | Subir imagen de perfil | Sí |

### Vehículos (`/vehicles`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/vehicles` | Registrar vehículo | Sí (Conductor) |
| GET | `/vehicles` | Listar vehículos | Sí |
| GET | `/vehicles/:id` | Obtener vehículo por ID | Sí |
| PUT | `/vehicles/:id` | Actualizar vehículo | Sí (Conductor) |
| DELETE | `/vehicles/:id` | Eliminar vehículo | Sí (Conductor) |
| POST | `/vehicles/:id/image` | Subir imagen de vehículo | Sí (Conductor) |

### Viajes (`/rides`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/rides` | Crear viaje | Sí (Conductor) |
| GET | `/rides` | Listar viajes disponibles | Opcional |
| GET | `/rides/:id` | Obtener viaje por ID | Opcional |
| PUT | `/rides/:id` | Actualizar viaje | Sí (Conductor) |
| DELETE | `/rides/:id` | Cancelar viaje | Sí (Conductor) |
| GET | `/rides/driver/:driverId` | Viajes de un conductor | Sí |
| PATCH | `/rides/:id/start` | Iniciar viaje | Sí (Conductor) |
| PATCH | `/rides/:id/complete` | Completar viaje | Sí (Conductor) |

### Reservas (`/bookings`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/bookings` | Crear reserva | Sí (Pasajero) |
| GET | `/bookings` | Listar mis reservas | Sí |
| GET | `/bookings/:id` | Obtener reserva por ID | Sí |
| PUT | `/bookings/:id` | Actualizar reserva | Sí |
| DELETE | `/bookings/:id` | Cancelar reserva | Sí |
| PATCH | `/bookings/:id/confirm` | Confirmar reserva | Sí (Conductor) |

### Reseñas (`/reviews`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/reviews` | Crear reseña | Sí |
| GET | `/reviews/user/:userId` | Reseñas de un usuario | Sí |
| GET | `/reviews/:id` | Obtener reseña por ID | Sí |
| PUT | `/reviews/:id` | Actualizar reseña | Sí |
| DELETE | `/reviews/:id` | Eliminar reseña | Sí |

### Notificaciones (`/notifications`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/notifications` | Listar mis notificaciones | Sí |
| GET | `/notifications/:id` | Obtener notificación | Sí |
| PATCH | `/notifications/:id/read` | Marcar como leída | Sí |
| DELETE | `/notifications/:id` | Eliminar notificación | Sí |

### Métricas (`/metrics`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/metrics/dashboard` | Dashboard de métricas | Sí (Admin) |
| GET | `/metrics/users` | Estadísticas de usuarios | Sí (Admin) |
| GET | `/metrics/rides` | Estadísticas de viajes | Sí (Admin) |

## 📁 Estructura del Proyecto

```
saferide-backend/
├── src/
│   ├── app.js                 # Configuración principal de Express
│   ├── config/                # Configuraciones
│   │   ├── auth.js           # Configuración JWT
│   │   ├── azure.js          # Clientes de Azure (Blob, KeyVault)
│   │   └── database.js       # Conexión a Cosmos DB
│   ├── controllers/           # Controladores de las rutas
│   │   ├── authController.js
│   │   ├── bookingController.js
│   │   ├── metricsController.js
│   │   ├── notificationController.js
│   │   ├── reviewController.js
│   │   ├── rideController.js
│   │   ├── userController.js
│   │   └── vehicleController.js
│   ├── middleware/            # Middleware personalizado
│   │   ├── auth.js           # Autenticación y autorización
│   │   ├── errorHandler.js   # Manejo de errores
│   │   ├── rateLimiter.js    # Rate limiting
│   │   └── validation.js     # Validación de datos
│   ├── models/                # Modelos de Mongoose
│   │   ├── Bookings.js
│   │   ├── Metics.js
│   │   ├── Notification.js
│   │   ├── Review.js
│   │   ├── Ride.js
│   │   ├── User.js
│   │   ├── Vehicle.js
│   │   └── index.js
│   ├── routes/                # Definición de rutas
│   │   ├── authRoutes.js
│   │   ├── bookingRoutes.js
│   │   ├── metricsRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── reviewRoutes.js
│   │   ├── rideRoutes.js
│   │   ├── userRoutes.js
│   │   ├── vehicleRoutes.js
│   │   └── index.js
│   ├── scripts/               # Scripts de utilidad
│   │   └── initDatabase.js   # Inicialización de BD
│   ├── services/              # Lógica de negocio
│   │   ├── blobService.js
│   │   ├── metricsService.js
│   │   └── notificationService.js
│   ├── tests/                 # Tests
│   │   ├── auth.tests.js
│   │   └── setup.js
│   └── utils/                 # Utilidades
│       ├── logger.js          # Logger personalizado
│       └── responseHelper.js  # Helpers de respuestas
├── .eslintrc.js              # Configuración ESLint
├── .gitignore                # Archivos ignorados por Git
├── jest.config.js            # Configuración de Jest
├── package.json              # Dependencias y scripts
├── README.md                 # Este archivo
└── server.js                 # Punto de entrada de la aplicación
```

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests con coverage
npm run test

# Tests en modo watch
npm run test -- --watch
```

### Coverage

Los tests incluyen:
- Tests de autenticación (registro, login, JWT)
- Tests de endpoints de API
- Tests de validación de datos
- Tests de middleware

## 🔒 Seguridad

### Medidas Implementadas

1. **Autenticación JWT**
   - Access tokens de corta duración (15 min)
   - Refresh tokens de larga duración (7 días)
   - Tokens almacenados de forma segura

2. **Encriptación**
   - Contraseñas hasheadas con bcrypt (10 rounds)
   - Conexiones HTTPS/TLS obligatorias
   - Variables de entorno para secretos

3. **Validación de Datos**
   - Express-validator para todas las entradas
   - Sanitización de datos
   - Validación de tipos y formatos

4. **Rate Limiting**
   - 100 peticiones por 15 minutos (general)
   - Rate limiting específico para autenticación
   - Protección contra fuerza bruta

5. **Headers de Seguridad**
   - Helmet.js configurado
   - CORS restrictivo
   - CSP (Content Security Policy)

6. **Azure Integration**
   - Key Vault para gestión de secretos
   - Managed Identity para autenticación
   - Blob Storage con acceso controlado

### Recomendaciones de Seguridad

- Cambiar todos los secretos en producción
- Usar variables de entorno en producción
- Habilitar HTTPS en producción
- Configurar firewall en Cosmos DB
- Rotar secretos periódicamente
- Revisar logs de seguridad

## 🚢 Despliegue

### Azure App Service

1. **Crear App Service**

```bash
az webapp create \
  --name saferide-api \
  --resource-group saferide-rg \
  --plan saferide-plan \
  --runtime "NODE|18-lts"
```

2. **Configurar Variables de Entorno**

```bash
az webapp config appsettings set \
  --name saferide-api \
  --resource-group saferide-rg \
  --settings NODE_ENV=production \
             COSMOS_CONNECTION_STRING="..." \
             JWT_SECRET="..."
```

3. **Desplegar**

```bash
# Desde el directorio del proyecto
az webapp up \
  --name saferide-api \
  --resource-group saferide-rg
```

### Variables de Entorno en Producción

Asegúrate de configurar todas las variables de entorno en Azure App Service:
- Variables de Cosmos DB
- Secretos JWT
- Configuración de Azure Blob Storage
- URL de Key Vault
- CORS origins de producción

## 🤝 Contribuir

Las contribuciones son bienvenidas. Para contribuir:

1. **Fork el proyecto**
2. **Crear una rama** para tu feature (`git checkout -b feature/AmazingFeature`)
3. **Commit tus cambios** (`git commit -m 'Add: nueva funcionalidad increíble'`)
4. **Push a la rama** (`git push origin feature/AmazingFeature`)
5. **Abrir un Pull Request**

### Guías de Contribución

- Seguir el estilo de código existente
- Ejecutar linting antes de commit (`npm run lint:fix`)
- Agregar tests para nuevas funcionalidades
- Actualizar documentación si es necesario
- Commits descriptivos en español

### Code Style

- Usar ESLint configurado en el proyecto
- Nombres de variables en camelCase
- Nombres de archivos en camelCase
- Comentarios en español cuando sean necesarios
- Seguir principios SOLID

## 📄 Licencia

Este proyecto está bajo la Licencia ISC.

## 👤 Autor

**Jose Pablo Muñoz Carvajal**

- GitHub: [@jmunozc023](https://github.com/jmunozc023)
- Email: contacto a través de GitHub

---

## 📞 Soporte

Si tienes alguna pregunta o problema:

1. Revisa la documentación
2. Busca en los issues existentes
3. Crea un nuevo issue con:
   - Descripción del problema
   - Pasos para reproducir
   - Comportamiento esperado
   - Screenshots (si aplica)

---

**Desarrollado con ❤️ en Costa Rica para mejorar la movilidad sostenible empresarial**