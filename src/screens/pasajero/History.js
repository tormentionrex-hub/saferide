import React, { useState, useEffect, useCallback, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
    RefreshControl,
    Platform,
    Dimensions,
    Linking,
    Modal,
    ScrollView,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { rideService } from '../../services/rideService';
import api from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkMapStyle } from '../../utils/mapStyle';
import { LinearGradient } from 'expo-linear-gradient';
import { DateTime } from 'luxon';
import { Image } from 'expo-image';
import DateTimePicker from '@react-native-community/datetimepicker';

// Cache en memoria para evitar refetch en cada useFocusEffect (navegación entre tabs)
let historyCache = { data: null, lastCheck: 0 };
const HISTORY_CACHE_TTL = 60000; // 60 segundos

const { width } = Dimensions.get('window');

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTHS_SHORT_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const getMonthNameES = (dt) => {
    if (!dt || !dt.isValid) return 'Mes';
    return MONTHS_ES[dt.month - 1] || 'Mes';
};

const getShortMonthNameES = (dt) => {
    if (!dt || !dt.isValid) return '---';
    return MONTHS_SHORT_ES[dt.month - 1] || '---';
};

// Memoized History Item for better performance
const HistoryItem = memo(({ item, theme, calculateArrivalTime, handleContact }) => {
    const ride = item.ride_id;
    if (!ride || !ride.fecha) return null;

    const arrivalTime = calculateArrivalTime(ride.fecha, ride.hora, ride.duration_minutes);
    const dateObj = DateTime.fromISO(ride.fecha);
    const day = dateObj.day || '--';
    const month = getShortMonthNameES(dateObj);

    const totalPaid = (ride.suggested_price || 0) * (item.seats_booked || 1);
    const originCoords = ride.origin?.coordinates;
    const destCoords = ride.destination?.coordinates;

    const isCancelled = item.status === 'cancelled' || item.status === 'canceled';
    const statusColor = isCancelled ? '#FF3B30' : '#4CD964';

    return (
        <View style={[styles.historyCard, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.text }]}>
            <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                    <View style={[styles.dateBlock, { backgroundColor: theme.bg }]}>
                        <Text style={[styles.dateDay, { color: theme.text }]}>{day}</Text>
                        <Text style={[styles.dateMonth, { color: theme.textSecondary }]}>{month}</Text>
                    </View>
                    <View style={styles.statusCol}>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                            <Text style={[styles.statusText, { color: statusColor }]}>
                                {item.status === 'completed' ? 'Completado' : 'Cancelado'}
                            </Text>
                        </View>
                        <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                            {ride.hora} → {arrivalTime}
                        </Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <Text style={[styles.priceText, { color: theme.accent }]}>
                        ₡{totalPaid.toLocaleString('es-CR')}
                    </Text>
                </View>
            </View>

            {/* MapView for Route */}
            {(originCoords && destCoords) ? (
                <View style={[styles.mapSection, { borderColor: theme.cardBorder }]}>
                    <View style={styles.mapSectionHeader}>
                        <Ionicons name="navigate-outline" size={13} color={theme.accent} />
                        <Text style={[styles.mapSectionLabel, { color: theme.textSecondary }]}>Tu Viaje</Text>
                    </View>
                    <View style={styles.mapContainer}>
                        <MapView
                            provider={PROVIDER_GOOGLE}
                            style={styles.map}
                            initialRegion={{
                                latitude: (originCoords.lat + destCoords.lat) / 2,
                                longitude: (originCoords.lng + destCoords.lng) / 2,
                                latitudeDelta: Math.abs(originCoords.lat - destCoords.lat) * 2.5,
                                longitudeDelta: Math.abs(originCoords.lng - destCoords.lng) * 2.5,
                            }}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            pitchEnabled={false}
                            rotateEnabled={false}
                            cacheEnabled={true}
                            customMapStyle={theme.dark ? darkMapStyle : []}
                        >
                            <Marker coordinate={{ latitude: originCoords.lat, longitude: originCoords.lng }}>
                                <View style={[styles.markerIcon, { backgroundColor: theme.accent }]}>
                                    <View style={styles.markerInner} />
                                </View>
                            </Marker>
                            <Marker coordinate={{ latitude: destCoords.lat, longitude: destCoords.lng }}>
                                <Ionicons name="location" size={20} color="#FF3B30" />
                            </Marker>
                        </MapView>
                    </View>
                </View>
            ) : null}

            <View style={[styles.routeContainer, { backgroundColor: theme.bg }]}>
                <View style={styles.routePoint}>
                    <Ionicons name="radio-button-on" size={14} color={theme.accent} />
                    <Text style={[styles.routeValue, { color: theme.text }]} numberOfLines={1}>
                        {ride.origin?.name || 'Ubicación desconocida'}
                    </Text>
                </View>
                <View style={[styles.routeConnector, { backgroundColor: theme.border }]} />
                <View style={styles.routePoint}>
                    <Ionicons name="location" size={14} color="#FF5A5F" />
                    <Text style={[styles.routeValue, { color: theme.text }]} numberOfLines={1}>
                        {ride.destination?.name || 'Ubicación desconocida'}
                    </Text>
                </View>
            </View>

            <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
                <View style={styles.driverInfoMain}>
                    <Image
                        source={ride.driver_id?.profileImage ? { uri: ride.driver_id.profileImage } : 'https://res.cloudinary.com/do2ccwxm3/image/upload/v1/assets/default-avatar.png'}
                        style={styles.avatarMini}
                        contentFit="cover"
                    />
                    <View>
                        <Text style={[styles.driverNameText, { color: theme.text }]} numberOfLines={1}>
                            {ride.driver_id?.name || 'Conductor'}
                        </Text>
                        <Text style={[styles.seatsInfoMini, { color: theme.textSecondary }]}>
                            {item.seats_booked} {item.seats_booked === 1 ? 'asiento' : 'asientos'}
                        </Text>
                    </View>
                </View>
                <View style={styles.contactActions}>
                    <TouchableOpacity 
                        style={[styles.contactBtn, { backgroundColor: '#25D366' + '20' }]}
                        onPress={() => handleContact('whatsapp', ride.driver_id?.phone)}
                    >
                        <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.contactBtn, { backgroundColor: theme.accent + '20' }]}
                        onPress={() => handleContact('call', ride.driver_id?.phone)}
                    >
                        <Ionicons name="call" size={18} color={theme.accent} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
});

const History = ({ navigation }) => {
    const { theme } = useDriverTheme();
    const insets = useSafeAreaInsets();
    
    // States
    const [allHistory, setAllHistory] = useState([]);
    const [filteredHistory, setFilteredHistory] = useState([]);
    const [availableMonths, setAvailableMonths] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    
    // Pagination & Day Picker States
    const [displayLimit, setDisplayLimit] = useState(3);
    const [showDayPicker, setShowDayPicker] = useState(false);
    const [tempDate, setTempDate] = useState(new Date());

    const fetchHistory = useCallback(async (isSilent = false, force = false) => {
        const now = Date.now();

        // Saltar fetch si el cache está fresco y no es un refresh manual
        if (!force && historyCache.data && (now - historyCache.lastCheck < HISTORY_CACHE_TTL)) {
            if (historyCache.data.length > 0 || allHistory.length === 0) {
                // Hidratar estado desde cache sin tocar la API
                setAllHistory(historyCache.data);
            }
            setLoading(false);
            setRefreshing(false);
            return;
        }

        if (!isSilent) setLoading(true);
        try {
            // Leer userId directo de AsyncStorage (guardado en login) para evitar
            // el cache stale de sessionCache que causaba el 403
            let userId = await AsyncStorage.getItem('userId');
            if (!userId) {
                // Fallback: consultar /auth/me si el userId no está aún en AsyncStorage
                const meRes = await api.get('/auth/me');
                userId = meRes.data?.data?._id;
            }
            if (!userId) return; // sin userId no tiene sentido continuar

            const response = await rideService.getBookingsByPassenger(userId);

            if (response.success) {
                const sorted = response.data
                    .filter(b => b.ride_id && b.ride_id.fecha && (b.status === 'completed' || b.status === 'cancelled' || b.status === 'canceled'))
                    .sort((a, b) => {
                        const dateA = DateTime.fromISO(a.ride_id.fecha + 'T' + a.ride_id.hora);
                        const dateB = DateTime.fromISO(b.ride_id.fecha + 'T' + b.ride_id.hora);
                        return dateB - dateA;
                    });

                historyCache = { data: sorted, lastCheck: Date.now() };
                setAllHistory(sorted);

                // Extract months
                const months = sorted.reduce((acc, b) => {
                    const ym = DateTime.fromISO(b.ride_id.fecha).toFormat('yyyy-MM');
                    if (!acc.includes(ym)) acc.push(ym);
                    return acc;
                }, []);

                setAvailableMonths(months);

                // Set initial month filter
                setSelectedMonth(prev => (months.length > 0 && !prev) ? months[0] : prev);
            }
        } catch (error) {
            // En 403 marcar cache con lista vacía para evitar retry infinito en cada focus
            if (error?.response?.status === 403) {
                historyCache = { data: [], lastCheck: Date.now() };
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            setDisplayLimit(3);
            fetchHistory(false, false); // usa cache si está fresco
        }, [fetchHistory])
    );

    // Filter whenever selectedMonth or allHistory changes
    useEffect(() => {
        if (!selectedMonth) {
            setFilteredHistory(allHistory);
            return;
        }
        
        const filtered = allHistory.filter(b => {
            const dateStr = b.ride_id?.fecha || '';
            if (selectedMonth.length > 7) {
                return dateStr === selectedMonth;
            } else {
                return dateStr.startsWith(selectedMonth);
            }
        });
        
        setFilteredHistory(filtered);
    }, [selectedMonth, allHistory]);

    const onRefresh = () => {
        setRefreshing(true);
        setDisplayLimit(3);
        fetchHistory(true, true); // force=true ignora el cache (pull-to-refresh manual)
    };

    const calculateArrivalTime = useCallback((date, departureTime, durationMinutes) => {
        if (!date || !departureTime || !durationMinutes) return '--:--';
        try {
            const departure = DateTime.fromFormat(`${date} ${departureTime}`, 'yyyy-MM-dd HH:mm');
            const arrival = departure.plus({ minutes: durationMinutes });
            return arrival.isValid ? arrival.toFormat('HH:mm') : '--:--';
        } catch (e) {
            return '--:--';
        }
    }, []);

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

    const handleDateChange = (event, date) => {
        setShowDayPicker(Platform.OS === 'ios');
        if (date) {
            setTempDate(date);
            const formattedDate = DateTime.fromJSDate(date).toFormat('yyyy-MM-dd');
            setSelectedMonth(formattedDate);
            setDisplayLimit(3);
            setIsModalVisible(false);
        }
    };

    const renderMonthSelector = () => {
        let selectedLabel = '';
        if (!selectedMonth) {
            selectedLabel = 'Seleccionar filtro';
        } else if (selectedMonth.length > 7) {
            const dt = DateTime.fromISO(selectedMonth);
            selectedLabel = dt.isValid ? `${dt.day} ${getMonthNameES(dt)} ${dt.year}` : selectedMonth;
        } else {
            const dt = DateTime.fromISO(`${selectedMonth}-01`);
            selectedLabel = dt.isValid ? `${getMonthNameES(dt)} ${dt.year}` : selectedMonth;
        }

        return (
            <View style={styles.selectorWrapper}>
                <TouchableOpacity 
                    style={[styles.selectorButton, { backgroundColor: theme.surfaceVariant }]}
                    onPress={() => setIsModalVisible(true)}
                >
                    <Ionicons name="filter-outline" size={20} color={theme.accent} />
                    <Text style={[styles.selectorLabel, { color: theme.text }]}>
                        {selectedLabel}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                </TouchableOpacity>

                <Modal
                    visible={isModalVisible}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setIsModalVisible(false)}
                >
                    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsModalVisible(false)}>
                        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
                            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                                <Text style={[styles.modalTitle, { color: theme.text }]}>Filtrar Historial</Text>
                                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                    <Ionicons name="close" size={24} color={theme.textSecondary} />
                                </TouchableOpacity>
                            </View>
                            
                            <ScrollView style={styles.modalBody}>
                                <TouchableOpacity 
                                    style={[styles.monthOption, selectedMonth.length > 7 && { backgroundColor: theme.accent + '15' }]}
                                    onPress={() => setShowDayPicker(true)}
                                >
                                    <View style={styles.optionRow}>
                                        <Ionicons name="calendar-outline" size={20} color={selectedMonth.length > 7 ? theme.accent : theme.textSecondary} />
                                        <Text style={[styles.optionText, { color: selectedMonth.length > 7 ? theme.accent : theme.text }]}>
                                            Filtrar por día...
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                                </TouchableOpacity>

                                <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />
                                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Viajes por Mes</Text>

                                {availableMonths.map((ym) => {
                                    const dt = DateTime.fromISO(`${ym}-01`);
                                    const label = dt.isValid ? `${getMonthNameES(dt)} ${dt.year}` : ym;
                                    const isSelected = selectedMonth === ym;
                                    return (
                                        <TouchableOpacity 
                                            key={ym}
                                            style={[styles.monthOption, isSelected && { backgroundColor: theme.accent + '15' }]}
                                            onPress={() => {
                                                setSelectedMonth(ym);
                                                setDisplayLimit(3);
                                                setIsModalVisible(false);
                                            }}
                                        >
                                            <View style={styles.optionRow}>
                                                <Ionicons name="calendar-clear-outline" size={20} color={isSelected ? theme.accent : theme.textSecondary} />
                                                <Text style={[styles.optionText, { color: isSelected ? theme.accent : theme.text }]}>
                                                    {label}
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

    const renderFooter = () => {
        if (displayLimit >= filteredHistory.length) return <View style={{ height: 40 }} />;
        
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

    const renderItem = useCallback(({ item }) => (
        <HistoryItem 
            item={item} 
            theme={theme} 
            calculateArrivalTime={calculateArrivalTime}
            handleContact={handleContact}
        />
    ), [theme, calculateArrivalTime, handleContact]);

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            
            <LinearGradient colors={[theme.accent, theme.accent + 'CC']} style={[styles.header, { paddingTop: insets.top + 20 }]}>
                <Text style={styles.headerTitle}>Tu Historial</Text>
                <Text style={styles.headerSubtitle}>Registros de tus viajes en SafeRide</Text>
            </LinearGradient>

            <View style={styles.listContainer}>
                {!loading && availableMonths.length > 0 && renderMonthSelector()}
                
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.accent} />
                        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando historial...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredHistory.slice(0, displayLimit)}
                        keyExtractor={(item) => item._id}
                        renderItem={renderItem}
                        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
                        showsVerticalScrollIndicator={false}
                        removeClippedSubviews={true}
                        initialNumToRender={3}
                        maxToRenderPerBatch={3}
                        windowSize={5}
                        ListFooterComponent={renderFooter}
                        ListEmptyComponent={() => {
                                const isFiltered = !!selectedMonth;
                                return (
                                    <View style={styles.emptyContainer}>
                                        <Ionicons
                                            name={isFiltered ? 'calendar-outline' : 'car-outline'}
                                            size={72}
                                            color={theme.textSecondary + '35'}
                                        />
                                        <Text style={[styles.emptyTitle, { color: theme.text }]}>
                                            {isFiltered ? 'Sin viajes en este período' : '¡Aún no tienes viajes!'}
                                        </Text>
                                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                            {isFiltered
                                                ? 'No encontramos viajes para la fecha seleccionada. Prueba con otro filtro.'
                                                : 'Cuando realices tu primer viaje con SafeRide, aparecerá aquí tu historial.'}
                                        </Text>
                                    </View>
                                );
                            }}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />
                        }
                    />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: 25,
        paddingBottom: 45,
        borderBottomLeftRadius: 35,
        borderBottomRightRadius: 35,
    },
    headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
    headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
    listContainer: { flex: 1, marginTop: -25 },
    listContent: { paddingHorizontal: 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
    loadingText: { marginTop: 10 },
    selectorWrapper: { paddingHorizontal: 20, marginBottom: 15, marginTop: 10 },
    selectorButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        gap: 12,
        elevation: 2,
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    selectorLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '80%', paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalBody: { padding: 16 },
    monthOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, marginBottom: 8 },
    optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    optionText: { fontSize: 16, fontWeight: '600' },
    sectionDivider: { height: 1, marginVertical: 16, opacity: 0.1 },
    sectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 12, marginLeft: 8, letterSpacing: 1 },
    historyCard: { borderRadius: 24, padding: 16, marginBottom: 20, borderWidth: 1, elevation: 6, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dateBlock: { width: 54, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    dateDay: { fontSize: 20, fontWeight: 'bold' },
    dateMonth: { fontSize: 10, fontWeight: '600' },
    statusCol: { gap: 4 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
    statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    timeText: { fontSize: 12, fontWeight: '600' },
    priceText: { fontSize: 20, fontWeight: 'bold' },
    mapSection: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
    mapSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
    mapSectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    mapContainer: { height: 110, overflow: 'hidden' },
    map: { ...StyleSheet.absoluteFillObject },
    markerIcon: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    markerInner: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
    routeContainer: { padding: 12, borderRadius: 16, gap: 2, marginBottom: 16 },
    routePoint: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    routeValue: { flex: 1, fontSize: 13, fontWeight: '600' },
    routeConnector: { width: 1.5, height: 8, marginLeft: 6, marginVertical: 2 },
    cardFooter: { paddingTop: 12, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    driverInfoMain: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    avatarMini: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
    driverNameText: { fontSize: 14, fontWeight: 'bold' },
    seatsInfoMini: { fontSize: 11 },
    contactActions: { flexDirection: 'row', gap: 8 },
    contactBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
    loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', marginTop: 10, marginBottom: 30, gap: 8 },
    loadMoreText: { fontSize: 15, fontWeight: 'bold' },
    emptyContainer: { marginTop: 80, alignItems: 'center', paddingHorizontal: 40, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
    emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});

export default History;
