# Safe-Ride Backend API

![Safe-Ride Banner](public/safe-ride-logo-inverted.png)

Backend robusto y escalable para la plataforma de carpooling **Safe-Ride**, diseñado para facilitar el transporte compartido corporativo y universitario, reduciendo la huella de carbono y optimizando la movilidad urbana.

## 📋 Tabla de Contenidos

- [Descripción del Proyecto](#-descripción-del-proyecto)
- [Arquitectura e Infraestructura](#-arquitectura-e-infraestructura)
- [Tecnologías Utilizadas](#-tecnologías-utilizadas)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Base de Datos](#-base-de-datos)
- [API Endpoints](#-api-endpoints)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Testing](#-testing)
- [Despliegue](#-despliegue)
- [Colaboración](#-colaboración)
- [Contacto](#-contacto)

---

## 📖 Descripción del Proyecto

Safe-Ride es una solución tecnológica que conecta a conductores con asientos disponibles y pasajeros que se dirigen al mismo destino. El backend gestiona toda la lógica de negocio, incluyendo:

- **Gestión de Usuarios:** Perfiles de conductores y pasajeros, autenticación segura.
- **Viajes (Rides):** Creación, búsqueda geoespacial y gestión de estados de viajes.
- **Reservas (Bookings):** Sistema de solicitud y confirmación de asientos.
- **Seguridad:** Validación de vehículos y licencias.
- **Gamificación y Métricas:** Cálculo de ahorro de CO2 y kilómetros compartidos.
- **Notificaciones:** Alertas en tiempo real sobre el estado de los viajes.

## 🏗 Arquitectura e Infraestructura

El sistema está construido sobre una arquitectura monolítica modular desplegada en la nube de **Microsoft Azure**.

### Diagrama de Infraestructura

```mermaid
graph TD
    Client["Cliente Web/Móvil"] -->|HTTPS| FD["Azure Front Door"]
    FD -->|Load Balancing| AppService["Azure App Service (Linux)"]

    subgraph "Azure Cloud Resource Group"
        AppService -->|Persistencia| CosmosDB["Azure Cosmos DB for MongoDB (vCore)"]
        AppService -->|Almacenamiento| BlobStorage["Azure Blob Storage"]
        AppService -->|Logs & Monitoreo| AppInsights["Application Insights"]
    end

    AppService -->|Timezone Handling| Luxon["Luxon (America/Costa_Rica)"]
```

### Componentes Clave

- **Azure App Service:** Hospeda la aplicación Node.js en un entorno Linux.
- **Azure Cosmos DB (vCore):** Base de datos NoSQL compatible con MongoDB para almacenamiento de alto rendimiento.
- **Azure Front Door:** CDN y balanceador de carga global para baja latencia y seguridad.
- **Azure Blob Storage:** Almacenamiento de imágenes de perfil y vehículos.

## 🛠 Tecnologías Utilizadas

### Core

- **Runtime:** [Node.js](https://nodejs.org/) (v18+)
- **Framework:** [Express.js](https://expressjs.com/) (v5.0)
- **Lenguaje:** JavaScript (ES6+)

### Base de Datos & ODM

- **Mongoose:** Modelado de objetos para MongoDB.
- **MongoDB / Azure Cosmos DB:** Base de datos principal.

### Seguridad & Utilidades

- **JWT (JsonWebToken):** Autenticación stateless.
- **BcryptJS:** Hashing de contraseñas.
- **Helmet & CORS:** Seguridad de cabeceras HTTP.
- **Express Validator:** Validación de datos de entrada.
- **Luxon:** Manejo preciso de zonas horarias (UTC vs Local).
- **Multer:** Manejo de subida de archivos (imágenes).

### Documentación & Testing

- **Swagger (OpenAPI 3.0):** Documentación interactiva de la API.
- **Jest:** Framework de pruebas unitarias y de integración.

## 📂 Estructura del Proyecto

```bash
saferide-backend/
├── src/
│   ├── config/         # Configuraciones (DB, Swagger, Azure, Auth)
│   ├── controllers/    # Lógica de control de peticiones
│   ├── middleware/     # Middlewares (Auth, Error Handling, Validation)
│   ├── models/         # Esquemas de Mongoose (User, Ride, Vehicle, etc.)
│   ├── routes/         # Definición de rutas de la API
│   ├── services/       # Lógica de negocio y servicios externos (Blob, Metrics)
│   ├── utils/          # Utilidades (Logger, TimeZone, ResponseHelper)
│   ├── jobs/           # Tareas programadas (Cron jobs)
│   ├── scripts/        # Scripts de inicialización y mantenimiento
│   ├── tests/          # Tests unitarios y de integración
│   └── app.js          # Punto de entrada de la aplicación Express
├── public/             # Archivos estáticos (Docs)
├── server.js           # Script de inicio del servidor
├── package.json        # Dependencias y scripts
└── README.md           # Documentación del proyecto
```

## 🗄 Base de Datos

El modelo de datos está diseñado para ser flexible y escalable. A continuación se presenta un diagrama entidad-relación simplificado de las colecciones principales.

### Diagrama de Clases / Entidades

```mermaid
classDiagram
    class User {
        +ObjectId _id
        +String name
        +String email
        +String password
        +String role
        +Float rating
    }
    class Vehicle {
        +ObjectId _id
        +ObjectId driver_id
        +String brand
        +String model
        +String plate
    }
    class Ride {
        +ObjectId _id
        +ObjectId driver_id
        +Object origin
        +Object destination
        +Date date_time
        +Int available_seats
        +String status
    }
    class Booking {
        +ObjectId _id
        +ObjectId ride_id
        +ObjectId passenger_id
        +String status
    }
    class Review {
        +ObjectId _id
        +ObjectId ride_id
        +ObjectId reviewer_id
        +ObjectId reviewee_id
        +Int rating
    }

    User "1" -- "0..*" Vehicle : owns
    User "1" -- "0..*" Ride : drives
    User "1" -- "0..*" Booking : makes
    Ride "1" -- "0..*" Booking : contains
    Ride "1" -- "0..*" Review : has
    User "1" -- "0..*" Review : writes/receives
```

## 🔌 API Endpoints

La documentación completa e interactiva está disponible en `/api-docs` cuando el servidor está en ejecución.

### Resumen de Módulos

| Módulo            | Ruta Base               | Descripción                                   |
| ----------------- | ----------------------- | --------------------------------------------- |
| **Auth**          | `/api/v1/auth`          | Registro, Login, Refresh Token.               |
| **Users**         | `/api/v1/users`         | Gestión de perfiles, estadísticas de usuario. |
| **Vehicles**      | `/api/v1/vehicles`      | CRUD de vehículos (solo conductores).         |
| **Rides**         | `/api/v1/rides`         | Publicación y búsqueda de viajes.             |
| **Bookings**      | `/api/v1/bookings`      | Gestión de reservas de asientos.              |
| **Reviews**       | `/api/v1/reviews`       | Sistema de calificación y comentarios.        |
| **Notifications** | `/api/v1/notifications` | Alertas de sistema y actividad.               |
| **Metrics**       | `/api/v1/metrics`       | Dashboard de impacto ambiental.               |

## 🚀 Instalación y Configuración

### Prerrequisitos

- Node.js v18 o superior.
- Instancia de MongoDB (Local o Atlas/Cosmos DB).
- Cuenta de Azure Storage (opcional para imágenes).

### Pasos

1.  **Clonar el repositorio:**

    ```bash
    git clone https://safe-ride-app@dev.azure.com/safe-ride-app/Safe-RideApp/_git/saferide-backend
    Ingresar las credenciales para clonar el proyecto
    cd saferide-backend
    ```

2.  **Instalar dependencias:**

    ```bash
    npm install
    ```

3.  **Configurar variables de entorno:**
    Crea un archivo `.env` en la raíz basado en el siguiente ejemplo:
    ```env # Server Configuration
        NODE_ENV=production
        PORT=8080
        API_VERSION=v1

        # Azure Cosmos DB

        COSMOS_ENDPOINT=https://cosmos-endpoint
        COSMOS_KEY=Cosmos-Key
        COSMOS_CONNECTION_STRING=cosmos-mongodb-connection-string
        COSMOS_DATABASE=name-of-the-database

        # Azure Blob Storage

        BLOB_STORAGE_CONNECTION_STRING=blob-connnection-string
        BLOB_CONTAINER_PROFILE=blob-container-name
        BLOB_CONTAINER_VEHICLE=blob-container-name

        # Microsoft Entra ID (Azure AD)

        ENTRA_TENANT_ID=tenant-id
        ENTRA_CLIENT_ID=client-id
        ENTRA_CLIENT_SECRET=client-secret
        ENTRA_REDIRECT_URI=http://uri-entra-id

        # JWT Configuration

        JWT_SECRET=jwt-secret
        JWT_EXPIRES_IN=24h
        JWT_REFRESH_EXPIRES_IN=7d

        # Application Insights

        APPLICATIONINSIGHTS_CONNECTION_STRING=connection-string-for-application-insights

        # Rate Limiting

        RATE_LIMIT_WINDOW_MS=##
        RATE_LIMIT_MAX_REQUESTS=##

        # CORS

        CORS_ORIGIN=cors-origin-of-the-database

        # Azure Key Vault (Optional)

        KEY_VAULT_URL=https://key-vault-url

        APP_TIMEZONE=America/Costa_Rica
```

4.  **Inicializar base de datos (opcional):**

    ```bash
    npm run db:init
    ```

5.  **Iniciar el servidor:**
    ```bash
    npm run dev  # Modo desarrollo
    npm start    # Modo producción
    ```

## 🧪 Testing

El proyecto utiliza **Jest** para pruebas automatizadas.

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests con cobertura
npm test -- --coverage
```

## ☁️ Despliegue

El despliegue de la aplicacion esta automatizado por medio de GitHub Actions, todo merge realizado en el main branch desde un branch autorizado realizara el despliegue.

## 🤝 Colaboración

¡Las contribuciones son bienvenidas! Por favor sigue estos pasos:

1.  Haz un Fork del repositorio.
2.  Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`).
3.  Commit a tus cambios (`git commit -m 'Add some AmazingFeature'`).
4.  Push a la rama (`git push origin feature/AmazingFeature`).
5.  Abre un Pull Request.

## 📞 Contacto

**Jose Pablo Muñoz Carvajal** - _Lead Developer_

- Email: [safe-ride-app@hotmail.com](mailto:safe-ride-app@hotmail.com)
- GitHub: [@jmunozc023](https://github.com/jmunozc023)

---

© 2025 Safe-Ride. Todos los derechos reservados.
