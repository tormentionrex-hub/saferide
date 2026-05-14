import React, { useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Platform, Dimensions, ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCustomAlert } from '../../context/CustomAlertContext';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import api from '../../services/api';
import { darkMapStyle } from '../../utils/mapStyle';
import { Image } from 'react-native';

const { width, height } = Dimensions.get('window');

const RideDetail = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const insets = useSafeAreaInsets();
    const { showAlert } = useCustomAlert();
    // Recibimos el objeto completo del viaje y el origen/destino de búsqueda del pasajero
    const { ride, searchOrigin, searchDestination } = route.params;

    const mapRef = useRef(null);

    // Extraemos las coordenadas de origen y destino
    const origin = ride.origin;
    const dest = ride.destination;

    useEffect(() => {
        // Enfoca el mapa para que ambos puntos sean visibles al cargar
        if (origin && dest && mapRef.current) {
            const coords = [
                { latitude: origin.coordinates.lat, longitude: origin.coordinates.lng },
                { latitude: dest.coordinates.lat, longitude: dest.coordinates.lng }
            ];
            mapRef.current.fitToCoordinates(coords, {
                edgePadding: { top: 100, right: 80, bottom: 100, left: 80 },
                animated: true,
            });
        }
    }, [origin, dest]);

    // Redirigir si ya tiene un booking pendiente o confirmado (que no esté vencido)
    useEffect(() => {
        const checkActiveBooking = async () => {
            try {
                const meRes = await api.get('/auth/me');
                if (meRes.data.success) {
                    const passengerId = meRes.data.data._id;
                    const bookingsRes = await api.get(`/bookings/passenger/${passengerId}`);
                    if (bookingsRes.data.success) {
                        const activeBooking = bookingsRes.data.data.find(b =>
                            b.status === 'pending' || b.status === 'confirmed'
                        );
                        if (activeBooking) {
                            if (activeBooking.status === 'confirmed') {
                                navigation.replace('TripInProgress', { bookingId: activeBooking._id });
                            } else if (activeBooking.status === 'pending') {
                                // Si el booking pendiente tiene más de 3 minutos, está vencido → cancelarlo
                                const lastUpdate = activeBooking.updatedAt || activeBooking.createdAt;
                                const timeDiff = Date.now() - new Date(lastUpdate).getTime();
                                if (lastUpdate && timeDiff > 3 * 60 * 1000) {
                                    try { await api.delete(`/bookings/${activeBooking._id}`); } catch (e) {}
                                    // No redirigimos: dejamos al usuario ver el detalle y reservar
                                } else {
                                    navigation.replace('ScreenSaver', { bookingId: activeBooking._id });
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking active booking in RideDetail:', error);
            }
        };
        checkActiveBooking();
    }, []);

    const handleConfirmBooking = async () => {
        try {
            // --- VALIDACIÓN: SOLO UNA RESERVA ACTIVA A LA VEZ ---
            const meRes = await api.get('/auth/me');
            if (meRes.data.success) {
                const passengerId = meRes.data.data._id;
                const bookingsRes = await api.get(`/bookings/passenger/${passengerId}`);
                if (bookingsRes.data.success) {
                    const activeBooking = bookingsRes.data.data.find(b =>
                        b.status === 'pending' || b.status === 'confirmed'
                    );
                    if (activeBooking) {
                        if (activeBooking.status === 'confirmed') {
                            showAlert(
                                'Solicitud en curso',
                                'No puedes solicitar unirte a un nuevo viaje porque ya tienes una reservación confirmada.',
                                'warning'
                            );
                            return;
                        }
                        // Si el pending lleva más de 3 minutos sin respuesta, cancelarlo automáticamente
                        const lastUpdate = activeBooking.updatedAt || activeBooking.createdAt;
                        const timeDiff = Date.now() - new Date(lastUpdate).getTime();
                        if (lastUpdate && timeDiff > 3 * 60 * 1000) {
                            try { await api.delete(`/bookings/${activeBooking._id}`); } catch (e) {}
                            // Booking vencido cancelado, continuar con la nueva reserva
                        } else {
                            showAlert(
                                'Solicitud en curso',
                                'Ya enviaste una solicitud reciente. Espera la respuesta del conductor.',
                                'warning'
                            );
                            return;
                        }
                    }
                }
            }

            const response = await api.post('/bookings', {
                ride_id: ride._id,
                seats_booked: 1,
                passenger_origin: searchOrigin?.name ?? null,
                passenger_destination: searchDestination?.name ?? null,
                passenger_origin_coords: searchOrigin
                    ? { lat: searchOrigin.lat, lng: searchOrigin.lng }
                    : null,
                passenger_destination_coords: searchDestination
                    ? { lat: searchDestination.lat, lng: searchDestination.lng }
                    : null,
            });
            if (response.data.success) {
                navigation.navigate('ScreenSaver', { bookingId: response.data.data._id });
            }
        } catch (error) {
            showAlert('Error', error.response?.data?.message || 'Error al solicitar unirse al viaje.', 'error');
        }
    };


    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor="transparent" translucent />

            {/* MAPA CON CARD HEADER */}
            <View style={styles.mapWrapper}>
                <View style={[styles.mapCardHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border, paddingTop: insets.top + 15, paddingBottom: 15 }]}>
                    <Ionicons name="navigate-outline" size={15} color={theme.accent} />
                    <Text style={[styles.mapCardLabel, { color: theme.text }]}>Tu Viaje</Text>
                </View>
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    customMapStyle={theme.dark ? darkMapStyle : []}
                >
                    {/* Marcador de Origen */}
                    <Marker
                        coordinate={{ latitude: origin.coordinates.lat, longitude: origin.coordinates.lng }}
                        title="Origen"
                        description={origin.name}
                    >
                        <View style={[styles.markerRound, { backgroundColor: theme.accent }]}>
                            <Ionicons name="radio-button-on" size={16} color="#fff" />
                        </View>
                    </Marker>
                    {/* Marcador de Destino */}
                    <Marker
                        coordinate={{ latitude: dest.coordinates.lat, longitude: dest.coordinates.lng }}
                        title="Destino"
                        description={dest.name}
                    >
                        <View style={[styles.markerRound, { backgroundColor: '#FF5A5F' }]}>
                            <Ionicons name="location" size={16} color="#fff" />
                        </View>
                    </Marker>
                </MapView>
            </View>

            {/* BOTÓN CERRAR (FLOTANTE) */}
            <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: theme.surface, top: insets.top + 4 }]}
                onPress={() => navigation.goBack()}
            >
                <Ionicons name="close" size={26} color={theme.text} />
            </TouchableOpacity>

            {/* CARD DE DETALLES (ESTILO PREMIUM) */}
            <View style={[styles.detailCard, { backgroundColor: theme.surface }]}>
                <View style={[styles.dragBar, { backgroundColor: theme.divider }]} />

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                    <View style={styles.headerRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            {ride.driver_id?.profileImage ? (
                                <Image source={{ uri: ride.driver_id.profileImage }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, { backgroundColor: theme.accent + '22' }]}>
                                    <Text style={[styles.avatarText, { color: theme.accent }]}>
                                        {(ride.driver_id?.name || 'D').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            <View>
                                <Text style={[styles.driverLabel, { color: theme.textSecondary }]}>CONDUCTOR</Text>
                                <Text style={[styles.driverName, { color: theme.text }]}>{ride.driver_id?.name || 'Desconocido'}</Text>
                            </View>
                        </View>
                        <View style={styles.priceTag}>
                            <Text style={styles.priceValue}>₡{ride.price}</Text>
                        </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: theme.divider }]} />

                    {/* Ruta Detallada */}
                    <View style={styles.routeBox}>
                        <View style={styles.iconColumn}>
                            <Ionicons name="radio-button-on" size={16} color={theme.accent} />
                            <View style={[styles.dotLine, { backgroundColor: theme.divider }]} />
                            <Ionicons name="location" size={16} color="#FF5A5F" />
                        </View>
                        <View style={styles.textColumn}>
                            <Text style={[styles.locationText, { color: theme.text }]} numberOfLines={1}>{origin.name}</Text>
                            <Text style={[styles.locationText, { color: theme.text, marginTop: 15 }]} numberOfLines={1}>{dest.name}</Text>
                        </View>
                    </View>

                    {/* Métricas del Viaje */}
                    <View style={styles.statsRow}>
                        <View style={[styles.statItem, { backgroundColor: theme.surfaceVariant }]}>
                            <Ionicons name="people-outline" size={18} color={theme.accent} />
                            <Text style={[styles.statText, { color: theme.text }]}>{ride.available_seats} asientos</Text>
                        </View>
                        <View style={[styles.statItem, { backgroundColor: theme.surfaceVariant }]}>
                            <Ionicons name="time-outline" size={18} color={theme.accent} />
                            <Text style={[styles.statText, { color: theme.text }]}>{ride.duration_minutes} min</Text>
                        </View>
                    </View>

                    {/* Botón de Acción Principal */}
                    <TouchableOpacity
                        style={[styles.bookBtn, { backgroundColor: theme.accent }]}
                        onPress={handleConfirmBooking}
                    >
                        <Text style={styles.bookBtnText}>Solicitar unirse</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    mapWrapper: {
        width: '100%',
        height: height * 0.7,
        overflow: 'hidden',
    },
    mapCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    mapCardLabel: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    map: { width: '100%', height: height * 0.7 - 44 },
    closeBtn: {
        position: 'absolute',
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        zIndex: 5,
    },
    markerRound: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
    },
    detailCard: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        maxHeight: height * 0.5,
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: Platform.OS === 'ios' ? 35 : 20,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        elevation: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.12,
        shadowRadius: 15,
    },
    dragBar: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 15 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 16, fontWeight: 'bold' },
    driverLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 2 },
    driverName: { fontSize: 18, fontWeight: 'bold' },
    priceTag: { backgroundColor: '#25C46020', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    priceValue: { color: '#25C460', fontWeight: 'bold', fontSize: 16 },
    divider: { height: 1, marginBottom: 15 },
    routeBox: { flexDirection: 'row', marginBottom: 15 },
    iconColumn: { alignItems: 'center', marginRight: 15 },
    dotLine: { width: 2, height: 25, marginVertical: 4 },
    textColumn: { flex: 1, justifyContent: 'space-between' },
    locationText: { fontSize: 14, fontWeight: '600' },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
    statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
    statText: { fontSize: 12, fontWeight: '600' },
    bookBtn: { paddingVertical: 15, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 5 },
    bookBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15, letterSpacing: 0.5 }
});

export default RideDetail;
