import { Alert, Platform } from 'react-native';

// En web, react-native-web implementa Alert.alert como una función vacía: los
// errores que la app muestra con Alert.alert (no se pudo aceptar, finalizar,
// cancelar, enviar la reseña…) no aparecían y el usuario no veía nada.
// Aquí se reemplaza solo en web por los diálogos del navegador. En iOS/Android
// no se toca nada.
export const installWebAlert = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    Alert.alert = (title, message, buttons) => {
        const text = [title, message].filter(Boolean).join('\n\n');
        const list = Array.isArray(buttons) ? buttons : [];
        if (list.length <= 1) {
            window.alert(text);
            list[0]?.onPress?.();
            return;
        }
        // Dos o más botones: Aceptar = el botón que no es "cancel" (el último),
        // Cancelar = el botón con style "cancel" (o el primero).
        const cancel = list.find((b) => b.style === 'cancel') || list[0];
        const confirm = [...list].reverse().find((b) => b !== cancel) || list[list.length - 1];
        if (window.confirm(text)) confirm?.onPress?.();
        else cancel?.onPress?.();
    };
};

export default installWebAlert;
