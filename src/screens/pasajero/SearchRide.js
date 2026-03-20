import React, { useState, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
    Alert, SafeAreaView, StatusBar, Platform, ScrollView
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigationBar from '../../components/BottomNavigationBar';
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
            // Automáticamente pasar a seleccionar destino
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

    // ─── Búsqueda ────────────────────────────────────────────────────────────
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

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(`${API_URL}/rides?${params.toString()}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

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
            if (error.name === 'AbortError') {
                Alert.alert('Error de Conexión', 'El servidor tardó mucho en responder.');
            } else {
                Alert.alert('Error', 'Hubo un problema al conectar con el servidor.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" />

            {/* ENCABEZADO */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Buscar Viaje</Text>
            </View>

            {/* MAPA */}
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

                {/* Botón GPS */}
                <TouchableOpacity style={styles.gpsButton} onPress={handleGPS} disabled={gpsLoading}>
                    {gpsLoading
                        ? <ActivityIndicator color="#045084" size="small" />
                        : <Ionicons name="locate" size={24} color="#045084" />
                    }
                </TouchableOpacity>

                {/* Indicador de modo activo */}
                <View style={styles.modeIndicator}>
                    <Ionicons
                        name="radio-button-on"
                        size={12}
                        color={seleccionando === 'origen' ? '#045084' : '#FF5A5F'}
                    />
                    <Text style={styles.modeText}>
                        Tocando:{' '}
                        <Text style={{ fontWeight: 'bold', color: seleccionando === 'origen' ? '#045084' : '#FF5A5F' }}>
                            {seleccionando === 'origen' ? 'Origen' : 'Destino'}
                        </Text>
                    </Text>
                </View>
            </View>

            <View style={{ flex: 1 }}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                {...si.scrollProps}
            >
                {/* Botones de selección Origen / Destino */}
                <View style={styles.selectorRow}>
                    <TouchableOpacity
                        style={[styles.selectorBtn, seleccionando === 'origen' && styles.selectorBtnBlue]}
                        onPress={() => setSeleccionando('origen')}
                    >
                        <Ionicons name="radio-button-on" size={14} color={seleccionando === 'origen' ? '#fff' : '#045084'} />
                        <Text style={[styles.selectorText, seleccionando === 'origen' && styles.selectorTextActive]}>
                            Origen
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.selectorBtn, seleccionando === 'destino' && styles.selectorBtnRed]}
                        onPress={() => setSeleccionando('destino')}
                    >
                        <Ionicons name="radio-button-on" size={14} color={seleccionando === 'destino' ? '#fff' : '#FF5A5F'} />
                        <Text style={[styles.selectorText, seleccionando === 'destino' && styles.selectorTextActive]}>
                            Destino
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Tarjeta de Origen */}
                <View style={styles.coordCard}>
                    <View style={[styles.coordDot, { backgroundColor: '#045084' }]} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.coordLabel}>ORIGEN</Text>
                        <Text style={styles.coordName} numberOfLines={1}>
                            {origenNombre || 'No seleccionado'}
                        </Text>
                        {origenCoords && (
                            <Text style={styles.coordValue}>
                                {origenCoords.latitude.toFixed(6)}, {origenCoords.longitude.toFixed(6)}
                            </Text>
                        )}
                    </View>
                    {origenCoords && <Ionicons name="checkmark-circle" size={20} color="#045084" />}
                </View>
                {errors.origen && <Text style={styles.errorText}>{errors.origen}</Text>}

                {/* Tarjeta de Destino */}
                <View style={[styles.coordCard, { marginTop: 8 }]}>
                    <View style={[styles.coordDot, { backgroundColor: '#FF5A5F' }]} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.coordLabel}>DESTINO</Text>
                        <Text style={styles.coordName} numberOfLines={1}>
                            {destinoNombre || 'No seleccionado'}
                        </Text>
                        {destinoCoords && (
                            <Text style={styles.coordValue}>
                                {destinoCoords.latitude.toFixed(6)}, {destinoCoords.longitude.toFixed(6)}
                            </Text>
                        )}
                    </View>
                    {destinoCoords && <Ionicons name="checkmark-circle" size={20} color="#FF5A5F" />}
                </View>
                {errors.destino && <Text style={styles.errorText}>{errors.destino}</Text>}

                {/* Fecha */}
                <View style={[styles.inputContainer, { marginTop: 16 }]}>
                    <Text style={styles.label}>Fecha</Text>
                    <TouchableOpacity
                        style={[styles.datePickerButton, errors.fecha && styles.inputError]}
                        onPress={() => {
                            setMostrarCalendario(true);
                            if (errors.fecha) setErrors({ ...errors, fecha: null });
                        }}
                    >
                        <Ionicons name="calendar-outline" size={22} color="#045084" />
                        <Text style={[styles.datePickerText, !fechaSeleccionada && styles.datePickerPlaceholder]}>
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
                    {mostrarCalendario && Platform.OS === 'ios' && (
                        <TouchableOpacity style={styles.confirmButton} onPress={() => setMostrarCalendario(false)}>
                            <Text style={styles.confirmButtonText}>Confirmar fecha</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Botón Buscar */}
                <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={loading}>
                    {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.searchButtonText}>Buscar</Text>
                    }
                </TouchableOpacity>
            </ScrollView>
            <ScrollIndicator si={si} thumbColor="#045084" />
            </View>

            <BottomNavigationBar navigation={navigation} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 0,
    },
    header: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'ios' ? 40 : 15,
        height: Platform.OS === 'ios' ? 90 : 70,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        backgroundColor: '#FFF',
    },
    headerTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 24,
        color: '#045084',
    },

    // ── Mapa ──────────────────────────────────────────────────────────────────
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
        backgroundColor: '#fff',
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
        backgroundColor: 'rgba(255,255,255,0.92)',
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
        color: '#333',
    },

    // ── Scroll content ────────────────────────────────────────────────────────
    scrollView: { flex: 1 },
    content: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 120,
    },

    // ── Selector Origen/Destino ───────────────────────────────────────────────
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
        borderColor: '#E0E0E0',
        backgroundColor: '#F5F7FA',
    },
    selectorBtnBlue: {
        backgroundColor: '#045084',
        borderColor: '#045084',
    },
    selectorBtnRed: {
        backgroundColor: '#FF5A5F',
        borderColor: '#FF5A5F',
    },
    selectorText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#555',
    },
    selectorTextActive: {
        color: '#fff',
    },

    // ── Tarjetas de coordenadas ───────────────────────────────────────────────
    coordCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F7FA',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E8ECF0',
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
        color: '#999',
        letterSpacing: 0.8,
    },
    coordName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1A2B4C',
        marginTop: 2,
    },
    coordValue: {
        fontSize: 11,
        color: '#7E8BA0',
        marginTop: 2,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },

    // ── Fecha ─────────────────────────────────────────────────────────────────
    inputContainer: { marginBottom: 22 },
    label: {
        fontSize: 14,
        color: '#555',
        marginBottom: 8,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    datePickerButton: {
        backgroundColor: '#F5F7FA',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
    },
    datePickerText: { fontSize: 16, color: '#333', flex: 1 },
    datePickerPlaceholder: { color: '#999' },
    confirmButton: {
        backgroundColor: '#045084',
        borderRadius: 10,
        padding: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    confirmButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },

    // ── Errores ───────────────────────────────────────────────────────────────
    inputError: { borderColor: '#f53333', borderWidth: 2, backgroundColor: 'rgba(245, 51, 51, 0.05)' },
    errorText: { color: '#f53333', fontSize: 13, marginTop: 5, marginLeft: 2, fontWeight: '500' },

    // ── Botón Buscar ──────────────────────────────────────────────────────────
    searchButton: {
        backgroundColor: '#045084',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#045084',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
    },
    searchButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
});

export default SearchRide;
