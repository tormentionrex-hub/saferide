import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { useDriverTheme } from '../context/DriverThemeContext';

/**
 * Cache TTL para la consulta de reservas activas al pulsar "Tu viaje".
 * Evita el error 429 (rate limit) cuando el usuario toca repetidamente el tab.
 *
 * RESTAURAR RATE LIMITING (futuro):
 *   Cuando el backend tenga un límite más generoso (>100 req/5min) o el
 *   endpoint /bookings esté excluido del authLimiter, se puede:
 *   1. Eliminar `bookingCache` y `BOOKING_CACHE_TTL`.
 *   2. Volver a llamar `api.get('/bookings')` directamente en onPress sin cache.
 */
let bookingCache = { data: null, lastCheck: 0 };
const BOOKING_CACHE_TTL = 30000; // 30 segundos

// Mapeo de cada item del nav con sus screens relacionados y los iconos que usa
const NAV_ITEMS = [
    {
        label: 'Inicio',
        activeIcon: 'home',
        inactiveIcon: 'home-outline',
        screens: ['DashboardPasajero'],
        target: 'DashboardPasajero',
    },
    {
        label: 'Tu viaje',
        activeIcon: 'car',
        inactiveIcon: 'car-outline',
        // Se ilumina tanto en SearchRide como en ListOfDrivers, TripInProgress, ScreenSaver, WaitingForTheStart
        screens: ['SearchRide', 'ListOfDrivers', 'TripInProgress', 'ScreenSaver', 'WaitingForTheStart'],
        target: 'SearchRide',
    },
    {
        label: 'Historial',
        activeIcon: 'time',
        inactiveIcon: 'time-outline',
        screens: ['History'],
        target: 'History',
    },
    {
        label: 'Métricas',
        activeIcon: 'bar-chart',
        inactiveIcon: 'bar-chart-outline',
        screens: ['Metrics'],
        target: 'Metrics',
    },
];

const BottomNavigationBar = ({ state, descriptors, navigation }) => {
    const { theme } = useDriverTheme();
    const activeColor   = theme.navActive;
    const inactiveColor = theme.navInactive;
    const insets = useSafeAreaInsets();

    const route = useRoute();
    const currentRouteName = state ? state.routes[state.index].name : route.name;

    const visibleItems = NAV_ITEMS.filter(item => item.label !== 'Métricas');

    return (
        <View style={[
            styles.container,
            {
                paddingBottom: insets.bottom > 0 ? insets.bottom : 14,
                height: 70 + (insets.bottom > 0 ? insets.bottom : 14),
                backgroundColor: theme.navBg,
                borderTopColor: theme.navBorder,
            }
        ]}>
            {visibleItems.map((item, idx) => {
                const isActive = item.screens.includes(currentRouteName);
                const color = isActive ? activeColor : inactiveColor;

                // Función que maneja la navegación al tocar un icono.
                const onPress = () => {
                    const event = state ? navigation.emit({
                        type: 'tabPress',
                        target: item.target,
                        canPreventDefault: true,
                    }) : { defaultPrevented: false };

                    if (isActive || event.defaultPrevented) return;

                    // Para "Tu viaje": revisar solo el cache en memoria
                    if (item.target === 'SearchRide') {
                        const now = Date.now();
                        if (bookingCache.data && (now - bookingCache.lastCheck < BOOKING_CACHE_TTL)) {
                            const activeBooking = bookingCache.data.find(
                                b => b.status === 'pending' || b.status === 'confirmed'
                            );
                            if (activeBooking) {
                                bookingCache = { data: null, lastCheck: 0 };
                                let dest;
                                if (activeBooking.status === 'pending') {
                                    dest = 'ScreenSaver';
                                } else if (activeBooking.ride_id?.status === 'in progress') {
                                    dest = 'TripInProgress';
                                } else {
                                    dest = 'WaitingForTheStart';
                                }
                                navigation.navigate(dest, { bookingId: activeBooking._id });
                                return;
                            }
                        }
                    }

                    // Navegación inmediata
                    if (!state) {
                        navigation.navigate('MainTabsPasajero', { screen: item.target });
                    } else {
                        navigation.navigate(item.target);
                    }
                };

                // ── Renderizado del Tab (Activo e Inactivo) ───────────────────
                return (
                    <TouchableOpacity
                        key={item.label}
                        style={styles.navItem}
                        activeOpacity={0.6}
                        onPress={onPress}
                    >
                        <Ionicons
                            name={isActive ? item.activeIcon : item.inactiveIcon}
                            size={26}
                            color={color}
                        />
                        <Text
                            style={[
                                styles.navText,
                                isActive && styles.navTextActive,
                                { color: color },
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            allowFontScaling={false}
                        >
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        width: '100%',
        alignItems: 'center',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
        elevation: 10,
    },
    // ── Tabs laterales ──────────────────────────────────────────────────────
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        paddingTop: 10,
    },
    navText: {
        fontSize: 11,
        marginTop: 3,
        textAlign: 'center',
        width: '100%',
        includeFontPadding: false,
    },
    navTextActive: {
        fontFamily: 'Poppins-SemiBold',
    },
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginTop: 3,
    },
    // ── Tab central elevado ─────────────────────────────────────────────────
    centerWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginTop: -26,
    },
    centerButton: {
        width: 58,
        height: 58,
        borderRadius: 29,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
    },
    centerButtonActive: {
        elevation: 12,
        shadowOpacity: 0.5,
    },
    centerLabel: {
        fontSize: 11,
        marginTop: 4,
        textAlign: 'center',
        width: '100%',
        includeFontPadding: false,
        fontFamily: 'Poppins-SemiBold',
    },
});

export default BottomNavigationBar;
