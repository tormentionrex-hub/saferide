import React, { useState, useEffect, useRef } from 'react';
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

const CancelledByDriverModal = ({ visible, onConfirm, theme }) => {
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
                        <Ionicons name="warning-outline" size={44} color="#EF4444" />
                    </View>
                    <Text style={[modalStyles.title, { color: theme.text }]}>Viaje Cancelado</Text>
                    <Text style={[modalStyles.subtitle, { color: theme.textSecondary }]}>
                        La reserva o el viaje han sido cancelados por el conductor.
                    </Text>
                    <TouchableOpacity 
                        style={[modalStyles.confirmBtn, { backgroundColor: '#EF4444' }]} 
                        onPress={onConfirm}
                    >
                        <Text style={modalStyles.confirmBtnText}>Regresar a Inicio</Text>
                        <Ionicons name="home-outline" size={18} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

/* ─── Modal: ¡El viaje ha iniciado! ─────────────────────────────── */
const RideStartedModal = ({ visible, onConfirm }) => {
    // Card
    const cardScale   = useRef(new Animated.Value(0)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;
    // Check
    const checkScale  = useRef(new Animated.Value(0)).current;
    // Burbujas (3 anillos)
    const ring1Scale  = useRef(new Animated.Value(0.3)).current;
    const ring1Op     = useRef(new Animated.Value(0.9)).current;
    const ring2Scale  = useRef(new Animated.Value(0.3)).current;
    const ring2Op     = useRef(new Animated.Value(0.7)).current;
    const ring3Scale  = useRef(new Animated.Value(0.3)).current;
    const ring3Op     = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        if (!visible) return;

        // Reset
        cardScale.setValue(0);
        cardOpacity.setValue(0);
        checkScale.setValue(0);
        ring1Scale.setValue(0.3); ring1Op.setValue(0.9);
        ring2Scale.setValue(0.3); ring2Op.setValue(0.7);
        ring3Scale.setValue(0.3); ring3Op.setValue(0.5);

        // 1. Card aparece con spring (burbuja que explota)
        Animated.parallel([
            Animated.spring(cardScale, {
                toValue: 1,
                tension: 180,
                friction: 6,
                useNativeDriver: true,
            }),
            Animated.timing(cardOpacity, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start();

        // 2. Check hace pop a los 150ms
        setTimeout(() => {
            Animated.spring(checkScale, {
                toValue: 1,
                tension: 260,
                friction: 5,
                useNativeDriver: true,
            }).start();
        }, 150);

        // 3. Anillos explotan en cascada desde el círculo
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(ring1Scale, { toValue: 2.4, duration: 600, useNativeDriver: true }),
                Animated.timing(ring1Op,    { toValue: 0,   duration: 600, useNativeDriver: true }),
            ]).start();
        }, 200);
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(ring2Scale, { toValue: 2.8, duration: 650, useNativeDriver: true }),
                Animated.timing(ring2Op,    { toValue: 0,   duration: 650, useNativeDriver: true }),
            ]).start();
        }, 320);
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(ring3Scale, { toValue: 3.2, duration: 700, useNativeDriver: true }),
                Animated.timing(ring3Op,    { toValue: 0,   duration: 700, useNativeDriver: true }),
            ]).start();
        }, 440);
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none">
            <View style={rideStartedStyles.overlay}>
                <Animated.View style={[
                    rideStartedStyles.card,
                    { opacity: cardOpacity, transform: [{ scale: cardScale }] }
                ]}>
                    {/* Anillos de burbuja */}
                    <View style={rideStartedStyles.ringWrapper} pointerEvents="none">
                        {[{ s: ring1Scale, o: ring1Op }, { s: ring2Scale, o: ring2Op }, { s: ring3Scale, o: ring3Op }].map((r, i) => (
                            <Animated.View key={i} style={[rideStartedStyles.ring, { transform: [{ scale: r.s }], opacity: r.o }]} />
                        ))}
                        {/* Círculo con check */}
                        <Animated.View style={[rideStartedStyles.checkCircle, { transform: [{ scale: checkScale }] }]}>
                            <Ionicons name="checkmark" size={38} color="#fff" />
                        </Animated.View>
                    </View>

                    <Text style={rideStartedStyles.title}>¡El viaje ha iniciado!</Text>
                    <Text style={rideStartedStyles.subtitle}>Tu conductor está en camino. Prepárate para el trayecto.</Text>
                    <TouchableOpacity style={rideStartedStyles.btn} onPress={onConfirm}>
                        <Ionicons name="car" size={18} color="#fff" />
                        <Text style={rideStartedStyles.btnText}>Ver mi viaje</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

const rideStartedStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    card: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 28,
        paddingVertical: 40,
        paddingHorizontal: 30,
        alignItems: 'center',
        elevation: 24,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
    },
    ringWrapper: {
        width: 90,
        height: 90,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    ring: {
        position: 'absolute',
        width: 90,
        height: 90,
        borderRadius: 45,
        borderWidth: 3,
        borderColor: '#10B981',
    },
    checkCircle: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#10B981',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        elevation: 2,
    },
    btnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

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
    const [showRideStartedModal, setShowRideStartedModal] = useState(false);
    const [showRideCancelledModal, setShowRideCancelledModal] = useState(false);
    const rideStartedBookingId = useRef(null);

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
                            'El conductor ha cancelado el viaje. Tu reserva ha sido cancelada. Por favor busca otro viaje.',
                            'warning',
                            'Buscar otro viaje',
                            () => navigation.navigate('BuscarViaje')
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
                            rideStartedBookingId.current = bookingId;
                            setShowRideStartedModal(true);
                        } else if (rideStatus === 'cancelled' || rideStatus === 'completed') {
                            clearInterval(intervalRef.current);
                            showAlert(
                                'Viaje Cancelado',
                                'El conductor ha cancelado el viaje. Tu reserva ha sido cancelada. Por favor busca otro viaje.',
                                'warning',
                                'Buscar otro viaje',
                                () => navigation.navigate('BuscarViaje')
                            );
                        }
                    }
                }
            } catch (e) {
                console.error('Error al verificar estado del viaje:', e);
            }
        };

        checkStatus();
        intervalRef.current = setInterval(checkStatus, 5000);

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
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            {/* ── HEADER ── */}
            <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 44 }]}>
                <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' })}>
                    <Ionicons name="chevron-back" size={26} color="#191C1E" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Ionicons name="time" size={18} color="#1A73E8" />
                    <Text style={styles.headerTitle}>Viaje Confirmado</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── DESTINO ── */}
                <View style={styles.destinationSection}>
                    <Text style={styles.destinationLabel}>Destino actual</Text>
                    <Text style={styles.destinationName} numberOfLines={1}>
                        {rideData?.destination?.name || 'Cargando...'}
                    </Text>
                </View>

                {/* ── ESTADO DE ESPERA ── */}
                <View style={styles.waitingCard}>
                    <View style={styles.waitingIconCircle}>
                        <Ionicons name="hourglass-outline" size={32} color="#005BBF" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.waitingTitle}>Esperando al conductor</Text>
                        <Text style={styles.waitingMeta}>El conductor iniciará el viaje en breve</Text>
                    </View>
                    {loading && <ActivityIndicator size="small" color="#1A73E8" />}
                </View>

                {!loading && (
                    <>
                        {/* ── BENTO GRID: Conductor + Horario ── */}
                        <View style={styles.bentoGrid}>
                            {/* Conductor */}
                            <View style={styles.bentoCard}>
                                {rideData?.driver_id?.profileImage ? (
                                    <Image source={{ uri: rideData.driver_id.profileImage }} style={styles.bentoAvatar} />
                                ) : (
                                    <View style={[styles.bentoAvatar, styles.bentoAvatarFallback]}>
                                        <Text style={styles.bentoAvatarInitials}>
                                            {rideData?.driver_id?.name
                                                ? rideData.driver_id.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                                                : '?'}
                                        </Text>
                                    </View>
                                )}
                                <Text style={styles.bentoValue} numberOfLines={1}>
                                    {rideData?.driver_id?.name?.split(' ')[0] || 'Conductor'}
                                </Text>
                                <View style={styles.bentoRatingRow}>
                                    <Ionicons name="star" size={12} color="#F59E0B" />
                                    <Text style={styles.bentoRating}>{rideData?.driver_id?.rating || 'Nuevo'}</Text>
                                </View>
                                {rideData?.driver_id?.phone && (
                                    <TouchableOpacity style={styles.bentoWhatsappBtn} onPress={() => handleWhatsApp(rideData.driver_id.phone)}>
                                        <Ionicons name="logo-whatsapp" size={14} color="#fff" style={{ marginRight: 4 }} />
                                        <Text style={styles.bentoWhatsappText}>Contactar</Text>
                                    </TouchableOpacity>
                                )}
                                <Text style={styles.bentoLabel}>TU CONDUCTOR</Text>
                            </View>

                            {/* Horario */}
                            <View style={styles.bentoCard}>
                                <View style={styles.bentoRow}>
                                    <Ionicons name="time-outline" size={26} color="#1A73E8" />
                                    <Text style={styles.bentoValue}>{formatTime(rideData?.hora)}</Text>
                                </View>
                                <Text style={styles.bentoMeta}>
                                    Llegada: {calculateArrivalTime(rideData?.hora, rideData?.duration_minutes)}
                                </Text>
                                {rideData?.distance_km ? (
                                    <Text style={styles.bentoMeta}>{Number(rideData.distance_km).toFixed(1)} km</Text>
                                ) : null}
                                <Text style={styles.bentoLabel}>HORARIO</Text>
                            </View>
                        </View>

                        {/* ── RUTA ── */}
                        <View style={styles.routeCard}>
                            <Text style={styles.routeCardLabel}>RUTA DEL VIAJE</Text>
                            <View style={styles.routeRow}>
                                <Ionicons name="location" size={20} color="#1A73E8" />
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={styles.routeSubLabel}>Origen</Text>
                                    <Text style={styles.routeValue} numberOfLines={1}>{rideData?.origin?.name || '---'}</Text>
                                </View>
                            </View>
                            <View style={styles.routeDivider} />
                            <View style={styles.routeRow}>
                                <Ionicons name="flag" size={20} color="#EF4444" />
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={styles.routeSubLabel}>Destino</Text>
                                    <Text style={styles.routeValue} numberOfLines={1}>{rideData?.destination?.name || '---'}</Text>
                                </View>
                            </View>
                        </View>

                        {/* ── VEHÍCULO ── */}
                        <View style={styles.routeCard}>
                            <Text style={styles.routeCardLabel}>VEHÍCULO</Text>
                            <View style={styles.vehicleRow}>
                                <View style={styles.vehicleItem}>
                                    <Text style={styles.routeSubLabel}>Matrícula</Text>
                                    <Text style={styles.routeValue}>{vehicleData?.license_plate || vehicleData?.licensePlate || '---'}</Text>
                                </View>
                                <View style={styles.vehicleItem}>
                                    <Text style={styles.routeSubLabel}>Color</Text>
                                    <Text style={styles.routeValue}>{vehicleData?.color || '---'}</Text>
                                </View>
                                <View style={styles.vehicleItem}>
                                    <Text style={styles.routeSubLabel}>Modelo</Text>
                                    <Text style={styles.routeValue} numberOfLines={1}>
                                        {vehicleData?.brand || vehicleData?.model
                                            ? `${vehicleData.brand || ''} ${vehicleData.model || ''}`.trim()
                                            : '---'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </>
                )}

                {/* ── ACCIONES ── */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={styles.homeBtn}
                        onPress={() => navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' })}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="home-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.homeBtnText}>Volver al Inicio</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
                        <Ionicons name="close-circle-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
                        <Text style={styles.cancelBtnText}>Cancelar Reservación</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            <RideStartedModal
                visible={showRideStartedModal}
                onConfirm={() => {
                    setShowRideStartedModal(false);
                    navigation.replace('TripInProgress', { bookingId: rideStartedBookingId.current });
                }}
            />

            <CancelledByDriverModal
                visible={showRideCancelledModal}
                theme={theme}
                onConfirm={() => {
                    setShowRideCancelledModal(false);
                    navigation.navigate('BuscarViaje');
                }}
            />

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
                    navigation.navigate('BuscarViaje');
                }}
            />

            <BottomNavigationBar navigation={navigation} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7F9FB' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingBottom: 12, backgroundColor: 'rgba(247,249,251,0.95)',
        zIndex: 10,
    },
    headerBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerTitle: { fontSize: 17, fontFamily: 'Poppins-Bold', color: '#191C1E', letterSpacing: -0.3 },
    scrollContent: { paddingBottom: 120 },

    // Destino
    destinationSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
    destinationLabel: { fontSize: 11, fontFamily: 'Poppins-SemiBold', color: '#2B5BB5', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
    destinationName: { fontSize: 26, fontFamily: 'Poppins-Bold', color: '#191C1E', letterSpacing: -0.5 },

    // Espera
    waitingCard: {
        marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 16,
        backgroundColor: '#EDF2F7', flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    waitingIconCircle: {
        width: 52, height: 52, borderRadius: 26, backgroundColor: '#D8E2FF',
        justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    waitingTitle: { fontSize: 15, fontFamily: 'Poppins-Bold', color: '#191C1E' },
    waitingMeta: { fontSize: 12, fontFamily: 'Poppins-Regular', color: '#727785', marginTop: 2 },

    // Bento
    bentoGrid: { flexDirection: 'row', marginHorizontal: 16, gap: 12, marginBottom: 12 },
    bentoCard: { flex: 1, backgroundColor: '#EDF2F7', borderRadius: 16, padding: 16, gap: 4 },
    bentoAvatar: { width: 44, height: 44, borderRadius: 22, flexShrink: 0, marginBottom: 6 },
    bentoAvatarFallback: { backgroundColor: '#D8E2FF', justifyContent: 'center', alignItems: 'center' },
    bentoAvatarInitials: { fontSize: 15, fontFamily: 'Poppins-Bold', color: '#005BBF' },
    bentoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    bentoValue: { fontSize: 18, fontFamily: 'Poppins-Bold', color: '#191C1E', flexShrink: 1, marginLeft: 6 },
    bentoRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    bentoRating: { fontSize: 13, fontFamily: 'Poppins-SemiBold', color: '#414754' },
    bentoMeta: { fontSize: 12, fontFamily: 'Poppins-Regular', color: '#414754' },
    bentoLabel: { fontSize: 10, fontFamily: 'Poppins-Bold', color: '#727785', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
    bentoWhatsappBtn: {
        backgroundColor: '#25D366', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 4,
    },
    bentoWhatsappText: { fontSize: 11, fontFamily: 'Poppins-Bold', color: '#fff' },

    // Ruta + Vehículo
    routeCard: {
        marginHorizontal: 16, marginBottom: 12, backgroundColor: '#EDF2F7',
        borderRadius: 16, padding: 16,
    },
    routeCardLabel: { fontSize: 10, fontFamily: 'Poppins-Bold', color: '#727785', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
    routeRow: { flexDirection: 'row', alignItems: 'center' },
    routeDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginVertical: 10 },
    routeSubLabel: { fontSize: 11, fontFamily: 'Poppins-Regular', color: '#727785' },
    routeValue: { fontSize: 14, fontFamily: 'Poppins-SemiBold', color: '#191C1E', marginTop: 1 },
    vehicleRow: { flexDirection: 'row', justifyContent: 'space-between' },
    vehicleItem: { flex: 1 },

    // Acciones
    actionsContainer: { marginHorizontal: 16, marginTop: 8, gap: 12 },
    homeBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#1A73E8', paddingVertical: 16, borderRadius: 14,
        elevation: 4, shadowColor: '#1A73E8', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28, shadowRadius: 8,
    },
    homeBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Poppins-Bold' },
    cancelBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: '#EF4444',
        backgroundColor: 'transparent',
    },
    cancelBtnText: { color: '#EF4444', fontSize: 16, fontFamily: 'Poppins-Bold' },
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