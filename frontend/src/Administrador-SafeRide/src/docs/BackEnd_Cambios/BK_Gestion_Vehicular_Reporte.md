ESTA ES LA PARTE DE AGREGAR LOS CARROS RRR

# 📑 Reporte Técnico de Ingeniería: Módulo de Gestión Vehicular (Backend)

**SafeRide Backend**  
**Fecha:** 14 de mayo, 2026  
**Estatus:** Desplegado y Operativo en Admin Dashboard

---

## 1. Análisis del Problema y Solución de Arquitectura
El sistema presentaba una limitación en la API de vehículos que impedía la supervisión administrativa. Como solución, se optó por una **extensión no intrusiva** del controlador existente.

**Decisión Técnica Clave:** Se mantuvo el esquema de base de datos original para evitar migraciones costosas, canalizando la aprobación legal a través del campo `isActive` y la validación visual mediante el buffer de `vehicleImage`.

---

## 2. Racional de Ingeniería Senior (El "Por qué" de los cambios)

Como Senior Developer, cada línea de código inyectada responde a una necesidad de negocio y una optimización de arquitectura:

### A. ¿Por qué el listado maestro (`getAllVehicles`)?
*   **Problema:** El backend original estaba atomizado; solo permitía ver vehículos de forma individual o por conductor. El Admin estaba "a ciegas" sobre la flota total.
*   **Solución:** Se centralizó el acceso a la colección `Vehicles`.
*   **Valor del `.populate()`**: Se integró para evitar el problema de rendimiento "N+1". Al enlazar el `driver_id` en una sola consulta, el Dashboard recibe el nombre y foto del dueño del carro instantáneamente, eliminando la necesidad de que el Frontend haga peticiones extra por cada tarjeta.

### B. ¿Por qué la lógica de aprobación vía `isActive`?
*   **Problema:** Necesidad de un "filtro de seguridad" antes de que un auto opere.
*   **Solución:** Se reutilizó el booleano `isActive` con semántica administrativa. Al registrarse desde Expo, el auto entra en `false` (Sala de Espera). Solo la acción explícita del Admin en el Dashboard lo cambia a `true`, habilitándolo para el motor de viajes de la App.
*   **Beneficio:** Seguridad total. Ningún auto puede recoger pasajeros si el Admin no ha validado visualmente el Marchamo y Seguro.

### C. ¿Por qué usar `PATCH` en lugar de `PUT`?
*   **Estándar de Industria:** `PUT` se reserva para reemplazar un objeto completo. Usar `PATCH` para la aprobación es semánticamente correcto ya que solo estamos modificando una propiedad del recurso (el estado de activación). Esto hace la API más limpia, predecible y eficiente.

### D. ¿Por qué Filtros y Regex?
*   **Escalabilidad:** Pensando en una flota de cientos de autos, la búsqueda por texto (`brand`, `license_plate`) mediante **Expresiones Regulares (Regex)** permite encontrar unidades al instante sin importar mayúsculas/minúsculas, mejorando drásticamente la UX del administrador.

---

## 3. Intervención en el Controlador (`src/controllers/vehicleController.js`)

Se inyectaron 70 líneas de código (Líneas 249 a 319) al final del archivo.

### A. Implementación de `getAllVehicles` (Listado Maestro)
Este endpoint alimenta la tabla de inventario del Admin Panel.

**Código Inyectado (Exacto):**
```javascript
// Línea 249: Definición del método con asincronía y manejo de errores Express
exports.getAllVehicles = async (req, res, next) => {
    try {
        // Desestructuración de Query Params para paginación y filtrado (Línea 252)
        const { page = 1, limit = 10, status, search } = req.query;
        const query = {};

        // Lógica de Filtrado por Estado (Líneas 256-258)
        // Se mapea 'active' a isActive:true y 'pending' a isActive:false
        if (status === 'active') query.isActive = true;
        if (status === 'pending') query.isActive = false;

        // Implementación de Búsqueda Elástica con Regex (Líneas 261-267)
        if (search) {
            query.$or = [
                { license_plate: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } }
            ];
        }

        // Consulta Optimizada a MongoDB (Líneas 269-273)
        const vehicles = await Vehicle.find(query)
            .populate('driver_id', 'name username email phone profileImage') // JOIN virtual
            .limit(limit * 1) // Conversión explícita a número
            .skip((page - 1) * limit) // Cálculo de offset
            .sort({ createdAt: -1 }); // Orden descendente (más nuevos primero)

        const count = await Vehicle.countDocuments(query); // Total para paginación (Línea 275)

        // Respuesta Estandarizada (Líneas 277-285)
        res.status(200).json({
            success: true,
            data: vehicles,
            pagination: { total: count, page: parseInt(page), pages: Math.ceil(count / limit) }
        });
    } catch (error) {
        next(error); // Delegación al middleware global de errores (Línea 287)
    }
};
```

### B. Implementación de `updateVehicleStatus` (Aprobación Legal)
Este método permite al Admin dar el "visto bueno" a los papeles del auto.

**Código Inyectado (Exacto):**
```javascript
// Línea 292: Endpoint para PATCH de estado parcial
exports.updateVehicleStatus = async (req, res, next) => {
    try {
        const { isActive } = req.body; // Captura del booleano de aprobación
        const vehicle = await Vehicle.findById(req.params.id); // Búsqueda por ID (Línea 295)

        if (!vehicle) {
            return res.status(404).json({ success: false, message: 'Vehicle not found' });
        }

        vehicle.isActive = isActive; // Actualización de campo (Línea 303)
        await vehicle.save(); // Persistencia en MongoDB

        res.status(200).json({
            success: true,
            message: `Vehicle ${isActive ? 'approved' : 'deactivated'} successfully`,
            data: vehicle
        });
    } catch (error) {
        next(error);
    }
};
```

---

## 3. Configuración de Capa de Transporte (`src/routes/vehicleRoutes.js`)

Se registraron los nuevos descriptores de ruta para exponer la funcionalidad al frontend.

**Líneas Agregadas (Final del archivo):**
```javascript
// Línea 258: Registro de Inventario Global
// Restricción: Solo usuarios con rol 'admin' (authorize)
router.get('/', authorize('admin'), vehicleController.getAllVehicles);

// Línea 268: Registro de Aprobación Documental
// Método: PATCH (para actualización parcial del recurso)
router.patch('/:id/status', authorize('admin'), vehicleController.updateVehicleStatus);
```

---

## 4. Resumen de Ingeniería
1.  **Seguridad**: Se implementó el middleware `authorize('admin')` en ambos niveles de ruta para prevenir escalada de privilegios.
2.  **Optimización**: El uso de `.populate()` en el listado masivo asegura que el dashboard cargue el nombre del conductor sin realizar peticiones extra por cada tarjeta.
3.  **Mantenibilidad**: Se respetó la estructura de errores de Express (`next(error)`) para asegurar que el sistema no se caiga ante peticiones malformadas.

--------

# 📑 Resumen Técnico — Módulo de Gestión Vehicular

Se implementó un nuevo sistema administrativo de gestión vehicular en el backend de SafeRide, permitiendo supervisión, filtrado y aprobación de vehículos desde el Admin Dashboard.

## Funcionalidades Implementadas

* Creación del endpoint `getAllVehicles` para listar toda la flota.
* Soporte para:

  * paginación,
  * búsqueda por placa, marca y modelo,
  * filtrado por estado (`active` / `pending`).
* Uso de `.populate()` para incluir información del conductor sin consultas adicionales.

## Gestión de Estado Vehicular

* Implementación del endpoint `updateVehicleStatus`.
* Los administradores ahora pueden:

  * aprobar vehículos,
  * desactivar registros,
  * controlar validaciones documentales.

## Seguridad y Arquitectura

* Protección completa mediante `authorize('admin')`.
* Manejo centralizado de errores usando `next(error)`.
* Se mantuvo intacto el esquema original de MongoDB para evitar migraciones complejas.

## Resultado

El sistema ahora funciona como un módulo centralizado de inventario y validación vehicular, optimizado para el Admin Dashboard y preparado para escalabilidad futura.

**Fecha:** 14/05/2026
