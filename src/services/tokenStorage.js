import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'saferide_access_token';
const REFRESH_TOKEN_KEY = 'saferide_refresh_token';

// Clave usada antes de migrar a SecureStore. Se lee como fallback en
// `getAccessToken` para no botar a usuarios con sesión activa cuando
// actualicen a la versión que guarda tokens en SecureStore.
const LEGACY_ACCESS_TOKEN_KEY = 'userToken';

const tokenStorage = {
    getAccessToken: async () => {
        const current = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        if (current) return current;

        // Promover el token de la versión anterior a SecureStore y
        // limpiar la clave vieja. Idempotente: si dos peticiones llegan
        // a la vez, ambas escriben el mismo valor y borran lo mismo.
        const legacy = await AsyncStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
        if (!legacy) return null;
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, legacy);
        await AsyncStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
        return legacy;
    },

    getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),

    setTokens: async ({ accessToken, refreshToken }) => {
        const ops = [];
        if (accessToken) ops.push(SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken));
        if (refreshToken) ops.push(SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken));
        await Promise.all(ops);
    },

    clearTokens: async () => {
        await Promise.all([
            SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
            SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
            AsyncStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY),
        ]);
    },
};

export default tokenStorage;
