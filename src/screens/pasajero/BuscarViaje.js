import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
    SafeAreaView, StatusBar, Platform, Dimensions, ScrollView, Modal, Linking,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCustomAlert } from '../../context/CustomAlertContext';
import { getCurrentLocation, reverseGeocode } from '../../services/locationService';
import api from '../../services/api';
import LocationPicker from '../../components/LocationPicker';
import BottomNavigationBar from '../../components/BottomNavigationBar';

const { width } = Dimensions.get('window');
const ACCENT = '#2563EB';
const RECENT_SEARCHES_KEY = 'buscarViaje_recentSearches';

const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38413e' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
];

const BuscarViaje = ({ navigation }) => {
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

    const mapRef = useRef(null);
    const [region, setRegion] = useState({
        latitude: 9.9281,
        longitude: -84.0907,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    });

    useEffect(() => {
        loadCurrentLocation();
        loadRecentSearches();
    }, []);

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

    // Ajusta el mapa cuando cambian origen/destino
    useEffect(() => {
        if (origen && destino) {
            mapRef.current?.fitToCoordinates(
                [
                    { latitude: origen.lat, longitude: origen.lng },
                    { latitude: destino.lat, longitude: destino.lng },
                ],
                { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }
            );
        } else if (origen) {
            mapRef.current?.animateToRegion(
                { latitude: origen.lat, longitude: origen.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
                500
            );
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
            // Verificar si el usuario ya tiene un viaje activo
            const bookingsRes = await api.get('/bookings');
            if (bookingsRes.data?.success && bookingsRes.data?.data) {
                const activeBooking = bookingsRes.data.data.find(
                    b => b.status === 'pending' || b.status === 'confirmed'
                );
                if (activeBooking) {
                    if (activeBooking.status === 'confirmed') {
                        setLoading(false);
                        setShowActiveBookingModal(true);
                        return;
                    }
                    const lastUpdate = activeBooking.updatedAt || activeBooking.createdAt;
                    const timeDiff = Date.now() - new Date(lastUpdate).getTime();
                    if (lastUpdate && timeDiff > 3 * 60 * 1000) {
                        try { await api.delete(`/bookings/${activeBooking._id}`); } catch (e) { }
                    } else {
                        setLoading(false);
                        setShowActiveBookingModal(true);
                        return;
                    }
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
        <View style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor="#F2F4F8" />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { 
                        paddingTop: (insets.top || 0) + 30, // Bajamos todo el contenido junto
                        paddingBottom: 100 + (insets.bottom || 14) 
                    },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* HEADER */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Tu Viaje</Text>
                    <View style={{ width: 40 }} />
                </View>

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
                    </MapView>
                </View>

                {/* TARJETA DE BÚSQUEDA */}
                <View style={styles.searchCard}>
                    {/* FROM */}
                    <TouchableOpacity style={styles.fieldRow} onPress={() => handleOpenPicker('origen')}>
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

                    <View style={styles.fieldDivider} />

                    {/* TO */}
                    <TouchableOpacity style={styles.fieldRow} onPress={() => handleOpenPicker('destino')}>
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
                            <TouchableOpacity key={index} style={styles.recentItem} activeOpacity={0.7} onPress={() => handleRecentSearchPress(item)}>
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
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Confirmar</Text>
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
        </View>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F2F4F8',
    },
    scrollView: { flex: 1 },
    scrollContent: {
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Poppins-Bold',
        color: '#1A1A2E',
    },
    subLabel: {
        fontSize: 11,
        color: ACCENT,
        fontFamily: 'Poppins-SemiBold',
        letterSpacing: 1.2,
        marginBottom: 4,
    },
    mainTitle: {
        fontSize: 26,
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
        fontSize: 10,
        fontFamily: 'Poppins-SemiBold',
        letterSpacing: 0.5,
    },
    map: { flex: 1 },
    searchCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
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
        fontSize: 10,
        color: '#9BA0A8',
        fontFamily: 'Poppins-SemiBold',
        letterSpacing: 0.8,
        marginBottom: 2,
    },
    fieldValue: {
        fontSize: 15,
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
        fontSize: 16,
        fontFamily: 'Poppins-Bold',
    },
    recentSection: {
        marginBottom: 10,
    },
    recentLabel: {
        fontSize: 12,
        color: '#9BA0A8',
        fontFamily: 'Poppins-SemiBold',
        letterSpacing: 1,
        marginBottom: 12,
    },
    recentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
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
        fontSize: 15,
        color: '#1A1A2E',
        fontFamily: 'Poppins-SemiBold',
    },
    recentAddress: {
        fontSize: 12,
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
        fontSize: 22,
        fontFamily: 'Poppins-Bold',
        color: '#1A1A2E',
        marginBottom: 10,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
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
        fontSize: 16,
        fontFamily: 'Poppins-Bold',
    },
});

export default BuscarViaje;
