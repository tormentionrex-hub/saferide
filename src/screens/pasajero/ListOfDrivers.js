import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    StatusBar, Platform, ActivityIndicator, Image, Modal, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import ScreenHeader from '../../components/ScreenHeader';
import api from '../../services/api';
import sessionCache from '../../services/sessionCache';

import { moderateScale } from '../../utils/responsive';
// ── Utilidad de Distancia Haversine ──────────────────────────────────────────
const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// ── Distancia de un punto al segmento de ruta del conductor ──────────────────
// Devuelve la distancia mínima en km desde el punto (px,py) hasta el segmento
// formado por los puntos A(ax,ay) y B(bx,by).
const pointToSegmentDistance = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) return getHaversineDistance(px, py, ax, ay);
    const t = Math.max(0, Math.min(1,
        ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    ));
    return getHaversineDistance(px, py, ax + t * dx, ay + t * dy);
};

// ── Parámetro t de proyección del punto sobre el segmento (0=inicio, 1=fin) ──
const projectionT = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) return 0;
    return Math.max(0, Math.min(1,
        ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    ));
};

// ── Tarjeta de conductor ──────────────────────────────────────────────────────
// Memoizada: evita re-renderizar todas las tarjetas cuando el padre re-renderiza
// (ej. cambio de loading, modal de imagen abierto, etc.). Solo cambia cuando
// cambia el id del ride o el theme.dark (que afecta colores).
const DriverCard = React.memo(({ item, onPress, onImagePress, theme }) => {
    const driverName = item.driver_id?.name || 'Conductor Desconocido';
    const rating = item.driver_id?.rating ?? null;
    const originName = item.origin?.name || 'Origen';
    const destName = item.destination?.name || 'Destino';
    const date = item.fecha || null;
    const time = item.hora || null;
    const price = item.suggested_price != null ? `₡${item.suggested_price.toLocaleString()}` : null;
    const seats = item.available_seats ?? null;

    const initials = driverName
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    const profileImage = item.driver_id?.profileImage;
    const defaultAvatar = 'https://res.cloudinary.com/do2ccwxm3/image/upload/v1/assets/default-avatar.png';

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => onPress(item)}
            activeOpacity={0.85}
        >
            {/* Cabecera: avatar + nombre + rating */}
            <View style={styles.cardHeader}>
                <TouchableOpacity 
                    activeOpacity={0.8}
                    onPress={() => profileImage && onImagePress && onImagePress(profileImage)}
                >
                    {profileImage ? (
                        <Image source={{ uri: profileImage }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, { backgroundColor: theme.accent + '22', justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={[styles.avatarText, { color: theme.accent }]}>{initials}</Text>
                        </View>
                    )}
                </TouchableOpacity>
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
}, (prev, next) =>
    prev.item._id === next.item._id &&
    prev.item.available_seats === next.item.available_seats &&
    prev.theme.dark === next.theme.dark
);

// ── Pantalla principal ────────────────────────────────────────────────────────
const ListOfDrivers = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const insets = useSafeAreaInsets();
    const si = useScrollIndicator();

    // Si vienen de búsqueda, usamos esos rides. Si no, cargamos todos.
    const initialRides = route.params?.rides;
    const [ridesData, setRidesData] = useState(initialRides || []);
    const [loading, setLoading] = useState(!initialRides);
    const [selectedImage, setSelectedImage] = useState(null);

    // Estabilizar searchTime para que no se reinstancie en cada render
    // (afecta a la dependency list del useMemo de filtrado).
    const searchTime = useMemo(
        () => (route.params?.searchTime ? new Date(route.params.searchTime) : new Date()),
        [route.params?.searchTime]
    );
    const searchOrigin = route.params?.searchOrigin;
    const searchDestination = route.params?.searchDestination;

    const fetchRides = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/rides');
            if (response.data.success) {
                setRidesData(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching rides:', error?.response?.data?.message || error?.message || 'unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Solo cargar si no se pasaron rides por parámetros
        if (!initialRides) {
            fetchRides();
        }
    }, [initialRides, fetchRides]);

    // ── Filtrado y Ordenamiento ──────────────────────────────────────────────
    const processedRides = useMemo(() => {
        let filtered = ridesData.filter(ride => {
            if (!ride.fecha || !ride.hora) return false;

            if (searchOrigin) {
                const oLat = ride.origin.coordinates.lat;
                const oLng = ride.origin.coordinates.lng;
                const dLat = ride.destination.coordinates.lat;
                const dLng = ride.destination.coordinates.lng;

                // 1. Origen del pasajero debe estar a ≤5km del segmento de ruta del conductor
                const distO = pointToSegmentDistance(
                    searchOrigin.lat, searchOrigin.lng,
                    oLat, oLng, dLat, dLng
                );
                if (distO > 5) return false;

                if (searchDestination) {
                    // 2. Destino del pasajero debe estar a ≤5km del segmento de ruta
                    const distD = pointToSegmentDistance(
                        searchDestination.lat, searchDestination.lng,
                        oLat, oLng, dLat, dLng
                    );
                    if (distD > 5) return false;

                    // 3. Check de dirección: el origen del pasajero debe proyectarse
                    // antes que su destino a lo largo de la ruta del conductor
                    const tO = projectionT(searchOrigin.lat, searchOrigin.lng, oLat, oLng, dLat, dLng);
                    const tD = projectionT(searchDestination.lat, searchDestination.lng, oLat, oLng, dLat, dLng);
                    if (tO >= tD) return false;
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

        // 2. Ordenar por proximidad al segmento de ruta
        if (searchOrigin && searchDestination) {
            filtered.sort((a, b) => {
                const segA = [a.origin.coordinates.lat, a.origin.coordinates.lng, a.destination.coordinates.lat, a.destination.coordinates.lng];
                const segB = [b.origin.coordinates.lat, b.origin.coordinates.lng, b.destination.coordinates.lat, b.destination.coordinates.lng];
                const scoreA = pointToSegmentDistance(searchOrigin.lat, searchOrigin.lng, ...segA)
                             + pointToSegmentDistance(searchDestination.lat, searchDestination.lng, ...segA);
                const scoreB = pointToSegmentDistance(searchOrigin.lat, searchOrigin.lng, ...segB)
                             + pointToSegmentDistance(searchDestination.lat, searchDestination.lng, ...segB);
                return scoreA - scoreB;
            });
        } else if (searchOrigin) {
            filtered.sort((a, b) => {
                const distA = pointToSegmentDistance(searchOrigin.lat, searchOrigin.lng, a.origin.coordinates.lat, a.origin.coordinates.lng, a.destination.coordinates.lat, a.destination.coordinates.lng);
                const distB = pointToSegmentDistance(searchOrigin.lat, searchOrigin.lng, b.origin.coordinates.lat, b.origin.coordinates.lng, b.destination.coordinates.lat, b.destination.coordinates.lng);
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

    const handleRideSelection = useCallback(async (ride) => {
        try {
            const passengerId = await sessionCache.getPassengerId();
            if (passengerId) {
                const bookingsRes = await api.get(`/bookings/passenger/${passengerId}`);
                if (bookingsRes.data.success) {
                    const activeBooking = bookingsRes.data.data.find(b =>
                        b.status === 'pending' || b.status === 'confirmed'
                    );
                    if (activeBooking) {
                        Alert.alert(
                            'Reservación activa',
                            'Ya tienes una solicitud pendiente o confirmada. Debes completarla o cancelarla antes de buscar otro viaje.'
                        );
                        return;
                    }
                }
            }
            navigation.navigate('RideDetail', { ride, searchOrigin, searchDestination });
        } catch (error) {
            console.error('Error verificando estado del pasajero:', error?.response?.data?.message || error?.message || 'unknown error');
            // Si hay error en la validación, permitimos pasar al detalle pero fallará al intentar reservar
            navigation.navigate('RideDetail', { ride, searchOrigin, searchDestination });
        }
    }, [navigation, searchOrigin, searchDestination]);

    const handleImagePress = useCallback((img) => setSelectedImage(img), []);

    const keyExtractor = useCallback(
        (item, index) => (item._id ? item._id.toString() : `ride-${index}`),
        []
    );

    const renderItem = useCallback(
        ({ item }) => (
            <DriverCard
                item={item}
                onPress={handleRideSelection}
                onImagePress={handleImagePress}
                theme={theme}
            />
        ),
        [handleRideSelection, handleImagePress, theme]
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

            <ScreenHeader
                title="Viajes Disponibles"
                subtitle={
                    processedRides.length > 0
                        ? `${processedRides.length} ${processedRides.length === 1 ? 'viaje encontrado' : 'viajes encontrados'}`
                        : undefined
                }
                onBack={() => navigation.goBack()}
                useInsets
                right={
                    <TouchableOpacity onPress={fetchRides} activeOpacity={0.7} disabled={loading}>
                        <Ionicons name="refresh" size={24} color={theme.text} />
                    </TouchableOpacity>
                }
            />
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
                        keyExtractor={keyExtractor}
                        renderItem={renderItem}
                        contentContainerStyle={[
                            styles.listContent,
                            { paddingBottom: insets.bottom + 100 },
                        ]}
                        showsVerticalScrollIndicator={false}
                        {...si.scrollProps}
                        onRefresh={initialRides ? undefined : fetchRides}
                        refreshing={loading}
                        removeClippedSubviews
                        initialNumToRender={6}
                        maxToRenderPerBatch={4}
                        windowSize={7}
                    />
                    <ScrollIndicator si={si} thumbColor={theme.accent} />
                </View>
            )}

            {/* ── MODAL VISOR DE IMAGEN ── */}
            <Modal transparent visible={!!selectedImage} animationType="fade" onRequestClose={() => setSelectedImage(null)}>
                <View style={styles.imageViewerOverlay}>
                    <TouchableOpacity style={styles.imageViewerClose} onPress={() => setSelectedImage(null)}>
                        <Ionicons name="close" size={30} color="#fff" />
                    </TouchableOpacity>
                    {selectedImage && (
                        <Image source={{ uri: selectedImage }} style={styles.imageViewerImage} resizeMode="contain" />
                    )}
                </View>
            </Modal>
        </View>
    );
};

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },
    imageViewerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageViewerClose: {
        position: 'absolute',
        top: 50,
        right: 20,
        padding: 10,
        zIndex: 10,
    },
    imageViewerImage: {
        width: '90%',
        height: '70%',
        borderRadius: 20,
    },


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
    avatarText: { fontSize: moderateScale(16), fontFamily: 'Poppins-Bold' },
    driverName: { fontSize: moderateScale(15), fontFamily: 'Poppins-Bold' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    ratingText: { fontSize: moderateScale(12), fontFamily: 'Poppins-Regular' },
    price: { fontSize: moderateScale(16), fontFamily: 'Poppins-Bold' },

    routeBox: { borderRadius: 12, padding: 12, marginBottom: 12 },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    routeDivider: { height: 1, marginVertical: 8, marginLeft: 22 },
    routeText: { flex: 1, fontSize: moderateScale(13), fontFamily: 'Poppins-Regular' },

    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    footerChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    footerChipText: { fontSize: moderateScale(12), fontFamily: 'Poppins-Regular' },
    verBtn: {
        marginLeft: 'auto', flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, gap: 2,
    },
    verBtnText: { color: '#fff', fontSize: moderateScale(13), fontFamily: 'Poppins-Bold' },

    // Estado vacío
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    emptyIconCircle: {
        width: 100, height: 100, borderRadius: 50,
        justifyContent: 'center', alignItems: 'center', marginBottom: 24,
    },
    emptyTitle: { fontSize: moderateScale(20), fontFamily: 'Poppins-Bold', marginBottom: 10, textAlign: 'center' },
    emptySubtitle: { fontSize: moderateScale(14), fontFamily: 'Poppins-Regular', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    retryBtn: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 14,
        borderRadius: 14,
    },
    retryBtnText: { color: '#fff', fontSize: moderateScale(15), fontFamily: 'Poppins-Bold' },

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
        fontSize: moderateScale(13),
        fontFamily: 'Poppins-Medium',
        flex: 1,
    },
});

export default ListOfDrivers;
