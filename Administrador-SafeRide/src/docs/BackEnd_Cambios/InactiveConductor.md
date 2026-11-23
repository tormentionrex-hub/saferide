14/05/26 R

Este era que el conductor no se eliminaba solo se quedaba inactive, lo que se hizo fue un soft delete para que no se borren solo desactiven

# Justificación Técnica: Borrado Lógico (Soft Delete) de Conductores

Este documento detalla la lógica y los beneficios de utilizar un sistema de **Borrado Lógico** en lugar de un borrado físico para la gestión de conductores en la plataforma SafeRide.

---

## 1. Definición del Concepto
El **Soft Delete** es un patrón de diseño donde los registros no se eliminan permanentemente de la base de datos. En su lugar, se utiliza una bandera (flag) booleana —en nuestro caso `isActive: false`— para marcar el registro como "fuera de servicio".

## 2. Razones de Implementación (Nivel Senior)

### A. Integridad Referencial y Relacional
SafeRide es un ecosistema interconectado. Un conductor está vinculado a:
- Historial de Viajes (Rides)
- Registros de Pagos y Facturación
- Calificaciones y Comentarios (Reviews)
- Métricas de Huella de Carbono

**Si realizáramos un Hard Delete (borrado total):**
Cualquier consulta a un viaje pasado fallaría o mostraría datos nulos porque el dueño del viaje ya no existe. Esto rompería los reportes de otros usuarios y de la administración.

### B. Seguridad y Auditoría (Forense)
En una aplicación de transporte, la seguridad es crítica. Si un conductor es reportado por una conducta inapropiada e intenta "borrar su rastro" dándose de baja, el **Soft Delete** garantiza que:
1. El acceso al sistema se le revoque de inmediato.
2. Toda su información histórica permanezca disponible para investigaciones legales o internas de la empresa.

### C. Cumplimiento Financiero
Por normativas fiscales, los registros de transacciones monetarias (pagos de conductores) deben persistir durante varios años. Borrar al usuario que recibió esos pagos invalidaría la trazabilidad financiera del sistema.

### D. Experiencia de Usuario (Retención)
Muchos conductores se retiran temporalmente de la plataforma. El Soft Delete permite que, si el conductor decide regresar 6 meses después, el administrador pueda reactivar su cuenta con un solo click (`isActive: true`), conservando su calificación, historial y preferencias, evitando la fricción de un nuevo registro.

---

## 3. Implementación en SafeRide

### Backend (`userController.js`)
El endpoint de eliminación no ejecuta un `.deleteOne()`, sino que realiza una actualización de estado:
```javascript
// Localización: src/controllers/userController.js -> deleteUser
user.isActive = false;
await user.save();
```

### Frontend (`Admin_SafeRide`)
El Panel Administrativo utiliza este estado para:
1. **Badge de Estado**: Muestra un indicador visual rojo ("Inactivo") en la tarjeta del conductor.
2. **Filtrado de Estadísticas**: Los contadores de "Conductores Activos" omiten automáticamente a los usuarios con `isActive: false`.

---

## 4. Conclusión
El uso de **Soft Delete** transforma la eliminación en una **desactivación de privilegios**, protegiendo la base de conocimientos de SafeRide y garantizando que la plataforma sea auditable y resiliente ante el crecimiento de los datos.
