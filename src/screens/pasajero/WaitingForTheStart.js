import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator, Platform, ScrollView, Image, Linking, Modal, Animated } from 'react-native';
import { useCustomAlert } from '../../context/CustomAlertContext';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import api from '../../services/api';
import BottomNavigationBar from '../../components/BottomNavigationBar';

const CancelConfirmationModal = ({ visible, onConfirm, onCancel, theme }) => {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0.85);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    return (
        <Modal transparent visible={visible} animationType="none">
            <View style={modalStyles.overlay}>
                <Animated.View style={[modalStyles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }], backgroundColor: theme.surface }]}>
                    <View style={[modalStyles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
                        <Ionicons name="alert-circle" size={44} color="#EF4444" />
                    </View>
                    <Text style={[modalStyles.title, { color: theme.text }]}>Confirmar cancelación</Text>
                    <Text style={[modalStyles.subtitle, { color: theme.textSecondary }]}>
                        ¿Estás seguro de que deseas cancelar tu reservación? Esta acción no se puede deshacer.
                    </Text>

                    <View style={{ width: '100%', gap: 12 }}>
                        <TouchableOpacity
                            style={[modalStyles.confirmBtn, { backgroundColor: '#EF4444' }]}
                            onPress={onConfirm}
                        >
                            <Text style={modalStyles.confirmBtnText}>Sí, cancelar reservación</Text>
                            <Ionicons name="trash-outline" size={18} color="#fff" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[modalStyles.cancelBtn, { borderColor: theme.border }]}
                            onPress={onCancel}
                        >
                            <Text style={[modalStyles.cancelBtnText, { color: theme.textSecondary }]}>Mantener reservación</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const SuccessActionModal = ({ visible, onConfirm, theme, title, message }) => {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0.85);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    return (
        <Modal transparent visible={visible} animationType="none">
            <View style={modalStyles.overlay}>
                <Animated.View style={[modalStyles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }], backgroundColor: theme.surface }]}>
                    <View style={[modalStyles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="checkmark-circle" size={44} color="#10B981" />
                    </View>
                    <Text style={[modalStyles.title, { color: theme.text }]}>{title || '¡Éxito!'}</Text>
                    <Text style={[modalStyles.subtitle, { color: theme.textSecondary }]}>
                        {message || 'La operación se realizó correctamente.'}
                    </Text>
                    <TouchableOpacity
                        style={[modalStyles.confirmBtn, { backgroundColor: '#10B981' }]}
                        onPress={onConfirm}
                    >
                        <Text style={modalStyles.confirmBtnText}>Entendido</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

const WaitingForTheStart = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const { showAlert } = useCustomAlert();
    const bookingId = route.params?.bookingId;
    const intervalRef = useRef(null);

    const [rideData, setRideData] = useState(null);
    const [vehicleData, setVehicleData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    useEffect(() => {
        if (!bookingId) return;

        const checkStatus = async () => {
            try {
                const bookingRes = await api.get(`/bookings/${bookingId}`);
                if (bookingRes.data.success) {
                    const bookingStatus = bookingRes.data.data.status;

                    if (bookingStatus === 'cancelled' || bookingStatus === 'deny') {
                        clearInterval(intervalRef.current);
                        showAlert(
                            'Viaje Cancelado',
                            'La reserva o el viaje han sido cancelados por el conductor.',
                            'warning',
                            'OK',
                            () => navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' })
                        );
                        return;
                    }

                    const rideId = bookingRes.data.data.ride_id._id || bookingRes.data.data.ride_id;
                    const rideRes = await api.get(`/rides/${rideId}`);

                    if (rideRes.data.success) {
                        const rideObj = rideRes.data.data;
                        const rideStatus = rideObj.status;
                        setRideData(rideObj);

                        setLoading(false);

                        if (!vehicleData && rideObj.driver_id) {
                            const driverId = rideObj.driver_id._id || rideObj.driver_id;
                            try {
                                const vRes = await api.get(`/vehicles/driver/${driverId}`);
                                if (vRes.data.success && vRes.data.data) {
                                    const vInfo = Array.isArray(vRes.data.data) ? vRes.data.data[0] : vRes.data.data;
                                    setVehicleData(vInfo || {});
                                }
                            } catch (e) {
                                console.log('Sin detalles de vehículo asociados.');
                                setVehicleData({}); // Para que no intente buscar repetidamente
                            }
                        }

                        if (rideStatus === 'in progress') {
                            clearInterval(intervalRef.current);
                            showAlert(
                                '¡El viaje ha iniciado!',
                                'Tu conductor ha comenzado el viaje.',
                                'info',
                                'Ver Viaje',
                                () => navigation.replace('TripInProgress', { bookingId })
                            );
                        } else if (rideStatus === 'cancelled' || rideStatus === 'completed') {
                            clearInterval(intervalRef.current);
                            showAlert(
                                'Viaje Finalizado',
                                'El viaje ha finalizado o ha sido cancelado.',
                                'warning',
                                'OK',
                                () => navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' })
                            );
                        }
                    }
                }
            } catch (e) {
                console.error('Error al verificar estado del viaje:', e);
            }
        };

        checkStatus();
        intervalRef.current = setInterval(checkStatus, 15000); // Aumentado a 15s para evitar error 429

        return () => clearInterval(intervalRef.current);
    }, [bookingId]);

    const handleCancel = () => {
        setShowCancelModal(true);
    };

    const confirmCancel = async () => {
        try {
            setShowCancelModal(false);
            const res = await api.delete(`/bookings/${bookingId}`);
            if (res.data.success) {
                setShowSuccessModal(true);
            }
        } catch (e) {
            showAlert('Error', 'No se pudo cancelar la reservación.', 'error');
        }
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '---';
        // Si ya viene como HH:mm (por ejemplo "08:30"), lo devolvemos tal cual o lo formateamos levemente
        return timeStr;
    };

    const calculateArrivalTime = (startTime, durationMin) => {
        if (!startTime || !durationMin) return '---';
        try {
            const [hours, minutes] = startTime.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes + (durationMin || 0));
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (e) {
            return '---';
        }
    };

    const handleWhatsApp = (phone) => {
        if (!phone) {
            showAlert('Error', 'El conductor no tiene un número de teléfono registrado.', 'info');
            return;
        }
        const cleanPhone = phone.replace(/\D/g, '');
        const finalPhone = cleanPhone.length === 8 ? `506${cleanPhone}` : cleanPhone;
        Linking.openURL(`https://wa.me/${finalPhone}`);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.surface} />

            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' })}
                >
                    <Ionicons name="arrow-back" size={26} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Viaje Confirmado</Text>
                <View style={{ width: 42 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.content}>
                    <Ionicons name="time" size={60} color={theme.accent} style={{ marginBottom: 15 }} />
                    <Text style={[styles.title, { color: theme.text }]}>
                        Por favor esperar a que el conductor inicie el viaje
                    </Text>

                    {loading ? (
                        <ActivityIndicator style={{ marginTop: 30 }} size="large" color={theme.accent} />
                    ) : (
                        <View style={styles.detailsContainer}>
                            {/* Información de Ruta */}
                            <View style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Ruta del Conductor</Text>

                                <View style={styles.infoRow}>
                                    <Ionicons name="location" size={20} color={theme.accent} />
                                    <View style={styles.textContainer}>
                                        <Text style={[styles.label, { color: theme.textSecondary }]}>Origen:</Text>
                                        <Text style={[styles.value, { color: theme.text }]}>{rideData?.origin?.name || '---'}</Text>
                                    </View>
                                </View>

                                <View style={styles.infoRow}>
                                    <Ionicons name="flag" size={20} color="#E74C3C" />
                                    <View style={styles.textContainer}>
                                        <Text style={[styles.label, { color: theme.textSecondary }]}>Destino:</Text>
                                        <Text style={[styles.value, { color: theme.text }]}>{rideData?.destination?.name || '---'}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Información de Tiempos */}
                            <View style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Horarios</Text>
                                <View style={styles.row}>
                                    <View style={styles.halfRow}>
                                        <Text style={[styles.label, { color: theme.textSecondary }]}>Salida</Text>
                                        <Text style={[styles.value, { color: theme.text }]}>{formatTime(rideData?.hora)}</Text>
                                    </View>
                                    <View style={styles.halfRow}>
                                        <Text style={[styles.label, { color: theme.textSecondary }]}>Llegada esperada</Text>
                                        <Text style={[styles.value, { color: theme.text }]}>{calculateArrivalTime(rideData?.hora, rideData?.duration_minutes)}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Información del Conductor */}
                            <View style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Conductor</Text>
                                <View style={styles.driverContainer}>
                                    <View style={styles.driverHeader}>
                                        {rideData?.driver_id?.profileImage ? (
                                            <Image
                                                source={{ uri: rideData.driver_id.profileImage }}
                                                style={styles.driverPhoto}
                                            />
                                        ) : (
                                            <View style={[styles.driverPhoto, { backgroundColor: theme.surfaceVariant, justifyContent: 'center', alignItems: 'center' }]}>
                                                <Ionicons name="person" size={24} color={theme.textSecondary} />
                                            </View>
                                        )}
                                        <View style={styles.driverInfo}>
                                            <Text style={[styles.driverName, { color: theme.text }]}>
                                                {rideData?.driver_id?.name || '---'}
                                            </Text>
                                            <Text style={[styles.driverPhone, { color: theme.textSecondary }]}>
                                                Tel: {rideData?.driver_id?.phone || 'No disponible'}
                                            </Text>
                                        </View>
                                    </View>

                                    {rideData?.driver_id?.phone && (
                                        <TouchableOpacity
                                            style={[styles.whatsappButton, { backgroundColor: '#25D366' }]}
                                            onPress={() => handleWhatsApp(rideData.driver_id.phone)}
                                        >
                                            <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
                                            <Text style={styles.whatsappText}>Contactar por WhatsApp</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* Información del Vehículo */}
                            <View style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Vehículo</Text>
                                <View style={styles.row}>
                                    <View style={styles.thirdRow}>
                                        <Text style={[styles.label, { color: theme.textSecondary }]}>Matrícula</Text>
                                        <Text style={[styles.value, { color: theme.text }]}>{vehicleData?.license_plate || vehicleData?.licensePlate || '---'}</Text>
                                    </View>
                                    <View style={styles.thirdRow}>
                                        <Text style={[styles.label, { color: theme.textSecondary }]}>Color</Text>
                                        <Text style={[styles.value, { color: theme.text }]}>{vehicleData?.color || '---'}</Text>
                                    </View>
                                    <View style={styles.thirdRow}>
                                        <Text style={[styles.label, { color: theme.textSecondary }]}>Modelo</Text>
                                        <Text style={[styles.value, { color: theme.text }]}>
                                            {vehicleData?.model || vehicleData?.brand ? `${vehicleData.brand || ''} ${vehicleData.model || ''}`.trim() : '---'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.cancelButton, { borderColor: '#E74C3C' }]}
                    onPress={handleCancel}
                >
                    <Text style={[styles.cancelButtonText, { color: '#E74C3C' }]}>Cancelar Reservación</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: theme.accent }]}
                    onPress={() => navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' })}
                >
                    <Text style={styles.buttonText}>Volver al Inicio</Text>
                </TouchableOpacity>
            </View>

            <CancelConfirmationModal
                visible={showCancelModal}
                theme={theme}
                onConfirm={confirmCancel}
                onCancel={() => setShowCancelModal(false)}
            />

            <SuccessActionModal
                visible={showSuccessModal}
                theme={theme}
                title="Cancelación Exitosa"
                message="Tu reservación ha sido cancelada correctamente."
                onConfirm={() => {
                    setShowSuccessModal(false);
                    navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' });
                }}
            />

            <BottomNavigationBar navigation={navigation} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 40,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    content: {
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    detailsContainer: {
        width: '100%',
        marginTop: 10,
    },
    card: {
        width: '100%',
        borderWidth: 1,
        borderRadius: 15,
        padding: 15,
        marginBottom: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    textContainer: {
        marginLeft: 12,
        flex: 1,
    },
    label: {
        fontSize: 12,
        marginBottom: 2,
    },
    value: {
        fontSize: 14,
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    halfRow: {
        flex: 1,
    },
    thirdRow: {
        flex: 0.33,
    },
    buttonContainer: {
        gap: 10,
        paddingHorizontal: 20,
        paddingBottom: 110, // Aumentado para dejar espacio al BottomNavigationBar
    },
    button: {
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancelButton: {
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        backgroundColor: 'transparent',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    // Nuevos estilos para Conductor y WhatsApp
    driverContainer: {
        marginTop: 5,
    },
    driverHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    driverPhoto: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
    },
    driverInfo: {
        flex: 1,
    },
    driverName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    driverPhone: {
        fontSize: 12,
        marginTop: 2,
    },
    whatsappButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 5,
    },
    whatsappText: {
        color: '#FFF',
        fontWeight: 'bold',
        marginLeft: 8,
        fontSize: 14,
    }
});

const modalStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 25 },
    card: { width: '100%', borderRadius: 30, padding: 30, alignItems: 'center', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15 },
    iconCircle: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 24, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 25, lineHeight: 22 },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', paddingVertical: 16, borderRadius: 16, elevation: 2 },
    confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    cancelBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, marginTop: 4 },
    cancelBtnText: { fontSize: 16, fontWeight: '600' },
});

export default WaitingForTheStart;
