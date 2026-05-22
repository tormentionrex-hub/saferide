import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import api from './api';
import { navigationRef } from './navigationRef';

// Si estamos en Expo Go, no importar el módulo en absoluto.
// El simple import estático ya dispara el warning interno del SDK 53+ en Android.
const Notifications = isRunningInExpoGo() ? null : require('expo-notifications');

// Pantallas que YA muestran su propia alerta/modal cuando el booking cambia
// de estado (vía polling). Cuando el pasajero está en una de estas pantallas,
// suprimimos el banner del SO para no duplicar la notificación visualmente.
// En cualquier otra pantalla, el banner del SO sigue saliendo normal.
const SCREENS_WITH_IN_APP_HANDLING = new Set([
    'ScreenSaver',
    'WaitingForTheStart',
    'TripInProgress',
]);

if (Notifications) {
    Notifications.setNotificationHandler({
        handleNotification: async () => {
            const currentRoute = navigationRef.current?.getCurrentRoute?.()?.name;
            const handledInApp = currentRoute && SCREENS_WITH_IN_APP_HANDLING.has(currentRoute);
            return {
                shouldShowAlert: !handledInApp,
                shouldShowBanner: !handledInApp,
                shouldShowList: !handledInApp,
                shouldPlaySound: !handledInApp,
                shouldSetBadge: true,
            };
        },
    });
}

/**
 * Solicita permisos, obtiene el Expo Push Token y lo registra en el backend.
 * Llama a esta función justo después del login exitoso.
 */
export const registerForPushNotifications = async () => {
    if (!Notifications) {
        console.log('[Push] Expo Go detectado — push notifications omitidas.');
        return null;
    }

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('[Push] Permiso denegado — no se registrará token.');
            return null;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync();
        const pushToken = tokenData.data;

        try {
            await api.post('/auth/push-token', { pushToken });
            console.log('[Push] Token registrado en backend:', pushToken);
        } catch (e) {
            console.error('[Push] Error guardando token en backend:', e.message);
        }

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'SafeRide',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#38BDF8',
            });
        }

        return pushToken;
    } catch (error) {
        console.log('[Push] Error en el flujo de notificaciones:', error.message);
        return null;
    }
};
