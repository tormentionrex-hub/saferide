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
import BottomNavigationDriver from '../../components/BottomNavigationDriver';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';

const TripInProgressDriver = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const { showAlert } = useCustomAlert();
    const si = useScrollIndicator({ alwaysVisible: true });

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

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            {/* ── HEADER ── */}
            <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 44 }]}>
                <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={26} color="#191C1E" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Ionicons name="location" size={18} color="#1A73E8" />
                    <Text style={styles.headerTitle}>Viaje en curso</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <View style={{ flex: 1 }}>
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    {...si.scrollProps}
                >
                    {/* ── DESTINO ── */}
                    <View style={styles.destinationSection}>
                        <Text style={styles.destinationLabel}>Destino actual</Text>
                        <Text style={styles.destinationName} numberOfLines={1}>
                            {ride?.destination?.name || 'Sin destino'}
                        </Text>
                    </View>

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
                                        mapRef.current.fitToCoordinates(
                                            [
                                                { latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) },
                                                { latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) },
                                            ],
                                            { edgePadding: { top: 60, right: 60, bottom: 160, left: 60 }, animated: true }
                                        );
                                    }
                                }}
                            >
                                <Marker coordinate={{ latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) }} title="Recogida" pinColor="#1A73E8" />
                                <Marker coordinate={{ latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) }} title="Destino" pinColor="#10B981" />
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

                        {/* Controles de mapa */}
                        <View style={styles.mapControls}>
                            <TouchableOpacity style={styles.mapControlBtn} activeOpacity={0.8}>
                                <Ionicons name="add" size={22} color="#005BBF" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.mapControlBtn} activeOpacity={0.8}>
                                <Ionicons name="remove" size={22} color="#005BBF" />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.mapControlBtn, styles.mapControlBtnPrimary]} activeOpacity={0.8}>
                                <Ionicons name="locate" size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {/* Tarjeta flotante en el mapa */}
                        <View style={styles.journeyCard}>
                            <View style={styles.journeyTopRow}>
                                <View style={styles.journeyCarIcon}>
                                    <Ionicons name="car" size={20} color="#00337C" />
                                </View>
                                <View style={styles.journeyTextBlock}>
                                    <Text style={styles.journeyTime}>
                                        {ride?.duration_minutes ? `Aprox. ${ride.duration_minutes} min de viaje` : 'En camino al destino'}
                                    </Text>
                                    <Text style={styles.journeyMeta}>
                                        {ride?.distance_km ? `Distancia: ${Number(ride.distance_km).toFixed(1)} km` : 'Calculando distancia...'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.journeyFinishBtn} onPress={handleFinalizeTrip} activeOpacity={0.8}>
                                <MaterialCommunityIcons name="logout" size={15} color="#fff" style={{ marginRight: 5 }} />
                                <Text style={styles.journeyFinishText}>Finalizar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ── BENTO GRID ── */}
                    <View style={styles.bentoGrid}>
                        {/* Pasajero */}
                        <View style={styles.bentoCard}>
                            <View style={styles.bentoDriverRow}>
                                {passenger?.profileImage ? (
                                    <Image source={{ uri: passenger.profileImage }} style={styles.bentoAvatar} onError={() => {}} />
                                ) : (
                                    <View style={[styles.bentoAvatar, styles.bentoAvatarFallback]}>
                                        <Text style={styles.bentoAvatarInitials}>
                                            {passenger?.name ? passenger.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?'}
                                        </Text>
                                    </View>
                                )}
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.bentoValue} numberOfLines={1}>
                                        {passenger?.name?.split(' ')[0] || 'Pasajero'}
                                    </Text>
                                    <View style={styles.bentoRatingRow}>
                                        <Ionicons name="star" size={12} color="#F59E0B" />
                                        <Text style={styles.bentoRating}>{passenger?.rating || 'Nuevo'}</Text>
                                    </View>
                                </View>
                            </View>
                            {passenger?.phone && (
                                <TouchableOpacity style={styles.bentoWhatsappBtn} onPress={() => {
                                    const cleanPhone = passenger.phone.replace(/[^0-9+]/g, '');
                                    const waUrl = `whatsapp://send?phone=${cleanPhone}&text=Hola,%20soy%20tu%20conductor.%20Voy%20en%20camino.`;
                                    Linking.canOpenURL(waUrl).then(s => s ? Linking.openURL(waUrl) : Linking.openURL(`https://wa.me/${cleanPhone}`)).catch(() => Linking.openURL(`tel:${passenger.phone}`));
                                }}>
                                    <Ionicons name="logo-whatsapp" size={14} color="#fff" style={{ marginRight: 4 }} />
                                    <Text style={styles.bentoWhatsappText}>Contactar</Text>
                                </TouchableOpacity>
                            )}
                            <Text style={styles.bentoLabel}>TU PASAJERO</Text>
                        </View>

                        {/* Ruta */}
                        <View style={styles.bentoCard}>
                            <View style={styles.bentoRow}>
                                <Ionicons name="navigate" size={26} color="#1A73E8" />
                                <Text style={styles.bentoValue}>
                                    {ride?.distance_km ? `${Number(ride.distance_km).toFixed(1)}` : '--'}
                                    <Text style={styles.bentoUnit}> km</Text>
                                </Text>
                            </View>
                            <Text style={styles.bentoMeta} numberOfLines={1}>
                                {ride?.origin?.name?.split(' ')[0] || 'Origen'} → {ride?.destination?.name?.split(' ')[0] || 'Destino'}
                            </Text>
                            <Text style={styles.bentoLabel}>DISTANCIA</Text>
                        </View>
                    </View>
                </ScrollView>
                <ScrollIndicator si={si} thumbColor="#1A73E8" />
            </View>

            <BottomNavigationDriver navigation={navigation} activeTab="Rutas" />

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
    container: { flex: 1, backgroundColor: '#F7F9FB' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingBottom: 12, backgroundColor: 'rgba(247,249,251,0.95)',
        zIndex: 10,
    },
    headerBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerTitle: { fontSize: 17, fontFamily: 'Poppins-Bold', color: '#191C1E', letterSpacing: -0.3 },
    scrollContent: { paddingBottom: 110 },
    destinationSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
    destinationLabel: { fontSize: 11, fontFamily: 'Poppins-SemiBold', color: '#2B5BB5', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
    destinationName: { fontSize: 26, fontFamily: 'Poppins-Bold', color: '#191C1E', letterSpacing: -0.5 },
    mapCard: {
        marginHorizontal: 16, height: 370, borderRadius: 20, overflow: 'hidden',
        backgroundColor: '#E0E3E5', shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08, shadowRadius: 24, elevation: 8, marginBottom: 16,
    },
    mapUnavailable: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    mapUnavailableText: { marginTop: 10, fontSize: 15, fontFamily: 'Poppins-SemiBold', color: '#727785' },
    mapControls: { position: 'absolute', right: 12, top: 12, gap: 10 },
    mapControlBtn: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.92)',
        justifyContent: 'center', alignItems: 'center', marginBottom: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
    },
    mapControlBtnPrimary: { backgroundColor: '#005BBF' },
    journeyCard: {
        position: 'absolute', bottom: 14, left: 12, right: 12,
        backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 16,
        paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12,
        flexDirection: 'column', gap: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
    },
    journeyTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    journeyCarIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#D8E2FF', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    journeyTextBlock: { flex: 1 },
    journeyTime: { fontSize: 14, fontFamily: 'Poppins-Bold', color: '#191C1E' },
    journeyMeta: { fontSize: 12, fontFamily: 'Poppins-Regular', color: '#727785', marginTop: 2 },
    journeyFinishBtn: {
        backgroundColor: '#EF4444', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch',
        shadowColor: '#EF4444', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 3,
    },
    journeyFinishText: { fontSize: 13, fontFamily: 'Poppins-Bold', color: '#fff', letterSpacing: 0.2 },
    bentoGrid: { flexDirection: 'row', marginHorizontal: 16, gap: 12 },
    bentoCard: { flex: 1, backgroundColor: '#EDF2F7', borderRadius: 16, padding: 16, gap: 4 },
    bentoDriverRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
    bentoAvatar: { width: 44, height: 44, borderRadius: 22, flexShrink: 0 },
    bentoAvatarFallback: { backgroundColor: '#D8E2FF', justifyContent: 'center', alignItems: 'center' },
    bentoAvatarInitials: { fontSize: 15, fontFamily: 'Poppins-Bold', color: '#005BBF' },
    bentoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    bentoValue: { fontSize: 18, fontFamily: 'Poppins-Bold', color: '#191C1E', flexShrink: 1, marginLeft: 6 },
    bentoUnit: { fontSize: 14, fontFamily: 'Poppins-Regular' },
    bentoRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    bentoRating: { fontSize: 13, fontFamily: 'Poppins-SemiBold', color: '#414754' },
    bentoMeta: { fontSize: 12, fontFamily: 'Poppins-Regular', color: '#414754' },
    bentoLabel: { fontSize: 10, fontFamily: 'Poppins-Bold', color: '#727785', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
    bentoWhatsappBtn: {
        backgroundColor: '#25D366', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 4,
    },
    bentoWhatsappText: { fontSize: 11, fontFamily: 'Poppins-Bold', color: '#fff' },
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
