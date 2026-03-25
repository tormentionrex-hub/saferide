import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import api from '../../services/api';

const ScreenSaver = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const bookingId = route.params?.bookingId;
    const [status, setStatus] = useState('pending');
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
                            navigation.navigate('SearchRide');
                        } else if (newStatus === 'cancelled') {
                            clearInterval(intervalRef.current);
                            Alert.alert('Lo lamentamos', 'No fuiste aceptado a bordo', [
                                { text: 'OK', onPress: () => navigation.navigate('SearchRide') }
                            ]);
                        } else if (newStatus === 'confirmed') {
                            clearInterval(intervalRef.current);
                            Alert.alert('Bienvenido', 'Bienvenido a bordo', [
                                { text: 'OK', onPress: () => navigation.navigate('TripInProgress', { bookingId }) }
                            ]);
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
        intervalRef.current = setInterval(checkStatus, 5000);

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
        Alert.alert(
            'Confirmar cancelación',
            '¿Estás seguro de que deseas cancelar tu reservación?',
            [
                { text: 'No, mantener', style: 'cancel' },
                { 
                    text: 'Sí, cancelar', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await api.delete(`/bookings/${bookingId}`);
                            if (res.data.success) {
                                Alert.alert('Éxito', 'Tu reservación ha sido cancelada.');
                                navigation.navigate('SearchRide');
                            }
                        } catch (e) {
                            Alert.alert('Error', 'No se pudo cancelar la reservación.');
                        }
                    } 
                }
            ]
        );
    };

    const { icon, iconColor, title, subtitle, showLoader } = getContent();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.surface} />
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
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
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
        marginBottom: 20,
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

export default ScreenSaver;
