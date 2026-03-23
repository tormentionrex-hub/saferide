import React, { useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    StatusBar, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';

// ── Utilidad de Distancia Haversine ──────────────────────────────────────────
const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// ── Tarjeta de conductor ──────────────────────────────────────────────────────
const DriverCard = ({ item, onPress, theme }) => {
    const driverName = item.driver_id?.name || 'Conductor Desconocido';
    const rating     = item.driver_id?.rating ?? null;
    const originName = item.origin?.name      || 'Origen';
    const destName   = item.destination?.name || 'Destino';
    const date       = item.fecha || null;
    const time       = item.hora || null;
    const price      = item.price != null ? `₡${item.price.toLocaleString()}` : null;
    const seats      = item.available_seats ?? null;

    const initials = driverName
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => onPress(item)}
            activeOpacity={0.85}
        >
            {/* Cabecera: avatar + nombre + rating */}
            <View style={styles.cardHeader}>
                <View style={[styles.avatar, { backgroundColor: theme.accent + '22' }]}>
                    <Text style={[styles.avatarText, { color: theme.accent }]}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.driverName, { color: theme.text }]} numberOfLines={1}>
                        {driverName}
                    </Text>
                    {rating !== null && (
                        <View style={styles.ratingRow}>
                            <Ionicons name="star" size={13} color="#F4A433" />
                            <Text style={[styles.ratingText, { color: theme.textSecondary }]}>
                                {Number(rating).toFixed(1)}
                            </Text>
                        </View>
                    )}
                </View>
                {price && (
                    <Text style={[styles.price, { color: theme.accent }]}>{price}</Text>
                )}
            </View>

            {/* Ruta */}
            <View style={[styles.routeBox, { backgroundColor: theme.surfaceVariant }]}>
                <View style={styles.routeRow}>
                    <Ionicons name="radio-button-on" size={14} color={theme.accent} />
                    <Text style={[styles.routeText, { color: theme.text }]} numberOfLines={1}>
                        {originName}
                    </Text>
                </View>
                <View style={[styles.routeDivider, { backgroundColor: theme.divider }]} />
                <View style={styles.routeRow}>
                    <Ionicons name="location" size={14} color="#FF5A5F" />
                    <Text style={[styles.routeText, { color: theme.text }]} numberOfLines={1}>
                        {destName}
                    </Text>
                </View>
            </View>

            {/* Footer: fecha + asientos */}
            <View style={styles.cardFooter}>
                {date && (
                    <View style={styles.footerChip}>
                        <Ionicons name="calendar-outline" size={13} color={theme.textSecondary} />
                        <Text style={[styles.footerChipText, { color: theme.textSecondary }]}>{date}</Text>
                    </View>
                )}
                {time && (
                    <View style={styles.footerChip}>
                        <Ionicons name="time-outline" size={13} color={theme.textSecondary} />
                        <Text style={[styles.footerChipText, { color: theme.textSecondary }]}>{time}</Text>
                    </View>
                )}
                {seats !== null && (
                    <View style={styles.footerChip}>
                        <Ionicons name="people-outline" size={13} color={theme.textSecondary} />
                        <Text style={[styles.footerChipText, { color: theme.textSecondary }]}>
                            {seats} {seats === 1 ? 'asiento' : 'asientos'}
                        </Text>
                    </View>
                )}
                <View style={[styles.verBtn, { backgroundColor: theme.accent }]}>
                    <Text style={styles.verBtnText}>Ver</Text>
                    <Ionicons name="chevron-forward" size={13} color="#fff" />
                </View>
            </View>
        </TouchableOpacity>
    );
};

// ── Pantalla principal ────────────────────────────────────────────────────────
const ListOfDrivers = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const insets    = useSafeAreaInsets();
    const si        = useScrollIndicator();
    const rides     = route.params?.rides || [];
    const searchTime = route.params?.searchTime ? new Date(route.params.searchTime) : new Date();
    const searchLoc  = route.params?.searchLocation;

    // ── Filtrado y Ordenamiento ──────────────────────────────────────────────
    const processedRides = useMemo(() => {
        // 1. Filtrar por ventana de tiempo: [searchTime - 1h, searchTime + 4h]
        let filtered = rides.filter(ride => {
            if (!ride.fecha || !ride.hora) return false;
            // Parse robustly using components to avoid timezone offsets on "plano" strings
            const [y, m, d] = ride.fecha.split('-').map(Number);
            const [h, mm] = ride.hora.split(':').map(Number);
            const rideDate = new Date(y, m - 1, d, h, mm, 0);
            
            const diffMs = rideDate.getTime() - searchTime.getTime();
            const diffHrs = diffMs / (1000 * 60 * 60);
            return diffHrs >= -1 && diffHrs <= 4;
        });

        // 2. Ordenar por cercanía al origen de búsqueda
        if (searchLoc) {
            filtered.sort((a, b) => {
                const distA = getHaversineDistance(
                    searchLoc.lat, searchLoc.lng,
                    a.origin.coordinates.lat, a.origin.coordinates.lng
                );
                const distB = getHaversineDistance(
                    searchLoc.lat, searchLoc.lng,
                    b.origin.coordinates.lat, b.origin.coordinates.lng
                );
                return distA - distB;
            });
        }
        return filtered;
    }, [rides, searchTime, searchLoc]);

    const handleRideSelection = (ride) => {
        navigation.navigate('RideDetail', { ride });
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

            {/* ── HEADER ── */}
            <View style={[
                styles.header,
                {
                    paddingTop: insets.top > 0 ? insets.top : Platform.OS === 'android' ? 20 : 16,
                    borderBottomColor: theme.divider,
                    backgroundColor: theme.bg,
                },
            ]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Conductores</Text>
                    {rides.length > 0 && (
                        <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
                            {rides.length} {rides.length === 1 ? 'viaje encontrado' : 'viajes encontrados'}
                        </Text>
                    )}
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* ── CONTENIDO ── */}
            {rides.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIconCircle, { backgroundColor: theme.surfaceVariant }]}>
                        <Ionicons name="car-outline" size={48} color={theme.textSecondary} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin viajes disponibles</Text>
                    <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                        No encontramos conductores para tu ruta.{'\n'}Intenta con otra fecha o destino.
                    </Text>
                    <TouchableOpacity
                        style={[styles.retryBtn, { backgroundColor: theme.accent }]}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="arrow-back" size={16} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.retryBtnText}>Volver a buscar</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.listWrapper}>
                    <FlatList
                        data={processedRides}
                        keyExtractor={(item) => item._id?.toString() ?? Math.random().toString()}
                        renderItem={({ item }) => (
                            <DriverCard item={item} onPress={handleRideSelection} theme={theme} />
                        )}
                        contentContainerStyle={[
                            styles.listContent,
                            { paddingBottom: insets.bottom + 100 },
                        ]}
                        showsVerticalScrollIndicator={false}
                        {...si.scrollProps}
                    />
                    <ScrollIndicator si={si} thumbColor={theme.accent} />
                </View>
            )}
        </View>
    );
};

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    backBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontFamily: 'Poppins-Bold' },
    headerSub:   { fontSize: 12, fontFamily: 'Poppins-Regular', marginTop: 1 },

    // Lista
    listWrapper:  { flex: 1 },
    listContent:  { paddingHorizontal: 16, paddingTop: 20 },

    // Tarjeta
    card: {
        borderRadius: 18,
        borderWidth: 1,
        padding: 16,
        marginBottom: 14,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
    },
    cardHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
    avatar: {
        width: 46, height: 46, borderRadius: 23,
        justifyContent: 'center', alignItems: 'center',
    },
    avatarText:   { fontSize: 16, fontFamily: 'Poppins-Bold' },
    driverName:   { fontSize: 15, fontFamily: 'Poppins-Bold' },
    ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    ratingText:   { fontSize: 12, fontFamily: 'Poppins-Regular' },
    price:        { fontSize: 16, fontFamily: 'Poppins-Bold' },

    routeBox:   { borderRadius: 12, padding: 12, marginBottom: 12 },
    routeRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
    routeDivider: { height: 1, marginVertical: 8, marginLeft: 22 },
    routeText:  { flex: 1, fontSize: 13, fontFamily: 'Poppins-Regular' },

    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    footerChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    footerChipText: { fontSize: 12, fontFamily: 'Poppins-Regular' },
    verBtn: {
        marginLeft: 'auto', flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, gap: 2,
    },
    verBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Poppins-Bold' },

    // Estado vacío
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    emptyIconCircle: {
        width: 100, height: 100, borderRadius: 50,
        justifyContent: 'center', alignItems: 'center', marginBottom: 24,
    },
    emptyTitle:    { fontSize: 20, fontFamily: 'Poppins-Bold', marginBottom: 10, textAlign: 'center' },
    emptySubtitle: { fontSize: 14, fontFamily: 'Poppins-Regular', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    retryBtn: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 14,
        borderRadius: 14,
    },
    retryBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Poppins-Bold' },
});

export default ListOfDrivers;
