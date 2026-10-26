// Configuración de Expo. Reemplaza al antiguo app.json para poder leer secretos
// y valores por entorno desde .env (desarrollo) o desde los perfiles de
// eas.json (builds), en lugar de dejarlos escritos en el repositorio.
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

module.exports = {
    expo: {
        name: 'SafeRide',
        slug: 'Saferide-FrontEnd',
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
                googleMapsApiKey: GOOGLE_MAPS_API_KEY,
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
                    apiKey: GOOGLE_MAPS_API_KEY,
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
        extra: EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {},
    },
};
