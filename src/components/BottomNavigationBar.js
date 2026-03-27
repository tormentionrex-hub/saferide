import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { useDriverTheme } from '../context/DriverThemeContext';
import api from '../services/api';

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

const { width } = Dimensions.get('window');

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

// Componente de la Barra de Navegación Inferior para el flujo de Pasajeros
const BottomNavigationBar = ({ state, descriptors, navigation }) => {
    const { theme } = useDriverTheme();
    const activeColor   = theme.navActive;
    const inactiveColor = theme.navInactive;
    const insets = useSafeAreaInsets();

    // Lógica para determinar el nombre de la ruta actual
    const route = useRoute();
    const currentRouteName = state ? state.routes[state.index].name : route.name;

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
            {NAV_ITEMS.filter(item => item.label !== 'Métricas').map((item) => {
                // Verificación de si el item actual de la barra coincide con el screen activo
                const isActive = item.screens.includes(currentRouteName);
                const iconName = isActive ? item.activeIcon : item.inactiveIcon;
                const color = isActive ? activeColor : inactiveColor;

                // Función que maneja la navegación al tocar un icono
                const onPress = async () => {
                    const event = state ? navigation.emit({
                        type: 'tabPress',
                        target: item.target,
                        canPreventDefault: true,
                    }) : { defaultPrevented: false };

                    if (isActive || event.defaultPrevented) return;

                    if (item.target === 'SearchRide') {
                        try {
                            const now = Date.now();
                            let bookings = null;

                            // Usar cache si está fresco (30 s) para evitar 429
                            if (bookingCache.data && (now - bookingCache.lastCheck < BOOKING_CACHE_TTL)) {
                                bookings = bookingCache.data;
                            } else {
                                const res = await api.get('/bookings');
                                if (res.data && res.data.success && res.data.data) {
                                    bookingCache = { data: res.data.data, lastCheck: now };
                                    bookings = res.data.data;
                                }
                            }

                            if (bookings) {
                                const activeBooking = bookings.find(b => b.status === 'pending' || b.status === 'confirmed');
                                if (activeBooking) {
                                    // Invalidar cache al navegar para que la próxima vez refleje estado real
                                    bookingCache = { data: null, lastCheck: 0 };
                                    if (activeBooking.status === 'pending') {
                                        navigation.navigate('ScreenSaver', { bookingId: activeBooking._id });
                                    } else {
                                        try {
                                            const rideId = activeBooking.ride_id._id || activeBooking.ride_id;
                                            const rideRes = await api.get(`/rides/${rideId}`);
                                            const rideStatus = rideRes.data.data.status;
                                            if (rideStatus === 'scheduled') {
                                                navigation.navigate('WaitingForTheStart', { bookingId: activeBooking._id });
                                            } else if (rideStatus === 'in progress') {
                                                navigation.navigate('TripInProgress', { bookingId: activeBooking._id });
                                            } else {
                                                navigation.navigate('TripInProgress', { bookingId: activeBooking._id });
                                            }
                                        } catch (e) {
                                            console.error('Error fetching ride status in navbar:', e);
                                            navigation.navigate('WaitingForTheStart', { bookingId: activeBooking._id });
                                        }
                                    }
                                    return;
                                }
                            }
                        } catch (error) {
                            console.error('Error fetching bookings:', error);
                        }
                    }

                    // Navegación por defecto
                    if (!state) {
                        navigation.navigate('MainTabsPasajero', { screen: item.target });
                    } else {
                        navigation.navigate(item.target);
                    }
                };

                return (
                    <TouchableOpacity
                        key={item.label}
                        style={styles.navItem}
                        activeOpacity={0.6}
                        onPress={onPress}
                    >
                        {/* Ícono de Ionicons con tamaño dinámico según estado */}
                        <Ionicons
                            name={iconName}
                            size={isActive ? 26 : 24}
                            color={color}
                        />
                        {/* Etiqueta del tab con color dinámico */}
                        <Text 
                            style={[
                                styles.navText,
                                { color },
                                isActive && styles.navTextActive
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            allowFontScaling={false}
                        >
                            {item.label}
                        </Text>
                        {/* Indicador visual (punto) para el tab activo */}
                        {isActive && <View style={[styles.activeDot, { backgroundColor: theme.navActive }]} />}
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
        paddingHorizontal: 8,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTopWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
        elevation: 10,
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        paddingTop: 10,
        position: 'relative',
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
});

export default BottomNavigationBar;

