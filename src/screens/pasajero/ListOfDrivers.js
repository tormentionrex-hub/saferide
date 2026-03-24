import React, { useMemo, useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import api from '../../services/api';

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
    const rating = item.driver_id?.rating ?? null;
    const originName = item.origin?.name || 'Origen';
    const destName = item.destination?.name || 'Destino';
    const date = item.fecha || null;
    const time = item.hora || null;
    const price = item.price != null ? `₡${item.price.toLocaleString()}` : null;
    const seats = item.available_seats ?? null;

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
    const insets = useSafeAreaInsets();
    const si = useScrollIndicator();

    // Si vienen de búsqueda, usamos esos rides. Si no, cargamos todos.
    const initialRides = route.params?.rides;
    const [ridesData, setRidesData] = useState(initialRides || []);
    const [loading, setLoading] = useState(!initialRides);

    const searchTime = route.params?.searchTime ? new Date(route.params.searchTime) : new Date();
    const searchOrigin = route.params?.searchOrigin;
    const searchDestination = route.params?.searchDestination;

    useEffect(() => {
        // Solo cargar si no se pasaron rides por parámetros
        if (!initialRides) {
            fetchRides();
        }
    }, [initialRides]);

    const fetchRides = async () => {
        setLoading(true);
        try {
            const response = await api.get('/rides');
            if (response.data.success) {
                setRidesData(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching rides:', error);
        } finally {
            setLoading(false);
        }
    };

    // ── Filtrado y Ordenamiento ──────────────────────────────────────────────
    const processedRides = useMemo(() => {
        let filtered = ridesData.filter(ride => {
            if (!ride.fecha || !ride.hora) return false;

            // Si venimos de una búsqueda, verificamos proximidad (5km de margen como extra)
            if (searchOrigin) {
                // 1. Filtrado por cercanía al origen (máximo 2km de distancia)
                const distO = getHaversineDistance(
                    searchOrigin.lat, searchOrigin.lng,
                    ride.origin.coordinates.lat, ride.origin.coordinates.lng
                );
                if (distO > 2) return false;

                // 2. Filtrado por cercanía al destino (máximo 2km de distancia)
                if (searchDestination) {
                    const distD = getHaversineDistance(
                        searchDestination.lat, searchDestination.lng,
                        ride.destination.coordinates.lat, ride.destination.coordinates.lng
                    );
                    if (distD > 2) return false;
                }

                // 3. Ventana de tiempo (30 minutos antes hasta 3 horas después)
                // Usamos la cadena de fecha/hora con el offset -06:00 para asegurar la comparación en Costa Rica
                const rideDate = new Date(`${ride.fecha}T${ride.hora}:00-06:00`);

                const diffMs = rideDate.getTime() - searchTime.getTime();
                const diffHrs = diffMs / (1000 * 60 * 60);

                // Solo permitimos viajes que ocurran entre T-30m y T+3h respecto al momento actual
                return diffHrs >= -0.5 && diffHrs <= 3;
            }
            return true;
        });

        // 2. Ordenar
        if (searchOrigin && searchDestination) {
            // Ordenar por suma de distancias (origen + destino) para encontrar el que mejor cuadre con la ruta completa
            filtered.sort((a, b) => {
                const distA_O = getHaversineDistance(
                    searchOrigin.lat, searchOrigin.lng,
                    a.origin.coordinates.lat, a.origin.coordinates.lng
                );
                const distA_D = getHaversineDistance(
                    searchDestination.lat, searchDestination.lng,
                    a.destination.coordinates.lat, a.destination.coordinates.lng
                );
                const distB_O = getHaversineDistance(
                    searchOrigin.lat, searchOrigin.lng,
                    b.origin.coordinates.lat, b.origin.coordinates.lng
                );
                const distB_D = getHaversineDistance(
                    searchDestination.lat, searchDestination.lng,
                    b.destination.coordinates.lat, b.destination.coordinates.lng
                );
                return (distA_O + distA_D) - (distB_O + distB_D);
            });
        } else if (searchOrigin) {
            filtered.sort((a, b) => {
                const distA = getHaversineDistance(
                    searchOrigin.lat, searchOrigin.lng,
                    a.origin.coordinates.lat, a.origin.coordinates.lng
                );
                const distB = getHaversineDistance(
                    searchOrigin.lat, searchOrigin.lng,
                    b.origin.coordinates.lat, b.origin.coordinates.lng
                );
                return distA - distB;
            });
        } else {
            // Ordenar por fecha y hora si es listado general
            filtered.sort((a, b) => {
                const dateA = new Date(`${a.fecha}T${a.hora}:00`);
                const dateB = new Date(`${b.fecha}T${b.hora}:00`);
                return dateA - dateB;
            });
        }
        return filtered;
    }, [ridesData, searchTime, searchOrigin, searchDestination]);

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
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Viajes Disponibles</Text>
                    {processedRides.length > 0 && (
                        <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
                            {processedRides.length} {processedRides.length === 1 ? 'viaje encontrado' : 'viajes encontrados'}
                        </Text>
                    )}
                </View>
                <View style={{ width: 40 }} />
            </View>
            {searchOrigin && searchDestination && (
                <View style={[styles.routeSummary, { backgroundColor: theme.surface, borderBottomColor: theme.divider }]}>
                    <View style={styles.routeSummaryRow}>
                        <Ionicons name="radio-button-on" size={14} color={theme.accent} />
                        <Text style={[styles.routeSummaryText, { color: theme.text }]} numberOfLines={1}>{searchOrigin.name}</Text>
                    </View>
                    <Ionicons name="ellipsis-vertical" size={10} color={theme.textSecondary} style={{ marginLeft: 2 }} />
                    <View style={styles.routeSummaryRow}>
                        <Ionicons name="location" size={14} color="#FF5A5F" />
                        <Text style={[styles.routeSummaryText, { color: theme.text }]} numberOfLines={1}>{searchDestination.name}</Text>
                    </View>
                </View>
            )}

            {/* ── CONTENIDO ── */}
            {loading ? (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator size="large" color={theme.accent} />
                </View>
            ) : processedRides.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIconCircle, { backgroundColor: theme.surfaceVariant }]}>
                        <Ionicons name="car-outline" size={48} color={theme.textSecondary} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin viajes disponibles</Text>
                    <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                        {searchOrigin
                            ? `No encontramos conductores para tu ruta entre ${searchOrigin.name} y ${searchDestination?.name || 'tu destino'}.`
                            : "No hay viajes programados por ahora."}
                    </Text>
                    <TouchableOpacity
                        style={[styles.retryBtn, { backgroundColor: theme.accent }]}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="arrow-back" size={16} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.retryBtnText}>Volver</Text>
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
                        onRefresh={initialRides ? undefined : fetchRides}
                        refreshing={loading}
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
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontFamily: 'Poppins-Bold' },
    headerSub: { fontSize: 12, fontFamily: 'Poppins-Regular', marginTop: 1 },

    // Lista
    listWrapper: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingTop: 20 },

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
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
    avatar: {
        width: 46, height: 46, borderRadius: 23,
        justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { fontSize: 16, fontFamily: 'Poppins-Bold' },
    driverName: { fontSize: 15, fontFamily: 'Poppins-Bold' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    ratingText: { fontSize: 12, fontFamily: 'Poppins-Regular' },
    price: { fontSize: 16, fontFamily: 'Poppins-Bold' },

    routeBox: { borderRadius: 12, padding: 12, marginBottom: 12 },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    routeDivider: { height: 1, marginVertical: 8, marginLeft: 22 },
    routeText: { flex: 1, fontSize: 13, fontFamily: 'Poppins-Regular' },

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
    emptyTitle: { fontSize: 20, fontFamily: 'Poppins-Bold', marginBottom: 10, textAlign: 'center' },
    emptySubtitle: { fontSize: 14, fontFamily: 'Poppins-Regular', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    retryBtn: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 14,
        borderRadius: 14,
    },
    retryBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Poppins-Bold' },

    // Resumen de ruta
    routeSummary: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    routeSummaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    routeSummaryText: {
        fontSize: 13,
        fontFamily: 'Poppins-Medium',
        flex: 1,
    },
});

export default ListOfDrivers;
