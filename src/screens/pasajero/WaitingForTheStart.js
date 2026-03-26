import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator, Alert, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import api from '../../services/api';

const WaitingForTheStart = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const bookingId = route.params?.bookingId;
    const intervalRef = useRef(null);

    const [rideData, setRideData] = useState(null);
    const [vehicleData, setVehicleData] = useState(null);
    const [loading, setLoading] = useState(true);

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
                            Alert.alert('¡El viaje ha iniciado!', 'Tu conductor ha comenzado el viaje.', [
                                { text: 'Ver Viaje', onPress: () => navigation.replace('TripInProgress', { bookingId }) }
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

    const formatDate = (dateStr) => {
        if (!dateStr) return '---';
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
                                        <Text style={[styles.value, { color: theme.text }]}>{formatDate(rideData?.departure_time)}</Text>
                                    </View>
                                    <View style={styles.halfRow}>
                                        <Text style={[styles.label, { color: theme.textSecondary }]}>Llegada esperada</Text>
                                        <Text style={[styles.value, { color: theme.text }]}>{formatDate(rideData?.arrival_time)}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Información del Conductor */}
                            <View style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Conductor</Text>
                                <View style={styles.infoRow}>
                                    <Ionicons name="person-circle" size={24} color={theme.textSecondary} />
                                    <View style={styles.textContainer}>
                                        <Text style={[styles.value, { color: theme.text, fontSize: 16 }]}>
                                            {rideData?.driver_id?.name || '---'}
                                        </Text>
                                    </View>
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
        paddingBottom: Platform.OS === 'ios' ? 20 : 15,
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
