import React, { useState, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
    Alert, SafeAreaView, StatusBar, Platform, ScrollView
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';

import { API_URL } from '../../config';
import { getCurrentLocation, reverseGeocode } from '../../services/locationService';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';

const REGION_SAN_JOSE = {
    latitude: 9.9281,
    longitude: -84.0907,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
};

const SearchRide = ({ navigation }) => {
    const { theme } = useDriverTheme();
    const mapRef = useRef(null);
    const si = useScrollIndicator();

    // Coordenadas seleccionadas en el mapa
    const [origenCoords, setOrigenCoords] = useState(null);
    const [destinoCoords, setDestinoCoords] = useState(null);

    // Nombres legibles de cada punto
    const [origenNombre, setOrigenNombre] = useState('');
    const [destinoNombre, setDestinoNombre] = useState('');

    // Cuál punto está seleccionando el usuario al tocar el mapa
    const [seleccionando, setSeleccionando] = useState('origen'); // 'origen' | 'destino'

    const [region, setRegion] = useState(REGION_SAN_JOSE);
    const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
    const [mostrarCalendario, setMostrarCalendario] = useState(false);
    const [loading, setLoading] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // ─── Formatos de fecha ───────────────────────────────────────────────────
    const formatearFecha = (date) => {
        if (!date) return '';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const formatearFechaDisplay = (date) => {
        if (!date) return 'Seleccionar fecha';
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        return `${d}/${m}/${date.getFullYear()}`;
    };

    const esFechaValida = () => {
        if (!fechaSeleccionada) return false;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const sel = new Date(fechaSeleccionada);
        sel.setHours(0, 0, 0, 0);
        return sel >= hoy;
    };

    const onCambiarFecha = (event, selectedDate) => {
        if (Platform.OS === 'android') setMostrarCalendario(false);
        if (selectedDate) setFechaSeleccionada(selectedDate);
    };

    // ─── Toque en el mapa ────────────────────────────────────────────────────
    const handleMapPress = async (e) => {
        const { latitude, longitude } = e.nativeEvent.coordinate;
        const geoResult = await reverseGeocode(latitude, longitude);
        const nombre = geoResult?.name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

        if (seleccionando === 'origen') {
            setOrigenCoords({ latitude, longitude });
            setOrigenNombre(nombre);
            setErrors(prev => ({ ...prev, origen: null }));
            setSeleccionando('destino');
        } else {
            setDestinoCoords({ latitude, longitude });
            setDestinoNombre(nombre);
            setErrors(prev => ({ ...prev, destino: null }));
        }
    };

    // ─── Botón GPS ───────────────────────────────────────────────────────────
    const handleGPS = async () => {
        setGpsLoading(true);
        try {
            const location = await getCurrentLocation();
            if (!location) {
                Alert.alert('Sin permiso', 'No se pudo obtener la ubicación. Verifica los permisos de la app.');
                return;
            }
            const { lat, lng } = location;
            const geoResult = await reverseGeocode(lat, lng);
            const nombre = geoResult?.name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

            setOrigenCoords({ latitude: lat, longitude: lng });
            setOrigenNombre(nombre);
            setErrors(prev => ({ ...prev, origen: null }));
            setSeleccionando('destino');

            const newRegion = { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };
            setRegion(newRegion);
            mapRef.current?.animateToRegion(newRegion, 800);
        } finally {
            setGpsLoading(false);
        }
    };

    const handleSearch = async () => {
        const newErrors = {};
        if (!origenCoords) newErrors.origen = 'Selecciona el origen tocando el mapa o usando el GPS.';
        if (!destinoCoords) newErrors.destino = 'Selecciona el destino tocando el mapa.';
        if (!fechaSeleccionada) newErrors.fecha = 'Por favor selecciona una fecha.';
        if (fechaSeleccionada && !esFechaValida()) newErrors.fecha = 'La fecha ya pasó. Elige una futura.';

        if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
        setErrors({});
        setLoading(true);

        try {
            const params = new URLSearchParams();
            params.append('origin', `${origenCoords.latitude},${origenCoords.longitude}`);
            params.append('destination', `${destinoCoords.latitude},${destinoCoords.longitude}`);
            params.append('date', formatearFecha(fechaSeleccionada));

            const response = await fetch(`${API_URL}/rides?${params.toString()}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                Alert.alert('Error', err.message || `Error del servidor (${response.status})`);
                return;
            }

            const result = await response.json();
            if (result.success) {
                navigation.navigate('ListOfDrivers', { rides: result.data || [] });
            } else {
                Alert.alert('Error', result.message || 'No se pudo obtener los viajes.');
            }
        } catch (error) {
            Alert.alert('Error', 'Hubo un problema al conectar con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

            <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Buscar Viaje</Text>
            </View>

            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={REGION_SAN_JOSE}
                    region={region}
                    onPress={handleMapPress}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                    customMapStyle={theme.dark ? darkMapStyle : []}
                >
                    {origenCoords && (
                        <Marker
                            coordinate={origenCoords}
                            pinColor="#045084"
                            title="Origen"
                            description={origenNombre}
                        />
                    )}
                    {destinoCoords && (
                        <Marker
                            coordinate={destinoCoords}
                            pinColor="#FF5A5F"
                            title="Destino"
                            description={destinoNombre}
                        />
                    )}
                </MapView>

                <TouchableOpacity style={[styles.gpsButton, { backgroundColor: theme.surface }]} onPress={handleGPS} disabled={gpsLoading}>
                    {gpsLoading
                        ? <ActivityIndicator color={theme.accent} size="small" />
                        : <Ionicons name="locate" size={24} color={theme.accent} />
                    }
                </TouchableOpacity>

                <View style={[styles.modeIndicator, { backgroundColor: theme.surface + 'EC' }]}>
                    <Ionicons
                        name="radio-button-on"
                        size={12}
                        color={seleccionando === 'origen' ? theme.accent : '#FF5A5F'}
                    />
                    <Text style={[styles.modeText, { color: theme.text }]}>
                        Tocando:{' '}
                        <Text style={{ fontWeight: 'bold', color: seleccionando === 'origen' ? theme.accent : '#FF5A5F' }}>
                            {seleccionando === 'origen' ? 'Origen' : 'Destino'}
                        </Text>
                    </Text>
                </View>
            </View>

            <View style={{ flex: 1 }}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                {...si.scrollProps}
            >
                <View style={styles.selectorRow}>
                    <TouchableOpacity
                        style={[styles.selectorBtn, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }, seleccionando === 'origen' && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                        onPress={() => setSeleccionando('origen')}
                    >
                        <Ionicons name="radio-button-on" size={14} color={seleccionando === 'origen' ? '#fff' : theme.accent} />
                        <Text style={[styles.selectorText, { color: theme.textSecondary }, seleccionando === 'origen' && styles.selectorTextActive]}>
                            Origen
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.selectorBtn, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }, seleccionando === 'destino' && { backgroundColor: '#FF5A5F', borderColor: '#FF5A5F' }]}
                        onPress={() => setSeleccionando('destino')}
                    >
                        <Ionicons name="radio-button-on" size={14} color={seleccionando === 'destino' ? '#fff' : '#FF5A5F'} />
                        <Text style={[styles.selectorText, { color: theme.textSecondary }, seleccionando === 'destino' && styles.selectorTextActive]}>
                            Destino
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.coordCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
                    <View style={[styles.coordDot, { backgroundColor: theme.accent }]} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.coordLabel, { color: theme.textSecondary }]}>ORIGEN</Text>
                        <Text style={[styles.coordName, { color: theme.text }]} numberOfLines={1}>
                            {origenNombre || 'No seleccionado'}
                        </Text>
                        {origenCoords && (
                            <Text style={[styles.coordValue, { color: theme.textSecondary }]}>
                                {origenCoords.latitude.toFixed(6)}, {origenCoords.longitude.toFixed(6)}
                            </Text>
                        )}
                    </View>
                    {origenCoords && <Ionicons name="checkmark-circle" size={20} color={theme.accent} />}
                </View>
                {errors.origen && <Text style={styles.errorText}>{errors.origen}</Text>}

                <View style={[styles.coordCard, { marginTop: 8, backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
                    <View style={[styles.coordDot, { backgroundColor: '#FF5A5F' }]} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.coordLabel, { color: theme.textSecondary }]}>DESTINO</Text>
                        <Text style={[styles.coordName, { color: theme.text }]} numberOfLines={1}>
                            {destinoNombre || 'No seleccionado'}
                        </Text>
                        {destinoCoords && (
                            <Text style={[styles.coordValue, { color: theme.textSecondary }]}>
                                {destinoCoords.latitude.toFixed(6)}, {destinoCoords.longitude.toFixed(6)}
                            </Text>
                        )}
                    </View>
                    {destinoCoords && <Ionicons name="checkmark-circle" size={20} color="#FF5A5F" />}
                </View>
                {errors.destino && <Text style={styles.errorText}>{errors.destino}</Text>}

                <View style={[styles.inputContainer, { marginTop: 16 }]}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Fecha</Text>
                    <TouchableOpacity
                        style={[styles.datePickerButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }, errors.fecha && styles.inputError]}
                        onPress={() => setMostrarCalendario(true)}
                    >
                        <Ionicons name="calendar-outline" size={22} color={theme.accent} />
                        <Text style={[styles.datePickerText, { color: theme.text }, !fechaSeleccionada && { color: theme.textSecondary }]}>
                            {formatearFechaDisplay(fechaSeleccionada)}
                        </Text>
                    </TouchableOpacity>
                    {errors.fecha && <Text style={styles.errorText}>{errors.fecha}</Text>}
                    {mostrarCalendario && (
                        <DateTimePicker
                            value={fechaSeleccionada || new Date()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            minimumDate={new Date()}
                            onChange={onCambiarFecha}
                        />
                    )}
                </View>

                <TouchableOpacity style={[styles.searchButton, { backgroundColor: theme.accent, shadowColor: theme.accent }]} onPress={handleSearch} disabled={loading}>
                    {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.searchButtonText}>Buscar</Text>
                    }
                </TouchableOpacity>
            </ScrollView>
            <ScrollIndicator si={si} thumbColor={theme.accent} />
            </View>
        </SafeAreaView>
    );
};

const darkMapStyle = [
    { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
    { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
    { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3f" }] },
    { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38413e" }] },
    { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
    { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
    { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
    { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#2f3948" }] },
    { "featureType": "transit.station", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
    { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
    { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
];

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 0,
    },
    header: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'ios' ? 40 : 15,
        height: Platform.OS === 'ios' ? 90 : 70,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 24,
    },
    mapContainer: {
        height: 260,
        position: 'relative',
    },
    map: {
        flex: 1,
    },
    gpsButton: {
        position: 'absolute',
        bottom: 48,
        right: 12,
        borderRadius: 30,
        width: 46,
        height: 46,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    modeIndicator: {
        position: 'absolute',
        bottom: 10,
        left: 12,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        elevation: 3,
    },
    modeText: {
        fontSize: 12,
    },
    scrollView: { flex: 1 },
    content: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 120,
    },
    selectorRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    selectorBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1.5,
    },
    selectorText: {
        fontSize: 14,
        fontWeight: '600',
    },
    selectorTextActive: {
        color: '#fff',
    },
    coordCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        gap: 12,
    },
    coordDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    coordLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
    },
    coordName: {
        fontSize: 15,
        fontWeight: '600',
        marginTop: 2,
    },
    coordValue: {
        fontSize: 11,
        marginTop: 2,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    inputContainer: { marginBottom: 22 },
    label: {
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    datePickerButton: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
    },
    datePickerText: { fontSize: 16 },
    inputError: { borderColor: '#f53333', borderWidth: 2 },
    errorText: { color: '#f53333', fontSize: 13, marginTop: 5, marginLeft: 2, fontWeight: '500' },
    searchButton: {
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
    },
    searchButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
});

export default SearchRide;
