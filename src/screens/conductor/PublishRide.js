import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StatusBar,
    Platform,
    ScrollView
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigationDriver from '../../components/BottomNavigationDriver';
import LocationPicker from '../../components/LocationPicker';
import api from '../../services/api';
import { getRouteDetails } from '../../services/locationService';

/**
 * Pantalla para que los conductores publiquen un nuevo viaje con geolocalización avanzada.
 */
const PublishRide = ({ navigation }) => {
    // --- ESTADOS DE UBICACIÓN ---
    const [origin, setOrigin] = useState(null); // { lat, lng, name, address }
    const [destination, setDestination] = useState(null);
    const [routeInfo, setRouteInfo] = useState(null); // { distance_km, duration_minutes }

    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickingFor, setPickingFor] = useState('origin'); // 'origin' o 'destination'

    // --- OTROS ESTADOS DEL FORMULARIO ---
    const [asientos, setAsientos] = useState('1');
    const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
    const [horaSeleccionada, setHoraSeleccionada] = useState(null);
    const [mostrarCalendario, setMostrarCalendario] = useState(false);
    const [mostrarHora, setMostrarHora] = useState(false);

    const [loading, setLoading] = useState(false);
    const [calculatingRoute, setCalculatingRoute] = useState(false);
    const [errors, setErrors] = useState({});

    // Efecto para calcular la ruta automáticamente cuando ambos puntos están definidos
    useEffect(() => {
        const fetchRoute = async () => {
            if (origin && destination) {
                setCalculatingRoute(true);
                try {
                    const details = await getRouteDetails(origin, destination);
                    setRouteInfo(details);
                } catch (error) {
                    console.error('Error calculando ruta:', error);
                    Alert.alert('Error', 'No se pudo calcular la distancia de la ruta.');
                } finally {
                    setCalculatingRoute(false);
                }
            }
        };
        fetchRoute();
    }, [origin, destination]);

    const handleOpenPicker = (type) => {
        setPickingFor(type);
        setPickerVisible(true);
    };

    const handleLocationSelect = (location) => {
        if (pickingFor === 'origin') {
            setOrigin(location);
        } else {
            setDestination(location);
        }
    };

    const calculatePrice = () => {
        if (!routeInfo) return 0;
        return Math.round(routeInfo.distance_km * 450);
    };

    const handlePublish = async () => {
        const newErrors = {};
        if (!origin) newErrors.origen = 'Requerido';
        if (!destination) newErrors.destino = 'Requerido';
        if (!fechaSeleccionada || !horaSeleccionada) newErrors.fechaHora = 'Requerido';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            Alert.alert('Campos incompletos', 'Por favor selecciona los puntos de origen, destino y la fecha/hora.');
            return;
        }

        setLoading(true);
        try {
            const fullDateTime = new Date(fechaSeleccionada);
            fullDateTime.setHours(horaSeleccionada.getHours());
            fullDateTime.setMinutes(horaSeleccionada.getMinutes());

            const payload = {
                origin: {
                    name: origin.name,
                    address: origin.address,
                    coordinates: { lat: origin.lat, lng: origin.lng }
                },
                destination: {
                    name: destination.name,
                    address: destination.address,
                    coordinates: { lat: destination.lat, lng: destination.lng }
                },
                date_time: fullDateTime.toISOString(),
                available_seats: parseInt(asientos),
                distance_km: routeInfo?.distance_km || 0,
                duration_minutes: routeInfo?.duration_minutes || 0,
                price: calculatePrice()
            };

            const response = await api.post('/rides', payload);

            if (response.data.success) {
                Alert.alert('¡Éxito!', 'Tu viaje ha sido publicado.', [
                    { text: 'OK', onPress: () => navigation.navigate('Home') }
                ]);
            }
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Error publicando el viaje.';
            Alert.alert('Error', errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" />
            <Text style={styles.backgroundTitle}>Publicar Viaje</Text>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                            <Ionicons name="chevron-back" size={24} color="#1A2B4C" />
                        </TouchableOpacity>
                        <Text style={styles.cardTitle}>Itinerario de Viaje</Text>
                    </View>

                    <View style={styles.divider} />

                    {/* Selector de Origen */}
                    <TouchableOpacity
                        style={[styles.locationBtn, errors.origen && styles.inputError]}
                        onPress={() => handleOpenPicker('origin')}
                    >
                        <Ionicons name="radio-button-off" size={20} color={origin ? "#2D63ED" : "#999"} />
                        <View style={styles.locationBtnTextContainer}>
                            <Text style={styles.locationLabel}>Punto de origen</Text>
                            <Text style={[styles.locationValue, !origin && { color: '#999' }]} numberOfLines={1}>
                                {origin ? origin.name : "Selecciona donde empiezas"}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Selector de Destino */}
                    <TouchableOpacity
                        style={[styles.locationBtn, errors.destino && styles.inputError]}
                        onPress={() => handleOpenPicker('destination')}
                    >
                        <Ionicons name="location-outline" size={20} color={destination ? "#2D63ED" : "#999"} />
                        <View style={styles.locationBtnTextContainer}>
                            <Text style={styles.locationLabel}>Punto de destino</Text>
                            <Text style={[styles.locationValue, !destination && { color: '#999' }]} numberOfLines={1}>
                                {destination ? destination.name : "Selecciona a donde vas"}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.verticalDivider} />

                    {/* Fecha y Hora */}
                    <TouchableOpacity
                        style={[styles.locationBtn, errors.fechaHora && styles.inputError]}
                        onPress={() => setMostrarCalendario(true)}
                    >
                        <Ionicons name="calendar-outline" size={20} color="#999" />
                        <View style={styles.locationBtnTextContainer}>
                            <Text style={styles.locationLabel}>¿Cuándo sales?</Text>
                            <Text style={[styles.locationValue, !fechaSeleccionada && { color: '#999' }]}>
                                {fechaSeleccionada
                                    ? `${fechaSeleccionada.toLocaleDateString()} ${horaSeleccionada ? '- ' + horaSeleccionada.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`
                                    : "Seleccionar fecha y hora"}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Asientos */}
                    <View style={styles.pickerWrapper}>
                        <Ionicons name="people-outline" size={20} color="#999" />
                        <Picker
                            selectedValue={asientos}
                            onValueChange={(v) => setAsientos(v)}
                            style={styles.picker}
                        >
                            {[1, 2, 3, 4, 5, 6].map(n => (
                                <Picker.Item key={n} label={`${n} Asientos disponibles`} value={n.toString()} />
                            ))}
                        </Picker>
                    </View>

                    {/* Tarjeta de Resumen (Solo si hay ruta) */}
                    {calculatingRoute ? (
                        <ActivityIndicator color="#2D63ED" style={{ marginVertical: 20 }} />
                    ) : routeInfo && (
                        <View style={styles.summaryCard}>
                            <View style={styles.summaryRow}>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Distancia</Text>
                                    <Text style={styles.summaryValue}>{routeInfo.distance_km} km</Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Duración</Text>
                                    <Text style={styles.summaryValue}>{routeInfo.duration_minutes} min</Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Precio Sug.</Text>
                                    <Text style={styles.summaryPrice}>₡{calculatePrice()}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.publishBtn, loading && { opacity: 0.7 }]}
                        onPress={handlePublish}
                        disabled={loading || calculatingRoute}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishBtnText}>Publicar Viaje</Text>}
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Date Pickers */}
            {(mostrarCalendario || mostrarHora) && (
                <DateTimePicker
                    value={(mostrarHora ? horaSeleccionada : fechaSeleccionada) || new Date()}
                    mode={mostrarCalendario ? "date" : "time"}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    onChange={(event, date) => {
                        if (Platform.OS === 'android') {
                            setMostrarCalendario(false);
                            setMostrarHora(false);
                        }
                        if (date) {
                            if (mostrarCalendario) {
                                setFechaSeleccionada(date);
                                if (Platform.OS === 'android') setTimeout(() => setMostrarHora(true), 100);
                            } else {
                                setHoraSeleccionada(date);
                            }
                        }
                    }}
                />
            )}

            {/* iOS Confirmación para DatePicker */}
            {Platform.OS === 'ios' && (mostrarCalendario || mostrarHora) && (
                <TouchableOpacity
                    style={styles.iosConfirm}
                    onPress={() => {
                        if (mostrarCalendario) {
                            setMostrarCalendario(false);
                            setMostrarHora(true);
                        } else {
                            setMostrarHora(false);
                        }
                    }}
                >
                    <Text style={styles.iosConfirmText}>
                        {mostrarCalendario ? "Siguiente: Hora" : "Confirmar Hora"}
                    </Text>
                </TouchableOpacity>
            )}

            <LocationPicker
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                title={pickingFor === 'origin' ? "Punto de Inicio" : "Punto de Destino"}
                onSelect={handleLocationSelect}
            />

            <BottomNavigationDriver navigation={navigation} activeTab="Viajes" />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
    backgroundTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A2B4C', textAlign: 'center', marginTop: 20 },
    content: { padding: 20, paddingBottom: 100 },
    card: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, elevation: 5, shadowOpacity: 0.1 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
    backButton: { position: 'absolute', left: 0 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    divider: { height: 1, backgroundColor: '#EEE', marginBottom: 20 },
    verticalDivider: { height: 1, backgroundColor: '#EEE', marginVertical: 12 },
    locationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#F5F7FA',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#EFEFEF',
        gap: 15
    },
    locationBtnTextContainer: { flex: 1 },
    locationLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
    locationValue: { fontSize: 15, color: '#333', fontWeight: '500' },
    inputError: { borderColor: '#f53333' },
    pickerWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F7FA',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 54,
        marginBottom: 20
    },
    picker: { flex: 1, marginLeft: -10 },
    summaryCard: {
        backgroundColor: '#2D63ED10',
        borderRadius: 15,
        padding: 15,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#2D63ED20'
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
    summaryItem: { alignItems: 'center' },
    summaryLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase' },
    summaryValue: { fontSize: 15, fontWeight: 'bold', color: '#1A2B4C' },
    summaryPrice: { fontSize: 16, fontWeight: 'bold', color: '#25C460' },
    publishBtn: {
        backgroundColor: '#2D63ED',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center'
    },
    publishBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    iosConfirm: { backgroundColor: '#2D63ED', padding: 15, borderRadius: 10, marginHorizontal: 20, marginBottom: 20 },
    iosConfirmText: { color: '#FFF', textAlign: 'center', fontWeight: 'bold' }
});

export default PublishRide;
