14/05/26
RRR
Es una actualización del backend para que el rol admin pueda administrar vehículos de cualquier conductor sin errores.
Antes:
Solo los conductores podían modificar sus vehículos.
Si un conductor ya tenía un vehículo, el sistema daba error 409 Conflict.
Existía un rol redundante llamado administrador.
Ahora:
El admin también puede crear, editar y subir imágenes de vehículos.
Si el vehículo ya existe, el sistema lo actualiza en vez de bloquearse (lógica “upsert”).
El vehículo se asigna correctamente al conductor indicado mediante driver_id.
Los roles quedaron estandarizados en:
conductor
pasajero
admin
En resumen: el sistema pasó de manejar vehículos individuales a permitir una gestión completa de flota desde el panel administrativo.


# Detalle de Reparación: Permisos Administrativos y Resiliencia (Solo Rol 'admin')

Este documento detalla los cambios exactos realizados en el backend para eliminar el error "Access Denied" y solucionar el conflicto de duplicidad de vehículos, permitiendo una gestión fluida desde el Panel Administrativo.

---

## 1. Rutas de Vehículos (Acceso al Rol Admin)
**Archivo**: `saferide-backend/src/routes/vehicleRoutes.js`

**Justificación**: Permitir que el rol `admin` realice operaciones CRUD sobre la flota de vehículos, algo anteriormente restringido solo a conductores individuales.

- **Línea 79 (Creación)**, **Línea 182 (Edición)** y **Línea 223 (Imagen)**:
    - **Viejo**: `authorize('conductor')`
    - **Nuevo**: `authorize('conductor', 'admin')`

---

## 2. Controlador de Vehículos (Lógica de Upsert y Delegación)
**Archivo**: `saferide-backend/src/controllers/vehicleController.js`

**Justificación**: Se implementó una lógica de "Gestión Inteligente". Un administrador ahora puede crear o actualizar un vehículo para cualquier conductor sin que el sistema bloquee la operación si el registro ya existe.

- **Líneas 13-14 (Delegación de Propiedad)**:
    - **Nuevo**: El backend detecta el `driver_id` en el body y asigna el vehículo al conductor, no al admin.
      ```javascript
      const targetDriverId = req.user.type === 'admin' && req.body.driver_id ? req.body.driver_id : req.user._id;
      ```

- **Líneas 21-35 (Lógica de Upsert - Solución al error 409)**:
    - **Problema**: El sistema daba error si el conductor ya tenía vehículo.
    - **Solución**: Si el vehículo existe, el controlador ahora **actualiza** los datos en lugar de fallar.
      ```javascript
      if (existingVehicle) {
          const fields = ['brand', 'model', 'license_plate', 'capacity', 'color', 'year'];
          fields.forEach(f => { if (req.body[f] !== undefined) existingVehicle[f] = req.body[f]; });
          await existingVehicle.save();
          return res.status(200).json({ success: true, message: 'Vehicle information updated', data: existingVehicle });
      }
      ```

- **Líneas 120-128 (Permisos y Campos Extendidos)**:
    - **Nuevo**: Se permite al `admin` editar campos sensibles como `license_plate` y `capacity` para correcciones de flota.

---

## 3. Modelo de Usuario (Estandarización)
**Archivo**: `saferide-backend/src/models/User.js`

**Justificación**: Eliminación del rol redundante "administrador" para mantener una arquitectura limpia de 3 roles: `conductor`, `pasajero` y `admin`.

- **Línea 59 (Enum)**:
    - **Estado Final**: `values: ['conductor', 'pasajero', 'admin']`

---

## Conclusión Técnica
Con estas modificaciones, el backend ha pasado de ser un sistema de "Auto-registro" a un sistema de **"Gestión de Flota"**. El Panel Administrativo ahora puede guardar cualquier cambio en el perfil de un conductor (incluyendo su vehículo) sin riesgo de colisiones de datos o bloqueos de permisos.
