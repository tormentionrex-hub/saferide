import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, Alert, Platform, Modal, Animated, AppState, BackHandler } from 'react-native';
// SafeAreaView de react-native está obsoleto; el de safe-area-context respeta
// el notch y la barra de gestos.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { useCustomAlert } from '../../context/CustomAlertContext';
import api from '../../services/api';
import BottomNavigationBar from '../../components/BottomNavigationBar';

import { moderateScale } from '../../utils/responsive';
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

const RejectionModal = ({ visible, onConfirm, theme, status }) => {
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

    const isDeny = status === 'deny' || !status;

    return (
        <Modal transparent visible={visible} animationType="none">
            <View style={modalStyles.overlay}>
                <Animated.View style={[modalStyles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }], backgroundColor: theme.surface }]}>
                    <View style={[modalStyles.iconCircle, { backgroundColor: '#FFF1F2' }]}>
                        <Ionicons name={isDeny ? "close-circle" : "alert-circle"} size={44} color="#E11D48" />
                    </View>
                    <Text style={[modalStyles.title, { color: theme.text }]}>
                        {isDeny ? 'Solicitud Rechazada' : 'Reserva Actualizada'}
                    </Text>
                    <Text style={[modalStyles.subtitle, { color: theme.textSecondary }]}>
                        {isDeny 
                            ? 'Lo sentimos, el conductor ha rechazado tu solicitud en este momento.'
                            : 'Lo sentimos, ha habido un cambio y no fuiste aceptado a bordo.'}
                    </Text>
                    <TouchableOpacity 
                        style={[modalStyles.confirmBtn, { backgroundColor: '#E11D48' }]} 
                        onPress={onConfirm}
                    >
                        <Text style={modalStyles.confirmBtnText}>Buscar otro viaje</Text>
                        <Ionicons name="search" size={18} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

const SuccessActionModal = ({ visible, onConfirm, theme, title, message, buttonText }) => {
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
                        <Text style={modalStyles.confirmBtnText}>{buttonText || 'Entendido'}</Text>
                        {buttonText === 'Buscar otro viaje' && <Ionicons name="search" size={18} color="#fff" />}
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

const ScheduledModal = ({ visible, onConfirm, theme, type }) => {
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

    const isScheduled = type === 'scheduled';

    return (
        <Modal transparent visible={visible} animationType="none">
            <View style={modalStyles.overlay}>
                <Animated.View style={[modalStyles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }], backgroundColor: theme.surface }]}>
                    <View style={[modalStyles.iconCircle, { backgroundColor: isScheduled ? '#EFF6FF' : '#ECFDF5' }]}>
                        <Ionicons name={isScheduled ? "calendar" : "car-sport"} size={44} color={isScheduled ? "#2563EB" : "#10B981"} />
                    </View>
                    <Text style={[modalStyles.title, { color: theme.text }]}>
                        {isScheduled ? '¡Viaje Programado!' : '¡Bienvenido a bordo!'}
                    </Text>
                    <Text style={[modalStyles.subtitle, { color: theme.textSecondary }]}>
                        {isScheduled 
                            ? 'Tu solicitud fue aceptada. Espera a que el conductor inicie el viaje para comenzar la ruta.'
                            : 'El viaje ha comenzado. Prepárate para el trayecto.'}
                    </Text>
                    <TouchableOpacity 
                        style={[modalStyles.confirmBtn, { backgroundColor: isScheduled ? "#2563EB" : "#10B981" }]} 
                        onPress={onConfirm}
                    >
                        <Text style={modalStyles.confirmBtnText}>Entendido</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

const TimeoutModal = ({ visible, onConfirm, theme }) => {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
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
                    <View style={[modalStyles.iconCircle, { backgroundColor: '#FFF7ED' }]}>
                        <Ionicons name="hourglass-outline" size={50} color="#F97316" />
                    </View>
                    <Text style={[modalStyles.title, { color: theme.text }]}>Tiempo Agotado</Text>
                    <Text style={[modalStyles.subtitle, { color: theme.textSecondary }]}>
                        El conductor no respondió a tiempo y la solicitud fue cancelada automáticamente para liberar tu cupo.
                    </Text>
                    <TouchableOpacity 
                        style={[modalStyles.confirmBtn, { backgroundColor: '#F97316' }]} 
                        onPress={onConfirm}
                    >
                        <Text style={modalStyles.confirmBtnText}>Entendido</Text>
                        <Ionicons name="search" size={18} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

/* ─── Pantalla ScreenSaver ────────────────────────────────────────── */
const ScreenSaver = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const { showAlert } = useCustomAlert();
    const bookingId = route.params?.bookingId;
    const [status, setStatus] = useState('pending');
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showScheduledModal, setShowScheduledModal] = useState(false);
    const [showTimeoutModal, setShowTimeoutModal] = useState(false);
    const [modalType, setModalType] = useState('scheduled'); // 'scheduled' or 'in-progress'
    const isCancellingRef = useRef(false);
    const intervalRef = useRef(null);
    // Refs de control de ciclo de vida y anti-solapamiento
    const mountedRef = useRef(true);
    const isFetchingRef = useRef(false);
    // Idempotencia: una vez disparado el modal de rechazo/cancelación para
    // este booking, no se vuelve a disparar. Cubre el caso en que el polling
    // (o un re-mount con el mismo bookingId ya en 'deny') intente reabrirlo.
    const alertedRef = useRef(false);
    // Una vez que la pantalla llegó a un cierre (tiempo agotado, aceptada,
    // rechazada o cancelada) no se vuelve a consultar ni a abrir otro modal.
    const finishedRef = useRef(false);

    // Cleanup global de montaje: bloquea setStates tardíos tras desmontar
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Back hardware (Android) → DashboardPasajero. Sin esto, el back haría
    // pop del stack y devolvería al pasajero a BuscarViaje/RideDetail/SearchRide
    // con estado obsoleto (parecería que puede solicitar otro viaje cuando ya
    // tiene esta reserva activa). El polling y los modals manejan el resto del
    // ciclo de vida (deny/cancelled/confirmed) con su propia navegación.
    const navigateToDashboard = useCallback(() => {
        navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabsPasajero', params: { screen: 'DashboardPasajero' } }],
        });
    }, [navigation]);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => { navigateToDashboard(); return true; };
            const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => sub.remove();
        }, [navigateToDashboard])
    );

    useEffect(() => {
        if (!bookingId) return;

        const checkStatus = async () => {
            if (finishedRef.current) return;
            // Anti-solapamiento: si la cascada anterior sigue activa, saltamos este tick
            if (isFetchingRef.current) return;
            isFetchingRef.current = true;
            try {
                const res = await api.get(`/bookings/${bookingId}`);
                if (!mountedRef.current) return;
                if (res.data.success) {
                    const newStatus = res.data.data.status;

                    // ── NUEVA CONDICIÓN: rechazar si el viaje ya inició o terminó ──
                    if (newStatus === 'pending') {
                        try {
                            const rideId = res.data.data.ride_id?._id || res.data.data.ride_id;
                            if (rideId) {
                                const rideRes = await api.get(`/rides/${rideId}`);
                                const rideStatus = rideRes.data?.data?.status;
                                if (
                                    rideStatus === 'in progress' ||
                                    rideStatus === 'awaiting_payment_verification' ||
                                    rideStatus === 'completed'
                                ) {
                                    clearInterval(intervalRef.current);
                                    intervalRef.current = null;
                                    try { await api.delete(`/bookings/${bookingId}`); } catch (err) {}
                                    if (!mountedRef.current) return;
                                    setStatus('deny');
                                    finishedRef.current = true;
                                    if (!alertedRef.current) {
                                        alertedRef.current = true;
                                        setShowRejectionModal(true);
                                    }
                                    return;
                                }
                            }
                        } catch (rideErr) {
                            console.error('Error verificando estado del viaje:', rideErr);
                        }
                    }
                    // ──────────────────────────────────────────────────────────────

                    if (newStatus !== status && status === 'pending') {
                        setStatus(newStatus);
                        if (newStatus === 'deny') {
                            clearInterval(intervalRef.current);
                            intervalRef.current = null;
                            if (!alertedRef.current) {
                                alertedRef.current = true;
                                setShowRejectionModal(true);
                            }
                        } else if (newStatus === 'cancelled' && !isCancellingRef.current) {
                            clearInterval(intervalRef.current);
                            intervalRef.current = null;
                            if (!alertedRef.current) {
                                alertedRef.current = true;
                                setShowRejectionModal(true); // Reutilizamos RejectionModal para informar cancelación externa
                            }
                        } else if (newStatus === 'confirmed') {
                            clearInterval(intervalRef.current);
                            intervalRef.current = null;
                            try {
                                const rideId = res.data.data.ride_id._id || res.data.data.ride_id;
                                const rideRes = await api.get(`/rides/${rideId}`);
                                if (!mountedRef.current) return;
                                const rideStatus = rideRes.data.data.status;

                                finishedRef.current = true;
                                if (rideStatus === 'scheduled') {
                                    setModalType('scheduled');
                                    setShowScheduledModal(true);
                                } else {
                                    setModalType('in-progress');
                                    setShowScheduledModal(true);
                                }
                            } catch (error) {
                                console.error('Error getting ride status:', error?.response?.data?.message || error?.message || 'unknown error');
                                if (!mountedRef.current) return;
                                navigation.navigate('WaitingForTheStart', { bookingId });
                            }
                        }
                    } else if (newStatus === 'pending') {
                        // AUTO CANCEL OUTDATED PENDING
                        const lastUpdate = res.data.data.updatedAt || res.data.data.createdAt || res.data.data.timestamp;
                        const timeDiff = Date.now() - new Date(lastUpdate).getTime();

                        if (lastUpdate && timeDiff > 2 * 60 * 1000) {
                            clearInterval(intervalRef.current);
                            intervalRef.current = null;
                            finishedRef.current = true;
                            try {
                                // Borramos el booking para que el usuario pueda intentar de nuevo
                                await api.delete(`/bookings/${bookingId}`);
                            } catch (err) {
                                console.error('Error deleting timed out booking:', err?.response?.data?.message || err?.message || 'unknown error');
                            }
                            if (!mountedRef.current) return;
                            setStatus('timeout');
                            setShowTimeoutModal(true);
                        }
                    } else if (newStatus === 'confirmed' || newStatus === 'deny' || newStatus === 'cancelled') {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                        setStatus(newStatus);
                        if (newStatus === 'deny' && !alertedRef.current) {
                            alertedRef.current = true;
                            setShowRejectionModal(true);
                        }
                    } else {
                        setStatus(newStatus);
                    }
                }
            } catch (e) {
                console.error('Error al verificar estado del booking:', e?.response?.data?.message || e?.message || 'unknown error');
            } finally {
                // Liberar bandera siempre, sobrevive a excepciones
                isFetchingRef.current = false;
            }
        };

        // Fase 1: bajamos a 6s (la mitad) para que el pasajero vea la
        // aceptación/rechazo del conductor más rápido. La salvaguarda
        // contra 429 son `isFetchingRef` (ya estaba) y la pausa por
        // AppState — no se hacen requests cuando la app está en
        // segundo plano.
        const POLL_MS = 6000;

        const startPolling = () => {
            if (intervalRef.current || finishedRef.current) return;
            intervalRef.current = setInterval(checkStatus, POLL_MS);
        };

        const stopPolling = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };

        checkStatus();
        startPolling();

        const appStateSub = AppState.addEventListener('change', (next) => {
            if (next === 'active') {
                // Al volver al foreground: fetch inmediato + reanudar ciclo
                checkStatus();
                startPolling();
            } else {
                // 'background' / 'inactive': cortamos el polling para no
                // gastar batería ni datos del usuario.
                stopPolling();
            }
        });

        return () => {
            stopPolling();
            appStateSub.remove();
            isFetchingRef.current = false;
        };
    }, [bookingId]);

    const getContent = () => {
        if (status === 'confirmed') {
            return {
                icon: 'checkmark-circle-outline',
                iconColor: '#27AE60',
                title: '¡Solicitud Aceptada!',
                subtitle: 'El conductor ha aceptado tu solicitud. ¡Que tengas buen viaje!',
                showLoader: false,
            };
        }
        if (status === 'deny') {
            return {
                icon: 'close-circle-outline',
                iconColor: '#E74C3C',
                title: 'Solicitud Rechazada',
                subtitle: 'El conductor ha rechazado tu solicitud. Puedes buscar otro viaje.',
                showLoader: false,
            };
        }
        if (status === 'cancelled') {
            return {
                icon: 'ban-outline',
                iconColor: '#E74C3C',
                title: 'Solicitud Cancelada',
                subtitle: 'Esta reserva fue cancelada.',
                showLoader: false,
            };
        }
        return {
            icon: 'time-outline',
            iconColor: theme.accent,
            title: 'Esperando respuesta...',
            subtitle: 'La petición se ha enviado, espera la respuesta del conductor',
            showLoader: true,
        };
    };

    const handleCancel = () => {
        setShowCancelModal(true);
    };

    const confirmCancel = async () => {
        if (isCancellingRef.current) return;
        try {
            isCancellingRef.current = true;
            setShowCancelModal(false);
            const res = await api.delete(`/bookings/${bookingId}`);
            if (res.data.success) {
                setShowSuccessModal(true);
            }
        } catch (e) {
            // Si el backend dice que ya está cancelada o no existe (timeout/driver canceló un microsegundo antes)
            // Tratamos como éxito porque el resultado final es el mismo: la reserva ya no está pendiente
            if (e.response && (e.response.status === 400 || e.response.status === 404)) {
                setShowSuccessModal(true);
            } else {
                isCancellingRef.current = false;
                showAlert('Error', 'No se pudo cancelar la reservación.', 'error');
            }
        }
    };

    const { icon, iconColor, title, subtitle, showLoader } = getContent();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            
            {/* Header con botón Atrás */}
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' })}
                >
                    <Ionicons name="arrow-back" size={26} color={theme.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <Ionicons name={icon} size={80} color={iconColor} />
                <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
                {showLoader && (
                    <ActivityIndicator style={{ marginTop: 30 }} size="large" color={theme.accent} />
                )}
            </View>
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: theme.accent }]}
                    onPress={() => navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' })}
                >
                    <Ionicons name="home-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.buttonText}>Volver al Inicio</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.cancelButton, { borderColor: '#E74C3C' }]}
                    onPress={handleCancel}
                >
                    <Ionicons name="close-circle-outline" size={18} color="#E74C3C" style={{ marginRight: 8 }} />
                    <Text style={[styles.cancelButtonText, { color: '#E74C3C' }]}>Cancelar Reservación</Text>
                </TouchableOpacity>
            </View>

            <RejectionModal
                visible={showRejectionModal}
                theme={theme}
                status={status}
                onConfirm={() => {
                    setShowRejectionModal(false);
                    // Reset del stack: dejamos Dashboard como base y BuscarViaje
                    // encima. Así, al tocar atrás en BuscarViaje el usuario va
                    // al Dashboard (flujo normal) en vez de volver a ScreenSaver
                    // que mostraría de nuevo la pantalla de rechazo.
                    navigation.reset({
                        index: 1,
                        routes: [
                            { name: 'MainTabsPasajero', params: { screen: 'DashboardPasajero' } },
                            { name: 'BuscarViaje' },
                        ],
                    });
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
                message="Tu reserva ha sido cancelada correctamente."
                buttonText="Buscar otro viaje"
                onConfirm={() => {
                    setShowSuccessModal(false);
                    navigation.navigate('BuscarViaje');
                }}
            />

            <ScheduledModal
                visible={showScheduledModal}
                theme={theme}
                type={modalType}
                onConfirm={() => {
                    setShowScheduledModal(false);
                    if (modalType === 'scheduled') {
                        navigation.navigate('WaitingForTheStart', { bookingId });
                    } else {
                        navigation.navigate('TripInProgress', { bookingId });
                    }
                }}
            />

            <TimeoutModal 
                visible={showTimeoutModal}
                theme={theme}
                onConfirm={() => {
                    setShowTimeoutModal(false);
                    navigation.navigate('BuscarViaje');
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
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 20,
        zIndex: 10,
    },
    backButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    title: {
        marginTop: 25,
        fontSize: moderateScale(22),
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
    },
    subtitle: {
        marginTop: 12,
        fontSize: moderateScale(15),
        textAlign: 'center',
        lineHeight: 22,
    },
    buttonContainer: {
        gap: 12,
        marginBottom: 105,
        marginHorizontal: 20,
    },
    button: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    cancelButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        borderWidth: 1.5,
        backgroundColor: 'transparent',
    },
    buttonText: {
        color: '#fff',
        fontSize: moderateScale(16),
        fontFamily: 'Poppins-Bold',
    },
    cancelButtonText: {
        fontSize: moderateScale(16),
        fontFamily: 'Poppins-Bold',
    }
});

const modalStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 25 },
    card: { width: '100%', borderRadius: 30, padding: 30, alignItems: 'center', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15 },
    iconCircle: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: moderateScale(24), fontFamily: 'Poppins-Bold', marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: moderateScale(15), textAlign: 'center', marginBottom: 25, lineHeight: 22 },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', paddingVertical: 16, borderRadius: 16, elevation: 2 },
    confirmBtnText: { color: '#fff', fontSize: moderateScale(16), fontFamily: 'Poppins-Bold' },
    cancelBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, marginTop: 4 },
    cancelBtnText: { fontSize: moderateScale(16), fontFamily: 'Poppins-SemiBold' },
});

export default ScreenSaver;