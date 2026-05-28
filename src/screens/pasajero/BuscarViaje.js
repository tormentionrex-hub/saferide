import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
    StatusBar, Platform, Dimensions, ScrollView, Modal, Linking,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCustomAlert } from '../../context/CustomAlertContext';
import { getCurrentLocation, reverseGeocode } from '../../services/locationService';
import api from '../../services/api';
import { GOOGLE_MAPS_API_KEY } from '../../config.js';
import LocationPicker from '../../components/LocationPicker';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { darkMapStyle } from '../../utils/mapStyle';
import BottomNavigationBar from '../../components/BottomNavigationBar';
import ScreenHeader from '../../components/ScreenHeader';

import { moderateScale } from '../../utils/responsive';
const { width } = Dimensions.get('window');
const ACCENT = '#2563EB';
const RECENT_SEARCHES_KEY = 'buscarViaje_recentSearches';

// ── Decodificar polyline de Google Directions ──
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
        console.log('[BuscarViaje] Error obteniendo ruta:', e.message);
    }
    return null;
};

const BuscarViaje = ({ navigation, route }) => {
    const { theme } = useDriverTheme();
    const { showAlert, hideAlert } = useCustomAlert();
    const alertTimerRef = useRef(null);
    const insets = useSafeAreaInsets();

    const [origen, setOrigen] = useState(null);
    const [destino, setDestino] = useState(null);
    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickingFor, setPickingFor] = useState('origen');
    const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
    const [mostrarCalendario, setMostrarCalendario] = useState(false);
    const [pasajeros, setPasajeros] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(true);
    const [errors, setErrors] = useState({});
    const [recentSearches, setRecentSearches] = useState([]);
    const [showActiveBookingModal, setShowActiveBookingModal] = useState(false);
    const [routeCoords, setRouteCoords] = useState(null);

    const mapRef = useRef(null);
    const [region, setRegion] = useState({
        latitude: 9.9281,
        longitude: -84.0907,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    });

    // Montaje inicial: cargar búsquedas recientes y, si NO hay prefill,
    // detectar la ubicación actual automáticamente.
    useEffect(() => {
        if (!route?.params?.prefillOrigin) {
            loadCurrentLocation();
        }
        loadRecentSearches();
    }, []);

    // Aplicar prefill cada vez que cambian los params.
    // Esto es necesario porque la pantalla puede quedar montada en el stack
    // (cuando se sale con navigation.navigate en vez de goBack), y un nuevo
    // tap en otra ruta frecuente debe refrescar los campos.
    useEffect(() => {
        const o = route?.params?.prefillOrigin;
        if (!o) return;

        setOrigen({ lat: o.lat, lng: o.lng, name: o.name, address: o.address || o.name });
        setRegion({
            latitude: o.lat,
            longitude: o.lng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
        });
        setLoadingLocation(false);

        if (route?.params?.prefillDestination) {
            const d = route.params.prefillDestination;
            setDestino({ lat: d.lat, lng: d.lng, name: d.name, address: d.address || d.name });
        }

        // Preguntar al usuario si desea usar su ubicación actual como origen
        if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
        alertTimerRef.current = setTimeout(() => {
            showAlert(
                '📍 Punto de salida',
                `Tu ruta frecuente sale desde "${o.name}".\n\n¿Deseas mantener este punto de salida o prefieres usar tu ubicación actual? (Esto solo cambiará el campo "DESDE")`,
                'info',
                'Usar mi ubicación',   // confirmText (botón principal)
                null,                   // onClose
                'Mantener ruta',        // cancelText (botón secundario)
                () => loadCurrentLocation() // onConfirm → reemplaza el origen
            );
        }, 600);

        // Limpiar los params para que, si el usuario vuelve a esta pantalla
        // sin pasar por una ruta frecuente, no se re-aplique el prefill viejo.
        navigation.setParams({ prefillOrigin: undefined, prefillDestination: undefined });
    }, [route?.params?.prefillOrigin, route?.params?.prefillDestination]);

    const loadCurrentLocation = async () => {
        try {
            setLoadingLocation(true);
            const coords = await getCurrentLocation();
            const details = await reverseGeocode(coords.lat, coords.lng);
            setOrigen({ lat: coords.lat, lng: coords.lng, name: 'Ubicación actual', address: details.address });
            setRegion({
                latitude: coords.lat,
                longitude: coords.lng,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            });
        } catch (e) {
            // La ubicación está desactivada o fue denegada → preguntarle al usuario
            showAlert(
                '¿Activar ubicación?',
                'Parece que tenés la ubicación desactivada en tu teléfono. ¿Querés activarla para que te detectemos automáticamente? Si preferís no hacerlo, podés elegir el punto de salida a mano.',
                'warning',
                'Sí, activar',
                null,
                'No, gracias',
                () => Linking.openSettings()
            );
        } finally {
            setLoadingLocation(false);
        }
    };

    const loadRecentSearches = async () => {
        try {
            const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
            if (stored) setRecentSearches(JSON.parse(stored));
        } catch (e) { }
    };

    const saveRecentSearch = async (search) => {
        try {
            const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
            let searches = stored ? JSON.parse(stored) : [];
            searches = searches.filter(s => s.name !== search.name);
            searches.unshift(search);
            searches = searches.slice(0, 5);
            await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
            setRecentSearches(searches);
        } catch (e) { }
    };

    // Ajusta el mapa y carga ruta real cuando cambian origen/destino
    useEffect(() => {
        if (origen && destino) {
            mapRef.current?.fitToCoordinates(
                [
                    { latitude: origen.lat, longitude: origen.lng },
                    { latitude: destino.lat, longitude: destino.lng },
                ],
                { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }
            );
            // Obtener la ruta real por carretera
            setRouteCoords(null);
            fetchRoutePolyline(origen.lat, origen.lng, destino.lat, destino.lng)
                .then(coords => {
                    if (coords && coords.length > 0) {
                        setRouteCoords(coords);
                        // Re-ajustar el mapa a la ruta real
                        mapRef.current?.fitToCoordinates(coords, {
                            edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                            animated: true,
                        });
                    }
                });
        } else if (origen) {
            setRouteCoords(null);
            mapRef.current?.animateToRegion(
                { latitude: origen.lat, longitude: origen.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
                500
            );
        } else {
            setRouteCoords(null);
        }
    }, [origen, destino]);

    const handleOpenPicker = (type) => {
        setPickingFor(type);
        setPickerVisible(true);
    };

    const handleLocationSelect = (location) => {
        if (pickingFor === 'origen') {
            setOrigen(location);
            setErrors(prev => ({ ...prev, origen: null }));
        } else {
            setDestino(location);
            setErrors(prev => ({ ...prev, destino: null }));
        }
    };

    const handleSearch = async (destinoOverride = null) => {
        const efectivoDestino = destinoOverride || destino;
        if (!origen) {
            showTimedAlert(
                '¿Desde dónde salís?',
                'Necesitamos saber el lugar donde estás o desde donde vas a salir. Tocá el campo "DESDE" aquí arriba y elegí tu dirección.',
                'warning',
                'Elegir ubicación',
                () => handleOpenPicker('origen')
            );
            return;
        }

        if (!efectivoDestino) {
            showTimedAlert(
                'Falta el destino',
                'Ingresa a dónde quieres ir para poder buscar los viajes disponibles en esa ruta.',
                'info',
                'Entendido'
            );
            setErrors(prev => ({ ...prev, destino: 'Ingresa el destino' }));
            return;
        }

        setLoading(true);
        try {
            // Verificaciones previas antes de buscar viajes (en orden de prioridad)
            const bookingsRes = await api.get('/bookings');
            if (bookingsRes.data?.success && bookingsRes.data?.data) {
                const bookings = bookingsRes.data.data;

                // 0. Cobro pendiente → prioridad máxima, debe pagar antes de cualquier acción.
                // Incluye dos casos: (a) viaje completado con pago pendiente
                // (conductor marcó "No pagó") y (b) booking cancelado por el
                // pasajero con penalización pendiente. En ambos casos el
                // backend deja payment_status='pending' + charged_amount>0.
                // Las cancelaciones del conductor no entran porque el backend
                // las pone como 'waived'.
                const unpaidBooking = bookings.find(b =>
                    (b.status === 'completed' || b.status === 'cancelled' || b.status === 'canceled') &&
                    b.payment_status === 'pending' &&
                    Number(b.charged_amount) > 0
                );
                if (unpaidBooking) {
                    setLoading(false);
                    const isPenalty =
                        unpaidBooking.status === 'cancelled' ||
                        unpaidBooking.status === 'canceled';
                    showAlert(
                        isPenalty ? 'Penalización pendiente' : 'Tienes un cobro pendiente',
                        isPenalty
                            ? `Tienes una penalización por cancelación pendiente de ₡${Number(unpaidBooking.charged_amount).toLocaleString('es-CR')}. Debes pagarla antes de buscar nuevos viajes.`
                            : `Para buscar nuevos viajes primero debes pagar el viaje pendiente por ₡${Number(unpaidBooking.charged_amount).toLocaleString('es-CR')}.`,
                        'warning',
                        'Pagar ahora',
                        null,
                        'Cancelar',
                        () => navigation.navigate('PendingPayment', { bookingId: unpaidBooking._id })
                    );
                    return;
                }

                // 0.5 Ride en awaiting_payment_verification → el viaje ya
                // terminó físicamente pero el conductor todavía no confirma
                // los pagos en PaymentVerification. Mandamos al pasajero a
                // PayForTravel (o RateDriver si el pago ya está cubierto).
                const awaitingBooking = bookings.find(b =>
                    b.status === 'confirmed' &&
                    b.ride_id?.status === 'awaiting_payment_verification'
                );
                if (awaitingBooking) {
                    setLoading(false);
                    const ride = awaitingBooking.ride_id;
                    const rideIdStr = ride?._id?.toString() || ride?.toString();
                    const driverIdStr = ride?.driver_id?._id?.toString() || ride?.driver_id?.toString();
                    const driverNameStr = ride?.driver_id?.name;
                    const driverImageStr = ride?.driver_id?.profileImage;
                    const storedMethod = await AsyncStorage.getItem('paymentMethod');

                    if (
                        awaitingBooking.payment_type === 'gifted' ||
                        awaitingBooking.payment_status === 'paid'
                    ) {
                        // Gifted o ya pagado: esperar en WaitingPaymentConfirmation
                        // hasta que el conductor toque Continuar y el booking
                        // pase a 'completed' (recién ahí pasa a RateDriver).
                        navigation.navigate('WaitingPaymentConfirmation', {
                            bookingId: awaitingBooking._id,
                            rideId: rideIdStr,
                            driverId: driverIdStr,
                            driverName: driverNameStr,
                            driverImage: driverImageStr,
                            paymentMethod:
                                awaitingBooking.payment_type === 'gifted'
                                    ? 'gifted'
                                    : storedMethod || '',
                            chargedAmount: awaitingBooking.charged_amount ?? null,
                        });
                    } else {
                        navigation.navigate('PayForTravel', {
                            bookingId: awaitingBooking._id,
                            rideId: rideIdStr,
                            driverId: driverIdStr,
                            driverName: driverNameStr,
                            driverImage: driverImageStr,
                            paymentMethod: storedMethod || '',
                            chargedAmount: awaitingBooking.charged_amount ?? null,
                        });
                    }
                    return;
                }

                // 1. Booking confirmed → máxima prioridad (ignorar las demás validaciones)
                const confirmedBooking = bookings.find(b => b.status === 'confirmed');
                if (confirmedBooking) {
                    setLoading(false);
                    showAlert(
                        'Viaje en curso',
                        'Ya estás abordo en otro viaje.',
                        'warning',
                        'OK'
                    );
                    return;
                }

                // 2. Booking pending
                const pendingBooking = bookings.find(b => b.status === 'pending');
                if (pendingBooking) {
                    // Auto-eliminar pending obsoleto (>3 min) para no bloquear al usuario
                    const lastUpdate = pendingBooking.updatedAt || pendingBooking.createdAt;
                    const timeDiff = Date.now() - new Date(lastUpdate).getTime();
                    if (lastUpdate && timeDiff > 3 * 60 * 1000) {
                        try { await api.delete(`/bookings/${pendingBooking._id}`); } catch (e) { }
                    } else {
                        setLoading(false);
                        showAlert(
                            'Solicitud pendiente',
                            'Ya has solicitado unirte a un viaje.',
                            'warning',
                            'OK'
                        );
                        return;
                    }
                }

                // 3. payment_status pendiente (paid y waived son válidos)
                const paymentPendingBooking = bookings.find(b => b.payment_status === 'pending');
                if (paymentPendingBooking) {
                    setLoading(false);
                    showAlert(
                        'Cobro pendiente',
                        'Tienes un cobro pendiente. Por favor realiza el pago correspondiente o comunícate con el chofer.',
                        'warning',
                        'OK'
                    );
                    return;
                }
            }

            const params = {
                origin: `${origen.lat},${origen.lng}`,
                destination: `${efectivoDestino.lat},${efectivoDestino.lng}`,
                date: new Date(
                    fechaSeleccionada.getTime() - fechaSeleccionada.getTimezoneOffset() * 60000
                ).toISOString().split('T')[0],
            };

            const response = await api.get('/rides', { params });
            if (response.data.success) {
                await saveRecentSearch({
                    lat: efectivoDestino.lat,
                    lng: efectivoDestino.lng,
                    name: efectivoDestino.name,
                    address: efectivoDestino.address || efectivoDestino.name,
                    timestamp: new Date().toISOString(),
                });
                navigation.navigate('MainTabsPasajero', {
                    screen: 'ListOfDrivers',
                    params: {
                        rides: response.data.data || [],
                        searchTime: new Date().toISOString(),
                        searchOrigin: { lat: origen.lat, lng: origen.lng, name: origen.name },
                        searchDestination: { lat: efectivoDestino.lat, lng: efectivoDestino.lng, name: efectivoDestino.name },
                    },
                });
            } else {
                showAlert('Aviso', 'No se encontraron viajes para esta ruta.', 'info');
            }
        } catch (error) {
            showAlert('Error', 'Hubo un problema al buscar viajes.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRecentSearchPress = (item) => {
        if (!item.lat || !item.lng) {
            // Búsqueda guardada sin coordenadas (formato antiguo) → limpiarla y avisar
            const cleaned = recentSearches.filter((_, i) => recentSearches.indexOf(item) !== i);
            setRecentSearches(cleaned);
            AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(cleaned));
            showTimedAlert('Búsqueda no disponible', 'Esta búsqueda fue guardada en un formato antiguo y no puede repetirse. Realizá la búsqueda manualmente.', 'warning', 'Entendido');
            return;
        }
        const recentDestino = { lat: item.lat, lng: item.lng, name: item.name, address: item.address };
        setDestino(recentDestino);
        handleSearch(recentDestino);
    };

    const showTimedAlert = (...args) => {
        if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
        showAlert(...args);
        alertTimerRef.current = setTimeout(() => hideAlert(), 7000);
    };

    const handleMapPress = (event) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        showAlert(
            '¿Qué punto es este?',
            'Tocaste un lugar en el mapa. ¿Es el lugar desde donde vas a salir, o es a donde querés llegar?',
            'map',
            'Mi destino',
            async () => {
                // "Desde aquí salgo" → origen
                try {
                    const details = await reverseGeocode(latitude, longitude);
                    setOrigen({ lat: latitude, lng: longitude, name: details.name, address: details.address });
                    setErrors(prev => ({ ...prev, origen: null }));
                } catch (e) {
                    setOrigen({ lat: latitude, lng: longitude, name: 'Punto de salida', address: '' });
                }
            },
            'Mi salida',
            async () => {
                // "Aquí quiero llegar" → destino
                try {
                    const details = await reverseGeocode(latitude, longitude);
                    setDestino({ lat: latitude, lng: longitude, name: details.name, address: details.address });
                    setErrors(prev => ({ ...prev, destino: null }));
                } catch (e) {
                    setDestino({ lat: latitude, lng: longitude, name: 'Destino seleccionado', address: '' });
                }
            },
            'Cancelar',
            () => {
                setOrigen(null);
                setDestino(null);
            }
        );
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

            <ScreenHeader title="Tu Viaje" onBack={() => navigation.goBack()} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: 16,
                        paddingBottom: 100 + (insets.bottom || 14),
                    },
                ]}
                showsVerticalScrollIndicator={false}
            >

                {/* SUBTÍTULO Y TÍTULO */}
                <Text style={styles.subLabel}>SELECCIÓN DE DESTINO</Text>
                <Text style={styles.mainTitle}>¿A dónde vamos?</Text>

                {/* MAPA */}
                <View style={styles.mapContainer}>
                    <View style={styles.yourLocationBadge}>
                        <Ionicons name="navigate-circle" size={14} color="#fff" />
                        <Text style={styles.yourLocationText}>TU UBICACIÓN</Text>
                    </View>
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        provider={PROVIDER_GOOGLE}
                        region={region}
                        customMapStyle={theme.dark ? darkMapStyle : []}
                        showsUserLocation={false}
                        showsMyLocationButton={false}
                        onPress={handleMapPress}
                    >
                        {origen?.lat && origen?.lng && (
                            <Marker coordinate={{ latitude: origen.lat, longitude: origen.lng }}>
                                <Ionicons name="location" size={30} color={ACCENT} />
                            </Marker>
                        )}
                        {destino?.lat && destino?.lng && (
                            <Marker coordinate={{ latitude: destino.lat, longitude: destino.lng }}>
                                <Ionicons name="location" size={30} color="#FF5A5F" />
                            </Marker>
                        )}
                        {/* Ruta real por carretera (o línea punteada mientras carga) */}
                        {origen?.lat && origen?.lng && destino?.lat && destino?.lng && (
                            routeCoords && routeCoords.length > 0 ? (
                                <Polyline
                                    coordinates={routeCoords}
                                    strokeColor={ACCENT}
                                    strokeWidth={4}
                                    lineJoin="round"
                                    lineCap="round"
                                />
                            ) : (
                                <Polyline
                                    coordinates={[
                                        { latitude: origen.lat, longitude: origen.lng },
                                        { latitude: destino.lat, longitude: destino.lng },
                                    ]}
                                    strokeColor={ACCENT}
                                    strokeWidth={2}
                                    lineDashPattern={[6, 6]}
                                />
                            )
                        )}
                    </MapView>
                </View>

                {/* TARJETA DE BÚSQUEDA */}
                <View style={[styles.searchCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder || theme.divider }]}>
                    {/* FROM */}
                    <TouchableOpacity style={[styles.fieldRow, { backgroundColor: theme.surface, borderColor: theme.cardBorder || theme.divider, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 }]} onPress={() => handleOpenPicker('origen')}>
                        <View style={[styles.fieldIconWrap, { backgroundColor: '#EBF0FF' }]}>
                            <Ionicons name="navigate-circle-outline" size={20} color={ACCENT} />
                        </View>
                        <View style={styles.fieldTexts}>
                            <Text style={styles.fieldLabel}>DESDE</Text>
                            <Text
                                style={[styles.fieldValue, errors.origen && { color: '#FF5A5F' }]}
                                numberOfLines={1}
                            >
                                {origen
                                    ? (origen.name === 'Current Location' ? 'Ubicación actual' : origen.name)
                                    : (errors.origen || 'Ubicación actual')}
                            </Text>
                        </View>
                        {loadingLocation && <ActivityIndicator size="small" color={ACCENT} />}
                    </TouchableOpacity>

                    <View style={{ height: 8 }} />

                    {/* TO */}
                    <TouchableOpacity style={[styles.fieldRow, { backgroundColor: theme.surface, borderColor: theme.cardBorder || theme.divider, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 }]} onPress={() => handleOpenPicker('destino')}>
                        <View style={[styles.fieldIconWrap, { backgroundColor: '#FFF0F0' }]}>
                            <Ionicons name="location-outline" size={20} color="#FF5A5F" />
                        </View>
                        <View style={styles.fieldTexts}>
                            <Text style={styles.fieldLabel}>HACIA</Text>
                            <Text
                                style={[
                                    styles.fieldValue,
                                    !destino && { color: '#AAAAAA' },
                                    errors.destino && { color: '#FF5A5F' },
                                ]}
                                numberOfLines={1}
                            >
                                {destino ? destino.name : (errors.destino || 'Ingresa tu destino')}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.fieldDivider} />

                    {/* DATE + PASSENGERS */}
                    <View style={styles.metaRow}>
                        <TouchableOpacity style={styles.metaField} onPress={() => setMostrarCalendario(true)}>
                            <View style={[styles.fieldIconWrap, { backgroundColor: '#EBF0FF' }]}>
                                <Ionicons name="calendar-outline" size={18} color={ACCENT} />
                            </View>
                            <View style={styles.fieldTexts}>
                                <Text style={styles.fieldLabel}>FECHA</Text>
                                <Text style={styles.fieldValue}>{formatDate(fechaSeleccionada)}</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={styles.metaDivider} />

                        <TouchableOpacity
                            style={styles.metaField}
                            onPress={() => setPasajeros(p => (p % 8) + 1)}
                        >
                            <View style={[styles.fieldIconWrap, { backgroundColor: '#EBF0FF' }]}>
                                <Ionicons name="people-outline" size={18} color={ACCENT} />
                            </View>
                            <View style={styles.fieldTexts}>
                                <Text style={styles.fieldLabel}>PASAJEROS</Text>
                                <Text style={styles.fieldValue}>
                                    {pasajeros} {pasajeros === 1 ? 'Persona' : 'Personas'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* BOTÓN SEE TRIPS */}
                    <TouchableOpacity
                        style={[styles.seeTripsBtn, loading && { opacity: 0.8 }]}
                        onPress={() => handleSearch()}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.seeTripsBtnText}>Ver Viajes</Text>
                        }
                    </TouchableOpacity>
                </View>

                {/* RECENT SEARCHES */}
                {recentSearches.length > 0 && (
                    <View style={styles.recentSection}>
                        <Text style={styles.recentLabel}>BÚSQUEDAS RECIENTES</Text>
                        {recentSearches.map((item, index) => (
                            <TouchableOpacity key={index} style={[styles.recentItem, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder || theme.divider }]} activeOpacity={0.7} onPress={() => handleRecentSearchPress(item)}>
                                <View style={styles.recentIconWrap}>
                                    <Ionicons name="time-outline" size={20} color={ACCENT} />
                                </View>
                                <View style={styles.recentTexts}>
                                    <Text style={styles.recentName} numberOfLines={1}>{item.name}</Text>
                                    <Text style={styles.recentAddress} numberOfLines={1}>{item.address}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#AAAAAA" />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* LOCATION PICKER */}
            <LocationPicker
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                title={pickingFor === 'origen' ? 'Escoge tu Origen' : 'Escoge tu Destino'}
                onSelect={handleLocationSelect}
            />

            {/* DATE PICKER */}
            {mostrarCalendario && (
                <DateTimePicker
                    value={fechaSeleccionada}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    onChange={(e, d) => {
                        if (Platform.OS === 'android') setMostrarCalendario(false);
                        if (d) setFechaSeleccionada(d);
                    }}
                />
            )}
            {mostrarCalendario && Platform.OS === 'ios' && (
                <TouchableOpacity
                    style={[styles.iosConfirm, { backgroundColor: ACCENT }]}
                    onPress={() => setMostrarCalendario(false)}
                >
                    <Text style={{ color: '#fff', fontFamily: 'Poppins-Bold' }}>Confirmar</Text>
                </TouchableOpacity>
            )}

            {/* MODAL VIAJE ACTIVO */}
            <Modal transparent visible={showActiveBookingModal} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalIconCircle}>
                            <Ionicons name="information-circle" size={44} color={ACCENT} />
                        </View>
                        <Text style={styles.modalTitle}>Ya tienes un viaje registrado</Text>
                        <Text style={styles.modalSubtitle}>
                            Tienes una reserva pendiente o confirmada. Revisa tu estado antes de buscar otro viaje.
                        </Text>
                        <TouchableOpacity
                            style={styles.modalConfirmBtn}
                            onPress={() => {
                                setShowActiveBookingModal(false);
                                navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' });
                            }}
                        >
                            <Text style={styles.modalConfirmBtnText}>Ir a mi dashboard</Text>
                            <Ionicons name="arrow-forward" size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* BOTTOM NAV */}
            <BottomNavigationBar navigation={navigation} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        // El backgroundColor lo aplica el componente desde theme.bg.
    },
    scrollView: { flex: 1 },
    scrollContent: {
        paddingHorizontal: 20,
    },
    subLabel: {
        fontSize: moderateScale(11),
        color: ACCENT,
        fontFamily: 'Poppins-SemiBold',
        letterSpacing: 1.2,
        marginBottom: 4,
    },
    mainTitle: {
        fontSize: moderateScale(26),
        fontFamily: 'Poppins-Bold',
        color: '#1A1A2E',
        marginBottom: 16,
    },
    mapContainer: {
        height: 180,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    yourLocationBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: ACCENT,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        zIndex: 10,
        gap: 4,
    },
    yourLocationText: {
        color: '#fff',
        fontSize: moderateScale(10),
        fontFamily: 'Poppins-SemiBold',
        letterSpacing: 0.5,
    },
    map: { flex: 1 },
    searchCard: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
        marginBottom: 24,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
    },
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 12,
    },
    fieldIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fieldTexts: { flex: 1 },
    fieldLabel: {
        fontSize: moderateScale(10),
        color: '#9BA0A8',
        fontFamily: 'Poppins-SemiBold',
        letterSpacing: 0.8,
        marginBottom: 2,
    },
    fieldValue: {
        fontSize: moderateScale(15),
        color: '#1A1A2E',
        fontFamily: 'Poppins-SemiBold',
    },
    fieldDivider: {
        height: 1,
        backgroundColor: '#F0F2F5',
        marginVertical: 4,
        marginLeft: 50,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 16,
    },
    metaField: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
    },
    metaDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#F0F2F5',
        marginHorizontal: 8,
    },
    seeTripsBtn: {
        backgroundColor: ACCENT,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    seeTripsBtnText: {
        color: '#fff',
        fontSize: moderateScale(16),
        fontFamily: 'Poppins-Bold',
    },
    recentSection: {
        marginBottom: 10,
    },
    recentLabel: {
        fontSize: moderateScale(12),
        color: '#9BA0A8',
        fontFamily: 'Poppins-SemiBold',
        letterSpacing: 1,
        marginBottom: 12,
    },
    recentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        marginBottom: 10,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        gap: 12,
    },
    recentIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#EBF0FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    recentTexts: { flex: 1 },
    recentName: {
        fontSize: moderateScale(15),
        color: '#1A1A2E',
        fontFamily: 'Poppins-SemiBold',
    },
    recentAddress: {
        fontSize: moderateScale(12),
        color: '#9BA0A8',
        fontFamily: 'Poppins-Regular',
    },
    iosConfirm: {
        padding: 15,
        borderRadius: 10,
        position: 'absolute',
        bottom: 100,
        alignSelf: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 25,
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 30,
        padding: 32,
        alignItems: 'center',
    },
    modalIconCircle: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: ACCENT + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: moderateScale(22),
        fontFamily: 'Poppins-Bold',
        color: '#1A1A2E',
        marginBottom: 10,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: moderateScale(14),
        color: '#9BA0A8',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    modalConfirmBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        backgroundColor: ACCENT,
    },
    modalConfirmBtnText: {
        color: '#fff',
        fontSize: moderateScale(16),
        fontFamily: 'Poppins-Bold',
    },
});

export default BuscarViaje;
