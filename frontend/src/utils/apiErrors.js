// Clasifica un error de axios para mostrar un mensaje honesto. Antes, con el
// servidor caído, el inicio de sesión decía "Correo o contraseña incorrectos.".
//   'network'  → no hubo respuesta (sin internet, servidor apagado, timeout)
//   'server'   → 5xx
//   'auth'     → 401 / 403
//   'rate'     → 429
//   'client'   → otro 4xx
export const classifyApiError = (error) => {
    const status = error?.response?.status;
    if (!error?.response) return 'network';
    if (status >= 500) return 'server';
    if (status === 401 || status === 403) return 'auth';
    if (status === 429) return 'rate';
    return 'client';
};

export const NETWORK_MESSAGE = 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.';
export const SERVER_MESSAGE = 'El servidor tuvo un problema. Intenta de nuevo en unos minutos.';

export const describeLoginError = (error) => {
    const data = error?.response?.data || {};
    switch (classifyApiError(error)) {
        case 'network': return NETWORK_MESSAGE;
        case 'server': return SERVER_MESSAGE;
        case 'rate': return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
        case 'auth':
            if (data.code === 'ACCOUNT_INACTIVE' || /inactive|deactivated|desactivad/i.test(String(data.message || ''))) {
                return 'Tu cuenta está desactivada. Contacta a soporte de SafeRide.';
            }
            return 'Correo o contraseña incorrectos.';
        default:
            return data.errors?.[0]?.message || data.message || 'No se pudo iniciar sesión. Revisa los datos.';
    }
};

// Un refresh que falla sin respuesta (red caída) no significa sesión vencida.
export const isSessionRejected = (error) => {
    const s = error?.response?.status;
    return s === 400 || s === 401 || s === 403;
};
