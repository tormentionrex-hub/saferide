// Cuentas eliminadas: el backend no borra a quien tiene historial, la
// anonimiza (userController.anonymizeUser): name "Usuario eliminado",
// email eliminado+<id>@saferide.invalid y deletedAt con fecha.
// Las listas del panel las ocultan salvo con el filtro "Mostrar eliminados".
export const isDeletedUser = (u) =>
  Boolean(u && typeof u === 'object' && (
    u.deletedAt ||
    /@saferide\.invalid$/i.test(String(u.email || '')) ||
    // Algunas rutas populan solo el nombre (sin email ni deletedAt).
    (!u.email && u.name === 'Usuario eliminado')
  ));

export default isDeletedUser;
