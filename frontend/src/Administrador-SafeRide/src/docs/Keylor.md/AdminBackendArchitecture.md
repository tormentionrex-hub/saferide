# Arquitectura Profesional Backend: Panel Admin (Uber-Style)

Esta guía detalla la implementación de un backend robusto utilizando **Node.js, Express, Sequelize (MySQL)** para un sistema de transporte con panel de administración dedicado.

---

## 1. Estructura de Carpetas (MVC + Services)
Una estructura profesional separa la lógica de las rutas, los datos y los procesos de negocio.

```text
backend/
├── config/             # Configuración de DB (Sequelize)
├── controllers/        # Lógica de entrada/salida (HTTP)
├── middlewares/        # Auth, Validaciones, Roles
├── models/             # Definiciones de tablas (Sequelize)
├── routes/             # Definición de endpoints
├── services/           # Lógica de negocio (Cálculos, DB complex queries)
├── uploads/            # Archivos temporales/locales (Multer)
├── utils/              # Funciones de ayuda (Logger, JWT)
└── app.js              # Punto de entrada
```

---

## 2. Modelos y Relaciones (Sequelize)

### Modelos Principales:
*   **Usuario**: `id, nombre, email, password, rol (admin, moderador, conductor, pasajero), estado (activo, suspendido)`.
*   **Vehiculo**: `id, marca, modelo, placa, año, estado_aprobacion (pendiente, aprobado, rechazado)`.
*   **DocumentoVehiculo**: `id, vehiculo_id, tipo (licencia, RTV, seguro, marchamo), url_archivo`.
*   **Reserva**: `id, pasajero_id, conductor_id, vehiculo_id, origen, destino, estado`.
*   **Pago**: `id, reserva_id, monto, estado (pendiente, completado, fallido)`.
*   **Notificacion**: `id, usuario_id, mensaje, leido`.
*   **Queja**: `id, usuario_id, reserva_id, descripcion, estado (abierta, resuelta, escalada)`.
*   **Auditoria**: `id, admin_id, accion, detalles, fecha`.

### Relaciones:
```javascript
// models/index.js
Usuario.hasMany(Reserva, { foreignKey: 'pasajero_id' });
Usuario.hasOne(Vehiculo, { foreignKey: 'conductor_id' });
Vehiculo.belongsTo(Usuario, { as: 'Conductor', foreignKey: 'conductor_id' });
Vehiculo.hasMany(DocumentoVehiculo, { foreignKey: 'vehiculo_id' });
Reserva.hasOne(Pago, { foreignKey: 'reserva_id' });
```

---

## 3. Sistema de Seguridad y Roles

### Middleware: `verificarRol`
```javascript
// middlewares/auth.js
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ message: "No tienes permiso para esta acción" });
    }
    next();
  };
};

// Uso en rutas
router.get('/usuarios', verifyToken, verificarRol('admin', 'moderador'), controller.listar);
```

---

## 4. Endpoints del Panel Administrativo

### Usuarios
*   `GET /admin/users`: Listado con filtros de estado y rol.
*   `PUT /admin/users/:id/role`: Cambiar el rol de un usuario.
*   `PATCH /admin/users/:id/suspend`: Suspender o activar cuenta.

### Verificación de Conductores (El Corazón del Sistema)
*   `GET /admin/vehicles/pending`: Lista de vehículos con documentos por revisar.
*   `POST /admin/vehicles/:id/approve`:
    *   Cambia `Vehiculo.estado_aprobacion` a 'aprobado'.
    *   Cambia `Usuario.rol` a 'conductor' automáticamente.
    *   Registra en `Auditoria`.

---

## 5. Subida de Documentos (Multer)

```javascript
// middlewares/upload.js
const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/documents/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage });
// En la ruta: upload.fields([{ name: 'licencia' }, { name: 'rtv' }])
```

---

## 6. Sistema de Auditoría
Cada vez que un administrador realiza una acción sensible, se llama a un servicio de auditoría:

```javascript
// services/auditService.js
const registrarAccion = async (adminId, accion, detalles) => {
  await Auditoria.create({ adminId, accion, detalles });
};
```

---

## 7. Pasos de Implementación Recomendados

1.  **Semana 1: Core**: Modelos Sequelize, Migraciones MySQL y Auth (JWT/Bcrypt).
2.  **Semana 2: Documentos**: Configuración de Multer y endpoints para que el pasajero suba sus requisitos para ser conductor.
3.  **Semana 3: Panel Admin**: Creación de las vistas de aprobación y el sistema de roles.
4.  **Semana 4: Auditoría y Dashboard**: Implementación de logs y endpoints estadísticos (COUNTs de usuarios, pagos fallidos, etc.).

---

## 8. Seguridad Extra
*   **Validaciones**: Usa `express-validator` para sanear cada entrada.
*   **Variables de Entorno**: Nunca subas el `JWT_SECRET` o credenciales de DB al repo.
*   **CORS**: Configura solo los dominios permitidos de tu frontend admin.
