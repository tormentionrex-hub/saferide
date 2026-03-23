import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    StatusBar,
    Platform,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import LocationPicker from '../../components/LocationPicker';
import api from '../../services/api';
import { getRouteDetails } from '../../services/locationService';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import SettingsGearButton from '../../components/SettingsGearButton';

/**
 * Pantalla para que los conductores publiquen un nuevo viaje con geolocalización avanzada.
 */
const PublishRide = ({ navigation }) => {
    const { theme } = useDriverTheme();
    const placeholderColor = theme.dark ? '#B0B0D8' : '#AAAAAA';
    const si = useScrollIndicator();

    // --- ESTADOS DE UBICACIÓN ---
    const [origin, setOrigin] = useState(null);
    const [destination, setDestination] = useState(null);
    const [routeInfo, setRouteInfo] = useState(null);

    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickingFor, setPickingFor] = useState('origin');

    // --- OTROS ESTADOS DEL FORMULARIO ---
    const [asientos, setAsientos] = useState(1);
    const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
    const [horaSeleccionada, setHoraSeleccionada] = useState(null);
    const [mostrarCalendario, setMostrarCalendario] = useState(false);
    const [mostrarHora, setMostrarHora] = useState(false);

    const [loading, setLoading] = useState(false);
    const [calculatingRoute, setCalculatingRoute] = useState(false);
    const [errors, setErrors] = useState({});

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
                available_seats: asientos,
                distance_km: routeInfo?.distance_km || 0,
                duration_minutes: routeInfo?.duration_minutes || 0,
                price: calculatePrice()
            };

            const response = await api.post('/rides', payload);

            if (response.data.success) {
                Alert.alert('¡Éxito!', 'Tu viaje ha sido publicado.', [
                    { text: 'OK', onPress: () => navigation.navigate('ListOfRequests') }
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
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.surface }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.surface} />

            <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.content} {...si.scrollProps}>
                {/* ── CARD ITINERARIO ─────────────────────────────────── */}
                <View style={[styles.card, { backgroundColor: theme.surface }]}>

                    {/* Cabecera */}
                    <View style={styles.cardHeader}>
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                            <Ionicons name="chevron-back" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>Itinerario de Viaje</Text>
                        <SettingsGearButton navigation={navigation} color={theme.text} style={styles.gearBtn} />
                    </View>

                    <View style={[styles.divider, { backgroundColor: theme.divider }]} />

                    {/* Origen */}
                    <TouchableOpacity
                        style={[styles.locationBtn, { backgroundColor: theme.surfaceVariant, borderColor: errors.origen ? theme.danger : theme.border }]}
                        onPress={() => handleOpenPicker('origin')}
                    >
                        <Ionicons name="radio-button-off" size={20} color={origin ? theme.accent : placeholderColor} />
                        <View style={styles.locationBtnTextContainer}>
                            <Text style={[styles.locationLabel, { color: placeholderColor }]}>Punto de origen</Text>
                            <Text style={[styles.locationValue, { color: origin ? theme.text : placeholderColor }]} numberOfLines={1}>
                                {origin ? origin.name : 'Selecciona donde empiezas'}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Destino */}
                    <TouchableOpacity
                        style={[styles.locationBtn, { backgroundColor: theme.surfaceVariant, borderColor: errors.destino ? theme.danger : theme.border }]}
                        onPress={() => handleOpenPicker('destination')}
                    >
                        <Ionicons name="location-outline" size={20} color={destination ? theme.accent : placeholderColor} />
                        <View style={styles.locationBtnTextContainer}>
                            <Text style={[styles.locationLabel, { color: placeholderColor }]}>Punto de destino</Text>
                            <Text style={[styles.locationValue, { color: destination ? theme.text : placeholderColor }]} numberOfLines={1}>
                                {destination ? destination.name : 'Selecciona a donde vas'}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <View style={[styles.verticalDivider, { backgroundColor: theme.divider }]} />

                    {/* Fecha y Hora */}
                    <TouchableOpacity
                        style={[styles.locationBtn, { backgroundColor: theme.surfaceVariant, borderColor: errors.fechaHora ? theme.danger : theme.border }]}
                        onPress={() => setMostrarCalendario(true)}
                    >
                        <Ionicons name="calendar-outline" size={20} color={placeholderColor} />
                        <View style={styles.locationBtnTextContainer}>
                            <Text style={[styles.locationLabel, { color: placeholderColor }]}>¿Cuándo sales?</Text>
                            <Text style={[styles.locationValue, { color: fechaSeleccionada ? theme.text : placeholderColor }]}>
                                {fechaSeleccionada
                                    ? `${fechaSeleccionada.toLocaleDateString()} ${horaSeleccionada ? '- ' + horaSeleccionada.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`
                                    : 'Seleccionar fecha y hora'}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Asientos — selector custom */}
                    <View style={[styles.seatsWrapper, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
                        <View style={styles.seatsLabelRow}>
                            <Ionicons name="people-outline" size={20} color={placeholderColor} />
                            <Text style={[styles.seatsLabel, { color: placeholderColor }]}>Asientos disponibles</Text>
                        </View>
                        <View style={styles.seatsControls}>
                            <TouchableOpacity
                                style={[styles.seatsBtn, { backgroundColor: theme.surface, borderColor: theme.border },
                                    asientos <= 1 && { opacity: 0.35 }]}
                                onPress={() => setAsientos(v => Math.max(1, v - 1))}
                                disabled={asientos <= 1}
                            >
                                <Ionicons name="remove" size={20} color={theme.accent} />
                            </TouchableOpacity>

                            <View style={[styles.seatsValueBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                <Text style={[styles.seatsValue, { color: theme.text }]}>{asientos}</Text>
                            </View>

                            <TouchableOpacity
                                style={[styles.seatsBtn, { backgroundColor: theme.surface, borderColor: theme.border },
                                    asientos >= 6 && { opacity: 0.35 }]}
                                onPress={() => setAsientos(v => Math.min(6, v + 1))}
                                disabled={asientos >= 6}
                            >
                                <Ionicons name="add" size={20} color={theme.accent} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Resumen de ruta */}
                    {calculatingRoute ? (
                        <ActivityIndicator color={theme.accent} style={{ marginVertical: 20 }} />
                    ) : routeInfo && (
                        <View style={[styles.summaryCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder }]}>
                            <View style={styles.summaryRow}>
                                <View style={styles.summaryItem}>
                                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Distancia</Text>
                                    <Text style={[styles.summaryValue, { color: theme.text }]}>{routeInfo.distance_km} km</Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Duración</Text>
                                    <Text style={[styles.summaryValue, { color: theme.text }]}>{routeInfo.duration_minutes} min</Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Precio Sug.</Text>
                                    <Text style={[styles.summaryPrice, { color: '#25C460' }]}>₡{calculatePrice()}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Botón publicar */}
                    <TouchableOpacity
                        style={[styles.publishBtn, { backgroundColor: theme.accent }, loading && { opacity: 0.7 }]}
                        onPress={handlePublish}
                        disabled={loading || calculatingRoute}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.publishBtnText}>Publicar Viaje</Text>
                        }
                    </TouchableOpacity>
                </View>
            </ScrollView>
            <ScrollIndicator si={si} thumbColor={theme.accent} />
            </View>

            {/* Date Pickers */}
            {(mostrarCalendario || mostrarHora) && (
                <DateTimePicker
                    value={(mostrarHora ? horaSeleccionada : fechaSeleccionada) || new Date()}
                    mode={mostrarCalendario ? 'date' : 'time'}
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
                    style={[styles.iosConfirm, { backgroundColor: theme.accent }]}
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
                        {mostrarCalendario ? 'Siguiente: Hora' : 'Confirmar Hora'}
                    </Text>
                </TouchableOpacity>
            )}

            <LocationPicker
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                title={pickingFor === 'origin' ? 'Punto de Inicio' : 'Punto de Destino'}
                onSelect={handleLocationSelect}
            />


        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    // ScrollView ocupa todo el espacio, sin padding extra
    content: {
        flexGrow: 1,
        paddingBottom: 100,
    },
    // La tarjeta ocupa todo el ancho y alto sin bordes ni sombras externas
    card: {
        flex: 1,
        padding: 24,
        minHeight: '100%',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    backButton: {
        position: 'absolute',
        left: 0,
        padding: 4,
    },
    gearBtn: {
        position: 'absolute',
        right: 0,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    divider: {
        height: 1,
        marginBottom: 20,
    },
    verticalDivider: {
        height: 1,
        marginVertical: 12,
    },
    locationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 14,
        marginBottom: 12,
        borderWidth: 1,
        gap: 15,
    },
    locationBtnTextContainer: {
        flex: 1,
    },
    locationLabel: {
        fontSize: 11,
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    locationValue: {
        fontSize: 15,
        fontWeight: '500',
    },
    seatsWrapper: {
        borderRadius: 14,
        paddingHorizontal: 15,
        paddingVertical: 12,
        marginBottom: 20,
        borderWidth: 1,
    },
    seatsLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    seatsLabel: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    seatsControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    seatsBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    seatsValueBox: {
        width: 64,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    seatsValue: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    summaryCard: {
        borderRadius: 15,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    summaryItem: {
        alignItems: 'center',
        flex: 1,
    },
    summaryLabel: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    summaryPrice: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    publishBtn: {
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 4,
    },
    publishBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    iosConfirm: {
        padding: 15,
        borderRadius: 10,
        marginHorizontal: 20,
        marginBottom: 20,
    },
    iosConfirmText: {
        color: '#FFF',
        textAlign: 'center',
        fontWeight: 'bold',
    },
});

export default PublishRide;
