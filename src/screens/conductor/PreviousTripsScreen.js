import React, { useState, useEffect, useCallback, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
    ScrollView,
    Modal,
    Platform,
    Linking,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { rideService } from '../../services/rideService';
import sessionCache from '../../services/sessionCache';
import { DateTime } from 'luxon';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

// Memoized Trip Item for better performance
const TripItem = memo(({ item, theme, calculateArrivalTime, handleContact }) => {
    const isCancelled = item.status === 'cancelled';
    const statusColor = isCancelled ? '#FF3B30' : '#4CD964';
    const arrivalTime = calculateArrivalTime(item.fecha, item.hora, item.duration_minutes);

    const originCoords = item.origin?.coordinates;
    const destCoords = item.destination?.coordinates;

    return (
        <View style={[styles.card, { backgroundColor: theme.surface, shadowColor: theme.text }]}>
            {/* Header: Fecha y Estado */}
            <View style={styles.cardHeader}>
                <View style={styles.dateContainer}>
                    <Text style={[styles.dateDay, { color: theme.text }]}>
                        {DateTime.fromISO(item.fecha).setLocale('es').toFormat('dd')}
                    </Text>
                    <Text style={[styles.dateMonth, { color: theme.textSecondary }]}>
                        {DateTime.fromISO(item.fecha).setLocale('es').toFormat('MMM, yyyy').toUpperCase()}
                    </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                        {item.status === 'completed' ? 'Completado' : 'Cancelado'}
                    </Text>
                </View>
            </View>

            {/* Mapa con la ruta */}
            {(originCoords && destCoords) ? (
                <View style={[styles.mapSection, { borderColor: theme.cardBorder }]}>
                    <View style={styles.mapSectionHeader}>
                        <Ionicons name="navigate-outline" size={13} color={theme.accent} />
                        <Text style={[styles.mapSectionLabel, { color: theme.textSecondary }]}>Ruta del Viaje</Text>
                    </View>
                    <View style={styles.mapContainer}>
                        <MapView
                            provider={PROVIDER_GOOGLE}
                            style={styles.map}
                            initialRegion={{
                                latitude: (originCoords.lat + destCoords.lat) / 2,
                                longitude: (originCoords.lng + destCoords.lng) / 2,
                                latitudeDelta: Math.abs(originCoords.lat - destCoords.lat) * 2,
                                longitudeDelta: Math.abs(originCoords.lng - destCoords.lng) * 2,
                            }}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            pitchEnabled={false}
                            rotateEnabled={false}
                            cacheEnabled={true} // Performance optimization for MapView
                        >
                            <Marker coordinate={{ latitude: originCoords.lat, longitude: originCoords.lng }}>
                                <View style={[styles.markerIcon, { backgroundColor: theme.accent }]}>
                                    <View style={styles.markerInner} />
                                </View>
                            </Marker>
                            <Marker coordinate={{ latitude: destCoords.lat, longitude: destCoords.lng }}>
                                <Ionicons name="location" size={24} color="#FF3B30" />
                            </Marker>
                        </MapView>
                    </View>
                </View>
            ) : null}

            {/* Ruta Textual */}
            <View style={styles.routeContainer}>
                <View style={styles.routePoint}>
                    <View style={[styles.dot, { backgroundColor: theme.accent }]} />
                    <Text style={[styles.locationText, { color: theme.text }]} numberOfLines={1}>
                        {item.origin?.name}
                    </Text>
                </View>
                <View style={[styles.line, { backgroundColor: theme.border }]} />
                <View style={styles.routePoint}>
                    <Ionicons name="location" size={16} color="#FF3B30" />
                    <Text style={[styles.locationText, { color: theme.text }]} numberOfLines={1}>
                        {item.destination?.name}
                    </Text>
                </View>
            </View>

            {/* Tiempos y Precio */}
            <View style={styles.footer}>
                <View style={styles.timeSection}>
                    <View style={styles.timeItem}>
                        <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>Salida</Text>
                        <Text style={[styles.timeValue, { color: theme.text }]}>{item.hora}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={14} color={theme.textSecondary} style={{ marginHorizontal: 12 }} />
                    <View style={styles.timeItem}>
                        <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>Llegada</Text>
                        <Text style={[styles.timeValue, { color: theme.text }]}>{arrivalTime}</Text>
                    </View>
                </View>
                <View style={styles.priceContainer}>
                    <Text style={[styles.priceText, { color: theme.accent }]}>
                        ₡{item.suggested_price?.toLocaleString()}
                    </Text>
                </View>
            </View>

            {/* Pasajeros con Contacto */}
            {item.passengers?.length > 0 && (
                <View style={[styles.passengerSection, { borderTopColor: theme.border }]}>
                    <Text style={[styles.passengerLabel, { color: theme.textSecondary }]}>
                        Pasajeros y Contacto:
                    </Text>
                    <View style={styles.passengerFullList}>
                        {item.passengers.map((p, idx) => (
                            <View key={idx} style={styles.passengerContactRow}>
                                <View style={styles.passengerInfoMain}>
                                    <Image
                                        source={p.image ? { uri: p.image } : 'https://res.cloudinary.com/do2ccwxm3/image/upload/v1/assets/default-avatar.png'}
                                        style={styles.avatarLarge}
                                        contentFit="cover"
                                    />
                                    <Text style={[styles.passengerNameText, { color: theme.text }]} numberOfLines={1}>
                                        {p.name}
                                    </Text>
                                </View>
                                <View style={styles.contactButtons}>
                                    <TouchableOpacity 
                                        style={[styles.contactBtn, { backgroundColor: '#25D366' + '20' }]}
                                        onPress={() => handleContact('whatsapp', p.phone)}
                                    >
                                        <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.contactBtn, { backgroundColor: theme.accent + '20' }]}
                                        onPress={() => handleContact('call', p.phone)}
                                    >
                                        <Ionicons name="call" size={18} color={theme.accent} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
});

export default function PreviousTripsScreen() {
    const { theme } = useDriverTheme();
    const [allTrips, setAllTrips] = useState([]);
    const [filteredTrips, setFilteredTrips] = useState([]);
    const [availableMonths, setAvailableMonths] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    
    // Pagination & Day Picker States
    const [displayLimit, setDisplayLimit] = useState(3);
    const [showDayPicker, setShowDayPicker] = useState(false);
    const [tempDate, setTempDate] = useState(new Date());

    const fetchTrips = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const driverId = await sessionCache.getDriverId();
            if (!driverId) {
                setLoading(false);
                return;
            }

            const [completedRes, cancelledRes] = await Promise.all([
                rideService.getRidesByDriver(driverId, 'completed'),
                rideService.getRidesByDriver(driverId, 'cancelled')
            ]);

            const tripsFromApi = [...(completedRes.data || []), ...(cancelledRes.data || [])];

            const tripsWithPassengers = await Promise.all(tripsFromApi.map(async (trip) => {
                try {
                    const bookingsRes = await rideService.getBookingsByRide(trip._id);
                    const passengers = bookingsRes.data
                        ?.filter(b => b.status === 'confirmed' || b.status === 'completed')
                        ?.map(b => ({
                            name: b.passenger_id?.name || 'Pasajero',
                            image: b.passenger_id?.profileImage,
                            phone: b.passenger_id?.phone
                        }));
                    
                    return { ...trip, passengers };
                } catch (error) {
                    return { ...trip, passengers: [] };
                }
            }));

            tripsWithPassengers.sort((a, b) => {
                const dateA = new Date(`${a.fecha}T${a.hora}`);
                const dateB = new Date(`${b.fecha}T${b.hora}`);
                return dateB - dateA;
            });

            setAllTrips(tripsWithPassengers);
            
            const months = tripsWithPassengers.reduce((acc, trip) => {
                const monthYear = DateTime.fromISO(trip.fecha).toFormat('yyyy-MM');
                if (!acc.includes(monthYear)) acc.push(monthYear);
                return acc;
            }, []);
            
            setAvailableMonths(months);

            if (!selectedMonth && months.length > 0) {
                setSelectedMonth(months[0]);
            }

        } catch (error) {
            console.error('Error fetching previous trips:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedMonth]);

    // Refresh data when screen gains focus
    useFocusEffect(
        useCallback(() => {
            setDisplayLimit(3);
            fetchTrips(true); // Fetch silently on focus
        }, [fetchTrips])
    );

    useEffect(() => {
        if (!selectedMonth) return;
        
        let filtered = [];
        if (selectedMonth.length > 7) {
            filtered = allTrips.filter(t => t.fecha === selectedMonth);
        } else {
            filtered = allTrips.filter(t => 
                DateTime.fromISO(t.fecha).toFormat('yyyy-MM') === selectedMonth
            );
        }
        setFilteredTrips(filtered);
    }, [selectedMonth, allTrips]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchTrips();
    };

    const calculateArrivalTime = useCallback((date, departureTime, durationMinutes) => {
        if (!date || !departureTime || !durationMinutes) return '--:--';
        const [year, month, day] = date.split('-').map(Number);
        const [hours, minutes] = departureTime.split(':').map(Number);
        const departure = DateTime.fromObject({ year, month, day, hour: hours, minute: minutes });
        const arrival = departure.plus({ minutes: durationMinutes });
        return arrival.toFormat('HH:mm');
    }, []);

    const handleDateChange = (event, date) => {
        setShowDayPicker(Platform.OS === 'ios');
        if (date) {
            setTempDate(date);
            const formattedDate = DateTime.fromJSDate(date).toFormat('yyyy-MM-dd');
            setSelectedMonth(formattedDate);
            setIsModalVisible(false);
        }
    };

    const handleContact = useCallback((type, phone) => {
        if (!phone) return;
        const cleanPhone = phone.replace(/[^\d+]/g, '');
        if (type === 'whatsapp') {
            const url = `https://wa.me/${cleanPhone.startsWith('+') ? cleanPhone : '+506' + cleanPhone}`;
            Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir WhatsApp.'));
        } else if (type === 'call') {
            Linking.openURL(`tel:${cleanPhone}`);
        }
    }, []);

    const renderMonthSelector = () => {
        let selectedLabel = '';
        if (!selectedMonth) {
            selectedLabel = 'Seleccionar filtro';
        } else if (selectedMonth.length > 7) {
            selectedLabel = DateTime.fromISO(selectedMonth).setLocale('es').toFormat('dd MMMM yyyy');
        } else {
            selectedLabel = DateTime.fromISO(`${selectedMonth}-01`).setLocale('es').toFormat('MMMM yyyy');
        }

        return (
            <View style={styles.selectorWrapper}>
                <TouchableOpacity 
                    style={[styles.selectorButton, { backgroundColor: theme.surfaceVariant }]}
                    onPress={() => setIsModalVisible(true)}
                >
                    <Ionicons name="filter-outline" size={20} color={theme.accent} />
                    <Text style={[styles.selectorLabel, { color: theme.text }]}>
                        {selectedLabel.charAt(0).toUpperCase() + selectedLabel.slice(1)}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                </TouchableOpacity>

                <Modal
                    visible={isModalVisible}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setIsModalVisible(false)}
                >
                    <TouchableOpacity 
                        style={styles.modalOverlay} 
                        activeOpacity={1} 
                        onPress={() => setIsModalVisible(false)}
                    >
                        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
                            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                                <Text style={[styles.modalTitle, { color: theme.text }]}>Filtrar Viajes</Text>
                                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                    <Ionicons name="close" size={24} color={theme.textSecondary} />
                                </TouchableOpacity>
                            </View>
                            
                            <ScrollView style={styles.modalBody}>
                                <TouchableOpacity 
                                    style={[
                                        styles.monthOption, 
                                        selectedMonth.length > 7 && { backgroundColor: theme.accent + '15' }
                                    ]}
                                    onPress={() => setShowDayPicker(true)}
                                >
                                    <View style={styles.optionRow}>
                                        <Ionicons 
                                            name="calendar-outline" 
                                            size={20} 
                                            color={selectedMonth.length > 7 ? theme.accent : theme.textSecondary} 
                                        />
                                        <Text style={[
                                            styles.optionText, 
                                            { color: selectedMonth.length > 7 ? theme.accent : theme.text }
                                        ]}>
                                            Filtrar por día...
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                                </TouchableOpacity>

                                <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />
                                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Viajes por Mes</Text>

                                {availableMonths.map((ym) => {
                                    const label = DateTime.fromISO(`${ym}-01`).setLocale('es').toFormat('MMMM yyyy');
                                    const isSelected = selectedMonth === ym;
                                    return (
                                        <TouchableOpacity 
                                            key={ym}
                                            style={[
                                                styles.monthOption, 
                                                isSelected && { backgroundColor: theme.accent + '15' }
                                            ]}
                                            onPress={() => {
                                                setSelectedMonth(ym);
                                                setIsModalVisible(false);
                                            }}
                                        >
                                            <View style={styles.optionRow}>
                                                <Ionicons 
                                                    name="calendar-clear-outline" 
                                                    size={20} 
                                                    color={isSelected ? theme.accent : theme.textSecondary} 
                                                />
                                                <Text style={[
                                                    styles.optionText, 
                                                    { color: isSelected ? theme.accent : theme.text }
                                                ]}>
                                                    {label.charAt(0).toUpperCase() + label.slice(1)}
                                                </Text>
                                            </View>
                                            {isSelected && <Ionicons name="checkmark" size={20} color={theme.accent} />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {showDayPicker && (
                    <DateTimePicker
                        value={tempDate}
                        mode="date"
                        display="default"
                        onChange={handleDateChange}
                        maximumDate={new Date()}
                    />
                )}
            </View>
        );
    };

    const renderTripItem = useCallback(({ item }) => (
        <TripItem 
            item={item} 
            theme={theme} 
            calculateArrivalTime={calculateArrivalTime} 
            handleContact={handleContact} 
        />
    ), [theme, calculateArrivalTime, handleContact]);

    const renderFooter = () => {
        if (displayLimit >= filteredTrips.length) return <View style={{ height: 40 }} />;
        
        return (
            <TouchableOpacity 
                style={[styles.loadMoreBtn, { borderColor: theme.accent }]}
                onPress={() => setDisplayLimit(prev => prev + 3)}
            >
                <Text style={[styles.loadMoreText, { color: theme.accent }]}>Mostrar más</Text>
                <Ionicons name="chevron-down" size={16} color={theme.accent} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Viajes Anteriores</Text>
            </View>

            {!loading && availableMonths.length > 0 && renderMonthSelector()}

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={theme.accent} />
                </View>
            ) : (
                <FlatList
                    data={filteredTrips.slice(0, displayLimit)}
                    renderItem={renderTripItem}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.listContent}
                    removeClippedSubviews={true} 
                    initialNumToRender={3}
                    maxToRenderPerBatch={3}
                    windowSize={5}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
                    }
                    ListFooterComponent={renderFooter}
                    ListEmptyComponent={() => {
                        const isFiltered = !!selectedMonth;
                        return (
                            <View style={styles.emptyContainer}>
                                <Ionicons
                                    name={isFiltered ? 'calendar-outline' : 'car-sport-outline'}
                                    size={72}
                                    color={theme.textSecondary + '35'}
                                />
                                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                                    {isFiltered ? 'Sin viajes en este período' : '¡Aún no tienes viajes!'}
                                </Text>
                                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                    {isFiltered
                                        ? 'No encontramos viajes para la fecha seleccionada. Prueba con otro filtro.'
                                        : 'Cuando completes tu primer viaje como conductor, aparecerá aquí tu historial.'}
                                </Text>
                            </View>
                        );
                    }}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    selectorWrapper: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    selectorButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    selectorLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        maxHeight: '80%',
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    modalBody: {
        padding: 16,
    },
    monthOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 16,
        marginBottom: 8,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
    },
    sectionDivider: {
        height: 1,
        marginVertical: 16,
        opacity: 0.1,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginBottom: 12,
        marginLeft: 8,
        letterSpacing: 1,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    card: {
        borderRadius: 24,
        padding: 16,
        marginBottom: 20,
        elevation: 10,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    dateDay: {
        fontSize: 28,
        fontWeight: '900',
    },
    dateMonth: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    mapSection: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 16,
    },
    mapSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    mapSectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    mapContainer: {
        height: 120,
        overflow: 'hidden',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    markerIcon: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    markerInner: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#fff',
    },
    routeContainer: {
        marginBottom: 16,
    },
    routePoint: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 10,
    },
    line: {
        width: 1,
        height: 12,
        marginLeft: 3.5,
        marginVertical: 2,
    },
    locationText: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingBottom: 16,
    },
    timeSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeItem: {
        alignItems: 'flex-start',
    },
    timeLabel: {
        fontSize: 9,
        textTransform: 'uppercase',
        fontWeight: '600',
        marginBottom: 2,
    },
    timeValue: {
        fontSize: 18,
        fontWeight: '800',
    },
    priceContainer: {
        alignItems: 'flex-end',
    },
    priceText: {
        fontSize: 22,
        fontWeight: '900',
    },
    passengerSection: {
        paddingTop: 16,
        borderTopWidth: 1,
    },
    passengerLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    passengerFullList: {
        gap: 12,
    },
    passengerContactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 10,
        borderRadius: 16,
    },
    passengerInfoMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    avatarLarge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    passengerNameText: {
        fontSize: 15,
        fontWeight: '600',
    },
    contactButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    contactBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadMoreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        marginTop: 10,
        marginBottom: 30,
        gap: 8,
    },
    loadMoreText: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
        gap: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 20,
    },
});



