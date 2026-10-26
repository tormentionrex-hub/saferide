const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Safe-Ride API',
      version: '1.0.0',
      description: `
# Safe-Ride Carpooling API

API REST completa para la aplicación de carpooling Safe-Ride. Esta API permite gestionar usuarios, vehículos, viajes, reservaciones, reseñas, notificaciones y métricas de sostenibilidad.

## Características principales

- 🔐 Autenticación JWT con tokens de acceso y refresh
- 👥 Gestión de usuarios (conductores, pasajeros y administradores)
- 🚗 Registro y gestión de vehículos
- 🚕 Creación y búsqueda de viajes con geolocalización
- 📝 Sistema de reservaciones (bookings)
- ⭐ Sistema de reseñas y calificaciones
- 🔔 Notificaciones en tiempo real
- 📊 Métricas de sostenibilidad (CO2 ahorrado, km compartidos)

## Autenticación

La mayoría de los endpoints requieren autenticación mediante JWT (JSON Web Token).

Para autenticarte:
1. Registra un usuario en \`/auth/register\` o inicia sesión en \`/auth/login\`
2. Obtendrás un \`accessToken\` en la respuesta
3. Incluye el token en el header de tus peticiones: \`Authorization: Bearer {tu_token}\`

## Rate Limiting

La API implementa rate limiting para prevenir abuso:
- Endpoints generales: 100 requests por 15 minutos
- Endpoints de autenticación: 5 intentos por 15 minutos
- Endpoints de lectura: 60 requests por minuto

## Códigos de Estado HTTP

- \`200\` - OK: La petición fue exitosa
- \`201\` - Created: El recurso fue creado exitosamente
- \`400\` - Bad Request: Error de validación en los datos enviados
- \`401\` - Unauthorized: Token inválido o ausente
- \`403\` - Forbidden: No tienes permisos para esta acción
- \`404\` - Not Found: Recurso no encontrado
- \`409\` - Conflict: Conflicto con el estado actual (ej: usuario ya existe)
- \`500\` - Internal Server Error: Error del servidor

## Paginación

Los endpoints que retornan listas incluyen paginación:

\`\`\`json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "pages": 10
  }
}
\`\`\`

Parámetros de query:
- \`page\`: Número de página (default: 1)
- \`limit\`: Elementos por página (default: 10, max: 100)
      `,
      contact: {
        name: 'Safe-Ride Support',
        email: 'safe-ride-app@hotmail.com',
        url: 'https://saferide.com/support',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:8080/api/v1',
        description: 'Servidor de Desarrollo Local',
      },
      {
        url: 'https://app-saferide-api-dev.azurewebsites.net/api/v1',
        description: 'Servidor de Desarrollo en Azure',
      },
      {
        url: 'https://app-safe-ride-prd-001-eeekf5h8cvfkbbha.centralus-01.azurewebsites.net/api/v1',
        description: 'Servidor de Producción',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Ingresa tu token JWT en el formato: Bearer {token}',
        },
      },
      schemas: {
        // Schema de Usuario
        User: {
          type: 'object',
          required: ['name', 'username', 'email', 'phone', 'password', 'company', 'type'],
          properties: {
            _id: {
              type: 'string',
              description: 'ID único del usuario',
              example: '507f1f77bcf86cd799439011',
            },
            name: {
              type: 'string',
              minLength: 4,
              description: 'Nombre completo del usuario',
              example: 'Juan Pérez Rodríguez',
            },
            username: {
              type: 'string',
              minLength: 4,
              description: 'Nombre de usuario único',
              example: 'juanperez',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Correo electrónico del usuario',
              example: 'juan.perez@intel.com',
            },
            phone: {
              type: 'string',
              pattern: '^[0-9]{9}$',
              description: 'Número telefónico de 9 dígitos',
              example: '88001234',
            },
            company: {
              type: 'string',
              description: 'Empresa donde labora el usuario',
              example: 'Intel Costa Rica',
            },
            work_schedule: {
              type: 'string',
              description: 'Horario de trabajo del usuario',
              example: '7:00 AM - 4:00 PM',
            },
            rating: {
              type: 'number',
              minimum: 1,
              maximum: 5,
              description: 'Calificación promedio del usuario',
              example: 4.8,
            },
            type: {
              type: 'string',
              enum: ['conductor', 'pasajero', 'admin'],
              description: 'Tipo de usuario en el sistema',
              example: 'conductor',
            },
            profileImage: {
              type: 'string',
              format: 'uri',
              description: 'URL de la imagen de perfil en Azure Blob Storage',
              example: 'https://stsaferidedev.blob.core.windows.net/profile-images/profile-123.jpg',
            },
            isActive: {
              type: 'boolean',
              description: 'Estado de la cuenta del usuario',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de creación de la cuenta',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de última actualización',
            },
          },
        },

        // Schema de Vehículo
        Vehicle: {
          type: 'object',
          required: ['driver_id', 'brand', 'model', 'license_plate', 'color', 'year'],
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439012',
            },
            driver_id: {
              type: 'string',
              description: 'ID del conductor propietario',
              example: '507f1f77bcf86cd799439011',
            },
            brand: {
              type: 'string',
              description: 'Marca del vehículo',
              example: 'Toyota',
            },
            model: {
              type: 'string',
              description: 'Modelo del vehículo',
              example: 'Corolla',
            },
            license_plate: {
              type: 'string',
              pattern: '^[A-Z0-9]{6}$',
              description: 'Placa del vehículo (6 caracteres)',
              example: 'ABC123',
            },
            color: {
              type: 'string',
              description: 'Color del vehículo',
              example: 'Blanco',
            },
            capacity: {
              type: 'integer',
              description: 'Capacidad del vehículo',
              example: 4,
            },
            year: {
              type: 'integer',
              minimum: 1900,
              maximum: 2030,
              description: 'Año del vehículo',
              example: 2020,
            },
            vehicleImage: {
              type: 'string',
              format: 'uri',
              description: 'URL de la imagen del vehículo',
              example: 'https://stsaferidedev.blob.core.windows.net/vehicle-images/vehicle-123.jpg',
            },
            isActive: {
              type: 'boolean',
              description: 'Estado del vehículo',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // Schema de Viaje
        Ride: {
          type: 'object',
          required: ['driver_id', 'origin', 'destination', 'fecha', 'hora', 'available_seats'],
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439013',
            },
            driver_id: {
              type: 'string',
              description: 'ID del conductor',
              example: '507f1f77bcf86cd799439011',
            },
            origin: {
              type: 'object',
              description: 'Ubicación de origen del viaje',
              properties: {
                name: {
                  type: 'string',
                  example: 'Alajuela Centro',
                },
                coordinates: {
                  type: 'object',
                  properties: {
                    lat: {
                      type: 'number',
                      format: 'double',
                      minimum: -90,
                      maximum: 90,
                      example: 10.0162,
                    },
                    lng: {
                      type: 'number',
                      format: 'double',
                      minimum: -180,
                      maximum: 180,
                      example: -84.2119,
                    },
                  },
                },
              },
            },
            destination: {
              type: 'object',
              description: 'Ubicación de destino del viaje',
              properties: {
                name: {
                  type: 'string',
                  example: 'San José Centro',
                },
                coordinates: {
                  type: 'object',
                  properties: {
                    lat: {
                      type: 'number',
                      format: 'double',
                      example: 9.9281,
                    },
                    lng: {
                      type: 'number',
                      format: 'double',
                      example: -84.0907,
                    },
                  },
                },
              },
            },
            fecha: {
              type: 'string',
              format: 'date',
              description: 'Fecha del viaje (YYYY-MM-DD)',
              example: '2024-12-15',
            },
            hora: {
              type: 'string',
              description: 'Hora del viaje (HH:mm)',
              example: '07:00',
            },
            available_seats: {
              type: 'integer',
              minimum: 0,
              maximum: 7,
              description: 'Asientos disponibles en el vehículo',
              example: 3,
            },
            status: {
              type: 'string',
              enum: ['scheduled', 'in progress', 'awaiting_payment_verification', 'completed', 'cancelled'],
              description: 'Estado actual del viaje. awaiting_payment_verification es el paso intermedio entre Finalizar viaje y la confirmación de pagos en PaymentVerification.',
              example: 'scheduled',
            },
            distance_km: {
              type: 'number',
              format: 'float',
              description: 'Distancia del viaje en kilómetros',
              example: 25.5,
            },
            duration_minutes: {
              type: 'integer',
              description: 'Duración estimada en minutos',
              example: 45,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // Schema de Reservación
        Booking: {
          type: 'object',
          required: ['ride_id', 'passenger_id'],
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439014',
            },
            ride_id: {
              type: 'string',
              description: 'ID del viaje reservado',
              example: '507f1f77bcf86cd799439013',
            },
            passenger_id: {
              type: 'string',
              description: 'ID del pasajero',
              example: '507f1f77bcf86cd799439011',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha y hora de la reservación',
            },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'cancelled', 'completed'],
              description: 'Estado de la reservación',
              example: 'confirmed',
            },
            seats_booked: {
              type: 'integer',
              minimum: 1,
              maximum: 7,
              description: 'Número de asientos reservados',
              example: 1,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // Schema de Reseña
        Review: {
          type: 'object',
          required: ['ride_id', 'reviewer_id', 'reviewee_id', 'rating'],
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439015',
            },
            ride_id: {
              type: 'string',
              description: 'ID del viaje evaluado',
              example: '507f1f77bcf86cd799439013',
            },
            reviewer_id: {
              type: 'string',
              description: 'ID del usuario que realiza la reseña',
              example: '507f1f77bcf86cd799439011',
            },
            reviewee_id: {
              type: 'string',
              description: 'ID del usuario evaluado',
              example: '507f1f77bcf86cd799439012',
            },
            rating: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: 'Calificación del 1 al 5',
              example: 5,
            },
            comment: {
              type: 'string',
              maxLength: 500,
              description: 'Comentario opcional sobre el viaje',
              example: 'Excelente conductor, muy puntual y amable.',
            },
            date: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de la reseña',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // Schema de Notificación
        Notification: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439016',
            },
            user_id: {
              type: 'string',
              description: 'ID del usuario destinatario',
              example: '507f1f77bcf86cd799439011',
            },
            message: {
              type: 'string',
              description: 'Mensaje de la notificación',
              example: 'Juan Pérez ha reservado 1 asiento en tu viaje',
            },
            type: {
              type: 'string',
              enum: [
                'booking_confirmed',
                'booking_cancelled',
                'ride_reminder',
                'ride_completed',
                'review_request',
                'system',
              ],
              description: 'Tipo de notificación',
              example: 'booking_confirmed',
            },
            status: {
              type: 'string',
              enum: ['unread', 'read', 'archived'],
              description: 'Estado de la notificación',
              example: 'unread',
            },
            relatedEntity: {
              type: 'object',
              description: 'Entidad relacionada con la notificación',
              properties: {
                entityType: {
                  type: 'string',
                  enum: ['ride', 'booking', 'user'],
                  example: 'booking',
                },
                entityId: {
                  type: 'string',
                  example: '507f1f77bcf86cd799439014',
                },
              },
            },
            date: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de creación de la notificación',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // Schema de Métricas
        Metrics: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439017',
            },
            user_id: {
              type: 'string',
              description: 'ID del usuario',
              example: '507f1f77bcf86cd799439011',
            },
            kilometers_driven: {
              type: 'number',
              format: 'float',
              description: 'Kilómetros totales conducidos',
              example: 245.8,
            },
            carbon_footprint: {
              type: 'number',
              format: 'float',
              description: 'Kilogramos de CO2 ahorrados',
              example: 35.2,
            },
            total_rides: {
              type: 'integer',
              description: 'Total de viajes completados',
              example: 15,
            },
            total_passengers: {
              type: 'integer',
              description: 'Total de pasajeros transportados',
              example: 42,
            },
            period: {
              type: 'string',
              enum: ['daily', 'weekly', 'monthly', 'yearly', 'total'],
              description: 'Período de las métricas',
              example: 'total',
            },
            date: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de actualización de las métricas',
            },
          },
        },

        // Respuestas comunes
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully',
            },
            data: {
              type: 'object',
              description: 'Datos de respuesta',
            },
          },
        },

        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Error message',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    example: 'email',
                  },
                  message: {
                    type: 'string',
                    example: 'Invalid email format',
                  },
                },
              },
            },
          },
        },

        PaginatedResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
            pagination: {
              type: 'object',
              properties: {
                total: {
                  type: 'integer',
                  example: 100,
                },
                page: {
                  type: 'integer',
                  example: 1,
                },
                limit: {
                  type: 'integer',
                  example: 10,
                },
                pages: {
                  type: 'integer',
                  example: 10,
                },
              },
            },
          },
        },
      },

      // Respuestas reutilizables
      responses: {
        UnauthorizedError: {
          description: 'Token de acceso inválido o ausente',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                message: 'Access denied. No token provided.',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'No tienes permisos para acceder a este recurso',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                message: 'Access denied. Insufficient permissions.',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Recurso no encontrado',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                message: 'Resource not found',
              },
            },
          },
        },
        ValidationError: {
          description: 'Error de validación en los datos enviados',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                message: 'Validation errors',
                errors: [
                  {
                    field: 'email',
                    message: 'Invalid email address',
                  },
                ],
              },
            },
          },
        },
        ConflictError: {
          description: 'Conflicto con el estado actual del recurso',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                message: 'User with this email already exists',
              },
            },
          },
        },
      },

      // Parámetros reutilizables
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          description: 'Número de página',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1,
          },
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: 'Elementos por página',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 10,
          },
        },
        IdParam: {
          name: 'id',
          in: 'path',
          description: 'ID del recurso',
          required: true,
          schema: {
            type: 'string',
            pattern: '^[0-9a-fA-F]{24}$',
          },
        },
      },
    },

    // Tags para organizar los endpoints
    tags: [
      {
        name: 'Authentication',
        description: 'Endpoints de autenticación y autorización',
      },
      {
        name: 'Users',
        description: 'Gestión de usuarios del sistema',
      },
      {
        name: 'Vehicles',
        description: 'Gestión de vehículos de los conductores',
      },
      {
        name: 'Rides',
        description: 'Creación, búsqueda y gestión de viajes',
      },
      {
        name: 'Bookings',
        description: 'Reservaciones de viajes por parte de pasajeros',
      },
      {
        name: 'Reviews',
        description: 'Sistema de reseñas y calificaciones',
      },
      {
        name: 'Notifications',
        description: 'Notificaciones del sistema',
      },
      {
        name: 'Metrics',
        description: 'Métricas de sostenibilidad y estadísticas',
      },
    ],
  },

  // Archivos donde buscar anotaciones JSDoc
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;



