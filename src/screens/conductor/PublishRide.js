import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    StatusBar,
    Platform,
    ScrollView,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import LocationPicker from '../../components/LocationPicker';
import ScreenHeader from '../../components/ScreenHeader';
import api from '../../services/api';
import { getRouteDetails } from '../../services/locationService';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';

import { moderateScale } from '../../utils/responsive';
/**
 * Pantalla para que los conductores publiquen un nuevo viaje con geolocalización avanzada.
 */
const PublishRide = ({ navigation, route }) => {
    const { theme } = useDriverTheme();
    const si = useScrollIndicator();

    // --- ESTADOS DE UBICACIÓN ---
    const [origin, setOrigin] = useState(null);
    const [destination, setDestination] = useState(null);
    const [routeInfo, setRouteInfo] = useState(null);

    // Pre-llenar origen/destino desde rutas frecuentes.
    // PublishRide es Tab.Screen (siempre montada), así que el efecto debe
    // reaccionar a cambios en los params, no sólo al primer montaje.
    useEffect(() => {
        const params = route?.params;
        if (!params?.prefillOrigin && !params?.prefillDestination) return;

        if (params?.prefillOrigin) {
            setOrigin(params.prefillOrigin);
        }
        if (params?.prefillDestination) {
            setDestination(params.prefillDestination);
        }

        // Limpiar los params para evitar re-aplicar si el usuario vuelve
        // a entrar manualmente a la pestaña sin pasar por una ruta frecuente.
        navigation.setParams({ prefillOrigin: undefined, prefillDestination: undefined });
    }, [route?.params?.prefillOrigin, route?.params?.prefillDestination]);

    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickingFor, setPickingFor] = useState('origin');

    // --- OTROS ESTADOS DEL FORMULARIO ---
    const [asientos, setAsientos] = useState(1);
    // La fecha arranca con "hoy" porque el backend solo permite publicar viajes
    // para el día actual — pedirle al usuario que la "seleccione" sería una
    // fricción innecesaria. El picker sigue disponible por si quiere abrirlo.
    const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
    const [horaSeleccionada, setHoraSeleccionada] = useState(null);
    const [mostrarCalendario, setMostrarCalendario] = useState(false);
    const [mostrarHora, setMostrarHora] = useState(false);

    const [loading, setLoading] = useState(false);
    const [calculatingRoute, setCalculatingRoute] = useState(false);
    const [errors, setErrors] = useState({});
    const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
    const [isActiveRideModalVisible, setIsActiveRideModalVisible] = useState(false);
    const [newRideId, setNewRideId] = useState(null);

    // --- SWEET ALERT ---
    const [sweetAlert, setSweetAlert] = useState({ visible: false, type: 'error', title: '', message: '' });
    const showSweetAlert = (type, title, message) => setSweetAlert({ visible: true, type, title, message });
    const hideSweetAlert = () => setSweetAlert(prev => ({ ...prev, visible: false }));

    useEffect(() => {
        const fetchRoute = async () => {
            if (origin && destination) {
                setCalculatingRoute(true);
                try {
                    const details = await getRouteDetails(origin, destination);
                    setRouteInfo(details);
                } catch (error) {
                    console.error('Error calculando ruta:', error?.response?.data?.message || error?.message || 'unknown error');
                    showSweetAlert('error', 'Error de ruta', 'No se pudo calcular la distancia de la ruta.');
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
        //negociar el precio por kilometro
        if (!routeInfo) return 0;
        return Math.round(routeInfo.distance_km * 270);
    };

    const handlePublish = async () => {
        const newErrors = {};
        if (!origin) newErrors.origen = 'Requerido';
        if (!destination) newErrors.destino = 'Requerido';
        if (!horaSeleccionada) newErrors.hora = 'Requerido';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            showSweetAlert('warning', 'Campos incompletos', 'Por favor selecciona el origen, destino y la hora de salida.');
            return;
        }

        setLoading(true);
        try {
            // --- VALIDACIÓN: SOLO UN VIAJE ACTIVO A LA VEZ ---
            const meRes = await api.get('/auth/me');
            if (meRes.data.success) {
                const driverId = meRes.data.data._id;
                const activeRidesRes = await api.get(`/rides/driver/${driverId}`);
                if (activeRidesRes.data.success) {
                    const activeRides = activeRidesRes.data.data.filter(r =>
                        r.status === 'scheduled' || r.status === 'in progress'
                    );
                    if (activeRides.length > 0) {
                        setIsActiveRideModalVisible(true);
                        setLoading(false);
                        return;
                    }
                }
            }

            const fullDateTime = new Date(fechaSeleccionada);
            fullDateTime.setHours(horaSeleccionada.getHours(), horaSeleccionada.getMinutes(), 0, 0);

            const now = new Date();

            // Validar que sea el día de hoy
            const inputDateString = new Date(fullDateTime.getTime() - fullDateTime.getTimezoneOffset() * 60000).toISOString().split('T')[0];
            const nowDateString = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];

            if (inputDateString !== nowDateString) {
                showSweetAlert('warning', 'Fecha inválida', 'Solo puedes publicar viajes para el día de hoy.');
                setLoading(false);
                return;
            }

            // Mínimo 3 minutos de anticipación (usando ms para evitar bug de rollover)
            const minAllowedTime = now.getTime() + 3 * 60 * 1000;

            if (fullDateTime.getTime() <= minAllowedTime) {
                showSweetAlert('warning', 'Hora muy próxima', 'Selecciona una hora con al menos 3 minutos de anticipación para que los pasajeros puedan unirse.');
                setLoading(false);
                return;
            }

            const fechaString = new Date(fechaSeleccionada.getTime() - fechaSeleccionada.getTimezoneOffset() * 60000).toISOString().split('T')[0];
            const horaString = `${horaSeleccionada.getHours().toString().padStart(2, '0')}:${horaSeleccionada.getMinutes().toString().padStart(2, '0')}`;

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
                fecha: fechaString,
                hora: horaString,
                available_seats: asientos,
                distance_km: routeInfo?.distance_km || 0,
                duration_minutes: routeInfo?.duration_minutes || 0,
                suggested_price: calculatePrice(),
            };

            const response = await api.post('/rides', payload);

            if (response.data.success) {
                setNewRideId(response.data.data._id);
                setIsSuccessModalVisible(true);
            }
        } catch (error) {
            const data = error.response?.data;
            let errorMsg = 'Error publicando el viaje.';

            if (data?.errors && Array.isArray(data.errors)) {
                errorMsg = data.errors.map(e => e.message).join('\n');
            } else if (data?.message) {
                errorMsg = data.message;
            }

            showSweetAlert('error', 'Error al publicar', errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

            <ScreenHeader title="Itinerario de Viaje" onBack={() => navigation.goBack()} />

            <View style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content} {...si.scrollProps}>

                    {/* ── SECCIÓN RUTA ─────────────────────────────────── */}
                    <View style={[styles.routeCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder || theme.border, borderWidth: 1 }]}>
                        <View style={styles.routeRow}>

                            {/* Timeline gráfico */}
                            <View style={styles.timeline}>
                                <View style={styles.timelineDotEmpty} />
                                <View style={styles.timelineLine} />
                                <View style={styles.timelineDotFilled} />
                            </View>

                            {/* Inputs de ubicación */}
                            <View style={styles.routeInputs}>
                                {/* Origen */}
                                <View>
                                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>SALIDA DE</Text>
                                    <TouchableOpacity
                                        style={[styles.locationCard, { backgroundColor: theme.surfaceVariant }, errors.origen && styles.cardError]}
                                        onPress={() => handleOpenPicker('origin')}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={[styles.locationCardPrimary, { color: theme.navActive }]}>
                                            {origin ? origin.name : 'Presiona para elegir el punto de Origen'}
                                        </Text>
                                        <Text style={[styles.locationCardSecondary, { color: theme.textSecondary }]}>
                                            {origin ? origin.address : '¿Desde dónde inicias?'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Destino */}
                                <View>
                                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>DESTINO FINAL</Text>
                                    <TouchableOpacity
                                        style={[styles.locationCard, { backgroundColor: theme.surfaceVariant }, errors.destino && styles.cardError]}
                                        onPress={() => handleOpenPicker('destination')}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={[styles.locationCardPrimary, { color: theme.navActive }]}>
                                            {destination ? destination.name : 'Presiona para elegir el Destino'}
                                        </Text>
                                        <Text style={[styles.locationCardSecondary, { color: theme.textSecondary }]}>
                                            {destination ? destination.address : '¿A dónde te diriges hoy?'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* ── FECHA + HORA ─────────────────────────────────── */}
                    <View style={styles.dateTimeRow}>
                        {/* Fecha */}
                        <TouchableOpacity
                            style={[styles.dateCard, { backgroundColor: theme.surfaceVariant }]}
                            onPress={() => setMostrarCalendario(true)}
                            activeOpacity={0.8}
                        >
                            <View>
                                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>FECHA</Text>
                                <Text style={[styles.dateValue, { color: theme.text }]}>Hoy</Text>
                            </View>
                            <View style={[styles.calendarIconCircle, { backgroundColor: theme.surface }]}>
                                <Ionicons name="calendar-outline" size={22} color={theme.navActive} />
                            </View>
                        </TouchableOpacity>

                        {/* Hora */}
                        <TouchableOpacity
                            style={[styles.timeCard, { backgroundColor: theme.surfaceVariant }, errors.hora && styles.cardError]}
                            onPress={() => setMostrarHora(true)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>HORA DE PARTIDA</Text>
                            <Text style={[styles.timeValue, { color: theme.text }]}>
                                {horaSeleccionada
                                    ? horaSeleccionada.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : '--:--'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* ── ASIENTOS ─────────────────────────────────── */}
                    <View style={[styles.seatsCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder || theme.border, borderWidth: 1 }]}>
                        <Text style={[styles.inputLabel, { color: theme.textSecondary, textAlign: 'center', marginBottom: 20 }]}>
                            ASIENTOS DISPONIBLES
                        </Text>
                        <View style={styles.seatsRow}>
                            <TouchableOpacity
                                style={[styles.seatsMinusBtn, { backgroundColor: theme.surfaceVariant, elevation: 0, shadowOpacity: 0 }, asientos <= 1 && { opacity: 0.3 }]}
                                onPress={() => setAsientos(v => Math.max(1, v - 1))}
                                disabled={asientos <= 1}
                                activeOpacity={0.75}
                            >
                                <Ionicons name="remove" size={28} color={theme.text} />
                            </TouchableOpacity>

                            <Text style={[styles.seatsNumber, { color: theme.text }]}>{asientos}</Text>

                            <TouchableOpacity
                                style={[styles.seatsPlusBtn, { backgroundColor: theme.surfaceVariant, elevation: 0, shadowOpacity: 0 }, asientos >= 6 && { opacity: 0.3 }]}
                                onPress={() => setAsientos(v => Math.min(6, v + 1))}
                                disabled={asientos >= 6}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="add" size={28} color={theme.text} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ── RESUMEN DE RUTA ─────────────────────────────── */}
                    {calculatingRoute ? (
                        <ActivityIndicator color={theme.navActive} style={{ marginVertical: 20 }} />
                    ) : routeInfo && (
                        <View style={[styles.summaryCard, { backgroundColor: theme.surfaceVariant }]}>
                            <View style={styles.summaryRow}>
                                <View style={styles.summaryItem}>
                                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Distancia</Text>
                                    <Text style={[styles.summaryValue, { color: theme.text }]}>{routeInfo.distance_km} km</Text>
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryItem}>
                                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Duración</Text>
                                    <Text style={[styles.summaryValue, { color: theme.text }]}>{routeInfo.duration_minutes} min</Text>
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryItem}>
                                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Precio Sug.</Text>
                                    <Text style={[styles.summaryValue, { color: '#25C460' }]}>₡{calculatePrice()}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* ── BOTÓN PUBLICAR ─────────────────────────────── */}
                    <TouchableOpacity
                        style={[styles.publishBtn, (loading || calculatingRoute) && { opacity: 0.65 }]}
                        onPress={handlePublish}
                        disabled={loading || calculatingRoute}
                        activeOpacity={0.9}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.publishBtnText}>PUBLICAR VIAJE AHORA</Text>
                            </>
                        )}
                    </TouchableOpacity>

                </ScrollView>
                <ScrollIndicator si={si} thumbColor="#1a73e8" />
            </View>

            {/* ── DATE / TIME PICKERS ──────────────────────────── */}
            {(mostrarCalendario || mostrarHora) && (
                <DateTimePicker
                    value={(mostrarHora ? horaSeleccionada : fechaSeleccionada) || new Date()}
                    mode={mostrarCalendario ? 'date' : 'time'}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    maximumDate={mostrarCalendario ? new Date(new Date().setHours(23, 59, 59, 999)) : undefined}
                    onChange={(_event, date) => {
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

            {/* ── MODAL ÉXITO ──────────────────────────────────── */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isSuccessModalVisible}
                onRequestClose={() => {
                    setIsSuccessModalVisible(false);
                    navigation.navigate('ListOfRequests', { rideId: newRideId });
                }}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => {
                        setIsSuccessModalVisible(false);
                        navigation.navigate('ListOfRequests', { rideId: newRideId });
                    }}
                >
                    <View style={[styles.alertContent, { backgroundColor: theme.surface }]}>
                        <View style={[styles.alertIconContainer, { backgroundColor: '#27AE6020' }]}>
                            <Ionicons name="checkmark-circle-outline" size={32} color="#27AE60" />
                        </View>
                        <Text style={[styles.alertTitle, { color: theme.text }]}>¡Éxito!</Text>
                        <Text style={[styles.alertMessage, { color: theme.textSecondary }]}>
                            Tu viaje ha sido publicado.
                        </Text>
                        <View style={styles.alertActions}>
                            <TouchableOpacity
                                style={[styles.alertConfirmBtn, { backgroundColor: '#27AE60' }]}
                                onPress={() => {
                                    setIsSuccessModalVisible(false);
                                    navigation.navigate('ListOfRequests', { rideId: newRideId });
                                }}
                            >
                                <Text style={styles.alertConfirmText}>¡Excelente!</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── MODAL VIAJE ACTIVO ───────────────────────────── */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isActiveRideModalVisible}
                onRequestClose={() => setIsActiveRideModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsActiveRideModalVisible(false)}
                >
                    <View style={[styles.alertContent, { backgroundColor: theme.surface }]}>
                        <View style={[styles.alertIconContainer, { backgroundColor: theme.accent + '20' }]}>
                            <Ionicons name="alert-circle-outline" size={32} color={theme.accent} />
                        </View>
                        <Text style={[styles.alertTitle, { color: theme.text }]}>Viaje activo detectado</Text>
                        <Text style={[styles.alertMessage, { color: theme.textSecondary }]}>
                            No puedes publicar un nuevo viaje porque ya tienes uno programado o en curso. Debes finalizar o cancelar el actual primero.
                        </Text>
                        <View style={styles.alertActions}>
                            <TouchableOpacity
                                style={[styles.alertConfirmBtn, { backgroundColor: theme.accent, marginBottom: 12 }]}
                                onPress={() => {
                                    setIsActiveRideModalVisible(false);
                                    navigation.navigate('DashboardDriver');
                                }}
                            >
                                <Text style={styles.alertConfirmText}>Ir a mi dashboard</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.alertConfirmBtn, { backgroundColor: theme.surfaceVariant, borderWidth: 1, borderColor: theme.border }]}
                                onPress={() => setIsActiveRideModalVisible(false)}
                            >
                                <Text style={[styles.alertConfirmText, { color: theme.textSecondary }]}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── SWEET ALERT ──────────────────────────────────── */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={sweetAlert.visible}
                onRequestClose={hideSweetAlert}
            >
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={hideSweetAlert}>
                    <View style={styles.sweetAlertCard}>
                        {/* Icono */}
                        <View style={[
                            styles.sweetAlertIconCircle,
                            sweetAlert.type === 'error'   && { backgroundColor: 'rgba(186,26,26,0.1)' },
                            sweetAlert.type === 'warning' && { backgroundColor: 'rgba(255,152,0,0.1)' },
                            sweetAlert.type === 'success' && { backgroundColor: 'rgba(37,196,96,0.1)' },
                        ]}>
                            <Ionicons
                                name={
                                    sweetAlert.type === 'error'   ? 'close-circle'  :
                                    sweetAlert.type === 'warning' ? 'warning'        :
                                    'checkmark-circle'
                                }
                                size={44}
                                color={
                                    sweetAlert.type === 'error'   ? '#ba1a1a' :
                                    sweetAlert.type === 'warning' ? '#FF9800' :
                                    '#25C460'
                                }
                            />
                        </View>

                        {/* Textos */}
                        <Text style={styles.sweetAlertTitle}>{sweetAlert.title}</Text>
                        <Text style={styles.sweetAlertMessage}>{sweetAlert.message}</Text>

                        {/* Botón */}
                        <TouchableOpacity
                            style={[
                                styles.sweetAlertBtn,
                                sweetAlert.type === 'error'   && { backgroundColor: '#ba1a1a' },
                                sweetAlert.type === 'warning' && { backgroundColor: '#FF9800' },
                                sweetAlert.type === 'success' && { backgroundColor: '#25C460' },
                            ]}
                            onPress={hideSweetAlert}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.sweetAlertBtnText}>Entendido</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#f7f9fb',
    },


    // ── ScrollView ────────────────────────────────────────────
    content: {
        padding: 20,
        paddingBottom: 120,
    },

    // ── Route Card ────────────────────────────────────────────
    routeCard: {
        backgroundColor: '#ffffff',
        borderRadius: 32,
        padding: 28,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.03,
        shadowRadius: 40,
        elevation: 2,
    },
    routeRow: {
        flexDirection: 'row',
        gap: 20,
    },

    // Timeline
    timeline: {
        alignItems: 'center',
        paddingTop: 22,
        paddingBottom: 6,
    },
    timelineDotEmpty: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#1a73e8',
        backgroundColor: '#ffffff',
    },
    timelineLine: {
        flex: 1,
        width: 2,
        marginVertical: 4,
        borderWidth: 1,
        borderColor: '#1a73e8',
        borderStyle: 'dashed',
        borderRadius: 1,
    },
    timelineDotFilled: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#1a73e8',
    },

    // Location inputs
    routeInputs: {
        flex: 1,
        gap: 24,
    },
    inputLabel: {
        fontSize: moderateScale(10),
        fontFamily: 'Poppins-Bold',
        color: '#9ca3af',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    locationCard: {
        backgroundColor: '#f2f4f6',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 1,
    },
    locationCardPrimary: {
        fontSize: moderateScale(12),
        fontFamily: 'Poppins-Bold',
        color: '#005bbf',
        letterSpacing: 0.2,
        marginBottom: 4,
    },
    locationCardSecondary: {
        fontSize: moderateScale(13),
        color: '#9ca3af',
    },
    cardError: {
        borderWidth: 1.5,
        borderColor: '#ba1a1a',
    },

    // ── Date + Time Row ───────────────────────────────────────
    dateTimeRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 14,
    },
    dateCard: {
        flex: 1,
        backgroundColor: '#f2f4f6',
        borderRadius: 24,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dateValue: {
        fontSize: moderateScale(18),
        fontFamily: 'Poppins-Bold',
        color: '#191c1e',
        marginTop: 2,
    },
    calendarIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    timeCard: {
        flex: 1,
        backgroundColor: '#f2f4f6',
        borderRadius: 24,
        padding: 20,
        justifyContent: 'center',
    },
    timeValue: {
        fontSize: moderateScale(20),
        fontFamily: 'Poppins-Bold',
        color: '#191c1e',
        marginTop: 2,
    },

    // ── Seats Card ────────────────────────────────────────────
    seatsCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.03,
        shadowRadius: 30,
        elevation: 2,
    },
    seatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '75%',
        maxWidth: 200,
        marginBottom: 4,
    },
    seatsMinusBtn: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#f2f4f6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    seatsNumber: {
        fontSize: moderateScale(42),
        fontFamily: 'Poppins-Bold',
        color: '#191c1e',
        lineHeight: 50,
        textAlign: 'center',
        minWidth: 50,
    },
    seatsPlusBtn: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#1a73e8',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#1a73e8',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
    },
    seatsNote: {
        fontSize: moderateScale(12),
        color: '#727785',
        fontStyle: 'italic',
        fontFamily: 'Poppins-SemiBold',
    },

    // ── Summary Card ──────────────────────────────────────────
    summaryCard: {
        backgroundColor: '#f2f4f6',
        borderRadius: 20,
        padding: 20,
        marginBottom: 14,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryItem: {
        alignItems: 'center',
        flex: 1,
    },
    summaryDivider: {
        width: 1,
        height: 36,
        backgroundColor: '#d1d5db',
    },
    summaryLabel: {
        fontSize: moderateScale(11),
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: '#727785',
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: moderateScale(16),
        fontFamily: 'Poppins-Bold',
        color: '#191c1e',
    },

    // ── Publish Button ────────────────────────────────────────
    publishBtn: {
        height: 64,
        backgroundColor: '#005bbf',
        borderRadius: 9999,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        shadowColor: '#005bbf',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.32,
        shadowRadius: 24,
        elevation: 8,
    },
    publishBtnText: {
        color: '#fff',
        fontSize: moderateScale(15),
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.8,
    },

    // ── iOS Confirm ───────────────────────────────────────────
    iosConfirm: {
        padding: 15,
        borderRadius: 14,
        marginHorizontal: 20,
        marginBottom: 20,
        backgroundColor: '#005bbf',
    },
    iosConfirmText: {
        color: '#FFF',
        textAlign: 'center',
        fontFamily: 'Poppins-Bold',
    },

    // ── Modals ────────────────────────────────────────────────
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    alertContent: {
        width: '85%',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
    },
    alertIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    alertTitle: {
        fontSize: moderateScale(20),
        fontFamily: 'Poppins-Bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    alertMessage: {
        fontSize: moderateScale(14),
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    alertActions: {
        width: '100%',
    },
    alertConfirmBtn: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },
    alertConfirmText: {
        color: '#fff',
        fontSize: moderateScale(15),
        fontFamily: 'Poppins-SemiBold',
    },

    // ── Sweet Alert ───────────────────────────────────────────
    sweetAlertCard: {
        width: '82%',
        backgroundColor: '#ffffff',
        borderRadius: 28,
        paddingVertical: 32,
        paddingHorizontal: 28,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 16,
    },
    sweetAlertIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    sweetAlertTitle: {
        fontSize: moderateScale(20),
        fontFamily: 'Poppins-Bold',
        color: '#191c1e',
        textAlign: 'center',
        marginBottom: 10,
        letterSpacing: -0.3,
    },
    sweetAlertMessage: {
        fontSize: moderateScale(14),
        color: '#727785',
        textAlign: 'center',
        lineHeight: 21,
        marginBottom: 28,
    },
    sweetAlertBtn: {
        width: '100%',
        paddingVertical: 15,
        borderRadius: 99,
        alignItems: 'center',
    },
    sweetAlertBtnText: {
        color: '#fff',
        fontSize: moderateScale(15),
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.3,
    },
});

export default PublishRide;
