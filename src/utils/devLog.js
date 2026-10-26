// Registro solo para desarrollo. En un build de producción (__DEV__ false)
// no escribe nada: los errores esperables que la app ya maneja (red caída,
// sondeos fallidos) no deben llenar el log del teléfono ni exponer datos.
export const devLog = (...args) => {
    if (__DEV__) console.log(...args);
};

export default devLog;
