import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    SafeAreaView,
    ActivityIndicator,
    Alert,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import BottomNavigationDriver from '../../components/BottomNavigationDriver';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';

/**
 * Pantalla que permite al conductor gestionar las solicitudes de pasajeros
 * para sus viajes publicados.
 */
const RequestsScreen = ({ navigation }) => {
    const { theme } = useDriverTheme();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const si = useScrollIndicator();

    // --- CARGA DE DATOS DESDE EL BACKEND ---
    useEffect(() => {
        const fetchRequests = async () => {
            try {
                setLoading(true);
                // 1. Obtener la información del usuario actual
                const meResponse = await api.get('/auth/me');
                if (!meResponse.data.success) throw new Error('No se pudo identificar al conductor');
                const driverId = meResponse.data.data._id;

                // 2. Obtener todos los viajes del conductor programados
                const ridesResponse = await api.get(`/rides/driver/${driverId}?status=scheduled`);
                const driverRides = ridesResponse.data.data || [];

                // 3. Para cada viaje, obtener sus reservaciones en paralelo
                const allBookingsPromises = driverRides.map(ride =>
                    api.get(`/bookings/ride/${ride._id}`)
                );

                const bookingsResults = await Promise.all(allBookingsPromises);

                // 4. Aplanar todos los arrays en una sola lista
                const flattenedRequests = bookingsResults.reduce((acc, current) => {
                    if (current.data.success && current.data.data) {
                        return [...acc, ...current.data.data];
                    }
                    return acc;
                }, []);

                setRequests(flattenedRequests);
            } catch (error) {
                console.error('Error al obtener solicitudes de la BD:', error);
                Alert.alert('Error', 'No se pudieron cargar las solicitudes de pasajeros.');
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
    }, []);

    const renderPassengerItem = ({ item }) => {
        const passenger = item.passenger_id || {};

        return (
            <TouchableOpacity
                style={[styles.passengerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => {
                    navigation.navigate('ManageRequests', { bookingId: item._id });
                    Alert.alert('Detalle', `Solicitud de ${passenger.name} para ${item.seats_booked} asiento(s).`);
                }}
            >
                <View style={styles.cardContent}>
                    <Image
                        source={{ uri: passenger.profileImage || `https://i.pravatar.cc/150?u=${passenger._id || 'default'}` }}
                        style={styles.avatar}
                    />

                    <View style={styles.infoContainer}>
                        <Text style={[styles.nameText, { color: theme.text }]}>
                            {passenger.name || 'Pasajero Anónimo'}
                        </Text>
                        <View style={styles.detailsRow}>
                            <View style={styles.ratingRow}>
                                <Ionicons name="star" size={14} color="#FFD700" />
                                <Text style={[styles.ratingText, { color: theme.textSecondary }]}>
                                    {passenger.rating?.toFixed(1) || '4.5'}
                                </Text>
                            </View>
                            <Text style={[styles.seatsText, { color: theme.textSecondary }]}>
                                • {item.seats_booked} asiento(s)
                            </Text>
                        </View>
                        <Text style={[
                            styles.statusTag,
                            item.status === 'confirmed'
                                ? { backgroundColor: theme.dark ? '#1A3A25' : '#E7F9ED', color: '#27AE60' }
                                : { backgroundColor: theme.dark ? '#3A2A10' : '#FFF4E5', color: '#FF9500' }
                        ]}>
                            {item.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}
                        </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color={theme.accent} />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.surface }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.surface} />

            <View style={[styles.mainContainer, { backgroundColor: theme.surface }]}>
                {/* Cabecera */}
                <View style={[styles.header, { borderBottomColor: theme.divider }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.innerTitle, { color: theme.text }]}>
                        Solicitudes del Conductor
                    </Text>
                </View>

                {loading ? (
                    <View style={styles.loader}>
                        <ActivityIndicator size="large" color={theme.accent} />
                        <Text style={[styles.loaderText, { color: theme.accent }]}>
                            Buscando pasajeros...
                        </Text>
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                    <FlatList
                        data={requests}
                        keyExtractor={(item) => item._id}
                        renderItem={renderPassengerItem}
                        contentContainerStyle={styles.listBody}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="people-outline" size={60} color={theme.border} />
                                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                    No hay solicitudes pendientes.
                                </Text>
                            </View>
                        }
                        refreshing={loading}
                        onRefresh={() => {}}
                        {...si.scrollProps}
                    />
                    <ScrollIndicator si={si} thumbColor={theme.accent} />
                    </View>
                )}
            </View>

            <BottomNavigationDriver navigation={navigation} activeTab="Mensajes" />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    mainContainer: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    backBtn: {
        position: 'absolute',
        left: 20,
    },
    innerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    listBody: {
        padding: 20,
        paddingBottom: 100,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderText: {
        marginTop: 10,
        fontSize: 14,
    },
    // Tarjeta de pasajero
    passengerCard: {
        borderRadius: 16,
        padding: 15,
        marginBottom: 14,
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#E1E8EE',
    },
    infoContainer: {
        flex: 1,
        marginLeft: 14,
    },
    nameText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingText: {
        fontSize: 13,
        marginLeft: 4,
        fontWeight: '500',
    },
    seatsText: {
        fontSize: 13,
        marginLeft: 8,
    },
    statusTag: {
        fontSize: 11,
        fontWeight: 'bold',
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: 8,
        overflow: 'hidden',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 80,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 12,
        fontSize: 16,
    },
});

export default RequestsScreen;
