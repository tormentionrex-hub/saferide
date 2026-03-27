import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, StatusBar, Platform, Linking, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import api from '../../services/api';
import BottomNavigationBar from '../../components/BottomNavigationBar';
import MapView, { Marker, Polyline } from 'react-native-maps';

const TripInProgress = ({ route, navigation }) => {
    const { theme } = useDriverTheme(); 
    
    // El ID del booking nos lo envía la navegación previa (BottomNavigationBar o ScreenSaver)
    const bookingId = route?.params?.bookingId;

    // Referencia al mapa para controlar la cámara (Zoom a la ruta)
    const mapRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [bookingData, setBookingData] = useState(null);

    // Estado para el ID resuelto (puede venir de params o de la búsqueda automática)
    const [resolvedBookingId, setResolvedBookingId] = useState(bookingId || null);
    const [noActiveTrip, setNoActiveTrip] = useState(false);
    const [driverLocation, setDriverLocation] = useState(null);

    // Si no hay bookingId en params, buscamos automáticamente el booking activo del usuario
    useEffect(() => {
        if (!bookingId) {
            const findActiveBooking = async () => {
                try {
                    // GET /bookings?status=confirmed devuelve SOLO los bookings del usuario logueado
                    const res = await api.get('/bookings?status=confirmed&limit=5');
                    if (res.data?.success) {
                        const bookings = res.data.data || [];
                        // Buscamos uno cuyo viaje esté 'in progress' (viaje activo ahora)
                        const active = bookings.find(b => {
                            const rideStatus = b.ride_id?.status;
                            return rideStatus === 'in progress' || rideStatus === 'scheduled';
                        });
                        if (active) {
                            setResolvedBookingId(active._id);
                        } else {
                            // No hay viaje activo
                            setNoActiveTrip(true);
                            setLoading(false);
                        }
                    } else {
                        setNoActiveTrip(true);
                        setLoading(false);
                    }
                } catch (err) {
                    console.log('Error buscando booking activo:', err?.message);
                    setNoActiveTrip(true);
                    setLoading(false);
                }
            };
            findActiveBooking();
        }
    }, []); // Solo al montar

    // Polling principal usando el ID resuelto
    useEffect(() => {
        if (!resolvedBookingId) return;
        let intervalId;

        const fetchTripDetails = async () => {
            try {
                // Hacemos el request al endpoint
                const res = await api.get(`/bookings/${resolvedBookingId}`);
                if (res.data && res.data.success) {
                    const data = res.data.data;
                    setBookingData(data);

                    // Validación en tiempo real: Si el conductor llegó al destino, completó el viaje, o canceló
                    if (data.status === 'cancelled' || data.status === 'completed' || data.status === 'deny') {
                        // Detenemos las repeticiones inmediatamente
                        if (intervalId) clearInterval(intervalId);
                        
                        if (data.status === 'completed') {
                            // Llevar al pasajero a calificar al conductor
                            navigation.replace('RateDriver', {
                                rideId: data.ride_id?._id?.toString() || data.ride_id?.toString(),
                                driverId: data.ride_id?.driver_id?._id?.toString() || data.ride_id?.driver_id?.toString(),
                                driverName: data.ride_id?.driver_id?.name,
                                driverImage: data.ride_id?.driver_id?.profileImage,
                            });
                        } else {
                            // Cancelado o rechazado
                            Alert.alert('Viaje Finalizado', 'El viaje ha sido cancelado o rechazado.', [
                                {
                                    text: 'Buscar otro viaje',
                                    onPress: () => navigation.navigate('MainTabsPasajero', { screen: 'SearchRide' })
                                }
                            ]);
                        }
                    }
                }
            } catch (error) {
                // Silenciamos este error intencionadamente para que no bloquee la vista por un fallo de red momentáneo
                console.log('Error silenciado haciendo polling a trip details:', error?.message);
            } finally {
                setLoading(false);
            }
        };

        // Primera carga inmediata
        fetchTripDetails();
        
        // Polling cada 10 segundos
        intervalId = setInterval(fetchTripDetails, 10000);

        // Cleanup al desmontar pantalla
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [resolvedBookingId, navigation]);

    // Polling secundario rápido para la ubicación del conductor
    useEffect(() => {
        if (!bookingData || !bookingData.ride_id) return;
        
        let locationInterval;
        const rideId = bookingData.ride_id._id || bookingData.ride_id;

        const fetchDriverLocation = async () => {
            try {
                const res = await api.get(`/location/${rideId}/driver`);
                if (res.data?.success && res.data.location?.lat) {
                    setDriverLocation({
                        latitude: res.data.location.lat,
                        longitude: res.data.location.lng
                    });
                }
            } catch (error) {
                // Silenciamos este error también
                //console.log('Error silenciado fetching driver location:', error?.message);
            }
        };

        fetchDriverLocation();
        // Cada 10 segundos actualizamos la ubicación del conductor
        locationInterval = setInterval(fetchDriverLocation, 10000);

        return () => {
            if (locationInterval) clearInterval(locationInterval);
        };
    }, [bookingData]);

    const handleCall = (phone) => {
        if (!phone) {
            Alert.alert('Aviso', 'El conductor no tiene número registrado.');
            return;
        }
        Linking.openURL(`tel:${phone}`).catch(() => {
            Alert.alert('Error', 'No se pudo abrir el marcador de llamadas.');
        });
    };

    const handleMessage = (phone) => {
        if (!phone) {
            Alert.alert('Aviso', 'El conductor no tiene número registrado.');
            return;
        }
        const cleanPhone = phone.replace(/[^0-9+]/g, '');
        // Agrega +506 (Costa Rica) si el número no tiene código de país
        const intlPhone = cleanPhone.startsWith('+') ? cleanPhone : '+506' + cleanPhone;
        const whatsappUrl = `https://wa.me/${intlPhone}?text=Hola,%20voy%20en%20el%20viaje`;
        Linking.openURL(whatsappUrl).catch(() => {
            Alert.alert('Error', 'No se pudo abrir WhatsApp. Asegúrate de tener la app instalada.');
        });
    };

    if (loading && !bookingData) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
                <ActivityIndicator size="large" color={theme.accent} />
                <Text style={{ marginTop: 10, color: theme.textSecondary }}>Cargando información del viaje...</Text>
            </SafeAreaView>
        );
    }

    if (noActiveTrip || !bookingData || !bookingData.ride_id) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
                
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Ionicons name="car-sport-outline" size={80} color={theme.textSecondary} style={{ opacity: 0.5, marginBottom: 20 }} />
                    <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 10 }}>
                        No tienes ningún viaje activo
                    </Text>
                    <Text style={{ fontSize: 16, color: theme.textSecondary, textAlign: 'center', marginBottom: 40, paddingHorizontal: 20 }}>
                        Actualmente no estás a bordo de ningún viaje ni esperando a ser recogido.
                    </Text>
                    
                    <TouchableOpacity 
                        style={{ backgroundColor: theme.accent, paddingHorizontal: 32, height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} 
                        onPress={() => navigation.navigate('MainTabsPasajero', { screen: 'SearchRide' })}
                    >
                        <Ionicons name="search" size={20} color="#FFF" style={{ marginRight: 10 }} />
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Buscar viaje</Text>
                    </TouchableOpacity>
                </View>

                {/* Navbar para no perder la navegación */}
                <BottomNavigationBar navigation={navigation} />
            </SafeAreaView>
        );
    }

    const { ride_id } = bookingData;
    const driver = ride_id?.driver_id;
    
    // Extracción segurizada de coordenadas
    const originCoords = ride_id?.origin?.coordinates;
    const destCoords = ride_id?.destination?.coordinates;
    // Nos aseguramos firmemente que traen valores válidos (números) antes de alimentar el MapView
    const hasCoords = (originCoords?.lat !== undefined && originCoords?.lng !== undefined) && 
                      (destCoords?.lat !== undefined && destCoords?.lng !== undefined);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            
            <ScrollView contentContainerStyle={styles.scrollContent}>
                
                {/* MAPA FUNCIONAL CON react-native-maps */}
                <View style={[styles.mapPlaceholder, { backgroundColor: theme.surfaceVariant }]}>
                    {hasCoords ? (
                        <MapView
                            ref={mapRef}
                            style={{ flex: 1, width: '100%', height: '100%', borderRadius: 20 }} // Arregla el colapso visual del mapa
                            initialRegion={{
                                latitude: (Number(originCoords.lat) + Number(destCoords.lat)) / 2,
                                longitude: (Number(originCoords.lng) + Number(destCoords.lng)) / 2,
                                latitudeDelta: Math.abs(Number(originCoords.lat) - Number(destCoords.lat)) * 2 || 0.05,
                                longitudeDelta: Math.abs(Number(originCoords.lng) - Number(destCoords.lng)) * 2 || 0.05,
                            }}
                            onMapReady={() => {
                                if (mapRef.current) {
                                    mapRef.current.fitToCoordinates(
                                        [
                                            { latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) },
                                            { latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) }
                                        ],
                                        { 
                                            edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, 
                                            animated: true 
                                        }
                                    );
                                }
                            }}
                        >
                            {/* Marcador de Recogida */}
                            <Marker 
                                coordinate={{ latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) }}
                                title="Lugar de Recogida"
                                description={ride_id.origin.name}
                                pinColor={theme.accent}
                            />
                            
                            {/* Marcador de Destino */}
                            <Marker 
                                coordinate={{ latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) }}
                                title="Destino del viaje"
                                description={ride_id.destination.name}
                                pinColor="#28a745"
                            />

                            {/* Marcador en vivo del Conductor */}
                            {driverLocation && (
                                <Marker 
                                    coordinate={driverLocation}
                                    title={driver?.name || 'Tu Conductor'}
                                    description="Ubicación en vivo"
                                    pinColor="#000" // Diferenciarlo visualmente
                                />
                            )}

                            {/* Trazado virtual uniendo los dos puntos */}
                            <Polyline 
                                coordinates={[
                                    { latitude: Number(originCoords.lat), longitude: Number(originCoords.lng) },
                                    { latitude: Number(destCoords.lat), longitude: Number(destCoords.lng) }
                                ]}
                                strokeColor={theme.accent}
                                strokeWidth={3}
                                lineDashPattern={[6, 6]}
                            />
                        </MapView>
                    ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="map-outline" size={60} color={theme.textSecondary} />
                            <Text style={[styles.mapText, { color: theme.textSecondary }]}>Mapa no disponible</Text>
                        </View>
                    )}
                </View>

                {/* TARJETA DEL CONDUCTOR DINÁMICA */}
                <View style={[styles.driverCard, { backgroundColor: theme.surface, shadowColor: theme.dark ? '#000' : '#d1d1d1' }]}>
                    <View style={styles.driverInfoLeft}>
                        <View style={[styles.driverAvatar, { backgroundColor: theme.border }]}>
                            <Ionicons name="person" size={28} color={theme.textSecondary} />
                        </View>
                        <View style={styles.driverDetails}>
                            <Text style={[styles.driverName, { color: theme.text }]}>{driver?.name || 'Conductor'}</Text>
                            <Text style={[styles.driverRole, { color: theme.textSecondary }]}>Conductor</Text>
                            <View style={styles.ratingContainer}>
                                <Ionicons name="star" size={14} color="#FFD700" />
                                <Text style={[styles.ratingText, { color: theme.textSecondary }]}>{driver?.rating || '5.0'}</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.driverActions}>
                        <TouchableOpacity style={[styles.callButton, { backgroundColor: theme.accent, shadowColor: theme.accent }]} onPress={() => handleCall(driver?.phone)}>
                            <Ionicons name="call" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.messageButton, { backgroundColor: '#25D366', shadowColor: '#25D366' }]} onPress={() => handleMessage(driver?.phone)}>
                            <Ionicons name="logo-whatsapp" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* DETALLES DEL VIAJE DINÁMICOS */}
                <View style={[styles.tripDetailsCard, { backgroundColor: theme.surface, shadowColor: theme.dark ? '#000' : '#d1d1d1' }]}>
                    <Text style={[styles.tripDetailsTitle, { color: theme.text }]}>Detalles del Viaje</Text>
                    
                    <View style={styles.routeContainer}>
                        {/* Origen */}
                        <View style={styles.routeItem}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="location" size={22} color={theme.accent} />
                            </View>
                            <View style={styles.routeTextContainer}>
                                <Text style={[styles.routeLabel, { color: theme.textSecondary }]}>Recogida</Text>
                                <Text style={[styles.routeAddress, { color: theme.text }]}>{ride_id?.origin?.name || 'Desconocido'}</Text>
                            </View>
                        </View>

                        {/* Línea conectora */}
                        <View style={[styles.routeLine, { backgroundColor: theme.border }]} />

                        {/* Destino */}
                        <View style={styles.routeItem}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="pin" size={22} color="#28a745" />
                            </View>
                            <View style={styles.routeTextContainer}>
                                <Text style={[styles.routeLabel, { color: theme.textSecondary }]}>Destino</Text>
                                <Text style={[styles.routeAddress, { color: theme.text }]}>{ride_id?.destination?.name || 'Desconocido'}</Text>
                            </View>
                        </View>
                    </View>
                </View>
                
            </ScrollView>

            {/* BOTTOM NAV BAR FUNCIONAL */}
            <BottomNavigationBar navigation={navigation} />

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 110, // Espacio para no quedar tapado por el bottom tab
    },
    mapPlaceholder: {
        height: 250,
        borderRadius: 20,
        marginBottom: 20,
        overflow: 'hidden',
    },
    mapText: {
        marginTop: 10,
        fontSize: 16,
        fontWeight: 'bold',
    },
    driverCard: {
        flexDirection: 'row',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    driverInfoLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    driverAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    driverDetails: {
        flex: 1,
    },
    driverName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    driverRole: {
        fontSize: 13,
        marginBottom: 4,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingText: {
        fontSize: 13,
        marginLeft: 6,
        fontWeight: 'bold',
    },
    driverActions: {
        flexDirection: 'row',
    },
    callButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 2,
    },
    messageButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 2,
    },
    tripDetailsCard: {
        borderRadius: 16,
        padding: 20,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        marginBottom: 20,
    },
    tripDetailsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    routeContainer: {
        marginLeft: 4,
    },
    routeItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    iconContainer: {
        width: 26,
        alignItems: 'center',
        marginTop: 2,
    },
    routeTextContainer: {
        flex: 1,
        marginLeft: 12,
    },
    routeLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    routeAddress: {
        fontSize: 15,
        fontWeight: '500',
        marginTop: 4,
    },
    routeLine: {
        width: 2,
        height: 30,
        marginLeft: 12,
        marginVertical: 4,
    }
});

export default TripInProgress;
