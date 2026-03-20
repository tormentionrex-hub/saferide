import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';

import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';

// Screen para mostrar la lista de conductores que coinciden con la búsqueda
const ListOfDrivers = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const rides = route.params?.rides || [];
    const si = useScrollIndicator();

    // Función para manejar el clic en un viaje
    const handleRideSelection = (rideId) => {
        console.log('Viaje seleccionado:', rideId);
    };

    // Componente para renderizar cada elemento de la lista de resultados
    const renderRideItem = ({ item }) => {
        const driverName = item.driver_id?.name || 'Conductor Desconocido';
        const originDesc = typeof item.origin === 'object' 
            ? item.origin?.address || JSON.stringify(item.origin)
            : item.origin || 'Origen no especificado';
        const rating = item.driver_id?.rating || 'N/A';

        return (
            <TouchableOpacity 
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]} 
                onPress={() => handleRideSelection(item._id)}
            >
                <View style={styles.cardHeader}>
                    <Text style={[styles.driverName, { color: theme.text }]}>{driverName}</Text>
                    <Text style={styles.rating}>⭐ {rating}</Text>
                </View>
                <Text style={[styles.originText, { color: theme.textSecondary }]}>Origen: {originDesc}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            
            <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={30} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>Viajes Disponibles</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                {rides.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No se encontró ningún viaje</Text>
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                    <FlatList
                        data={rides}
                        keyExtractor={(item) => item._id}
                        renderItem={renderRideItem}
                        contentContainerStyle={styles.listContainer}
                        {...si.scrollProps}
                    />
                    <ScrollIndicator si={si} thumbColor={theme.accent} />
                    </View>
                )}
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
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        height: Platform.OS === 'ios' ? 110 : 100,
        borderBottomWidth: 1,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
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
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
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
        flex: 1,
    },
    rating: {
        fontSize: 16,
        color: '#f39c12',
        fontWeight: 'bold',
    },
    originText: {
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        textAlign: 'center',
    }
});

export default ListOfDrivers;
