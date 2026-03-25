import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    ActivityIndicator,
    Dimensions,
    StatusBar,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Ionicons } from '@expo/vector-icons';
import { GOOGLE_MAPS_API_KEY } from '../config.js';
import { getCurrentLocation, reverseGeocode } from '../services/locationService';
import { useDriverTheme } from '../context/DriverThemeContext';

const { width, height } = Dimensions.get('window');

/**
 * Componente modal para seleccionar una ubicación.
 * Soporta búsqueda por texto, selección en mapa y GPS.
 */
const LocationPicker = ({ visible, onClose, onSelect, title = 'Seleccionar Ubicación' }) => {
    const { theme } = useDriverTheme();
    const [tab, setTab] = useState('search');
    const [loading, setLoading] = useState(false);
    const [region, setRegion] = useState({
        latitude: 9.9281,
        longitude: -84.0907,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    });
    const [markerCoords, setMarkerCoords] = useState(null);

    useEffect(() => {
        if (visible) {
            setTab('search');
            setMarkerCoords(null);
        }
    }, [visible]);

    const handleConfirmSelection = async (lat, lng, name, address) => {
        setLoading(true);
        try {
            if (!name || !address) {
                const details = await reverseGeocode(lat, lng);
                onSelect({ lat, lng, name: details.name, address: details.address });
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

    const activeColor = theme.accent;
    const inactiveColor = theme.textSecondary;
    // Color de placeholder con suficiente contraste en ambos modos
    const placeholderColor = theme.dark ? '#A0A0C8' : '#AAAAAA';

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.surface} />

                {/* Header */}
                <View style={[styles.header, { borderBottomColor: theme.divider }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={28} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Tabs */}
                <View style={[styles.tabsContainer, { borderBottomColor: theme.divider, backgroundColor: theme.surface }]}>
                    {[
                        { key: 'search', icon: 'search-outline', label: 'Buscar' },
                        { key: 'map',    icon: 'map-outline',    label: 'Mapa'   },
                        { key: 'gps',    icon: 'navigate-outline', label: 'GPS'  },
                    ].map(({ key, icon, label }) => (
                        <TouchableOpacity
                            key={key}
                            style={[styles.tab, tab === key && { borderBottomColor: activeColor, borderBottomWidth: 2 }]}
                            onPress={() => setTab(key)}
                        >
                            <Ionicons name={icon} size={20} color={tab === key ? activeColor : inactiveColor} />
                            <Text style={[styles.tabText, { color: tab === key ? activeColor : inactiveColor },
                                tab === key && { fontWeight: '600' }]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Content */}
                <View style={[styles.content, { backgroundColor: theme.bg }]}>
                    {/* ── BÚSQUEDA ── */}
                    {tab === 'search' && (
                        <GooglePlacesAutocomplete
                            placeholder='¿A donde vas?'
                            textInputProps={{ placeholderTextColor: placeholderColor }}
                            onPress={(data, details = null) => {
                                const lat = details.geometry.location.lat;
                                const lng = details.geometry.location.lng;
                                
                                // En vez de confirmar directo, vamos al mapa para que el usuario rectifique
                                setRegion({
                                    latitude: lat,
                                    longitude: lng,
                                    latitudeDelta: 0.005, // Zoom de cuadra
                                    longitudeDelta: 0.005
                                });
                                setTab('map');
                            }}
                            query={{
                                key: GOOGLE_MAPS_API_KEY,
                                language: 'es',
                                components: 'country:cr',
                            }}
                            fetchDetails={true}
                            styles={{
                                textInputContainer: {
                                    backgroundColor: 'transparent',
                                },
                                textInput: {
                                    height: 50,
                                    backgroundColor: theme.surfaceVariant,
                                    borderRadius: 12,
                                    paddingHorizontal: 15,
                                    borderWidth: 1,
                                    borderColor: theme.border,
                                    color: theme.text,
                                    fontSize: 15,
                                },
                                container: { flex: 0, width: '100%' },
                                listView: {
                                    backgroundColor: theme.surface,
                                    borderRadius: 12,
                                    marginTop: 4,
                                    borderWidth: 1,
                                    borderColor: theme.border,
                                    zIndex: 999,
                                },
                                row: {
                                    backgroundColor: theme.surface,
                                    paddingVertical: 12,
                                    paddingHorizontal: 15,
                                },
                                description: {
                                    color: theme.text,
                                    fontSize: 14,
                                },
                                poweredContainer: {
                                    backgroundColor: theme.surface,
                                    borderTopColor: theme.divider,
                                },
                                powered: {
                                    tintColor: theme.textSecondary,
                                },
                                separator: {
                                    backgroundColor: theme.divider,
                                    height: 1,
                                },
                            }}
                        />
                    )}

                    {/* ── MAPA ── */}
                    {tab === 'map' && (
                        <View style={styles.mapContainer}>
                            <MapView
                                style={styles.map}
                                initialRegion={region}
                                onRegionChangeComplete={(r) => {
                                    setRegion(r);
                                    setMarkerCoords({ latitude: r.latitude, longitude: r.longitude });
                                }}
                                showsUserLocation={true}
                                userInterfaceStyle={theme.dark ? 'dark' : 'light'}
                            />
                            
                            {/* Pin central fijo (Estilo Uber) */}
                            <View style={styles.fixedCenterPin} pointerEvents="none">
                                <Ionicons name="location" size={48} color={theme.accent} style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 4 }} />
                            </View>

                            <View style={styles.mapOverlay}>
                                <Text style={styles.mapHelper}>Arrastra el mapa para ajustar con precisión</Text>
                                {markerCoords && (
                                    <TouchableOpacity
                                        style={[styles.confirmMapBtn, { backgroundColor: theme.accent }]}
                                        onPress={() => handleConfirmSelection(markerCoords.latitude, markerCoords.longitude)}
                                    >
                                        <Text style={styles.confirmMapBtnText}>Confirmar este punto</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}

                    {/* ── GPS ── */}
                    {tab === 'gps' && (
                        <View style={styles.gpsContainer}>
                            <View style={[styles.gpsIconCircle, { backgroundColor: theme.surfaceVariant }]}>
                                <Ionicons name="location" size={50} color={theme.accent} />
                            </View>
                            <Text style={[styles.gpsTitle, { color: theme.text }]}>Ubicación Actual</Text>
                            <Text style={[styles.gpsDesc, { color: theme.textSecondary }]}>
                                Usa tu ubicación actual detectada por el sensor GPS.
                            </Text>
                            <TouchableOpacity
                                style={[styles.gpsBtn, { backgroundColor: theme.accent }]}
                                onPress={handleGpsDetect}
                            >
                                {loading
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={styles.gpsBtnText}>Detectar Ubicación</Text>
                                }
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
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 60,
        borderBottomWidth: 1,
    },
    closeBtn: {
        padding: 5,
        width: 40,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: 'bold',
    },
    tabsContainer: {
        flexDirection: 'row',
        height: 50,
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    tabText: {
        fontSize: 14,
    },
    content: {
        flex: 1,
        padding: 15,
    },
    mapContainer: {
        flex: 1,
        borderRadius: 15,
        overflow: 'hidden',
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
    fixedCenterPin: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: -24, 
        marginTop: -44, // Apunta exacto al centro
        zIndex: 10,
        alignItems: 'center',
        justifyContent: 'flex-end'
    },
    mapHelper: {
        backgroundColor: 'rgba(10, 10, 24, 0.75)',
        color: 'white',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        fontSize: 12,
        marginBottom: 10,
        overflow: 'hidden',
    },
    confirmMapBtn: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
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
    gpsIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    gpsTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 12,
    },
    gpsDesc: {
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 30,
        lineHeight: 22,
        fontSize: 15,
    },
    gpsBtn: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    gpsBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
});

export default LocationPicker;
