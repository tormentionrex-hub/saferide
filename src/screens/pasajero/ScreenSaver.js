import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator, Alert, Platform, Modal, Animated } from 'react-native';
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
const ScreenSaver = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const bookingId = route.params?.bookingId;
    const [status, setStatus] = useState('pending');
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showScheduledModal, setShowScheduledModal] = useState(false);
    const [modalType, setModalType] = useState('scheduled'); // 'scheduled' or 'in-progress'
    const [isCancellingLocally, setIsCancellingLocally] = useState(false);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (!bookingId) return;

        const checkStatus = async () => {
            try {
                const res = await api.get(`/bookings/${bookingId}`);
                if (res.data.success) {
                    const newStatus = res.data.data.status;
                    if (newStatus !== status && status === 'pending') {
                        setStatus(newStatus);
                        if (newStatus === 'deny') {
                            clearInterval(intervalRef.current);
                            setShowRejectionModal(true);
                        } else if (newStatus === 'cancelled' && !isCancellingLocally) {
                            clearInterval(intervalRef.current);
                            setShowRejectionModal(true); // Reutilizamos RejectionModal para informar cancelación externa
                        } else if (newStatus === 'confirmed') {
                            clearInterval(intervalRef.current);
                            try {
                                const rideId = res.data.data.ride_id._id || res.data.data.ride_id;
                                const rideRes = await api.get(`/rides/${rideId}`);
                                const rideStatus = rideRes.data.data.status;
                                
                                if (rideStatus === 'scheduled') {
                                    setModalType('scheduled');
                                    setShowScheduledModal(true);
                                } else {
                                    setModalType('in-progress');
                                    setShowScheduledModal(true);
                                }
                            } catch (error) {
                                console.error('Error getting ride status:', error);
                                navigation.navigate('WaitingForTheStart', { bookingId });
                            }
                        }
                    } else if (newStatus === 'pending') {
                        // AUTO CANCEL OUTDATED PENDING
                        const createdAt = res.data.data.createdAt || res.data.data.timestamp;
                        if (createdAt && (Date.now() - new Date(createdAt).getTime() > 2 * 60 * 1000)) {
                            clearInterval(intervalRef.current);
                            await api.delete(`/bookings/${bookingId}`).catch(()=>null);
                            setStatus('timeout');
                            Alert.alert('Tiempo Agotado', 'El conductor no respondió a tiempo y la solicitud fue cancelada automáticamente.', [
                                { text: 'OK', onPress: () => navigation.navigate('MainTabsPasajero', { screen: 'SearchRide' }) }
                            ]);
                            return;
                        }
                    } else if (newStatus === 'confirmed' || newStatus === 'deny' || newStatus === 'cancelled') {
                        clearInterval(intervalRef.current);
                    } else {
                        setStatus(newStatus);
                    }
                }
            } catch (e) {
                console.error('Error al verificar estado del booking:', e);
            }
        };

        checkStatus();
        intervalRef.current = setInterval(checkStatus, 12000); // Aumentado de 5s a 12s para evitar error 429

        return () => clearInterval(intervalRef.current);
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
        try {
            setIsCancellingLocally(true);
            setShowCancelModal(false);
            const res = await api.delete(`/bookings/${bookingId}`);
            if (res.data.success) {
                setShowSuccessModal(true);
            }
        } catch (e) {
            setIsCancellingLocally(false);
            Alert.alert('Error', 'No se pudo cancelar la reservación.');
        }
    };

    const { icon, iconColor, title, subtitle, showLoader } = getContent();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.surface} />
            
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
                    navigation.navigate('MainTabsPasajero', { screen: 'SearchRide' });
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
                    navigation.navigate('MainTabsPasajero', { screen: 'SearchRide' });
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
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    subtitle: {
        marginTop: 12,
        fontSize: 15,
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
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
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

export default ScreenSaver;