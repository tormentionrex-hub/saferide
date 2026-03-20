import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';

// Screen para mostrar la lista de conductores que coinciden con la búsqueda
const ListOfDrivers = ({ route, navigation }) => {
    const rides = route.params?.rides || [];
    const si = useScrollIndicator();

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
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            
            {/* Header con botón de retroceso */}
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={30} color="#045084" />
                </TouchableOpacity>
                <Text style={styles.title}>Viajes Disponibles</Text>
                {/* View vacío para compensar el espacio del botón de atrás y que el título quede centrado */}
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                
                {rides.length === 0 ? (
                    // Mensaje cuando no se encuentran viajes
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No se encontró ningún viaje</Text>
                    </View>
                ) : (
                    // Lista de viajes publicados
                    <View style={{ flex: 1 }}>
                    <FlatList
                        data={rides}
                        keyExtractor={(item) => item._id}
                        renderItem={renderRideItem}
                        contentContainerStyle={styles.listContainer}
                        {...si.scrollProps}
                    />
                    <ScrollIndicator si={si} thumbColor="#045084" />
                    </View>
                )}
            </View>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA', // Fondo claro y limpio
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        height: Platform.OS === 'ios' ? 110 : 100,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        backgroundColor: '#FFF',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        color: '#045084',
        fontWeight: 'bold',
        textAlign: 'center',
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 20,
        paddingBottom: 90, 
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
        elevation: 3, 
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
