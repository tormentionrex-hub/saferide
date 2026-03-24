import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
    Alert, SafeAreaView, StatusBar, Platform, Dimensions, Animated
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';

import { API_URL } from '../../config.js';
import api from '../../services/api';
import LocationPicker from '../../components/LocationPicker';

const { width, height } = Dimensions.get('window');

const SearchRide = ({ navigation }) => {
    const { theme } = useDriverTheme();
    const [origen, setOrigen] = useState(null);
    const [destino, setDestino] = useState(null);
    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickingFor, setPickingFor] = useState('origen');

    const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
    const [mostrarCalendario, setMostrarCalendario] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Coordenadas para el mapa (por defecto San José)
    const [region, setRegion] = useState({
        latitude: 9.9281,
        longitude: -84.0907,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    });

    const mapRef = useRef(null);

    // Ajustamos la región del mapa cuando cambian los puntos
    useEffect(() => {
        if (origen && destino) {
            const coords = [
                { latitude: origen.lat, longitude: origen.lng },
                { latitude: destino.lat, longitude: destino.lng }
            ];
            mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
                animated: true,
            });
        } else if (origen) {
            mapRef.current?.animateToRegion({
                latitude: origen.lat,
                longitude: origen.lng,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02
            });
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

    const handleSearch = async () => {
        const newErrors = {};
        if (!origen) newErrors.origen = 'Selecciona el origen';
        if (!destino) newErrors.destino = 'Selecciona el destino';
        if (!fechaSeleccionada) newErrors.fecha = 'Requerido';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setLoading(true);
        try {
            const params = {
                origin: `${origen.lat},${origen.lng}`,
                destination: `${destino.lat},${destino.lng}`,
                date: fechaSeleccionada.toISOString().split('T')[0]
            };

            const response = await api.get('/rides', { params });
            if (response.data.success) {
                navigation.navigate('ListOfDrivers', {
                    rides: response.data.data || [],
                    searchTime: new Date().toISOString(),
                    searchOrigin: { lat: origen.lat, lng: origen.lng, name: origen.name },
                    searchDestination: { lat: destino.lat, lng: destino.lng, name: destino.name }
                });
            } else {
                Alert.alert('Aviso', 'No se encontraron viajes para esta ruta.');
            }
        } catch (error) {
            Alert.alert('Error', 'Hubo un problema al buscar viajes.');
        } finally {
            setLoading(false);
        }
    };

    const darkMapStyle = [
        { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
        { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
        { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38413e" }] },
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor="transparent" translucent />

            {/* MAPA DE FONDO */}
            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={region}
                customMapStyle={theme.dark ? darkMapStyle : []}
                showsUserLocation
                showsMyLocationButton={false}
            >
                {origen && (
                    <Marker
                        coordinate={{ latitude: origen.lat, longitude: origen.lng }}
                        title="Origen"
                    >
                        <View style={[styles.markerContainer, { backgroundColor: theme.accent }]}>
                            <Ionicons name="radio-button-on" size={20} color="#fff" />
                        </View>
                    </Marker>
                )}
                {destino && (
                    <Marker
                        coordinate={{ latitude: destino.lat, longitude: destino.lng }}
                        title="Destino"
                    >
                        <View style={[styles.markerContainer, { backgroundColor: '#FF5A5F' }]}>
                            <Ionicons name="location" size={20} color="#fff" />
                        </View>
                    </Marker>
                )}
            </MapView>

            {/* BOTÓN ATRÁS FLOTANTE */}
            <TouchableOpacity
                style={[styles.backFab, { backgroundColor: theme.surface }]}
                onPress={() => navigation.goBack()}
            >
                <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>

            {/* TARJETA PRINCIPAL DE PANEL DE BÚSQUEDA */}
            <View style={[styles.bottomCard, { backgroundColor: theme.surface }]}>
                <View style={[styles.dragBar, { backgroundColor: theme.divider }]} />

                <Text style={[styles.title, { color: theme.text }]}>¿A dónde vamos?</Text>

                <View style={styles.inputsContainer}>
                    {/* ORIGEN */}
                    <TouchableOpacity
                        style={[styles.inputRow, { borderColor: errors.origen ? '#FF5A5F' : theme.border }]}
                        onPress={() => handleOpenPicker('origen')}
                    >
                        <Ionicons name="radio-button-on" size={18} color={theme.accent} style={styles.inputIcon} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Desde</Text>
                            <Text style={[styles.inputValue, { color: origen ? theme.text : theme.textSecondary }]} numberOfLines={1}>
                                {origen ? origen.name : 'Tu ubicación actual'}
                            </Text>
                        </View>
                        <View style={styles.quickActions}>
                            <Ionicons name="search" size={18} color={theme.accent} />
                        </View>
                    </TouchableOpacity>

                    <View style={[styles.verticalLine, { backgroundColor: theme.divider }]} />

                    {/* DESTINO */}
                    <TouchableOpacity
                        style={[styles.inputRow, { borderColor: errors.destino ? '#FF5A5F' : theme.border }]}
                        onPress={() => handleOpenPicker('destino')}
                    >
                        <Ionicons name="location" size={18} color="#FF5A5F" style={styles.inputIcon} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Hacia</Text>
                            <Text style={[styles.inputValue, { color: destino ? theme.text : theme.textSecondary }]} numberOfLines={1}>
                                {destino ? destino.name : 'Ingresa tu destino'}
                            </Text>
                        </View>
                        <View style={styles.quickActions}>
                            <Ionicons name="map" size={18} color="#FF5A5F" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* OPCIÓN DE FECHA */}
                <View style={styles.row}>
                    <TouchableOpacity
                        style={[styles.dateBtn, { backgroundColor: theme.surfaceVariant }]}
                        onPress={() => setMostrarCalendario(true)}
                    >
                        <Ionicons name="calendar-outline" size={18} color={theme.accent} />
                        <Text style={[styles.dateText, { color: theme.text }]}>
                            {fechaSeleccionada ? fechaSeleccionada.toLocaleDateString() : 'Hoy'}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.searchBtn, { backgroundColor: theme.accent }]}
                        onPress={handleSearch}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>Ver Viajes</Text>}
                    </TouchableOpacity>
                </View>
            </View>

            {/* PICKER MODAL UTILIZANDO MISMA LÓGICA QUE CONDUCTOR */}
            <LocationPicker
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                title={pickingFor === 'origen' ? 'Escoge tu Origen' : 'Escoge tu Destino'}
                onSelect={handleLocationSelect}
            />

            {/* Selector de Fecha Nativo */}
            {mostrarCalendario && (
                <DateTimePicker
                    value={fechaSeleccionada || new Date()}
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
                <TouchableOpacity style={[styles.iosConfirm, { backgroundColor: theme.accent }]} onPress={() => setMostrarCalendario(false)}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Confirmar</Text>
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
    backFab: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
        zIndex: 10,
    },
    markerContainer: {
        padding: 5,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#fff',
        elevation: 5,
    },
    bottomCard: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 135 : 115, // Ajustado para que la barra de navegación no tape los botones
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    dragBar: {
        width: 40,
        height: 5,
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 15,
    },
    title: {
        fontSize: 22,
        fontFamily: 'Poppins-Bold',
        marginBottom: 20,
    },
    inputsContainer: {
        marginBottom: 20,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderRadius: 12,
        borderWidth: 1,
    },
    inputIcon: { marginRight: 15 },
    inputLabel: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 },
    inputValue: { fontSize: 15, fontWeight: '500' },
    quickActions: { marginLeft: 10 },
    verticalLine: {
        width: 1,
        height: 8,
        marginLeft: 24,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    dateBtn: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 15,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dateText: { flex: 1, fontWeight: '600', fontSize: 14 },
    searchBtn: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    iosConfirm: {
        padding: 15,
        borderRadius: 10,
        position: 'absolute',
        bottom: 250,
        alignSelf: 'center',
    }
});

export default SearchRide;
