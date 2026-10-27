// Configuración de Expo. Reemplaza al antiguo app.json para poder leer secretos
// y valores por entorno desde .env (desarrollo) o desde los perfiles de
// eas.json (builds), en lugar de dejarlos escritos en el repositorio.
// Clave del SDK nativo del mapa, una por plataforma: Google solo permite un
// tipo de restricción de app por clave (paquete Android o bundle de iOS).
// EXPO_PUBLIC_GOOGLE_MAPS_API_KEY queda como respaldo común para desarrollo.
const MAPS_KEY_FALLBACK = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const MAPS_KEY_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY || MAPS_KEY_FALLBACK;
const MAPS_KEY_IOS = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY || MAPS_KEY_FALLBACK;
// Proyecto de EAS (@christopher202006s-team/saferide). El ID no es secreto:
// identifica el proyecto para builds y push. La variable permite cambiarlo.
const EAS_OWNER = 'christopher202006s-team';
const EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '260f951a-85de-46a2-a63b-3ca4e09ef7cd';

module.exports = {
    expo: {
        name: 'SafeRide',
        slug: 'saferide',
        owner: EAS_OWNER,
        scheme: 'saferide',
        version: '1.0.0',
        orientation: 'portrait',
        icon: './assets/icon.png',
        userInterfaceStyle: 'light',
        splash: {
            image: './assets/splash-icon.png',
            resizeMode: 'contain',
            backgroundColor: '#ffffff',
        },
        ios: {
            supportsTablet: true,
            bundleIdentifier: 'cr.saferide.app',
            buildNumber: '1',
            config: {
                googleMapsApiKey: MAPS_KEY_IOS,
            },
            infoPlist: {
                NSLocationWhenInUseUsageDescription:
                    'SafeRide usa tu ubicación para mostrar viajes cercanos y compartir el recorrido mientras viajas.',
                NSPhotoLibraryUsageDescription:
                    'SafeRide necesita acceso a tus fotos para tu foto de perfil y la de tu vehículo.',
            },
        },
        android: {
            package: 'cr.saferide.app',
            versionCode: 1,
            adaptiveIcon: {
                backgroundColor: '#E6F4FE',
                foregroundImage: './assets/android-icon-foreground.png',
                backgroundImage: './assets/android-icon-background.png',
                monochromeImage: './assets/android-icon-monochrome.png',
            },
            permissions: [
                'ACCESS_COARSE_LOCATION',
                'ACCESS_FINE_LOCATION',
                'POST_NOTIFICATIONS',
            ],
            config: {
                googleMaps: {
                    apiKey: MAPS_KEY_ANDROID,
                },
            },
        },
        web: {
            favicon: './assets/favicon.png',
        },
        plugins: [
            'expo-asset',
            'expo-font',
            '@react-native-community/datetimepicker',
            'expo-mail-composer',
            'expo-secure-store',
            [
                'expo-location',
                {
                    locationWhenInUsePermission:
                        'SafeRide usa tu ubicación para mostrar viajes cercanos y compartir el recorrido mientras viajas.',
                },
            ],
            [
                'expo-image-picker',
                {
                    photosPermission:
                        'SafeRide necesita acceso a tus fotos para tu foto de perfil y la de tu vehículo.',
                    cameraPermission: false,
                },
            ],
            [
                'expo-notifications',
                {
                    color: '#4B68FF',
                },
            ],
        ],
        extra: { eas: { projectId: EAS_PROJECT_ID } },
    },
};
