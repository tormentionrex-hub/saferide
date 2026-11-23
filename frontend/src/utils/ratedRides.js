import AsyncStorage from '@react-native-async-storage/async-storage';

// Recuerda en el dispositivo qué viajes ya se calificaron, para mostrar el
// botón "Calificar" en el Historial solo donde falta. La autoridad es el
// backend: si responde 409 ("ya calificaste") también se marca aquí.
// Antes la calificación solo existía en la pantalla que sale una vez al
// terminar el viaje: si la persona recargaba o no estaba ahí, se perdía.
const key = (rideId, revieweeId) => `@saferide_rated:${rideId}:${revieweeId}`;

export const isRideRated = async (rideId, revieweeId) => {
    if (!rideId || !revieweeId) return true; // sin datos no se ofrece calificar
    try {
        return (await AsyncStorage.getItem(key(rideId, revieweeId))) === '1';
    } catch {
        return false;
    }
};

export const markRideRated = async (rideId, revieweeId) => {
    if (!rideId || !revieweeId) return;
    try {
        await AsyncStorage.setItem(key(rideId, revieweeId), '1');
    } catch {
        // best-effort: si falla, el backend igual rechaza la reseña repetida (409)
    }
};

// El backend responde 409 con este texto cuando la reseña ya existe.
export const isAlreadyReviewedError = (error) =>
    error?.response?.status === 409
    && /already reviewed/i.test(String(error?.response?.data?.message || ''));
