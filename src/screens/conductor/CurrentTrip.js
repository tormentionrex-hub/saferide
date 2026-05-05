import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, StatusBar, Platform, ScrollView, ActivityIndicator, Image, Linking, Animated, Modal } from 'react-native';
import { useCustomAlert } from '../../context/CustomAlertContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import api from '../../services/api';
import MapView, { Marker, Polyline } from 'react-native-maps';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBjX1C4jk1I2E5MB2FnABjTZC0uXt0ullA';

const FinalizeTripModal = ({ visible, onConfirm, onCancel, theme, loading }) => {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0.85);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onCancel}>
            <View style={modalStyles.overlay}>
                <Animated.View style={[modalStyles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }], backgroundColor: theme.surface }]}>
                    <View style={[modalStyles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
                        <Ionicons name="flag" size={44} color="#EF4444" />
                    </View>
                    <Text style={[modalStyles.title, { color: theme.text }]}>Finalizar viaje</Text>
                    <Text style={[modalStyles.subtitle, { color: theme.textSecondary }]}>
                        ¿Estás seguro de que has llegado al destino? Esta acción concluirá el viaje actual y notificará a los pasajeros.
                    </Text>
                    
                    <View style={{ width: '100%', gap: 12 }}>
                        <TouchableOpacity 
                            style={[modalStyles.confirmBtn, { backgroundColor: '#EF4444' }, loading && { opacity: 0.7 }]} 
                            onPress={onConfirm}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Text style={modalStyles.confirmBtnText}>Sí, he llegado al destino</Text>
                                    <MaterialCommunityIcons name="logout" size={18} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[modalStyles.cancelBtn, { borderColor: theme.border }]} 
                            onPress={onCancel}
                            disabled={loading}
                        >
                            <Text style={[modalStyles.cancelBtnText, { color: theme.textSecondary }]}>Aún no, volver</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const decodePolyline = (encoded) => {
    const points = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
        let shift = 0, result = 0, byte;
        do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);
        shift = 0; result = 0;
        do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);
        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
};

const fetchRoutePolyline = async (originLat, originLng, destLat, destLng) => {
    try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&key=${GOOGLE_MAPS_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.routes?.length > 0) {
            return decodePolyline(data.routes[0].overview_polyline.points);
        }
    } catch (e) {
        console.log('[CurrentTrip] Error obteniendo ruta:', e.message);
    }
    return null;
};
import { useLocationTracker } from '../../hooks/useLocationTracker';
import { useScrollIndicator } from '../../components/ScrollIndicator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TripInProgressDriver = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const { showAlert } = useCustomAlert();
    const si = useScrollIndicator({ alwaysVisible: true });
    const insets = useSafeAreaInsets();

    // ListOfRequests nos pasa rideId (el ID del viaje), no bookingId
    const rideId = route?.params?.rideId;
    const mapRef = useRef(null);

    // Activamos el rastreo GPS en tiempo real para el driver
    const { location: driverLocation, errorMsg: locationError } = useLocationTracker(true);

    const [loading, setLoading] = useState(true);
    const [bookingData, setBookingData] = useState(null);
    const [rideData, setRideData] = useState(null);
    const [routeCoords, setRouteCoords] = useState(null);
    const [finishModalVisible, setFinishModalVisible] = useState(false);
    const [finishingTrip, setFinishingTrip] = useState(false);
    const routeFetched = useRef(false);

    // Cargamos tanto el ride como el primer booking confirmado del viaje
    useEffect(() => {
        let intervalId;
        const fetchTripDetails = async () => {
            if (!rideId) {
                setLoading(false);
                return;
            }
            try {
                // 1. Traemos los datos del ride (origen, destino, etc.)
                const rideRes = await api.get(`/rides/${rideId}`);
                if (rideRes.data?.success) {
                    const ride = rideRes.data.data;
                    setRideData(ride);

                    // Cargamos la ruta real por carretera una sola vez
                    const oc = ride?.origin?.coordinates;
                    const dc = ride?.destination?.coordinates;
                    if (!routeFetched.current && oc?.lat && dc?.lat) {
                        routeFetched.current = true;
                        fetchRoutePolyline(Number(oc.lat), Number(oc.lng), Number(dc.lat), Number(dc.lng))
                            .then(coords => {
                                if (coords) {
                                    setRouteCoords(coords);
                                    if (mapRef.current) {
                                        mapRef.current.fitToCoordinates(coords, {
                                            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                                            animated: true,
                                        });
                                    }
                                }
                            });
                    }
                }

                // 2. Traemos los bookings confirmados de este ride para mostrar al pasajero
                const bookingsRes = await api.get(`/bookings/ride/${rideId}`);
                if (bookingsRes.data?.success) {
                    const allBookings = bookingsRes.data.data || [];
                    // Tomamos el primero confirmado (o cualquiera si no hay confirmado aún)
                    const confirmed = allBookings.find(b => b.status === 'confirmed') || allBookings[0];
                    setBookingData(confirmed || null);
                }
            } catch (error) {
                console.log('Error fetching trip:', error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTripDetails();
        intervalId = setInterval(fetchTripDetails, 30000);
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [rideId]);

    const confirmFinalize = async () => {
        try {
            setFinishingTrip(true);
            // 1. Consultamos el estado actual del ride antes de actuar
            const rideCheck = await api.get(`/rides/${rideId}`);
            const currentStatus = rideCheck.data?.data?.status;

            if (currentStatus === 'completed') {
                setFinishModalVisible(false);
                navigation.replace('PaymentVerification', { rideId });
                return;
            }

            if (currentStatus === 'scheduled') {
                // Nunca se marcó 'in progress', lo iniciamos primero
                await api.patch(`/rides/${rideId}/start`);
            }

            // 2. Ahora lo completamos (garantizado en 'in progress')
            const res = await api.patch(`/rides/${rideId}/complete`);
            
            if (res.data?.success) {
                setFinishModalVisible(false);
                navigation.replace('PaymentVerification', { rideId });
            } else {
                setFinishModalVisible(false);
                Alert.alert('Error', res.data?.message || 'No se pudo finalizar el viaje.');
            }
        } catch (error) {
            setFinishModalVisible(false);
            // Mostramos el mensaje real del servidor para facilitar el debug
            const serverMsg = error.response?.data?.message || error.message || 'Error desconocido';
            console.error('Error finalizing trip:', serverMsg, error.response?.status);
            Alert.alert('Error al finalizar', serverMsg);
        } finally {
            setFinishingTrip(false);
        }
    };

    const handleFinalizeTrip = () => {
        showAlert(
            "Finalizar viaje",
            "¿Estás seguro de que has llegado al destino?",
            "warning",
            "Sí, finalizar",
            null,
            "Cancelar",
            async () => {
                        try {
                            // 1. Consultamos el estado actual del ride antes de actuar
                            const rideCheck = await api.get(`/rides/${rideId}`);
                            const currentStatus = rideCheck.data?.data?.status;

                            if (currentStatus === 'completed') {
                                navigation.replace('PaymentVerification', { rideId });
                                return;
                            }

                            if (currentStatus === 'scheduled') {
                                // Nunca se marcó 'in progress', lo iniciamos primero
                                await api.patch(`/rides/${rideId}/start`);
                            }

                            // 2. Ahora lo completamos (garantizado en 'in progress')
                            const res = await api.patch(`/rides/${rideId}/complete`);

                            if (res.data?.success) {
                                navigation.replace('PaymentVerification', { rideId });
                            } else {
                                showAlert('Error', res.data?.message || 'No se pudo finalizar el viaje.', 'error');
                            }
                        } catch (error) {
                            // Mostramos el mensaje real del servidor para facilitar el debug
                            const serverMsg = error.response?.data?.message || error.message || 'Error desconocido';
                            console.error('Error finalizing trip:', serverMsg, error.response?.status);
                            showAlert('Error al finalizar', serverMsg, 'error');
                        }
            }
        );
    };

    if (loading && !rideData) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#EF5350" />
            </SafeAreaView>
        );
    }

    // Si no hay datos del ride, algo salió mal
    if (!rideData) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
                <Ionicons name="alert-circle-outline" size={60} color="#EF5350" />
                <Text style={{ marginTop: 10, fontSize: 18, color: theme.text }}>No se encontró el viaje.</Text>
                <TouchableOpacity style={[styles.finishButton, { backgroundColor: theme.accent, width: '100%' }]} onPress={() => navigation.goBack()}>
                    <Text style={styles.finishButtonText}>Volver</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // ride viene de rideData (GET /rides/:id), passenger viene del booking
    const ride = rideData;
    const passenger = bookingData?.passenger_id;

    const originCoords = ride?.origin?.coordinates;
    const destCoords = ride?.destination?.coordinates;
    const hasCoords = (originCoords?.lat !== undefined && originCoords?.lng !== undefined) &&
        (destCoords?.lat !== undefined && destCoords?.lng !== undefined);

    const passengerPickup = bookingData?.passenger_origin_coords?.lat
        ? bookingData.passenger_origin_coords
        : null;
    const passengerDropoff = bookingData?.passenger_destination_coords?.lat
        ? bookingData.passenger_destination_coords
        : null;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent />

            {/* ── HEADER ── */}
            <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 44 }]}>
                <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.navigate('MainTabsDriver', { screen: 'DashboardDriver' })}>
                    <Ionicons name="chevron-back" size={26} color="#191C1E" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Viaje en curso</Text>
                <TouchableOpacity style={styles.headerMenuBtn}>
                    <Ionicons name="ellipsis-vertical" size={20} color="#191C1E" />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                {...si.scrollProps}
            >
                {/* ── MAPA CARD ── */}
                <View style={styles.mapCard}>
                    {hasCoords ? (
                        <MapView
                            ref={mapRef}
                            style={StyleSheet.absoluteFill}
                            initialRegion={{
                                latitude: (Number(originCoords.lat) + Number(destCoords.lat)) / 2,
                                longitude: (Number(originCoords.lng) + Number(destCoords.lng)) / 2,
                                latitudeDelta: Math.abs(Number(originCoords.lat) - Number(destCoords.lat)) * 2.5 || 0.05,
                                longitudeDelta: Math.abs(Number(originCoords.lng) - Number(destCoords.lng)) * 2.5 || 0.05,
                            }}
                            showsUserLocation={true}
                            onMapReady={() => {
                                if (mapRef.current) {
                                    const coords = [{ latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) }];
                                    if (passengerPickup) coords.push({ latitude: Number(passengerPickup.lat), longitude: Number(passengerPickup.lng) });
                                    if (passengerDropoff) coords.push({ latitude: Number(passengerDropoff.lat), longitude: Number(passengerDropoff.lng) });
                                    else coords.push({ latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) });
                                    mapRef.current.fitToCoordinates(coords, { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true });
                                }
                            }}
                        >
                            {/* Origen del conductor */}
                            <Marker coordinate={{ latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) }} title="Origen del viaje" pinColor="#1A73E8" />
                            {/* Punto de recogida del pasajero */}
                            {passengerPickup && (
                                <Marker
                                    coordinate={{ latitude: Number(passengerPickup.lat), longitude: Number(passengerPickup.lng) }}
                                    title="Subida del pasajero"
                                    description={bookingData?.passenger_origin || ''}
                                    pinColor="#F59E0B"
                                />
                            )}
                            {/* Destino del pasajero (fallback al destino del ride) */}
                            {passengerDropoff ? (
                                <Marker
                                    coordinate={{ latitude: Number(passengerDropoff.lat), longitude: Number(passengerDropoff.lng) }}
                                    title="Bajada del pasajero"
                                    description={bookingData?.passenger_destination || ''}
                                    pinColor="#EF4444"
                                />
                            ) : (
                                <Marker coordinate={{ latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) }} title="Destino" pinColor="#EF4444" />
                            )}
                            {routeCoords && routeCoords.length > 0 ? (
                                <Polyline coordinates={routeCoords} strokeColor="#1A73E8" strokeWidth={5} lineJoin="round" lineCap="round" />
                            ) : (
                                <Polyline
                                    coordinates={[
                                        { latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) },
                                        { latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) },
                                    ]}
                                    strokeColor="#1A73E8" strokeWidth={3} lineDashPattern={[8, 5]}
                                />
                            )}
                        </MapView>
                    ) : (
                        <View style={styles.mapUnavailable}>
                            <Ionicons name="map-outline" size={60} color="#727785" />
                            <Text style={styles.mapUnavailableText}>Mapa no disponible</Text>
                        </View>
                    )}

                    {/* Chip de tiempo y distancia sobre el mapa */}
                    <View style={styles.mapChip}>
                        <Ionicons name="navigate" size={14} color="#1A73E8" />
                        <Text style={styles.mapChipText}>
                            {ride?.duration_minutes ? `${ride.duration_minutes} min` : '--'} • {ride?.distance_km ? `${Number(ride.distance_km).toFixed(1)} km` : '--'}
                        </Text>
                    </View>
                </View>

                {/* ── TARJETA PASAJERO ── */}
                <View style={styles.passengerCard}>
                    <View style={styles.passengerInfo}>
                        {passenger?.profileImage ? (
                            <Image source={{ uri: passenger.profileImage }} style={styles.passengerAvatar} onError={() => {}} />
                        ) : (
                            <View style={[styles.passengerAvatar, styles.passengerAvatarFallback]}>
                                <Text style={styles.passengerAvatarInitials}>
                                    {passenger?.name ? passenger.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?'}
                                </Text>
                            </View>
                        )}
                        <View style={styles.passengerDetails}>
                            <Text style={styles.passengerName} numberOfLines={2}>
                                {passenger?.name || 'Pasajero'}
                            </Text>
                            <View style={styles.passengerRatingRow}>
                                <Ionicons name="star" size={13} color="#F59E0B" />
                                <Text style={styles.passengerRating}>{passenger?.rating || '5.0'}</Text>
                            </View>
                        </View>
                        <View style={styles.passengerActions}>
                            {passenger?.phone && (
                                <>
                                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#25D366' }]} onPress={() => {
                                        const cleanPhone = passenger.phone.replace(/[^0-9+]/g, '');
                                        const waUrl = `whatsapp://send?phone=${cleanPhone}&text=Hola,%20soy%20tu%20conductor.%20Voy%20en%20camino.`;
                                        Linking.canOpenURL(waUrl).then(s => s ? Linking.openURL(waUrl) : Linking.openURL(`https://wa.me/${cleanPhone}`)).catch(() => Linking.openURL(`tel:${passenger.phone}`));
                                    }}>
                                        <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#1A73E8' }]} onPress={() => {
                                        Linking.openURL(`tel:${passenger.phone}`);
                                    }}>
                                        <Ionicons name="call" size={20} color="#fff" />
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                </View>

                {/* ── TARJETA RUTA ── */}
                <View style={styles.routeCard}>
                    <View style={styles.routeRow}>
                        {/* Columna de iconos con línea conectora */}
                        <View style={styles.routeIconColumn}>
                            <View style={[styles.routeDot, { backgroundColor: '#1A73E8' }]} />
                            <View style={styles.routeLine} />
                            <View style={[styles.routeDot, styles.routeDotSquare, { backgroundColor: '#EF4444' }]} />
                        </View>
                        {/* Columna de textos */}
                        <View style={styles.routeTextsColumn}>
                            <View style={styles.routeTextBlock}>
                                <Text style={styles.routeLabel}>PUNTO DE PARTIDA</Text>
                                <Text style={styles.routeAddress} numberOfLines={1}>
                                    {ride?.origin?.name || 'Origen no disponible'}
                                </Text>
                            </View>
                            <View style={styles.routeTextBlock}>
                                <Text style={styles.routeLabel}>DESTINO</Text>
                                <Text style={styles.routeAddress} numberOfLines={1}>
                                    {ride?.destination?.name || 'Destino no disponible'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* ── BOTÓN FINALIZAR ── */}
            <View style={[styles.bottomBtnContainer, { paddingBottom: (insets.bottom > 0 ? insets.bottom : 20) + 12 }]}>
                <TouchableOpacity style={styles.finalizeBtn} onPress={handleFinalizeTrip} activeOpacity={0.85}>
                    <MaterialCommunityIcons name="logout" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.finalizeBtnText}>Finalizar viaje</Text>
                </TouchableOpacity>
            </View>

            <FinalizeTripModal
                visible={finishModalVisible}
                onConfirm={confirmFinalize}
                onCancel={() => setFinishModalVisible(false)}
                theme={theme}
                loading={finishingTrip}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingBottom: 10, backgroundColor: '#FFFFFF',
        zIndex: 10,
    },
    headerBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    headerTitle: { fontSize: 16, fontFamily: 'Poppins-SemiBold', color: '#191C1E', letterSpacing: -0.2 },
    headerMenuBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
    scrollContent: { paddingBottom: 30 },

    // Mapa
    mapCard: {
        marginHorizontal: 20, height: 280, borderRadius: 20, overflow: 'hidden',
        backgroundColor: '#E0E3E5', marginBottom: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
    },
    mapUnavailable: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    mapUnavailableText: { marginTop: 10, fontSize: 15, fontFamily: 'Poppins-SemiBold', color: '#727785' },
    mapChip: {
        position: 'absolute', bottom: 14, left: 14,
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 20,
        paddingHorizontal: 12, paddingVertical: 7,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
    },
    mapChipText: { fontSize: 13, fontFamily: 'Poppins-SemiBold', color: '#191C1E' },

    // Tarjeta pasajero
    passengerCard: {
        marginHorizontal: 20, backgroundColor: '#FFFFFF', borderRadius: 18,
        padding: 16, marginBottom: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
        borderWidth: 1, borderColor: '#F0F0F0',
    },
    passengerInfo: { flexDirection: 'row', alignItems: 'center' },
    passengerAvatar: { width: 52, height: 52, borderRadius: 26 },
    passengerAvatarFallback: { backgroundColor: '#E8EDF2', justifyContent: 'center', alignItems: 'center' },
    passengerAvatarInitials: { fontSize: 17, fontFamily: 'Poppins-Bold', color: '#555' },
    passengerDetails: { flex: 1, marginLeft: 14 },
    passengerName: { fontSize: 16, fontFamily: 'Poppins-SemiBold', color: '#191C1E', lineHeight: 21 },
    passengerRatingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },
    passengerRating: { fontSize: 13, fontFamily: 'Poppins-SemiBold', color: '#414754' },
    passengerActions: { flexDirection: 'row', gap: 10 },
    actionBtn: {
        width: 42, height: 42, borderRadius: 21, backgroundColor: '#F5F5F5',
        justifyContent: 'center', alignItems: 'center',
    },

    // Tarjeta ruta
    routeCard: {
        marginHorizontal: 20, backgroundColor: '#FFFFFF', borderRadius: 18,
        paddingVertical: 18, paddingHorizontal: 20, marginBottom: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
        borderWidth: 1, borderColor: '#F0F0F0',
    },
    routeRow: { flexDirection: 'row' },
    routeIconColumn: { alignItems: 'center', width: 24, marginRight: 14 },
    routeDot: { width: 14, height: 14, borderRadius: 7 },
    routeDotSquare: { borderRadius: 3 },
    routeLine: { width: 2, flex: 1, backgroundColor: '#D0D5DD', marginVertical: 4 },
    routeTextsColumn: { flex: 1, justifyContent: 'space-between', gap: 20 },
    routeTextBlock: {},
    routeLabel: { fontSize: 10, fontFamily: 'Poppins-Bold', color: '#999', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
    routeAddress: { fontSize: 15, fontFamily: 'Poppins-SemiBold', color: '#191C1E' },

    // Botón finalizar
    bottomBtnContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20, paddingTop: 14,
        backgroundColor: '#FFFFFF',
    },
    finalizeBtn: {
        backgroundColor: '#EF4444', paddingVertical: 16, borderRadius: 28,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
    },
    finalizeBtnText: { fontSize: 16, fontFamily: 'Poppins-Bold', color: '#fff', letterSpacing: 0.3 },
});

const modalStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 25 },
    card: { width: '100%', borderRadius: 30, padding: 30, alignItems: 'center', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15 },
    iconCircle: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 24, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 25, lineHeight: 22 },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', paddingVertical: 16, borderRadius: 16, elevation: 2 },
    confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    cancelBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, marginTop: 4 },
    cancelBtnText: { fontSize: 16, fontWeight: '600' },
});

export default TripInProgressDriver;
