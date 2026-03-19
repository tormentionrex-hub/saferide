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
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import BottomNavigationDriver from '../../components/BottomNavigationDriver';
import { useDriverTheme } from '../../context/DriverThemeContext';

/**
 * Pantalla que permite al conductor gestionar las solicitudes de pasajeros 
 * para sus viajes publicados.
 */
const RequestsScreen = ({ navigation }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- CARGA DE DATOS DESDE EL BACKEND ---
    useEffect(() => {
        /**
         * Función asíncrona para obtener las reservas de todos los viajes del conductor.
         */
        const fetchRequests = async () => {
            try {
                setLoading(true);
                // 1. Obtener la información del usuario actual para tener su ID de conductor
                const meResponse = await api.get('/auth/me');
                if (!meResponse.data.success) throw new Error("No se pudo identificar al conductor");
                const driverId = meResponse.data.data._id;

                // 2. Obtener todos los viajes del conductor que aún están programados (scheduled)
                const ridesResponse = await api.get(`/rides/driver/${driverId}?status=scheduled`);
                const driverRides = ridesResponse.data.data || [];

                // 3. Para cada viaje, obtener sus reservaciones de pasajeros
                // Nota: Usamos Promise.all para hacer las peticiones en paralelo y ser más eficientes.
                const allBookingsPromises = driverRides.map(ride => 
                    api.get(`/bookings/ride/${ride._id}`)
                );
                
                const bookingsResults = await Promise.all(allBookingsPromises);
                
                // 4. Aplanar todos los arrays de reservaciones en una sola lista
                const flattenedRequests = bookingsResults.reduce((acc, current) => {
                    if (current.data.success && current.data.data) {
                        return [...acc, ...current.data.data];
                    }
                    return acc;
                }, []);

                // 5. Guardar las solicitudes obtenidas (pueden ser 'pending' o 'confirmed' según el flujo del backend)
                setRequests(flattenedRequests);
            } catch (error) {
                console.error("Error al obtener solicitudes de la BD:", error);
                Alert.alert("Error", "No se pudieron cargar las solicitudes de pasajeros.");
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
    }, []);

    /**
     * Renderiza cada tarjeta de pasajero que ha solicitado unirse a un viaje.
     */
    const renderPassengerItem = ({ item }) => {
        // En el backend, el objeto de reservación tiene un campo 'passenger_id' con los datos del usuario.
        const passenger = item.passenger_id || {};
        
        return (
            <TouchableOpacity 
                style={styles.passengerCard}
                // Redirección a la pantalla de decisión (Aceptar/Rechazar)
                // Se pasan los datos de la reservación para mostrarlos en el detalle.
                onPress={() => {
                    // Nota: Si 'passengerInfo' no está definida en tu Stack de navegación, esto fallará.
                    // Podrías navegar a una pantalla genérica de detalles de reservación.
                    navigation.navigate('ManageRequests', { bookingId: item._id }); 
                    // Por ahora redirigimos a la misma pantalla o alertamos, ya que passengerInfo no existe aún.
                    Alert.alert("Detalle", `Solicitud de ${passenger.name} para ${item.seats_booked} asiento(s).`);
                }}
            >
                <View style={styles.cardContent}>
                    {/* Imagen del pasajero: Usamos el profileImage del backend o un avatar aleatorio por defecto */}
                    <Image 
                        source={{ uri: passenger.profileImage || `https://i.pravatar.cc/150?u=${passenger._id || 'default'}` }} 
                        style={styles.avatar} 
                    />
                    
                    <View style={styles.infoContainer}>
                        <Text style={styles.nameText}>{passenger.name || 'Pasajero Anónimo'}</Text>
                        <View style={styles.detailsRow}>
                            <View style={styles.ratingRow}>
                                <Ionicons name="star" size={14} color="#FFD700" />
                                <Text style={styles.ratingText}>{passenger.rating?.toFixed(1) || '4.5'}</Text>
                            </View>
                            <Text style={styles.seatsText}>• {item.seats_booked} asiento(s)</Text>
                        </View>
                        {/* Indicador de estado */}
                        <Text style={[styles.statusTag, item.status === 'confirmed' ? styles.statusConfirmed : styles.statusPending]}>
                            {item.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}
                        </Text>
                    </View>

                    {/* Flecha indicadora de navegación */}
                    <Ionicons name="chevron-forward" size={20} color="#2D63ED" />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Título exterior decorativo */}
            <Text style={styles.outerTitle}>Lista de Solicitudes</Text>

            <View style={styles.mainContainer}>
                {/* Cabecera de la sección */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color="#1A2B4C" />
                    </TouchableOpacity>
                    <Text style={styles.innerTitle}>Solicitudes del Conductor</Text>
                </View>

                {loading ? (
                    <View style={styles.loader}>
                        <ActivityIndicator size="large" color="#2D63ED" />
                        <Text style={styles.loaderText}>Buscando pasajeros...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={requests}
                        keyExtractor={(item) => item._id}
                        renderItem={renderPassengerItem}
                        contentContainerStyle={styles.listBody}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="people-outline" size={60} color="#E1E8EE" />
                                <Text style={styles.emptyText}>No hay solicitudes pendientes.</Text>
                            </View>
                        }
                        refreshing={loading}
                        onRefresh={() => { /* Podrías implementar el pull-to-refresh aquí */ }}
                    />
                )}
            </View>

            {/* Navegación inferior persistente */}
            <BottomNavigationDriver navigation={navigation} activeTab="Mensajes" />
        </SafeAreaView>
    );
};

// --- DEFINICIÓN DE ESTILOS ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
    outerTitle: { 
        fontSize: 22, color: '#A0AAB5', fontWeight: 'bold', 
        paddingHorizontal: 25, marginTop: 10, marginBottom: 10 
    },
    mainContainer: { 
        flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 30, 
        borderTopRightRadius: 30, marginHorizontal: 15, elevation: 4,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 10
    },
    header: { 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0'
    },
    backBtn: { position: 'absolute', left: 20 },
    innerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A2B4C' },
    listBody: { padding: 20, paddingBottom: 100 },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderText: { marginTop: 10, color: '#2D63ED' },
    
    // Tarjeta del pasajero
    passengerCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#F0F2F5',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    cardContent: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E1E8EE' },
    infoContainer: { flex: 1, marginLeft: 15 },
    nameText: { fontSize: 16, fontWeight: 'bold', color: '#1A2B4C' },
    detailsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    ratingRow: { flexDirection: 'row', alignItems: 'center' },
    ratingText: { fontSize: 13, color: '#7E8BA0', marginLeft: 4, fontWeight: '500' },
    seatsText: { fontSize: 13, color: '#7E8BA0', marginLeft: 8 },
    statusTag: { 
        fontSize: 11, fontWeight: 'bold', paddingVertical: 2, 
        paddingHorizontal: 8, borderRadius: 4, alignSelf: 'flex-start', marginTop: 8 
    },
    statusConfirmed: { backgroundColor: '#E7F9ED', color: '#27AE60' },
    statusPending: { backgroundColor: '#FFF4E5', color: '#FF9500' },
    
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80 },
    emptyText: { textAlign: 'center', marginTop: 10, color: '#999', fontSize: 16 }
});

export default RequestsScreen;
