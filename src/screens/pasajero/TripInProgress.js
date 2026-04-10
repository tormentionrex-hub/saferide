import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
    StatusBar, Platform, Linking, ActivityIndicator, Animated,
    Modal, Image, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userService } from '../../services/userService';
import { useCustomAlert } from '../../context/CustomAlertContext';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import BottomNavigationBar from '../../components/BottomNavigationBar';
import MapView, { Marker, Polyline } from 'react-native-maps';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBjX1C4jk1I2E5MB2FnABjTZC0uXt0ullA';

// Decodifica el polyline codificado de Google Maps en array de coordenadas
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

// Obtiene la ruta real entre dos puntos usando Google Directions API
const fetchRoutePolyline = async (originLat, originLng, destLat, destLng) => {
    try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&key=${GOOGLE_MAPS_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.routes?.length > 0) {
            return decodePolyline(data.routes[0].overview_polyline.points);
        }
    } catch (e) {
        console.log('[TripInProgress] Error obteniendo ruta:', e.message);
    }
    return null;
};

/* ─── Modal de Estado Final del Viaje ─────────────────────────────── */
const TripStatusModal = ({ visible, status, onConfirm, theme }) => {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0.85);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    const isCompleted = status === 'completed';

    return (
        <Modal transparent visible={visible} animationType="none">
            <View style={modalStyles.overlay}>
                <Animated.View style={[modalStyles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }], backgroundColor: theme.surface }]}>
                    <View style={[modalStyles.iconCircle, { backgroundColor: isCompleted ? '#ECFDF5' : '#FEF2F2' }]}>
                        <Ionicons
                            name={isCompleted ? 'checkmark-circle' : 'alert-circle'}
                            size={50}
                            color={isCompleted ? '#10B981' : '#EF4444'}
                        />
                    </View>
                    <Text style={[modalStyles.title, { color: theme.text }]}>
                        {isCompleted ? '¡Viaje Finalizado!' : 'Viaje Interrumpido'}
                    </Text>
                    <Text style={[modalStyles.subtitle, { color: theme.textSecondary }]}>
                        {isCompleted
                            ? 'Has llegado a tu destino. Esperamos que hayas tenido un excelente viaje.'
                            : 'Lo sentimos, el viaje ha sido cancelado o rechazado por el conductor.'}
                    </Text>
                    <TouchableOpacity
                        style={[modalStyles.confirmBtn, { backgroundColor: isCompleted ? '#10B981' : '#EF4444' }]}
                        onPress={onConfirm}
                    >
                        <Text style={modalStyles.confirmBtnText}>
                            {isCompleted ? 'Calificar Conductor' : 'Buscar otro viaje'}
                        </Text>
                        <Ionicons name={isCompleted ? 'star' : 'search'} size={18} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

/* ─── Avatar del conductor con fallback de iniciales ──────────────── */
const DriverAvatar = ({ profileImage, name, size = 44 }) => {
    const [imgError, setImgError] = useState(false);
    const initials = name
        ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : '?';
    const radius = size / 2;

    if (profileImage && !imgError) {
        return (
            <Image
                source={{ uri: profileImage }}
                style={{ width: size, height: size, borderRadius: radius }}
                onError={() => setImgError(true)}
            />
        );
    }
    return (
        <View style={{
            width: size, height: size, borderRadius: radius,
            backgroundColor: '#D8E2FF', justifyContent: 'center', alignItems: 'center',
        }}>
            <Text style={{ fontSize: size * 0.33, fontFamily: 'Poppins-Bold', color: '#005BBF' }}>
                {initials}
            </Text>
        </View>
    );
};

/* ─── Pantalla principal ───────────────────────────────────────────── */
const TripInProgress = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const { showAlert } = useCustomAlert();
    const insets = useSafeAreaInsets();

    const bookingId = route?.params?.bookingId;
    const mapRef = useRef(null);
    const currentRegionRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [bookingData, setBookingData] = useState(null);
    const [resolvedBookingId, setResolvedBookingId] = useState(bookingId || null);
    const [noActiveTrip, setNoActiveTrip] = useState(false);
    const [driverLocation, setDriverLocation] = useState(null);
    const [routeCoords, setRouteCoords] = useState(null);
    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [finalStatus, setFinalStatus] = useState(null);

    // Datos del pasajero (para el avatar del header)
    const [passengerPhoto, setPassengerPhoto] = useState(null);
    const [passengerName, setPassengerName] = useState('');

    useEffect(() => {
        const loadPassenger = async () => {
            // 1. Cargar lo que hay en cache primero (respuesta inmediata)
            const cachedPhoto = await AsyncStorage.getItem('userPhoto');
            const cachedName  = await AsyncStorage.getItem('userName');
            if (cachedPhoto && (cachedPhoto.startsWith('http') || cachedPhoto.startsWith('file'))) {
                setPassengerPhoto(cachedPhoto);
            }
            if (cachedName) setPassengerName(cachedName);

            // 2. Sincronizar con el servidor para obtener profileImage real
            try {
                const res = await userService.getProfile();
                const u = res?.data;
                if (u?.profileImage) {
                    setPassengerPhoto(u.profileImage);
                    await AsyncStorage.setItem('userPhoto', u.profileImage);
                }
                if (u?.name) {
                    setPassengerName(u.name);
                    await AsyncStorage.setItem('userName', u.name);
                }
            } catch (e) {
                // Si falla el servidor, quedamos con lo del cache
            }
        };
        loadPassenger();
    }, []);

    // Si no hay bookingId en params, buscamos el booking activo del usuario
    useEffect(() => {
        let findInterval;
        if (!bookingId) {
            const findActiveBooking = async () => {
                try {
                    const res = await api.get('/bookings?status=confirmed&limit=5');
                    if (res.data?.success) {
                        const bookings = res.data.data || [];
                        const active = bookings.find(b => {
                            const rideStatus = b.ride_id?.status;
                            return rideStatus === 'in progress' || rideStatus === 'scheduled';
                        });
                        if (active) {
                            setResolvedBookingId(active._id);
                            setNoActiveTrip(false);
                            if (findInterval) clearInterval(findInterval);
                        } else {
                            setNoActiveTrip(true);
                            setLoading(false);
                        }
                    } else {
                        setNoActiveTrip(true);
                        setLoading(false);
                    }
                } catch (err) {
                    console.log('Error buscando booking activo:', err?.message);
                    setNoActiveTrip(true);
                    setLoading(false);
                }
            };
            findActiveBooking();
            findInterval = setInterval(findActiveBooking, 10000);
        }
        return () => { if (findInterval) clearInterval(findInterval); };
    }, []);

    // Polling principal de datos del booking
    useEffect(() => {
        if (!resolvedBookingId) return;
        let intervalId;

        const fetchTripDetails = async () => {
            try {
                const res = await api.get(`/bookings/${resolvedBookingId}`);
                if (res.data && res.data.success) {
                    const data = res.data.data;
                    setBookingData(data);
                    if (data.status === 'cancelled' || data.status === 'completed' || data.status === 'deny') {
                        if (intervalId) clearInterval(intervalId);
                        if (data.status === 'completed') {
                            navigation.replace('RateDriver', {
                                rideId: data.ride_id?._id?.toString() || data.ride_id?.toString(),
                                driverId: data.ride_id?.driver_id?._id?.toString() || data.ride_id?.driver_id?.toString(),
                                driverName: data.ride_id?.driver_id?.name,
                                driverImage: data.ride_id?.driver_id?.profileImage,
                            });
                        } else {
                            showAlert(
                                'Viaje Finalizado',
                                'El viaje ha sido cancelado o rechazado.',
                                'warning',
                                'Aceptar',
                                () => {
                                    setResolvedBookingId(null);
                                    setBookingData(null);
                                    setNoActiveTrip(true);
                                }
                            );
                        }
                    }
                }
            } catch (error) {
                console.log('Error silenciado haciendo polling a trip details:', error?.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTripDetails();
        intervalId = setInterval(fetchTripDetails, 30000);
        return () => { if (intervalId) clearInterval(intervalId); };
    }, [resolvedBookingId, navigation]);

    // Polling de ubicación del conductor + carga de ruta
    useEffect(() => {
        if (!bookingData || !bookingData.ride_id) return;
        let locationInterval;
        const rideId = bookingData.ride_id._id || bookingData.ride_id;

        const fetchDriverLocation = async () => {
            try {
                const res = await api.get(`/location/${rideId}/driver`);
                if (res.data?.success && res.data.location?.lat) {
                    setDriverLocation({
                        latitude: res.data.location.lat,
                        longitude: res.data.location.lng,
                    });
                }
            } catch (error) {
                // silenciado
            }
        };

        fetchDriverLocation();
        locationInterval = setInterval(fetchDriverLocation, 10000);

        const originCoords = bookingData.ride_id?.origin?.coordinates;
        const destCoords = bookingData.ride_id?.destination?.coordinates;
        if (!routeCoords && originCoords?.lat && destCoords?.lat) {
            fetchRoutePolyline(
                Number(originCoords.lat), Number(originCoords.lng),
                Number(destCoords.lat), Number(destCoords.lng)
            ).then(coords => {
                if (coords) {
                    setRouteCoords(coords);
                    if (mapRef.current) {
                        mapRef.current.fitToCoordinates(coords, {
                            edgePadding: { top: 60, right: 60, bottom: 160, left: 60 },
                            animated: true,
                        });
                    }
                }
            });
        }

        return () => { if (locationInterval) clearInterval(locationInterval); };
    }, [bookingData]);

    const handleCall = (phone) => {
        if (!phone) { showAlert('Aviso', 'El conductor no tiene número registrado.', 'info'); return; }
        Linking.openURL(`tel:${phone}`).catch(() => showAlert('Error', 'No se pudo abrir el marcador.', 'error'));
    };

    const handleMessage = (phone) => {
        if (!phone) { showAlert('Aviso', 'El conductor no tiene número registrado.', 'info'); return; }
        const cleanPhone = phone.replace(/[^0-9+]/g, '');
        const whatsappUrl = `whatsapp://send?phone=${cleanPhone}&text=Hola,%20voy%20en%20el%20viaje`;
        Linking.canOpenURL(whatsappUrl).then(supported => {
            if (supported) return Linking.openURL(whatsappUrl);
            return Linking.openURL(`https://wa.me/${cleanPhone}?text=Hola,%20voy%20en%20el%20viaje`);
        }).catch(() => showAlert('Error', 'No se pudo abrir WhatsApp.', 'error'));
    };

    const handleZoom = (direction) => {
        if (!mapRef.current || !currentRegionRef.current) return;
        const factor = direction === 'in' ? 0.5 : 2;
        const r = currentRegionRef.current;
        mapRef.current.animateToRegion({
            ...r,
            latitudeDelta: r.latitudeDelta * factor,
            longitudeDelta: r.longitudeDelta * factor,
        }, 300);
    };

    const handleRecenter = () => {
        if (!mapRef.current || !bookingData?.ride_id) return;
        const originCoords = bookingData.ride_id?.origin?.coordinates;
        const destCoords = bookingData.ride_id?.destination?.coordinates;
        if (originCoords?.lat && destCoords?.lat) {
            mapRef.current.fitToCoordinates([
                { latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) },
                { latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) },
            ], { edgePadding: { top: 60, right: 60, bottom: 160, left: 60 }, animated: true });
        }
    };

    /* ── Loading ── */
    if (loading && !bookingData) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: '#F7F9FB', justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar barStyle="dark-content" backgroundColor="#F7F9FB" />
                <ActivityIndicator size="large" color="#005BBF" />
                <Text style={{ marginTop: 10, color: '#727785', fontFamily: 'Poppins-Regular' }}>Cargando información del viaje...</Text>
            </SafeAreaView>
        );
    }

    /* ── Sin viaje activo ── */
    if (noActiveTrip || !bookingData || !bookingData.ride_id) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: '#F7F9FB' }]}>
                <StatusBar barStyle="dark-content" backgroundColor="#F7F9FB" />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Ionicons name="car-sport-outline" size={80} color="#727785" style={{ opacity: 0.4, marginBottom: 20 }} />
                    <Text style={{ fontSize: 22, fontFamily: 'Poppins-Bold', color: '#191C1E', textAlign: 'center', marginBottom: 10 }}>
                        No tienes ningún viaje activo
                    </Text>
                    <Text style={{ fontSize: 15, fontFamily: 'Poppins-Regular', color: '#727785', textAlign: 'center', marginBottom: 40, paddingHorizontal: 20 }}>
                        Actualmente no estás a bordo de ningún viaje ni esperando a ser recogido.
                    </Text>
                    <TouchableOpacity
                        style={styles.searchBtn}
                        onPress={() => navigation.navigate('MainTabsPasajero', { screen: 'SearchRide' })}
                    >
                        <Ionicons name="search" size={20} color="#fff" style={{ marginRight: 10 }} />
                        <Text style={styles.searchBtnText}>Buscar viaje</Text>
                    </TouchableOpacity>
                </View>
                <BottomNavigationBar navigation={navigation} />
            </SafeAreaView>
        );
    }

    const { ride_id } = bookingData;
    const driver = ride_id?.driver_id;
    const originCoords = ride_id?.origin?.coordinates;
    const destCoords = ride_id?.destination?.coordinates;
    const hasCoords = originCoords?.lat !== undefined && originCoords?.lng !== undefined
        && destCoords?.lat !== undefined && destCoords?.lng !== undefined;

    const distanceKm = bookingData?.distance_km || ride_id?.distance_km;
    const durationMin = ride_id?.duration_minutes;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            {/* ── HEADER ───────────────────────────────────────────── */}
            <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 4 : 28 }]}>
                <View style={styles.headerLeft}>
                    <Ionicons name="location" size={22} color="#1A73E8" />
                    <Text style={styles.headerTitle}>Viaje en Curso</Text>
                </View>
                <TouchableOpacity
                    style={styles.avatarWrapper}
                    onPress={() => navigation.navigate('PasajeroProfileScreen')}
                >
                    <DriverAvatar profileImage={passengerPhoto} name={passengerName} size={36} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ── DESTINO ─────────────────────────────────────── */}
                <View style={styles.destinationSection}>
                    <Text style={styles.destinationLabel}>Destino actual</Text>
                    <Text style={styles.destinationName} numberOfLines={1}>
                        {ride_id?.destination?.name || 'Sin destino'}
                    </Text>
                </View>

                {/* ── MAPA CARD ───────────────────────────────────── */}
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
                            onRegionChangeComplete={(r) => { currentRegionRef.current = r; }}
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
                            <Marker
                                coordinate={{ latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) }}
                                title="Lugar de Recogida"
                                description={ride_id.origin.name}
                                pinColor="#1A73E8"
                            />
                            <Marker
                                coordinate={{ latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) }}
                                title="Destino del viaje"
                                description={ride_id.destination.name}
                                pinColor="#10B981"
                            />
                            {driverLocation && (
                                <Marker
                                    coordinate={driverLocation}
                                    title={driver?.name || 'Tu Conductor'}
                                    description="Ubicación en vivo"
                                    pinColor="#1A1A1A"
                                />
                            )}
                            {routeCoords && routeCoords.length > 0 ? (
                                <Polyline
                                    coordinates={routeCoords}
                                    strokeColor="#1A73E8"
                                    strokeWidth={5}
                                    lineJoin="round"
                                    lineCap="round"
                                />
                            ) : (
                                <Polyline
                                    coordinates={[
                                        { latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) },
                                        { latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) },
                                    ]}
                                    strokeColor="#1A73E8"
                                    strokeWidth={3}
                                    lineDashPattern={[8, 5]}
                                />
                            )}
                        </MapView>
                    ) : (
                        <View style={styles.mapUnavailable}>
                            <Ionicons name="map-outline" size={60} color="#727785" />
                            <Text style={styles.mapUnavailableText}>Mapa no disponible</Text>
                        </View>
                    )}

                    {/* Degradado inferior */}
                    <View style={styles.mapGradient} pointerEvents="none" />

                    {/* Controles de zoom */}
                    <View style={styles.mapControls}>
                        <TouchableOpacity style={styles.mapControlBtn} onPress={() => handleZoom('in')} activeOpacity={0.8}>
                            <Ionicons name="add" size={22} color="#005BBF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.mapControlBtn} onPress={() => handleZoom('out')} activeOpacity={0.8}>
                            <Ionicons name="remove" size={22} color="#005BBF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.mapControlBtn, styles.mapControlBtnPrimary]} onPress={handleRecenter} activeOpacity={0.8}>
                            <Ionicons name="locate" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Tarjeta de viaje flotante en el mapa */}
                    <View style={styles.journeyCard}>
                        <View style={styles.journeyCarIcon}>
                            <Ionicons name="car" size={20} color="#00337C" />
                        </View>
                        <View style={styles.journeyTextBlock}>
                            <Text style={styles.journeyTime}>
                                {durationMin
                                    ? `Aprox. ${durationMin} min de viaje`
                                    : 'En camino a tu destino'}
                            </Text>
                            <Text style={styles.journeyMeta}>
                                {distanceKm
                                    ? `Distancia: ${Number(distanceKm).toFixed(1)} km`
                                    : 'Calculando distancia...'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── TARJETA CONDUCTOR ──────────────────────────── */}
                <View style={styles.infoCard}>
                    <View style={styles.driverRow}>
                        <DriverAvatar profileImage={driver?.profileImage} name={driver?.name} size={52} />
                        <View style={styles.driverInfo}>
                            <Text style={styles.driverName} numberOfLines={1}>
                                {driver?.name || 'Tu Conductor'}
                            </Text>
                            <View style={styles.driverRatingRow}>
                                <Ionicons name="star" size={14} color="#F59E0B" />
                                <Text style={styles.driverRatingText}>
                                    {driver?.rating || '5.0'}
                                    {driver?.total_rides ? ` (${driver.total_rides} viajes)` : ''}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.driverActions}>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => handleCall(driver?.phone)} activeOpacity={0.8}>
                                <Ionicons name="call" size={19} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnWhatsapp]} onPress={() => handleMessage(driver?.phone)} activeOpacity={0.8}>
                                <Ionicons name="logo-whatsapp" size={19} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* ── TARJETA RUTA ────────────────────────────────── */}
                <View style={styles.infoCard}>
                    <View style={styles.routeRow}>
                        <View style={styles.routeIconCol}>
                            <View style={styles.routeDotOrigin} />
                            <View style={styles.routeLine} />
                            <View style={styles.routeDotDest} />
                        </View>
                        <View style={styles.routeTextCol}>
                            <View style={styles.routeItem}>
                                <Text style={styles.routeItemLabel}>RECOGIDA</Text>
                                <Text style={styles.routeItemValue} numberOfLines={2}>
                                    {ride_id?.origin?.name || '---'}
                                </Text>
                            </View>
                            <View style={styles.routeItemDivider} />
                            <View style={styles.routeItem}>
                                <Text style={styles.routeItemLabel}>DESTINO</Text>
                                <Text style={styles.routeItemValue} numberOfLines={2}>
                                    {ride_id?.destination?.name || '---'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <BottomNavigationBar navigation={navigation} />

            <TripStatusModal
                visible={statusModalVisible}
                status={finalStatus}
                theme={{ surface: '#fff', text: '#191C1E', textSecondary: '#727785' }}
                onConfirm={() => {
                    setStatusModalVisible(false);
                    if (finalStatus === 'completed') {
                        navigation.replace('RateDriver', {
                            rideId: bookingData?.ride_id?._id?.toString() || bookingData?.ride_id?.toString(),
                            driverId: bookingData?.ride_id?.driver_id?._id?.toString() || bookingData?.ride_id?.driver_id?.toString(),
                            driverName: bookingData?.ride_id?.driver_id?.name,
                            driverImage: bookingData?.ride_id?.driver_id?.profileImage,
                        });
                    } else {
                        navigation.navigate('MainTabsPasajero', { screen: 'SearchRide' });
                    }
                }}
            />
        </SafeAreaView>
    );
};

/* ─── Estilos ──────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F9FB',
    },

    /* Header */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 12,
        backgroundColor: 'rgba(247,249,251,0.92)',
        zIndex: 10,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 17,
        fontFamily: 'Poppins-Bold',
        color: '#191C1E',
        letterSpacing: -0.3,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerIconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarWrapper: {
        width: 36,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#C1C6D6',
    },
    avatarImg: {
        width: '100%',
        height: '100%',
    },
    avatarFallback: {
        backgroundColor: '#D8E2FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        fontSize: 13,
        fontFamily: 'Poppins-Bold',
        color: '#005BBF',
    },

    /* Scroll */
    scrollContent: {
        paddingBottom: 110,
    },

    /* Destino */
    destinationSection: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    destinationLabel: {
        fontSize: 11,
        fontFamily: 'Poppins-SemiBold',
        color: '#2B5BB5',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    destinationName: {
        fontSize: 26,
        fontFamily: 'Poppins-Bold',
        color: '#191C1E',
        letterSpacing: -0.5,
    },

    /* Mapa */
    mapCard: {
        marginHorizontal: 16,
        height: 370,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#E0E3E5',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 8,
        marginBottom: 16,
    },
    mapGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
        backgroundColor: 'transparent',
        // Gradient simulado con opacidad
    },
    mapUnavailable: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapUnavailableText: {
        marginTop: 10,
        fontSize: 15,
        fontFamily: 'Poppins-SemiBold',
        color: '#727785',
    },

    /* Controles de mapa */
    mapControls: {
        position: 'absolute',
        right: 12,
        top: 12,
        gap: 10,
    },
    mapControlBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.92)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
        marginBottom: 2,
    },
    mapControlBtnPrimary: {
        backgroundColor: '#005BBF',
    },

    /* Tarjeta de viaje en el mapa */
    journeyCard: {
        position: 'absolute',
        bottom: 14,
        left: 12,
        right: 12,
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.6)',
    },
    journeyCarIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#D8E2FF',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    journeyTextBlock: {
        flex: 1,
    },
    journeyTime: {
        fontSize: 14,
        fontFamily: 'Poppins-Bold',
        color: '#191C1E',
    },
    journeyMeta: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#727785',
        marginTop: 2,
    },
    journeyStopBtn: {
        backgroundColor: '#25D366',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
        shadowColor: '#25D366',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 3,
    },
    journeyStopText: {
        fontSize: 13,
        fontFamily: 'Poppins-Bold',
        color: '#fff',
        letterSpacing: 0.2,
    },

    /* Info cards (conductor + ruta) */
    infoCard: {
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 3,
    },

    /* Conductor card */
    driverRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    driverInfo: {
        flex: 1,
        minWidth: 0,
    },
    driverName: {
        fontSize: 16,
        fontFamily: 'Poppins-Bold',
        color: '#191C1E',
    },
    driverRatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    driverRatingText: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: '#414754',
    },
    driverActions: {
        flexDirection: 'row',
        gap: 10,
        flexShrink: 0,
    },
    actionBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#1A73E8',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#1A73E8',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    actionBtnWhatsapp: {
        backgroundColor: '#25D366',
        shadowColor: '#25D366',
    },

    /* Route card */
    routeRow: {
        flexDirection: 'row',
        gap: 14,
    },
    routeIconCol: {
        alignItems: 'center',
        paddingTop: 4,
        width: 16,
    },
    routeDotOrigin: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#1A73E8',
    },
    routeLine: {
        width: 2,
        flex: 1,
        marginVertical: 4,
        backgroundColor: '#D1D9E6',
    },
    routeDotDest: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#191C1E',
    },
    routeTextCol: {
        flex: 1,
        gap: 0,
    },
    routeItem: {
        paddingVertical: 6,
    },
    routeItemDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 2,
    },
    routeItemLabel: {
        fontSize: 10,
        fontFamily: 'Poppins-Bold',
        color: '#727785',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    routeItemValue: {
        fontSize: 14,
        fontFamily: 'Poppins-SemiBold',
        color: '#191C1E',
        lineHeight: 20,
    },

    /* Sin viaje */
    searchBtn: {
        backgroundColor: '#005BBF',
        paddingHorizontal: 32,
        height: 50,
        borderRadius: 25,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBtnText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Poppins-Bold',
    },
});

const modalStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 25 },
    card: { width: '100%', borderRadius: 30, padding: 30, alignItems: 'center', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15 },
    iconCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 24, fontFamily: 'Poppins-Bold', marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 15, fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', paddingVertical: 16, borderRadius: 16, elevation: 2 },
    confirmBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Poppins-Bold' },
});

export default TripInProgress;
