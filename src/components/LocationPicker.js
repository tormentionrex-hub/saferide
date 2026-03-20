import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    Platform,
    ActivityIndicator,
    Dimensions
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Ionicons } from '@expo/vector-icons';
import { GOOGLE_MAPS_API_KEY } from '../config';
import { getCurrentLocation, reverseGeocode } from '../services/locationService';

const { width, height } = Dimensions.get('window');

/**
 * Componente modal para seleccionar una ubicación.
 * Soporta búsqueda por texto, selección en mapa y GPS.
 */
const LocationPicker = ({ visible, onClose, onSelect, title = "Seleccionar Ubicación" }) => {
    const [tab, setTab] = useState('search'); // 'search', 'map', 'gps'
    const [loading, setLoading] = useState(false);
    const [region, setRegion] = useState({
        latitude: 9.9281, // Default San José, Costa Rica
        longitude: -84.0907,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    });
    const [markerCoords, setMarkerCoords] = useState(null);

    // Al abrir el modal, resetear estados
    useEffect(() => {
        if (visible) {
            setTab('search');
            setMarkerCoords(null);
        }
    }, [visible]);

    const handleConfirmSelection = async (lat, lng, name, address) => {
        setLoading(true);
        try {
            // Si el nombre o dirección vienen vacíos, hacer geocodificación inversa
            if (!name || !address) {
                const details = await reverseGeocode(lat, lng);
                onSelect({
                    lat,
                    lng,
                    name: details.name,
                    address: details.address,
                });
            } else {
                onSelect({ lat, lng, name, address });
            }
            onClose();
        } catch (error) {
            console.error('Error confirmando ubicación:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGpsDetect = async () => {
        setLoading(true);
        try {
            const coords = await getCurrentLocation();
            const details = await reverseGeocode(coords.lat, coords.lng);
            handleConfirmSelection(coords.lat, coords.lng, details.name, details.address);
        } catch (error) {
            alert('Error detectando ubicación');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={28} color="#1A2B4C" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{title}</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <TouchableOpacity
                        style={[styles.tab, tab === 'search' && styles.activeTab]}
                        onPress={() => setTab('search')}
                    >
                        <Ionicons name="search-outline" size={20} color={tab === 'search' ? '#2D63ED' : '#999'} />
                        <Text style={[styles.tabText, tab === 'search' && styles.activeTabText]}>Buscar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, tab === 'map' && styles.activeTab]}
                        onPress={() => setTab('map')}
                    >
                        <Ionicons name="map-outline" size={20} color={tab === 'map' ? '#2D63ED' : '#999'} />
                        <Text style={[styles.tabText, tab === 'map' && styles.activeTabText]}>Mapa</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, tab === 'gps' && styles.activeTab]}
                        onPress={() => setTab('gps')}
                    >
                        <Ionicons name="navigate-outline" size={20} color={tab === 'gps' ? '#2D63ED' : '#999'} />
                        <Text style={[styles.tabText, tab === 'gps' && styles.activeTabText]}>GPS</Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {tab === 'search' && (
                        <GooglePlacesAutocomplete
                            placeholder='¿A donde vas?'
                            onPress={(data, details = null) => {
                                const lat = details.geometry.location.lat;
                                const lng = details.geometry.location.lng;
                                handleConfirmSelection(lat, lng, data.structured_formatting.main_text, data.description);
                            }}
                            query={{
                                key: GOOGLE_MAPS_API_KEY,
                                language: 'es',
                                components: 'country:cr', // Sesgado a Costa Rica por defecto
                            }}
                            fetchDetails={true}
                            styles={{
                                textInput: styles.searchInput,
                                container: { flex: 0, width: '100%' },
                                listView: { backgroundColor: 'white', position: 'absolute', top: 50, zIndex: 999 }
                            }}
                        />
                    )}

                    {tab === 'map' && (
                        <View style={styles.mapContainer}>
                            <MapView
                                style={styles.map}
                                initialRegion={region}
                                onRegionChangeComplete={(r) => setRegion(r)}
                                onPress={(e) => setMarkerCoords(e.nativeEvent.coordinate)}
                            >
                                {markerCoords && (
                                    <Marker coordinate={markerCoords} draggable />
                                )}
                            </MapView>
                            <View style={styles.mapOverlay}>
                                <Text style={styles.mapHelper}>Toca el mapa para colocar el pin</Text>
                                {markerCoords && (
                                    <TouchableOpacity
                                        style={styles.confirmMapBtn}
                                        onPress={() => handleConfirmSelection(markerCoords.latitude, markerCoords.longitude)}
                                    >
                                        <Text style={styles.confirmMapBtnText}>Confirmar este punto</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}

                    {tab === 'gps' && (
                        <View style={styles.gpsContainer}>
                            <Ionicons name="location" size={80} color="#2D63ED" />
                            <Text style={styles.gpsTitle}>Ubicación Actual</Text>
                            <Text style={styles.gpsDesc}>Usa tu ubicación actual detectada por el sensor GPS.</Text>
                            <TouchableOpacity style={styles.gpsBtn} onPress={handleGpsDetect}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.gpsBtnText}>Detectar Ubicación</Text>}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 60,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    closeBtn: {
        padding: 5,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A2B4C',
    },
    tabsContainer: {
        flexDirection: 'row',
        height: 50,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#2D63ED',
    },
    tabText: {
        fontSize: 14,
        color: '#999',
    },
    activeTabText: {
        color: '#2D63ED',
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 15,
    },
    searchInput: {
        height: 50,
        backgroundColor: '#F5F7FA',
        borderRadius: 10,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#EFEFEF',
    },
    mapContainer: {
        flex: 1,
        borderRadius: 15,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#EFEFEF',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    mapOverlay: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    mapHelper: {
        backgroundColor: 'rgba(26, 43, 76, 0.8)',
        color: 'white',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        fontSize: 12,
        marginBottom: 10,
    },
    confirmMapBtn: {
        backgroundColor: '#2D63ED',
        width: '100%',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        shadowColor: '#2D63ED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    confirmMapBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    gpsContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    gpsTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1A2B4C',
        marginTop: 20,
    },
    gpsDesc: {
        textAlign: 'center',
        color: '#666',
        marginTop: 10,
        marginBottom: 30,
        lineHeight: 20,
    },
    gpsBtn: {
        backgroundColor: '#2D63ED',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    gpsBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    }
});

export default LocationPicker;
