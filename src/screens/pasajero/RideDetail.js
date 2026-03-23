import React, { useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Platform, Dimensions, Alert
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import api from '../../services/api';

const { width, height } = Dimensions.get('window');

const RideDetail = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    // Recibimos el objeto completo del viaje
    const { ride } = route.params; 

    const mapRef = useRef(null);

    // Extraemos las coordenadas de origen y destino
    const origin = ride.origin;
    const dest = ride.destination;

    useEffect(() => {
        // Enfoca el mapa para que ambos puntos sean visibles al cargar
        if (origin && dest && mapRef.current) {
            const coords = [
                { latitude: origin.coordinates.lat, longitude: origin.coordinates.lng },
                { latitude: dest.coordinates.lat, longitude: dest.coordinates.lng }
            ];
            mapRef.current.fitToCoordinates(coords, {
                edgePadding: { top: 100, right: 80, bottom: 100, left: 80 },
                animated: true,
            });
        }
    }, [origin, dest]);

    const handleConfirmBooking = async () => {
        try {
            const response = await api.post('/bookings', { ride_id: ride._id, seats_booked: 1 });
            if (response.data.success) {
                navigation.navigate('ScreenSaver');
            }
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'Error al solicitar unirse al viaje.');
        }
    };

    const darkMapStyle = [
        { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
        { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
        { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38413e" }] },
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
    ];

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor="transparent" translucent />
            
            {/* MAPA A PANTALLA COMPLETA */}
            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                customMapStyle={theme.dark ? darkMapStyle : []}
            >
                {/* Marcador de Origen */}
                <Marker
                    coordinate={{ latitude: origin.coordinates.lat, longitude: origin.coordinates.lng }}
                    title="Origen"
                    description={origin.name}
                >
                    <View style={[styles.markerRound, { backgroundColor: theme.accent }]}>
                        <Ionicons name="radio-button-on" size={16} color="#fff" />
                    </View>
                </Marker>
                {/* Marcador de Destino */}
                <Marker
                    coordinate={{ latitude: dest.coordinates.lat, longitude: dest.coordinates.lng }}
                    title="Destino"
                    description={dest.name}
                >
                    <View style={[styles.markerRound, { backgroundColor: '#FF5A5F' }]}>
                        <Ionicons name="location" size={16} color="#fff" />
                    </View>
                </Marker>
            </MapView>

            {/* BOTÓN CERRAR (FLOTANTE) */}
            <TouchableOpacity 
                style={[styles.closeBtn, { backgroundColor: theme.surface }]}
                onPress={() => navigation.goBack()}
            >
                <Ionicons name="close" size={26} color={theme.text} />
            </TouchableOpacity>

            {/* CARD DE DETALLES (ESTILO PREMIUM) */}
            <View style={[styles.detailCard, { backgroundColor: theme.surface }]}>
                <View style={[styles.dragBar, { backgroundColor: theme.divider }]} />
                
                <View style={styles.headerRow}>
                    <View>
                        <Text style={[styles.driverLabel, { color: theme.textSecondary }]}>CONDUCTOR</Text>
                        <Text style={[styles.driverName, { color: theme.text }]}>{ride.driver_id?.name || 'Desconocido'}</Text>
                    </View>
                    <View style={styles.priceTag}>
                        <Text style={styles.priceValue}>₡{ride.price}</Text>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.divider }]} />

                {/* Ruta Detallada */}
                <View style={styles.routeBox}>
                    <View style={styles.iconColumn}>
                        <Ionicons name="radio-button-on" size={16} color={theme.accent} />
                        <View style={[styles.dotLine, { backgroundColor: theme.divider }]} />
                        <Ionicons name="location" size={16} color="#FF5A5F" />
                    </View>
                    <View style={styles.textColumn}>
                        <Text style={[styles.locationText, { color: theme.text }]} numberOfLines={1}>{origin.name}</Text>
                        <Text style={[styles.locationText, { color: theme.text, marginTop: 15 }]} numberOfLines={1}>{dest.name}</Text>
                    </View>
                </View>

                {/* Métricas del Viaje */}
                <View style={styles.statsRow}>
                    <View style={[styles.statItem, { backgroundColor: theme.surfaceVariant }]}>
                        <Ionicons name="people-outline" size={18} color={theme.accent} />
                        <Text style={[styles.statText, { color: theme.text }]}>{ride.available_seats} asientos</Text>
                    </View>
                    <View style={[styles.statItem, { backgroundColor: theme.surfaceVariant }]}>
                        <Ionicons name="time-outline" size={18} color={theme.accent} />
                        <Text style={[styles.statText, { color: theme.text }]}>{ride.duration_minutes} min</Text>
                    </View>
                </View>

                {/* Botón de Acción Principal */}
                <TouchableOpacity 
                    style={[styles.bookBtn, { backgroundColor: theme.accent }]}
                    onPress={handleConfirmBooking}
                >
                    <Text style={styles.bookBtnText}>Solicitar unirse</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { width: '100%', height: height * 0.7 },
    closeBtn: {
        position: 'absolute',
        top: 50,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        zIndex: 5,
    },
    markerRound: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
    },
    detailCard: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        paddingHorizontal: 25,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 45 : 30,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        elevation: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.12,
        shadowRadius: 15,
    },
    dragBar: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    driverLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 2 },
    driverName: { fontSize: 20, fontWeight: 'bold' },
    priceTag: { backgroundColor: '#25C46020', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    priceValue: { color: '#25C460', fontWeight: 'bold', fontSize: 18 },
    divider: { height: 1, marginBottom: 20 },
    routeBox: { flexDirection: 'row', marginBottom: 25 },
    iconColumn: { alignItems: 'center', marginRight: 15 },
    dotLine: { width: 2, height: 25, marginVertical: 4 },
    textColumn: { flex: 1, justifyContent: 'space-between' },
    locationText: { fontSize: 15, fontWeight: '600' },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 25 },
    statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 15 },
    statText: { fontSize: 13, fontWeight: '600' },
    bookBtn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 5 },
    bookBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 0.5 }
});

export default RideDetail;
