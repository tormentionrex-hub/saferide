import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import api from '../../services/api';

const WaitingForTheStart = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const bookingId = route.params?.bookingId;
    const intervalRef = useRef(null);

    useEffect(() => {
        if (!bookingId) return;

        const checkStatus = async () => {
            try {
                const bookingRes = await api.get(`/bookings/${bookingId}`);
                if (bookingRes.data.success) {
                    const bookingStatus = bookingRes.data.data.status;
                    
                    if (bookingStatus === 'cancelled' || bookingStatus === 'deny') {
                        clearInterval(intervalRef.current);
                        Alert.alert('Viaje Cancelado', 'La reserva o el viaje han sido cancelados por el conductor.', [
                            { text: 'OK', onPress: () => navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' }) }
                        ]);
                        return;
                    }

                    const rideId = bookingRes.data.data.ride_id._id || bookingRes.data.data.ride_id;
                    const rideRes = await api.get(`/rides/${rideId}`);
                    
                    if (rideRes.data.success) {
                        const rideStatus = rideRes.data.data.status;
                        
                        if (rideStatus === 'in progress') {
                            clearInterval(intervalRef.current);
                            Alert.alert('¡El viaje ha iniciado!', 'Tu conductor ha comenzado el viaje. Dirígete al punto de encuentro.', [
                                { text: 'Ver Viaje', onPress: () => navigation.navigate('TripInProgress', { bookingId }) }
                            ]);
                        } else if (rideStatus === 'cancelled' || rideStatus === 'completed') {
                            clearInterval(intervalRef.current);
                            Alert.alert('Viaje Finalizado', 'El viaje ha finalizado o ha sido cancelado.', [
                                { text: 'OK', onPress: () => navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' }) }
                            ]);
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
                                navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' });
                            }
                        } catch (e) {
                            Alert.alert('Error', 'No se pudo cancelar la reservación.');
                        }
                    } 
                }
            ]
        );
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
            </View>

            <View style={styles.content}>
                <Ionicons name="car-sport-outline" size={80} color={theme.accent} />
                <Text style={[styles.title, { color: theme.text }]}>Viaje Programado</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                    Tu conductor ha aceptado la solicitud. Estamos esperando a que inicie el viaje.
                </Text>
                <ActivityIndicator style={{ marginTop: 30 }} size="large" color={theme.accent} />
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

export default WaitingForTheStart;
