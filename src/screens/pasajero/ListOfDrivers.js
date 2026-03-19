import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import BottomNavigationBar from '../../components/BottomNavigationBar';

// Screen para mostrar la lista de conductores que coinciden con la búsqueda
const ListOfDrivers = ({ route, navigation }) => {
    // Obtenemos los viajes desde los parámetros de navegación que nos pasó SearchRide.js
    const rides = route.params?.rides || [];

    // Función para manejar el clic en un viaje, reservado para el futuro screen
    const handleRideSelection = (rideId) => {
        // TODO: Navegar al screen futuro que mostrará el detalle del viaje o confirmará la reserva
        // Ejemplo de uso futuro: navigation.navigate('FutureRideDetailScreen', { rideId });
        console.log('Viaje seleccionado:', rideId);
    };

    // Componente para renderizar cada elemento de la lista de resultados
    const renderRideItem = ({ item }) => {
        // Extraemos nombre, origen y calificación del viaje
        const driverName = item.driver_id?.name || 'Conductor Desconocido';
        
        // Manejo seguro del origen ya que podría ser un string o un objeto dependiendo del backend
        const originDesc = typeof item.origin === 'object' 
            ? item.origin?.address || JSON.stringify(item.origin)
            : item.origin || 'Origen no especificado';
            
        const rating = item.driver_id?.rating || 'N/A';

        return (
            <TouchableOpacity 
                style={styles.card} 
                onPress={() => handleRideSelection(item._id)}
            >
                <View style={styles.cardHeader}>
                    {/* Nombre del conductor */}
                    <Text style={styles.driverName}>{driverName}</Text>
                    {/* Calificación a la derecha en la misma fila */}
                    <Text style={styles.rating}>⭐ {rating}</Text>
                </View>
                {/* Origen abajo del nombre */}
                <Text style={styles.originText}>Origen: {originDesc}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Viajes Disponibles</Text>
                
                {rides.length === 0 ? (
                    // Mensaje cuando no se encuentran viajes
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No se encontró ningún viaje</Text>
                    </View>
                ) : (
                    // Lista de viajes publicados
                    <FlatList 
                        data={rides}
                        keyExtractor={(item) => item._id}
                        renderItem={renderRideItem}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>

            {/* Componente de navegación inferior */}
            <BottomNavigationBar navigation={navigation} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA', // Fondo claro y limpio
    },
    content: {
        flex: 1,
        padding: 20,
        paddingBottom: 90, // Espacio para que el BottomNavBar no tape la lista
    },
    title: {
        fontSize: 22,
        color: '#045084',
        fontWeight: 'bold',
        marginBottom: 20,
        marginTop: 40, // Margen superior para hacerlo visible debajo del notch de iOS/Android
        textAlign: 'center',
    },
    listContainer: {
        paddingBottom: 20,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3, // Sombra para dispositivos Android
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    driverName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
    },
    rating: {
        fontSize: 16,
        color: '#f39c12',
        fontWeight: 'bold',
    },
    originText: {
        fontSize: 14,
        color: '#666',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        color: '#999',
        textAlign: 'center',
    }
});

export default ListOfDrivers;
