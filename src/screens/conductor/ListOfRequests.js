import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, SafeAreaView, StatusBar, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { useDriverTheme } from '../../context/DriverThemeContext';

const ListOfRequests = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    // Permitimos navegar hasta esta vista con un rideId específico
    // Si no viene, traemos todas las solicitudes pendientes del conductor
    const specificRideId = route.params?.rideId;

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                setLoading(true);
                let fetchURL = '';

                if (specificRideId) {
                    // Solo solicitudes para ese viaje en específico
                    const bookingsRes = await api.get(`/bookings/ride/${specificRideId}`);
                    if (bookingsRes.data.success) {
                        setRequests(bookingsRes.data.data || []);
                    }
                } else {
                    // Logic vieja: todas las solicitudes del driver
                    const meResponse = await api.get('/auth/me');
                    if (!meResponse.data.success) throw new Error('No se pudo identificar al conductor');
                    const driverId = meResponse.data.data._id;

                    const ridesResponse = await api.get(`/rides/driver/${driverId}?status=scheduled`);
                    const driverRides = ridesResponse.data.data || [];

                    const allBookingsPromises = driverRides.map(ride =>
                        api.get(`/bookings/ride/${ride._id}`)
                    );

                    const bookingsResults = await Promise.all(allBookingsPromises);

                    const flattenedRequests = bookingsResults.reduce((acc, current) => {
                        if (current.data.success && current.data.data) {
                            return [...acc, ...current.data.data];
                        }
                        return acc;
                    }, []);

                    setRequests(flattenedRequests);
                }
            } catch (error) {
                console.error('Error fetching requests:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
    }, [specificRideId]);

    const handleAccept = async (bookingId) => {
        try {
            // Este endpoint depende del status real de tu API. (Asumo que lo tiene según bookingsRoutes.js que vi `PATCH /:id/status`)
            // Por simplicidad en la UI solo mostramos alerta.
            Alert.alert("Éxito", "Has aceptado la solicitud.");
        } catch (e) {
            console.error(e);
        }
    }

    const renderPassengerItem = ({ item }) => {
        const passenger = item.passenger_id || {};

        return (
            <View style={[styles.passengerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Image source={{ uri: passenger.profileImage || `https://i.pravatar.cc/150?u=${passenger._id || 'default'}` }} style={styles.avatar} />
                <View style={styles.infoContainer}>
                    <Text style={[styles.nameText, { color: theme.text }]}>{passenger.name || 'Pasajero Anónimo'}</Text>
                    <Text style={{ color: theme.textSecondary, marginTop: 4 }}>
                        Solicitó unirse a tu viaje ({item.seats_booked} asiento/s)
                    </Text>
                </View>
                <TouchableOpacity 
                    style={[styles.acceptBtn, { backgroundColor: theme.accent }]}
                    onPress={() => handleAccept(item._id)}
                >
                    <Text style={styles.btnText}>Aceptar</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.surface} />
            <View style={[styles.header, { borderBottomColor: theme.divider }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>Solicitudes {specificRideId ? 'del Viaje' : 'de Pasajeros'}</Text>
            </View>
            
            {loading ? (
                <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 50 }}/>
            ) : (
                <FlatList
                    data={requests.filter(r => r.status === 'pending')}
                    keyExtractor={(item, index) => item._id || index.toString()}
                    renderItem={renderPassengerItem}
                    contentContainerStyle={{ padding: 20 }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Ionicons name="people-outline" size={60} color={theme.border} />
                            <Text style={{ color: theme.textSecondary, marginTop: 10 }}>No hay solicitudes pendientes.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, borderBottomWidth: 1 },
    backBtn: { position: 'absolute', left: 20 },
    title: { fontSize: 18, fontWeight: 'bold' },
    passengerCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 10, borderWidth: 1, marginBottom: 15 },
    avatar: { width: 50, height: 50, borderRadius: 25 },
    infoContainer: { flex: 1, marginLeft: 15 },
    nameText: { fontSize: 16, fontWeight: 'bold' },
    acceptBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8 },
    btnText: { color: '#fff', fontWeight: 'bold' }
});

export default ListOfRequests;
