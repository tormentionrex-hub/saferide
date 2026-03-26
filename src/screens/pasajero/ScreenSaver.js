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

const RejectionModal = ({ visible, onConfirm, theme }) => {
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
                        <Ionicons name="close-circle" size={44} color="#EF4444" />
                    </View>
                    <Text style={[modalStyles.title, { color: theme.text }]}>Solicitud Rechazada</Text>
                    <Text style={[modalStyles.subtitle, { color: theme.textSecondary }]}>
                        Lo sentimos, el conductor ha rechazado tu solicitud. Puedes intentar buscar otro viaje disponible.
                    </Text>
                    <TouchableOpacity 
                        style={[modalStyles.confirmBtn, { backgroundColor: theme.accent }]} 
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

const ScreenSaver = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const bookingId = route.params?.bookingId;
    const [status, setStatus] = useState('pending');
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
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
                        } else if (newStatus === 'cancelled') {
                            clearInterval(intervalRef.current);
                            Alert.alert('Lo lamentamos', 'No fuiste aceptado a bordo', [
                                { text: 'OK', onPress: () => navigation.navigate('MainTabsPasajero', { screen: 'SearchRide' }) }
                            ]);
                        } else if (newStatus === 'confirmed') {
                            clearInterval(intervalRef.current);
                            try {
                                const rideId = res.data.data.ride_id._id || res.data.data.ride_id;
                                const rideRes = await api.get(`/rides/${rideId}`);
                                const rideStatus = rideRes.data.data.status;
                                
                                if (rideStatus === 'scheduled') {
                                    Alert.alert('Viaje Programado', 'Tu solicitud fue aceptada. Espera a que el conductor inicie el viaje.', [
                                        { text: 'OK', onPress: () => navigation.navigate('WaitingForTheStart', { bookingId }) }
                                    ]);
                                } else {
                                    Alert.alert('Bienvenido', 'Bienvenido a bordo', [
                                        { text: 'OK', onPress: () => navigation.navigate('TripInProgress', { bookingId }) }
                                    ]);
                                }
                            } catch (error) {
                                console.error('Error getting ride status:', error);
                                navigation.navigate('WaitingForTheStart', { bookingId });
                            }
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
            setShowCancelModal(false);
            const res = await api.delete(`/bookings/${bookingId}`);
            if (res.data.success) {
                Alert.alert('Éxito', 'Tu reservación ha sido cancelada.');
                navigation.navigate('MainTabsPasajero', { screen: 'SearchRide' });
            }
        } catch (e) {
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

            <RejectionModal 
                visible={showRejectionModal} 
                theme={theme}
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

            <BottomNavigationBar navigation={navigation} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // justifyContent: 'center', // Removido para que el header esté arriba
        padding: 20,
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
        gap: 10,
        marginBottom: 105, // Aumentado para dejar espacio al BottomNavigationBar
        marginHorizontal: 20,
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
