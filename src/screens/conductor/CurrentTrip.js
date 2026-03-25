import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, StatusBar, Platform, ScrollView, ActivityIndicator, Alert, Image, Linking } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import api from '../../services/api';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useLocationTracker } from '../../hooks/useLocationTracker';

const TripInProgressDriver = ({ route, navigation }) => {
    const { theme } = useDriverTheme(); 
    
    // ListOfRequests nos pasa rideId (el ID del viaje), no bookingId
    const rideId = route?.params?.rideId;
    const mapRef = useRef(null);

    // Activamos el rastreo GPS en tiempo real para el driver
    const { location: driverLocation, errorMsg: locationError } = useLocationTracker(true);

    const [loading, setLoading] = useState(true);
    const [bookingData, setBookingData] = useState(null);
    const [rideData, setRideData] = useState(null);

    // Cargamos tanto el ride como el primer booking confirmado del viaje
    useEffect(() => {
        let intervalId;
        const fetchTripDetails = async () => {
            if (!rideId) {
                setLoading(false);
                return;
            }
            try {
                // 1. Traemos los datos del ride (origen, destino, etc.)
                const rideRes = await api.get(`/rides/${rideId}`);
                if (rideRes.data?.success) {
                    setRideData(rideRes.data.data);
                }

                // 2. Traemos los bookings confirmados de este ride para mostrar al pasajero
                const bookingsRes = await api.get(`/bookings/ride/${rideId}`);
                if (bookingsRes.data?.success) {
                    const allBookings = bookingsRes.data.data || [];
                    // Tomamos el primero confirmado (o cualquiera si no hay confirmado aún)
                    const confirmed = allBookings.find(b => b.status === 'confirmed') || allBookings[0];
                    setBookingData(confirmed || null);
                }
            } catch (error) {
                console.log('Error fetching trip:', error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTripDetails();
        intervalId = setInterval(fetchTripDetails, 30000); // 30s para no saturar el rate limiter del backend
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [rideId]);

    const handleFinalizeTrip = () => {
        Alert.alert(
            "Finalizar viaje",
            "¿Estás seguro de que has llegado al destino?",
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Sí, finalizar", 
                    onPress: async () => {
                        try {
                            // 1. Consultamos el estado actual del ride antes de actuar
                            const rideCheck = await api.get(`/rides/${rideId}`);
                            const currentStatus = rideCheck.data?.data?.status;

                            if (currentStatus === 'completed') {
                                navigation.replace('RatePassenger', {
                                    rideId,
                                    passengerId: bookingData?.passenger_id?._id?.toString() || bookingData?.passenger_id?.toString(),
                                    passengerName: bookingData?.passenger_id?.name,
                                    passengerImage: bookingData?.passenger_id?.profileImage,
                                });
                                return;
                            }

                            if (currentStatus === 'scheduled') {
                                // Nunca se marcó 'in progress', lo iniciamos primero
                                await api.patch(`/rides/${rideId}/start`);
                            }

                            // 2. Ahora lo completamos (garantizado en 'in progress')
                            const res = await api.patch(`/rides/${rideId}/complete`);
                            
                            if (res.data?.success) {
                                navigation.replace('RatePassenger', {
                                    rideId,
                                    passengerId: bookingData?.passenger_id?._id?.toString() || bookingData?.passenger_id?.toString(),
                                    passengerName: bookingData?.passenger_id?.name,
                                    passengerImage: bookingData?.passenger_id?.profileImage,
                                });
                            } else {
                                Alert.alert('Error', res.data?.message || 'No se pudo finalizar el viaje.');
                            }
                        } catch (error) {
                            // Mostramos el mensaje real del servidor para facilitar el debug
                            const serverMsg = error.response?.data?.message || error.message || 'Error desconocido';
                            console.error('Error finalizing trip:', serverMsg, error.response?.status);
                            Alert.alert('Error al finalizar', serverMsg);
                        }
                    } 
                }
            ]
        );
    };

    if (loading && !rideData) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#EF5350" />
            </SafeAreaView>
        );
    }
    
    // Si no hay datos del ride, algo salió mal
    if (!rideData) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
                <Ionicons name="alert-circle-outline" size={60} color="#EF5350" />
                <Text style={{ marginTop: 10, fontSize: 18, color: theme.text }}>No se encontró el viaje.</Text>
                <TouchableOpacity style={[styles.finishButton, { backgroundColor: theme.accent, width: '100%' }]} onPress={() => navigation.goBack()}>
                    <Text style={styles.finishButtonText}>Volver</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // ride viene de rideData (GET /rides/:id), passenger viene del booking
    const ride = rideData;
    const passenger = bookingData?.passenger_id;

    const originCoords = ride?.origin?.coordinates;
    const destCoords = ride?.destination?.coordinates;
    const hasCoords = (originCoords?.lat !== undefined && originCoords?.lng !== undefined) && 
                      (destCoords?.lat !== undefined && destCoords?.lng !== undefined);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Viaje en curso</Text>
                <View style={{ width: 28 }} /> 
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Mapa con bordes redondeados y sombra */}
                <View style={styles.mapContainer}>
                    {hasCoords ? (
                        <MapView
                            ref={mapRef}
                            style={styles.map}
                            initialRegion={{
                                latitude: (Number(originCoords.lat) + Number(destCoords.lat)) / 2,
                                longitude: (Number(originCoords.lng) + Number(destCoords.lng)) / 2,
                                latitudeDelta: Math.abs(Number(originCoords.lat) - Number(destCoords.lat)) * 2 || 0.05,
                                longitudeDelta: Math.abs(Number(originCoords.lng) - Number(destCoords.lng)) * 2 || 0.05,
                            }}
                            showsUserLocation={true}
                            showsMyLocationButton={true}
                            onMapReady={() => {
                                if (mapRef.current) {
                                    mapRef.current.fitToCoordinates(
                                        [
                                            { latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) },
                                            { latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) }
                                        ],
                                        { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true }
                                    );
                                }
                            }}
                        >
                            {/* Marcador Origen */}
                            <Marker 
                                coordinate={{ latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) }}
                                title="Recogida"
                                pinColor="#4A90E2"
                            />
                            {/* Marcador Destino */}
                            <Marker 
                                coordinate={{ latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) }}
                                title="Destino"
                                pinColor="#EF5350"
                            />
                            {/* Trayecto virtual */}
                            <Polyline 
                                coordinates={[
                                    { latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) },
                                    { latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) }
                                ]}
                                strokeColor="#4A90E2"
                                strokeWidth={3}
                                lineDashPattern={[5, 5]}
                            />
                        </MapView>
                    ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="map-outline" size={60} color="#CCC" />
                            <Text style={{ color: '#999', marginTop: 10 }}>Sin conexión GPS</Text>
                        </View>
                    )}
                </View>

                {/* Card de Detalles del Pasajero */}
                <View style={[styles.passengerCard, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Detalles del Pasajero</Text>
                    
                    <View style={[styles.passengerInfoRow, { backgroundColor: theme.bg }]}>
                        {passenger?.profileImage ? (
                            <Image source={{ uri: passenger.profileImage }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, { backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' }]}>
                                <Ionicons name="person" size={24} color={theme.textSecondary} />
                            </View>
                        )}
                        <View style={styles.passengerTextInfo}>
                            <Text style={[styles.passengerName, { color: theme.text }]}>{passenger?.name || 'Pasajero no identificado'}</Text>
                            <View style={styles.ratingRow}>
                                <Ionicons name="star" size={14} color="#FFC107" />
                                <Text style={[styles.ratingText, { color: theme.textSecondary }]}>{passenger?.rating || 'Nuevo'}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={[styles.chatButton, { backgroundColor: '#25D366' }]} onPress={() => {
                            const pPhone = passenger?.phone;
                            if (pPhone) {
                                const cleanPhone = pPhone.replace(/[^0-9+]/g, '');
                                const waUrl = `whatsapp://send?phone=${cleanPhone}&text=Hola,%20soy%20tu%20conductor.%20Voy%20en%20camino.`;
                                Linking.canOpenURL(waUrl).then(supported => {
                                    if (supported) return Linking.openURL(waUrl);
                                    return Linking.openURL(`https://wa.me/${cleanPhone}?text=Hola,%20soy%20tu%20conductor.%20Voy%20en%20camino.`);
                                }).catch(() => Linking.openURL(`tel:${pPhone}`));
                            } else {
                                Alert.alert('Atención', 'El pasajero no tiene número de contacto.');
                            }
                        }}>
                            <Ionicons name="logo-whatsapp" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Timeline de la ruta */}
                    <View style={styles.routeDetails}>
                        <View style={styles.timelineItem}>
                            <View style={[styles.dot, { backgroundColor: '#A2C2E8' }]} />
                            <View style={styles.timelineText}>
                                <Text style={[styles.routeLabel, { color: theme.textSecondary }]}>Recogida</Text>
                                <Text style={[styles.addressText, { color: theme.text }]} numberOfLines={2}>{ride?.origin?.name || 'Desconocido'}</Text>
                            </View>
                        </View>

                        <View style={[styles.verticalLine, { backgroundColor: theme.border }]} />

                        <View style={styles.timelineItem}>
                            <View style={[styles.dot, { backgroundColor: '#4A90E2' }]} />
                            <View style={styles.timelineText}>
                                <Text style={[styles.routeLabel, { color: theme.textSecondary }]}>Destino</Text>
                                <Text style={[styles.addressText, { color: theme.text }]}>{ride?.destination?.name || 'Desconocido'}</Text>
                            </View>
                        </View>

                        <View style={styles.timelineItem}>
                            <Ionicons name="time-outline" size={18} color={theme.accent} style={{ marginRight: 12 }} />
                            <View style={styles.timelineText}>
                                <Text style={[styles.routeLabel, { color: theme.textSecondary }]}>Llegada esperada</Text>
                                <Text style={[styles.addressText, { color: theme.text }]}>12:30 PM (Est.)</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Botón Finalizar */}
                <TouchableOpacity style={styles.finishButton} onPress={handleFinalizeTrip}>
                    <MaterialCommunityIcons name="logout" size={24} color="#FFF" />
                    <Text style={styles.finishButtonText}>Finalizar viaje</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    scrollContent: { padding: 20 },
    mapContainer: {
        height: 200,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    map: { flex: 1, width: '100%', height: '100%' },
    passengerCard: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 30,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 15,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 15 },
    passengerInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        padding: 12,
        borderRadius: 16,
        marginBottom: 20
    },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
    passengerTextInfo: { flex: 1 },
    passengerName: { fontSize: 16, fontWeight: '600' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    ratingText: { marginLeft: 4, color: '#666', fontSize: 14 },
    chatButton: {
        backgroundColor: '#4A90E2',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center'
    },
    routeDetails: { marginTop: 10 },
    timelineItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
    dot: { width: 12, height: 12, borderRadius: 6, marginRight: 15 },
    verticalLine: { width: 2, height: 20, backgroundColor: '#EEE', marginLeft: 5, marginBottom: -5, marginTop: -5 },
    routeLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
    addressText: { fontSize: 14, color: '#333', fontWeight: '500' },
    finishButton: {
        backgroundColor: '#EF5350',
        flexDirection: 'row',
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10
    },
    finishButtonText: { color: '#FFF', fontSize: 18, fontWeight: '700', marginLeft: 10 }
});

export default TripInProgressDriver;
