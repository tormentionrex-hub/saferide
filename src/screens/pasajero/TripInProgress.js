import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
    StatusBar, Platform, Linking, ActivityIndicator, Animated,
    Modal, Image, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import sessionStorage from '../../services/sessionStorage';
import { userService } from '../../services/userService';
import { useCustomAlert } from '../../context/CustomAlertContext';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import api from '../../services/api';
import BottomNavigationBar from '../../components/BottomNavigationBar';
import ScreenHeader from '../../components/ScreenHeader';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { darkMapStyle } from '../../utils/mapStyle';

import { moderateScale } from '../../utils/responsive';
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

    const bookingId = route?.params?.bookingId;
    const mapRef = useRef(null);
    const currentRegionRef = useRef(null);
    const isCancellingRef = useRef(false);
    const intervalIdRef = useRef(null);
    // Refs de control de ciclo de vida y anti-solapamiento
    const mountedRef = useRef(true);
    const findIntervalRef = useRef(null);
    const findFetchingRef = useRef(false);
    const tripFetchingRef = useRef(false);
    const locationFetchingRef = useRef(false);
    // Idempotencia: una vez disparado el alert de cancelación/rechazo del
    // viaje, no se vuelve a disparar aunque el polling lo vuelva a detectar.
    const alertedRef = useRef(false);

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
    const [paymentMethod, setPaymentMethod] = useState('');

    const [vehicleData, setVehicleData] = useState(null);
    const [vehicleLoading, setVehicleLoading] = useState(false);
    const [vehicleImageError, setVehicleImageError] = useState(false);

    const driverIdForVehicle = useMemo(() => {
        const d = bookingData?.ride_id?.driver_id;
        if (!d) return null;
        const id = d._id ?? d;
        if (!id) return null;
        return typeof id === 'string' ? id : id.toString?.() ?? String(id);
    }, [bookingData?.ride_id?.driver_id]);

    useEffect(() => {
        const loadPassenger = async () => {
            // 1. Cargar lo que hay en cache primero (respuesta inmediata)
            const cachedPhoto = await AsyncStorage.getItem('userPhoto');
            const cachedName  = await AsyncStorage.getItem('userName');
            const cachedMethod = await AsyncStorage.getItem('paymentMethod');
            if (cachedMethod) setPaymentMethod(cachedMethod);

            if (cachedPhoto && (cachedPhoto.startsWith('http') || cachedPhoto.startsWith('file'))) {
                setPassengerPhoto(cachedPhoto);
            }
            if (cachedName) setPassengerName(cachedName);

            // 2. Sincronizar con el servidor para obtener profileImage real
            try {
                const res = await userService.getProfile();
                const u = res?.data;
                if (u?.profileImage) setPassengerPhoto(u.profileImage);
                if (u?.name) setPassengerName(u.name);
                if (u) {
                    await sessionStorage.updateSession({
                        name: u.name,
                        profileImage: u.profileImage,
                    });
                }
            } catch (e) {
                // Si falla el servidor, quedamos con lo del cache
            }
        };
        loadPassenger();
    }, []);

    // Cleanup global de montaje: bloquea setStates tardíos tras desmontar
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Interceptar el back / swipe-back del usuario: el stack anterior (Waiting
    // ForTheStart o ScreenSaver con "ya fuiste aceptado") ya no corresponde
    // porque el viaje está en curso. Lo llevamos al Dashboard, que es el flujo
    // natural. Solo interceptamos GO_BACK/POP — REPLACE/NAVIGATE/RESET que
    // dispara el polling (a PayForTravel, RateDriver, etc.) se dejan pasar.
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            const actionType = e.data?.action?.type;
            if (actionType === 'GO_BACK' || actionType === 'POP') {
                e.preventDefault();
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'MainTabsPasajero', params: { screen: 'DashboardPasajero' } }],
                });
            }
        });
        return unsubscribe;
    }, [navigation]);

    // Si no hay bookingId en params, buscamos el booking activo del usuario
    useEffect(() => {
        if (!bookingId) {
            const findActiveBooking = async () => {
                // Anti-solapamiento: si la request anterior aún corre, saltamos este tick
                if (findFetchingRef.current) return;
                findFetchingRef.current = true;
                try {
                    const res = await api.get('/bookings?status=confirmed&limit=5');
                    if (!mountedRef.current) return;
                    if (res.data?.success) {
                        const bookings = res.data.data || [];
                        const active = bookings.find(b => {
                            const rideStatus = b.ride_id?.status;
                            return rideStatus === 'in progress' || rideStatus === 'scheduled';
                        });
                        if (active) {
                            setResolvedBookingId(active._id);
                            setNoActiveTrip(false);
                            if (findIntervalRef.current) {
                                clearInterval(findIntervalRef.current);
                                findIntervalRef.current = null;
                            }
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
                    if (!mountedRef.current) return;
                    setNoActiveTrip(true);
                    setLoading(false);
                } finally {
                    // Liberar siempre, aunque haya lanzado: el siguiente tick podrá correr
                    findFetchingRef.current = false;
                }
            };
            findActiveBooking();
            findIntervalRef.current = setInterval(findActiveBooking, 10000);
        }
        return () => {
            if (findIntervalRef.current) {
                clearInterval(findIntervalRef.current);
                findIntervalRef.current = null;
            }
            findFetchingRef.current = false;
        };
    }, []);

    // Polling principal de datos del booking
    useEffect(() => {
        if (!resolvedBookingId) return;

        const fetchTripDetails = async () => {
            if (isCancellingRef.current) return;
            // Anti-solapamiento: si la request anterior sigue activa, saltamos este tick
            if (tripFetchingRef.current) return;
            tripFetchingRef.current = true;
            try {
                const res = await api.get(`/bookings/${resolvedBookingId}`);
                if (isCancellingRef.current) return; // BLOQUEO TARDÍO
                if (!mountedRef.current) return;
                if (res.data && res.data.success) {
                    const data = res.data.data;
                    setBookingData(data);
                    if (data.status === 'cancelled' || data.status === 'completed' || data.status === 'deny') {
                        if (intervalIdRef.current) {
                            clearInterval(intervalIdRef.current);
                            intervalIdRef.current = null;
                        }
                        // El pasajero inició la cancelación: no disparar el alert
                        // "El conductor ha cancelado el viaje".
                        if (data.status !== 'completed' && isCancellingRef.current) return;
                        if (data.status === 'completed') {
                            const rideIdStr = data.ride_id?._id?.toString() || data.ride_id?.toString();
                            const driverIdStr = data.ride_id?.driver_id?._id?.toString() || data.ride_id?.driver_id?.toString();
                            const driverNameStr = data.ride_id?.driver_id?.name;
                            const driverImageStr = data.ride_id?.driver_id?.profileImage;

                            if (data.payment_type === 'gifted') {
                                // Viaje regalado: el conductor no confirma pago, pasajero pasa directo a calificar
                                navigation.replace('RateDriver', {
                                    rideId: rideIdStr,
                                    driverId: driverIdStr,
                                    driverName: driverNameStr,
                                    driverImage: driverImageStr,
                                    paidConfirmed: true,
                                    gifted: true,
                                });
                            } else if (data.payment_status === 'paid') {
                                // Ya está pagado (PayPal previo o conductor lo marcó)
                                navigation.replace('RateDriver', {
                                    rideId: rideIdStr,
                                    driverId: driverIdStr,
                                    driverName: driverNameStr,
                                    driverImage: driverImageStr,
                                    paidConfirmed: true,
                                });
                            } else {
                                // payment_status === 'pending' (no gifted, no paid):
                                // pasa por PayForTravel sin importar el método guardado.
                                // Desde ahí el usuario decide Continuar (→ PayPalCheckout
                                // o WaitingPaymentConfirmation) u Omitir (→ RateDriver
                                // dejando el booking pendiente en su historial).
                                navigation.replace('PayForTravel', {
                                    bookingId: data._id,
                                    rideId: rideIdStr,
                                    driverId: driverIdStr,
                                    driverName: driverNameStr,
                                    driverImage: driverImageStr,
                                    paymentMethod,
                                    chargedAmount: data.charged_amount ?? null,
                                });
                            }
                        } else {
                            if (alertedRef.current) return;
                            alertedRef.current = true;
                            showAlert(
                                'Viaje Cancelado',
                                'El conductor ha cancelado el viaje.',
                                'warning',
                                'Aceptar',
                                () => {
                                    navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' });
                                }
                            );
                        }
                    }
                }
            } catch (error) {
                console.log('Error silenciado haciendo polling a trip details:', error?.message);
            } finally {
                // Liberar la bandera siempre, sobreviviendo a excepciones
                tripFetchingRef.current = false;
                if (mountedRef.current) setLoading(false);
            }
        };

        fetchTripDetails();
        intervalIdRef.current = setInterval(fetchTripDetails, 4000);
        return () => {
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
            tripFetchingRef.current = false;
        };
    }, [resolvedBookingId, navigation, paymentMethod]);

    // Polling de ubicación del conductor + carga de ruta
    useEffect(() => {
        if (!bookingData || !bookingData.ride_id) return;
        let locationInterval;
        const rideId = bookingData.ride_id._id || bookingData.ride_id;

        const fetchDriverLocation = async () => {
            // Anti-solapamiento: si una consulta de ubicación sigue en vuelo, saltamos este tick
            if (locationFetchingRef.current) return;
            locationFetchingRef.current = true;
            try {
                const res = await api.get(`/location/${rideId}/driver`);
                if (!mountedRef.current) return;
                if (res.data?.success && res.data.location?.lat) {
                    setDriverLocation({
                        latitude: res.data.location.lat,
                        longitude: res.data.location.lng,
                    });
                }
            } catch (error) {
                // silenciado
            } finally {
                locationFetchingRef.current = false;
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

        return () => {
            if (locationInterval) clearInterval(locationInterval);
            locationFetchingRef.current = false;
        };
    }, [bookingData]);

    useEffect(() => {
        if (!driverIdForVehicle) {
            setVehicleData(null);
            setVehicleLoading(false);
            return;
        }
        let cancelled = false;
        setVehicleLoading(true);
        setVehicleData(null);
        setVehicleImageError(false);
        (async () => {
            try {
                const vRes = await api.get(`/vehicles/driver/${driverIdForVehicle}`);
                if (cancelled) return;
                if (vRes.data?.success && vRes.data.data) {
                    const raw = vRes.data.data;
                    const vInfo = Array.isArray(raw) ? raw[0] : raw;
                    setVehicleData(vInfo && typeof vInfo === 'object' ? vInfo : null);
                } else {
                    setVehicleData(null);
                }
            } catch {
                if (!cancelled) setVehicleData(null);
            } finally {
                if (!cancelled) setVehicleLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [driverIdForVehicle]);

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

    const handleDriverMoreOptions = () => {
        showAlert(
            '¿Cancelar el viaje?',
            '¿Deseas cancelar el viaje en curso?',
            'warning',
            'Sí',
            null,
            'No',
            () => {
                showAlert(
                    'Advertencia',
                    'Si cancelas un viaje en progreso, recibirás un cobro pendiente que deberás pagar obligatoriamente. Si sigues cancelando viajes, podrías recibir una amonestación.',
                    'advertencia',
                    'Sí, deseo cancelar',
                    null,
                    'No, mantener el viaje',
                    async () => {
                        isCancellingRef.current = true;
                        // Detener el polling de inmediato para evitar el alert
                        // cruzado "El conductor ha cancelado el viaje".
                        if (intervalIdRef.current) {
                            clearInterval(intervalIdRef.current);
                            intervalIdRef.current = null;
                        }
                        const bid = resolvedBookingId || bookingData?._id?.toString?.() || bookingData?._id;
                        if (!bid) {
                            showAlert('Error', 'No se encontró la reserva del viaje.', 'error');
                            return;
                        }

                        const isGifted = bookingData?.payment_type === 'gifted' && bookingData?.payment_status === 'waived';

                        try {
                            if (isGifted) {
                                // ── ESCENARIO 1: Viaje regalado ──
                                // Solo cancelar sin tocar payment_status ni payment_type
                                const res = await api.patch(`/bookings/${bid}/status`, {
                                    status: 'cancelled',
                                });

                                if (res.data?.success) {
                                    const trust = res.data?.trust;
                                    // El backend decrementa trustScore solo en este escenario
                                    // (gifted + ride in progress + pasajero cancela). Mostramos
                                    // alert específico que reemplaza el de "Cancelación exitosa".
                                    if (trust?.decremented) {
                                        const reachedZero = trust.newScore === 0;
                                        showAlert(
                                            'Has perdido una oportunidad',
                                            reachedZero
                                                ? 'Tu trust score bajó a 0 de 4. Tu cuenta ha sido limitada: no podrás crear nuevas reservas hasta que un administrador la reactive.'
                                                : `Tu trust score bajó a ${trust.newScore} de 4. ${
                                                    trust.newScore === 1
                                                        ? 'Te queda 1 oportunidad antes de que tu cuenta sea limitada.'
                                                        : `Te quedan ${trust.newScore} oportunidades antes de que tu cuenta sea limitada.`
                                                }`,
                                            'warning',
                                            'Entendido',
                                            () => navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' })
                                        );
                                    } else {
                                        showAlert(
                                            'Cancelación exitosa',
                                            'Tu viaje ha sido cancelado correctamente.',
                                            'success',
                                            'OK',
                                            () => navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' })
                                        );
                                    }
                                } else {
                                    showAlert('Aviso', res.data?.message || 'No se pudo cancelar la reserva.', 'warning');
                                }
                            } else {
                                // ── ESCENARIO 2: Viaje normal con penalización ──
                                const res = await api.patch(`/bookings/${bid}/status`, {
                                    status: 'cancelled',
                                    apply_penalty: true,
                                });

                                if (res.data?.success) {
                                    const updatedBooking = res.data.data;
                                    const penaltyApplied = updatedBooking.charged_amount !== updatedBooking.offered_amount;

                                    if (penaltyApplied) {
                                        showAlert(
                                            'Cancelación con penalización',
                                            `Se te cobrará un monto debido a la cancelación.\nPor favor realiza el pago correspondiente.\n\nMonto a pagar: ₡${updatedBooking.charged_amount}`,
                                            'warning',
                                            'OK',
                                            () => navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' })
                                        );
                                    } else {
                                        showAlert(
                                            'Cancelación exitosa',
                                            'Tu viaje ha sido cancelado.',
                                            'success',
                                            'OK',
                                            () => navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' })
                                        );
                                    }
                                } else {
                                    showAlert('Aviso', res.data?.message || 'No se pudo cancelar la reserva.', 'warning');
                                }
                            }
                        } catch (e) {
                            const msg = e.response?.data?.message || 'No se pudo cancelar el viaje. Intenta de nuevo.';
                            showAlert('Error', msg, 'error');
                        }
                    },
                );
            },
        );
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
        const oc = bookingData.ride_id?.origin?.coordinates;
        const dc = bookingData.ride_id?.destination?.coordinates;
        const pPickup = bookingData?.passenger_origin_coords?.lat ? bookingData.passenger_origin_coords : null;
        const pDropoff = bookingData?.passenger_destination_coords?.lat ? bookingData.passenger_destination_coords : null;
        const coords = [];
        if (oc?.lat) coords.push({ latitude: Number(oc.lat), longitude: Number(oc.lng) });
        if (pPickup) coords.push({ latitude: Number(pPickup.lat), longitude: Number(pPickup.lng) });
        if (pDropoff) coords.push({ latitude: Number(pDropoff.lat), longitude: Number(pDropoff.lng) });
        else if (dc?.lat) coords.push({ latitude: Number(dc.lat), longitude: Number(dc.lng) });
        if (coords.length > 0) {
            mapRef.current.fitToCoordinates(coords, { edgePadding: { top: 60, right: 60, bottom: 160, left: 60 }, animated: true });
        }
    };

    /* ── Loading ── */
    if (loading && !bookingData) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
                <ActivityIndicator size="large" color={theme.navActive} />
                <Text style={{ marginTop: 10, color: theme.textSecondary, fontFamily: 'Poppins-Regular' }}>Cargando información del viaje...</Text>
            </SafeAreaView>
        );
    }

    /* ── Sin viaje activo ── */
    if (noActiveTrip || !bookingData || !bookingData.ride_id) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Ionicons name="car-sport-outline" size={80} color={theme.textSecondary} style={{ opacity: 0.4, marginBottom: 20 }} />
                    <Text style={{ fontSize: moderateScale(22), fontFamily: 'Poppins-Bold', color: theme.text, textAlign: 'center', marginBottom: 10 }}>
                        No tienes ningún viaje activo
                    </Text>
                    <Text style={{ fontSize: moderateScale(15), fontFamily: 'Poppins-Regular', color: theme.textSecondary, textAlign: 'center', marginBottom: 40, paddingHorizontal: 20 }}>
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

    const passengerPickup = bookingData?.passenger_origin_coords?.lat
        ? bookingData.passenger_origin_coords
        : null;
    const passengerDropoff = bookingData?.passenger_destination_coords?.lat
        ? bookingData.passenger_destination_coords
        : null;

    const distanceKm = bookingData?.distance_km || ride_id?.distance_km;
    const durationMin = ride_id?.duration_minutes;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor="transparent" translucent />

            <ScreenHeader
                title="Viaje en Curso"
                onBack={() => navigation.reset({
                    index: 0,
                    routes: [{ name: 'MainTabsPasajero', params: { screen: 'DashboardPasajero' } }],
                })}
                useInsets
                right={
                    <TouchableOpacity
                        style={styles.avatarWrapper}
                        onPress={() => navigation.navigate('PasajeroProfileScreen')}
                    >
                        <DriverAvatar profileImage={passengerPhoto} name={passengerName} size={36} />
                    </TouchableOpacity>
                }
            />

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ── DESTINO ─────────────────────────────────────── */}
                <View style={styles.destinationSection}>
                    <Text style={[styles.destinationLabel, { color: theme.navActive }]}>Destino actual</Text>
                    <Text style={[styles.destinationName, { color: theme.text }]} numberOfLines={1}>
                        {ride_id?.destination?.name || 'Sin destino'}
                    </Text>
                </View>

                {/* ── MAPA CARD ───────────────────────────────────── */}
                <View style={styles.mapCard}>
                    {hasCoords ? (
                        <MapView
                            ref={mapRef}
                            customMapStyle={theme.dark ? darkMapStyle : []}
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
                                    const coords = [{ latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) }];
                                    if (passengerPickup) coords.push({ latitude: Number(passengerPickup.lat), longitude: Number(passengerPickup.lng) });
                                    if (passengerDropoff) coords.push({ latitude: Number(passengerDropoff.lat), longitude: Number(passengerDropoff.lng) });
                                    else coords.push({ latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) });
                                    mapRef.current.fitToCoordinates(coords, { edgePadding: { top: 60, right: 60, bottom: 160, left: 60 }, animated: true });
                                }
                            }}
                        >
                            {/* Origen del conductor */}
                            <Marker
                                coordinate={{ latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) }}
                                title="Origen del conductor"
                                description={ride_id.origin.name}
                                pinColor="#1A73E8"
                            />
                            {/* Punto de recogida del pasajero */}
                            {passengerPickup && (
                                <Marker
                                    coordinate={{ latitude: Number(passengerPickup.lat), longitude: Number(passengerPickup.lng) }}
                                    title="Tu punto de recogida"
                                    description={bookingData?.passenger_origin || ''}
                                    pinColor="#F59E0B"
                                />
                            )}
                            {/* Destino del pasajero (fallback al destino del ride) */}
                            {passengerDropoff ? (
                                <Marker
                                    coordinate={{ latitude: Number(passengerDropoff.lat), longitude: Number(passengerDropoff.lng) }}
                                    title="Tu destino"
                                    description={bookingData?.passenger_destination || ''}
                                    pinColor="#10B981"
                                />
                            ) : (
                                <Marker
                                    coordinate={{ latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) }}
                                    title="Destino del viaje"
                                    description={ride_id.destination.name}
                                    pinColor="#10B981"
                                />
                            )}
                            {/* Ubicación en tiempo real del conductor */}
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

                {/* ── TARJETA CONDUCTOR + VEHÍCULO (solo lectura, datos del conductor) ── */}
                <View style={[styles.infoCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder || theme.border, borderWidth: 1 }]}>
                    <View style={styles.driverVehicleTopRow}>
                        <View style={styles.driverLeftCol}>
                            <DriverAvatar profileImage={driver?.profileImage} name={driver?.name} size={56} />
                            <View style={styles.ratingUnderAvatar}>
                                <Ionicons name="star" size={12} color="#F59E0B" />
                                <Text style={[styles.ratingUnderAvatarText, { color: theme.text }]}>
                                    {driver?.rating != null ? String(driver.rating) : '5.0'}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.vehicleSummaryCol}>
                            {vehicleLoading ? (
                                <ActivityIndicator size="small" color={theme.navActive} style={{ alignSelf: 'flex-end' }} />
                            ) : (
                                <>
                                    <Text style={[styles.vehiclePlate, { color: theme.text }]} numberOfLines={1}>
                                        {vehicleData?.license_plate || vehicleData?.licensePlate || '---'}
                                    </Text>
                                    <Text
                                        style={[styles.vehicleColorModel, { color: theme.text }]}
                                        numberOfLines={2}
                                    >
                                        {[vehicleData?.color, vehicleData?.brand, vehicleData?.model]
                                            .filter(Boolean)
                                            .join(' ')
                                            .trim() || '---'}
                                    </Text>
                                </>
                            )}
                        </View>
                        <View
                            style={[
                                styles.vehiclePhotoSlot,
                                {
                                    backgroundColor: theme.dark ? '#1C1C1E' : '#E8ECF2',
                                    borderColor: theme.border,
                                },
                            ]}
                        >
                            {vehicleData?.vehicleImage && !vehicleImageError ? (
                                <Image
                                    source={{ uri: vehicleData.vehicleImage }}
                                    style={StyleSheet.absoluteFillObject}
                                    resizeMode="cover"
                                    onError={() => setVehicleImageError(true)}
                                />
                            ) : null}
                        </View>
                    </View>
                    <Text style={[styles.driverNameHero, { color: theme.text }]} numberOfLines={2}>
                        {(driver?.name || 'Tu conductor').toUpperCase()}
                    </Text>
                    <View style={styles.driverActionsRow}>
                        <TouchableOpacity
                            style={[styles.msgBtnWide, { backgroundColor: theme.surfaceVariant }]}
                            onPress={() => handleMessage(driver?.phone)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                            <Text style={[styles.msgBtnWideText, { color: theme.text }]} numberOfLines={1}>
                                Envía un mensaje
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtnSquare, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
                            onPress={() => handleCall(driver?.phone)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="call" size={20} color={theme.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtnSquare, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
                            onPress={handleDriverMoreOptions}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── TARJETA RUTA ────────────────────────────────── */}
                <View style={[styles.infoCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder || theme.border, borderWidth: 1 }]}>
                    <View style={styles.routeRow}>
                        <View style={styles.routeIconCol}>
                            <View style={[styles.routeDotOrigin, { backgroundColor: theme.navActive }]} />
                            <View style={styles.routeLine} />
                            <View style={[styles.routeDotDest, { backgroundColor: theme.text }]} />
                        </View>
                        <View style={styles.routeTextCol}>
                            <View style={styles.routeItem}>
                                <Text style={[styles.routeItemLabel, { color: theme.textSecondary }]}>RECOGIDA</Text>
                                <Text style={[styles.routeItemValue, { color: theme.text }]} numberOfLines={2}>
                                    {ride_id?.origin?.name || '---'}
                                </Text>
                            </View>
                            <View style={[styles.routeItemDivider, { backgroundColor: theme.surfaceVariant }]} />
                            <View style={styles.routeItem}>
                                <Text style={[styles.routeItemLabel, { color: theme.textSecondary }]}>DESTINO</Text>
                                <Text style={[styles.routeItemValue, { color: theme.text }]} numberOfLines={2}>
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
        // El backgroundColor lo aplica el componente desde theme.bg para
        // que coincida con el resto de la app (DashboardPasajero).
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
        fontSize: moderateScale(13),
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
        fontSize: moderateScale(11),
        fontFamily: 'Poppins-SemiBold',
        color: '#2B5BB5',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    destinationName: {
        fontSize: moderateScale(26),
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
        fontSize: moderateScale(15),
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
        fontSize: moderateScale(14),
        fontFamily: 'Poppins-Bold',
        color: '#191C1E',
    },
    journeyMeta: {
        fontSize: moderateScale(12),
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
        fontSize: moderateScale(13),
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

    /* Conductor + vehículo (referencia: placa, color/marca/modelo, foto opcional) */
    driverVehicleTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    driverLeftCol: {
        alignItems: 'center',
        width: 64,
    },
    ratingUnderAvatar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
    },
    ratingUnderAvatarText: {
        fontSize: moderateScale(13),
        fontFamily: 'Poppins-SemiBold',
    },
    vehicleSummaryCol: {
        flex: 1,
        minWidth: 0,
        alignItems: 'flex-end',
        paddingRight: 4,
    },
    vehiclePlate: {
        fontSize: moderateScale(22),
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.5,
        textAlign: 'right',
    },
    vehicleColorModel: {
        fontSize: moderateScale(14),
        fontFamily: 'Poppins-Medium',
        textAlign: 'right',
        marginTop: 4,
        lineHeight: 18,
    },
    vehiclePhotoSlot: {
        width: 72,
        height: 72,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
    },
    driverNameHero: {
        fontSize: moderateScale(20),
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.3,
        marginTop: 14,
    },
    driverActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 16,
    },
    msgBtnWide: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        minHeight: 48,
    },
    msgBtnWideText: {
        fontSize: moderateScale(14),
        fontFamily: 'Poppins-SemiBold',
        flexShrink: 1,
    },
    actionBtnSquare: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
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
        fontSize: moderateScale(10),
        fontFamily: 'Poppins-Bold',
        color: '#727785',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    routeItemValue: {
        fontSize: moderateScale(14),
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
        fontSize: moderateScale(16),
        fontFamily: 'Poppins-Bold',
    },
});

const modalStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 25 },
    card: { width: '100%', borderRadius: 30, padding: 30, alignItems: 'center', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15 },
    iconCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: moderateScale(24), fontFamily: 'Poppins-Bold', marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: moderateScale(15), fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', paddingVertical: 16, borderRadius: 16, elevation: 2 },
    confirmBtnText: { color: '#fff', fontSize: moderateScale(16), fontFamily: 'Poppins-Bold' },
});

export default TripInProgress;
