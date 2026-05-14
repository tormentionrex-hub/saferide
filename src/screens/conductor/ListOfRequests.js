import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
    ActivityIndicator, SafeAreaView, StatusBar, Alert, Platform, Modal, Animated, Dimensions, ScrollView
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import sessionCache from '../../services/sessionCache';
import { useDriverTheme } from '../../context/DriverThemeContext';
import BottomNavigationDriver from '../../components/BottomNavigationDriver';
import TripCompletedOverlay from '../../components/TripCompletedOverlay';
import { darkMapStyle } from '../../utils/mapStyle';

/* ─── Modal de inicio de viaje ───────────────────────────────────── */
const StartRideModal = ({ visible, onClose, onConfirm, loading, confirmedCount, theme }) => {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0.85);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <Animated.View style={[modalStyles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }], backgroundColor: theme.surface }]}>
                    
                    {/* Icono central animado/destacado */}
                    <View style={[modalStyles.iconCircle, { backgroundColor: theme.surfaceVariant }]}>
                        <Ionicons name="car-sport" size={44} color={theme.navActive} />
                    </View>

                    {/* Título y subtítulo */}
                    <Text style={[modalStyles.title, { color: theme.text }]}>¿Iniciar viaje ahora?</Text>
                    <Text style={[modalStyles.subtitle, { color: theme.textSecondary }]}>
                        Al iniciar, notificaremos a los pasajeros que estás en camino.
                    </Text>

                    {/* Información del viaje */}
                    <View style={[modalStyles.infoBox, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
                        <View style={modalStyles.infoRow}>
                            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            <Text style={[modalStyles.infoText, { color: theme.text }]}>
                                {confirmedCount} pasajeros confirmados
                            </Text>
                        </View>
                        <View style={modalStyles.infoRow}>
                            <Ionicons name="map-outline" size={18} color={theme.textSecondary} />
                            <Text style={[modalStyles.infoText, { color: theme.text }]}>La ruta se mostrará en el mapa</Text>
                        </View>
                    </View>

                    <Text style={modalStyles.warningText}>
                        Asegúrate de que todos los pasajeros estén a bordo antes de continuar.
                    </Text>

                    {/* Botones */}
                    <View style={modalStyles.buttonContainer}>
                        <TouchableOpacity 
                            style={[modalStyles.confirmBtn, loading && modalStyles.btnDisabled]} 
                            onPress={onConfirm}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Text style={modalStyles.confirmBtnText}>Sí, iniciar viaje</Text>
                                    <Ionicons name="play" size={18} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose} disabled={loading}>
                            <Text style={[modalStyles.cancelBtnText, { color: theme.textSecondary }]}>Aún no, volver</Text>
                        </TouchableOpacity>
                    </View>

                </Animated.View>
            </View>
        </Modal>
    );
};

/* ─── Modal de Pasajero retiró solicitud ─────────────────────────── */
const WithdrawalModal = ({ visible, onClose, theme }) => {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0.85);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <Animated.View style={[modalStyles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }], backgroundColor: theme.surface }]}>
                    <View style={[modalStyles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
                        <Ionicons name="person-remove" size={50} color="#EF4444" />
                    </View>
                    <Text style={[modalStyles.title, { color: theme.text }]}>Solicitud Cancelada</Text>
                    <Text style={[modalStyles.subtitle, { color: theme.textSecondary }]}>
                        Un pasajero ha cancelado su reservación para este viaje. Los asientos correspondientes se han liberado automáticamente.
                    </Text>
                    <TouchableOpacity 
                        style={[modalStyles.confirmBtn, { backgroundColor: '#EF4444', width: '100%' }]} 
                        onPress={onClose}
                    >
                        <Text style={modalStyles.confirmBtnText}>Entendido</Text>
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

/* ─── Modal de Éxito al Aceptar ──────────────────────────────────── */
const SuccessModal = ({ visible, onClose, theme }) => {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0.85);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <Animated.View style={[modalStyles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }], backgroundColor: theme.surface }]}>
                    <View style={[modalStyles.iconCircle, { backgroundColor: '#D1FAE5' }]}>
                        <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                    </View>
                    <Text style={[modalStyles.title, { color: theme.text }]}>¡Pasajero Aceptado!</Text>
                    <Text style={[modalStyles.subtitle, { color: theme.textSecondary }]}>
                        Has aceptado la solicitud exitosamente.
                    </Text>
                    <TouchableOpacity 
                        style={[modalStyles.confirmBtn, { backgroundColor: '#10B981', width: '100%', borderRadius: 16 }]} 
                        onPress={onClose}
                    >
                        <Text style={modalStyles.confirmBtnText}>Genial</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

/* ─── Modal de Éxito al Rechazar ─────────────────────────────────── */
const DenySuccessModal = ({ visible, onClose, theme }) => {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0.85);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <Animated.View style={[modalStyles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }], backgroundColor: theme.surface }]}>
                    <View style={[modalStyles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
                        <Ionicons name="close-circle" size={48} color="#EF4444" />
                    </View>
                    <Text style={[modalStyles.title, { color: theme.text }]}>¡Solicitud Rechazada!</Text>
                    <Text style={[modalStyles.subtitle, { color: theme.textSecondary }]}>
                        Has rechazado la solicitud exitosamente. Se ha enviado una notificación al pasajero informándole de tu decisión.
                    </Text>
                    <TouchableOpacity 
                        style={[modalStyles.confirmBtn, { backgroundColor: '#EF4444', width: '100%', borderRadius: 16 }]} 
                        onPress={onClose}
                    >
                        <Text style={modalStyles.confirmBtnText}>Entendido</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

/* ─── Modal de Cancelar Viaje ───────────────────────────────────── */
const CancelRideModal = ({ visible, onClose, onConfirm, loading, theme }) => {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0.85);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={modalStyles.overlay}>
                <Animated.View style={[modalStyles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }], backgroundColor: theme?.surface || '#fff' }]}>
                    <View style={[modalStyles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
                        <Ionicons name="warning" size={44} color="#EF4444" />
                    </View>
                    <Text style={[modalStyles.title, { color: theme?.text || '#111827' }]}>¿Cancelar el viaje?</Text>
                    <Text style={[modalStyles.subtitle, { color: theme?.textSecondary || '#6B7280' }]}>
                        Esta acción cancelará el viaje completo y notificará a todos los pasajeros confirmados. No se puede deshacer.
                    </Text>
                    <View style={modalStyles.buttonContainer}>
                        <TouchableOpacity
                            style={[modalStyles.confirmBtn, { backgroundColor: '#EF4444' }, loading && modalStyles.btnDisabled]}
                            onPress={onConfirm}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Text style={modalStyles.confirmBtnText}>Sí, cancelar viaje</Text>
                                    <Ionicons name="trash-outline" size={18} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose} disabled={loading}>
                            <Text style={modalStyles.cancelBtnText}>Volver atrás</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ─── Avatar del pasajero con fallback correcto ante URL rota ───── */
const PassengerAvatar = ({ profileImage, passengerId, style }) => {
    const [imgError, setImgError] = useState(false);
    const uri = (!imgError && profileImage)
        ? profileImage
        : `https://i.pravatar.cc/150?u=${passengerId || 'default'}`;
    return (
        <Image
            source={{ uri }}
            style={style}
            onError={() => setImgError(true)}
        />
    );
};

/* ─── Modal de Detalle del Pasajero ──────────────────────────────── */
const PassengerDetailModal = ({ visible, onClose, booking, rideData, theme }) => {
    const scaleAnim = useRef(new Animated.Value(0.92)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const mapRef = useRef(null);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 10 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0.92);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    if (!booking) return null;

    const passenger = booking.passenger_id || {};
    const passengerRating = passenger.rating ?? 0;
    const fullStars = Math.floor(passengerRating);
    const hasHalf = passengerRating - fullStars >= 0.5;

    // Coordenadas del pasajero (guardadas al crear el booking)
    // Fallback a las coordenadas del ride para bookings anteriores
    const passengerOriginCoords = booking?.passenger_origin_coords?.lat
        ? booking.passenger_origin_coords
        : rideData?.origin?.coordinates;
    const passengerDestCoords = booking?.passenger_destination_coords?.lat
        ? booking.passenger_destination_coords
        : rideData?.destination?.coordinates;

    const hasCoords = passengerOriginCoords?.lat && passengerDestCoords?.lat;



    const handleMapReady = () => {
        if (hasCoords && mapRef.current) {
            const coords = [
                { latitude: passengerOriginCoords.lat, longitude: passengerOriginCoords.lng },
                { latitude: passengerDestCoords.lat, longitude: passengerDestCoords.lng },
            ];
            mapRef.current.fitToCoordinates(coords, {
                edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                animated: true,
            });
        }
    };

    const renderStars = () => {
        const stars = [];
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars.push(<Ionicons key={i} name="star" size={16} color="#F59E0B" />);
            } else if (i === fullStars && hasHalf) {
                stars.push(<Ionicons key={i} name="star-half" size={16} color="#F59E0B" />);
            } else {
                stars.push(<Ionicons key={i} name="star-outline" size={16} color="#D1D5DB" />);
            }
        }
        return stars;
    };

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <Animated.View style={[detailModalStyles.overlay, { opacity: opacityAnim }]}>
                <Animated.View style={[detailModalStyles.container, { transform: [{ scale: scaleAnim }], backgroundColor: theme.bg }]}>
                    
                    {/* Header con mapa */}
                    <View style={detailModalStyles.mapWrapper}>
                    <View style={[detailModalStyles.mapHeader, { backgroundColor: theme.surface, paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 50) }]}>
                            <Ionicons name="person-circle-outline" size={16} color={theme.accent} />
                            <Text style={[detailModalStyles.mapHeaderText, { color: theme.text }]}>Detalle del Pasajero</Text>
                        </View>
                        {hasCoords ? (
                            <MapView
                                ref={mapRef}
                                style={detailModalStyles.map}
                                provider={PROVIDER_GOOGLE}
                                customMapStyle={theme.dark ? darkMapStyle : []}
                                onMapReady={handleMapReady}
                            >
                                <Marker
                                    coordinate={{ latitude: passengerOriginCoords.lat, longitude: passengerOriginCoords.lng }}
                                    title="Punto de partida del pasajero"
                                    description={booking.passenger_origin || ''}
                                >
                                    <View style={detailModalStyles.markerRound}>
                                        <Ionicons name="radio-button-on" size={14} color="#fff" />
                                    </View>
                                </Marker>
                                <Marker
                                    coordinate={{ latitude: passengerDestCoords.lat, longitude: passengerDestCoords.lng }}
                                    title="Punto de llegada del pasajero"
                                    description={booking.passenger_destination || ''}
                                >
                                    <View style={[detailModalStyles.markerRound, { backgroundColor: '#FF5A5F' }]}>
                                        <Ionicons name="location" size={14} color="#fff" />
                                    </View>
                                </Marker>
                            </MapView>
                        ) : (
                            <View style={[detailModalStyles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surfaceVariant || '#F1F5F9' }]}>
                                <Ionicons name="map-outline" size={50} color={theme.border} />
                                <Text style={{ color: theme.textSecondary, marginTop: 8, fontSize: 13 }}>Mapa no disponible</Text>
                            </View>
                        )}
                    </View>

                    {/* Botón X flotante */}
                    <TouchableOpacity style={[detailModalStyles.closeBtn, { backgroundColor: theme.surface }]} onPress={onClose}>
                        <Ionicons name="close" size={24} color={theme.text} />
                    </TouchableOpacity>

                    {/* Tarjeta inferior */}
                    <View style={[detailModalStyles.detailCard, { backgroundColor: theme.surface }]}>
                        <View style={[detailModalStyles.dragBar, { backgroundColor: theme.divider }]} />

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                        {/* Foto + Nombre + Rating */}
                        <View style={detailModalStyles.profileRow}>
                            <PassengerAvatar
                                profileImage={passenger.profileImage}
                                passengerId={passenger._id}
                                style={detailModalStyles.profileImg}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={[detailModalStyles.profileName, { color: theme.text }]}>
                                    {passenger.name || 'Pasajero Anónimo'}
                                </Text>
                                <View style={detailModalStyles.starsRow}>
                                    {renderStars()}
                                    <Text style={[detailModalStyles.ratingText, { color: theme.textSecondary }]}>
                                        {passengerRating > 0 ? passengerRating.toFixed(1) : 'Sin calificar'}
                                    </Text>
                                </View>
                            </View>
                            <View style={detailModalStyles.statusBadge(booking.status)}>
                                <Text style={detailModalStyles.statusText(booking.status)}>
                                    {booking.status === 'pending' ? 'Pendiente' : booking.status === 'confirmed' ? 'Aceptado' : booking.status === 'deny' ? 'Rechazado' : 'Cancelado'}
                                </Text>
                            </View>
                        </View>

                        <View style={[detailModalStyles.divider, { backgroundColor: theme.divider }]} />

                        {/* Ruta del pasajero (solo texto) */}
                        <View style={detailModalStyles.routeSection}>
                            <Text style={[detailModalStyles.sectionLabel, { color: theme.textSecondary }]}>RUTA SOLICITADA</Text>
                            <View style={detailModalStyles.routeBox}>
                                <View style={detailModalStyles.iconCol}>
                                    <Ionicons name="radio-button-on" size={14} color={theme.accent} />
                                    <View style={[detailModalStyles.dotLine, { backgroundColor: theme.divider }]} />
                                    <Ionicons name="location" size={14} color="#FF5A5F" />
                                </View>
                                <View style={{ flex: 1, justifyContent: 'space-between' }}>
                                    <Text style={[detailModalStyles.routeText, { color: theme.text }]} numberOfLines={3}>
                                        {booking.passenger_origin || 'Punto de partida no especificado'}
                                    </Text>
                                    <Text style={[detailModalStyles.routeText, { color: theme.text, marginTop: 14 }]} numberOfLines={3}>
                                        {booking.passenger_destination || 'Punto de llegada no especificado'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Métricas */}
                        <View style={detailModalStyles.metricsRow}>
                            <View style={[detailModalStyles.metricItem, { backgroundColor: theme.surfaceVariant || '#F1F5F9' }]}>
                                <Ionicons name="people-outline" size={18} color={theme.accent} />
                                <Text style={[detailModalStyles.metricText, { color: theme.text }]}>{booking.seats_booked} asiento(s)</Text>
                            </View>
                            <View style={[detailModalStyles.metricItem, { backgroundColor: theme.surfaceVariant || '#F1F5F9' }]}>
                                <Ionicons name="time-outline" size={18} color={theme.accent} />
                                <Text style={[detailModalStyles.metricText, { color: theme.text }]}>{rideData?.duration_minutes ? `${rideData.duration_minutes} min aprox.` : 'Duración N/A'}</Text>
                            </View>
                        </View>

                        {/* Monto Ofrecido */}
                        <View style={[detailModalStyles.offerCard, { backgroundColor: theme.surfaceVariant || '#F1F5F9', borderColor: (booking.offered_amount ?? 0) > 0 ? '#25C460' : (theme.border || '#E5E7EB') }]}>
                            <View style={detailModalStyles.offerIconCircle}>
                                <Ionicons name="cash-outline" size={22} color="#25C460" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[detailModalStyles.offerLabel, { color: theme.textSecondary }]}>MONTO OFRECIDO</Text>
                                <Text style={[detailModalStyles.offerValue, { color: (booking.offered_amount ?? 0) > 0 ? '#25C460' : theme.text }]}>
                                    ₡{(booking.offered_amount ?? 0).toLocaleString()}
                                </Text>
                            </View>
                        </View>
                    </ScrollView>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

const detailModalStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
    container: { flex: 1 },
    mapWrapper: { width: '100%', height: SCREEN_H * 0.42 },
    mapHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    mapHeaderText: { fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
    map: { width: '100%', flex: 1 },
    closeBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 8, right: 16, width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5, zIndex: 10 },
    markerRound: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2563EB', borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 4 },
    detailCard: { position: 'absolute', bottom: 0, width: '100%', maxHeight: SCREEN_H * 0.62, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 35 : 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 12 },
    dragBar: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 15 },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    profileImg: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#E5E7EB' },
    profileName: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
    starsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    ratingText: { fontSize: 13, fontWeight: '600', marginLeft: 6 },
    statusBadge: (status) => ({
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
        backgroundColor: status === 'confirmed' ? '#ECFDF5' : status === 'pending' ? '#FEF3C7' : '#FEE2E2',
    }),
    statusText: (status) => ({
        fontSize: 11, fontWeight: '700',
        color: status === 'confirmed' ? '#10B981' : status === 'pending' ? '#D97706' : '#EF4444',
    }),
    divider: { height: 1, marginBottom: 14 },
    routeSection: { marginBottom: 14 },
    sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 },
    routeBox: { flexDirection: 'row' },
    iconCol: { alignItems: 'center', marginRight: 12, paddingVertical: 4 },
    dotLine: { width: 2, flex: 1, marginVertical: 3 },
    routeText: { fontSize: 14, fontWeight: '600' },
    metricsRow: { flexDirection: 'row', gap: 10 },
    metricItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
    metricText: { fontSize: 12, fontWeight: '600' },
    offerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 10 },
    offerIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#25C46015', justifyContent: 'center', alignItems: 'center' },
    offerLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 2 },
    offerValue: { fontSize: 18, fontWeight: '800' },
});

const ListOfRequests = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [startRideVisible, setStartRideVisible] = useState(false);
    const [startRideLoading, setStartRideLoading] = useState(false);
    const [confirmedCount, setConfirmedCount] = useState(0);
    const [withdrawalVisible, setWithdrawalVisible] = useState(false);
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [denyModalVisible, setDenyModalVisible] = useState(false);
    const [cancelledIds, setCancelledIds] = useState(new Set());
    const [tripCompletedVisible, setTripCompletedVisible] = useState(false);
    const [cancelRideVisible, setCancelRideVisible] = useState(false);
    const [cancelRideLoading, setCancelRideLoading] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [passengerDetailVisible, setPassengerDetailVisible] = useState(false);
    const [rideDetailData, setRideDetailData] = useState(null);
    const intervalRef = useRef(null);

    const specificRideId = route.params?.rideId;

    const fetchRequests = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            
            if (specificRideId) {
                const bookingsRes = await api.get(`/bookings/ride/${specificRideId}`);
                if (bookingsRes.data.success) {
                    const allBookings = bookingsRes.data.data || [];
                    
                    // --- ELIMINAR O VENCER PENDIENTES ANTIGUOS ---
                    const activeBookings = [];
                    const now = Date.now();
                    for (const b of allBookings) {
                        if (b.status === 'pending') {
                            const lastUpdate = b.updatedAt || b.createdAt || b.timestamp;
                            if (lastUpdate && (now - new Date(lastUpdate).getTime() > 2 * 60 * 1000)) {
                                try { await api.patch(`/bookings/${b._id}/status`, { status: 'deny', payment_status: 'waived', payment_type: 'normal' }); } catch(e){}
                                continue;
                            }
                        }
                        activeBookings.push(b);
                    }

                    if (__DEV__) {
                        activeBookings.forEach(b => {
                            const p = b.passenger_id;
                            console.log('[ListOfRequests] passenger:', p?._id, '| profileImage:', p?.profileImage ?? 'NULL');
                        });
                    }
                    setRequests(activeBookings);
                    const confirmed = activeBookings.filter(b => b.status === 'confirmed').length;
                    setConfirmedCount(confirmed);
                }
            } else {
                const driverId = await sessionCache.getDriverId();
                if (!driverId) throw new Error('No se pudo identificar al conductor');

                const ridesResponse = await api.get(`/rides/driver/${driverId}?status=scheduled`);
                const driverRides = ridesResponse.data.data || [];

                const allBookingsPromises = driverRides.map(ride =>
                    api.get(`/bookings/ride/${ride._id}`)
                );

                const bookingsResults = await Promise.all(allBookingsPromises);

                const flattenedRequests = bookingsResults.reduce((acc, current) => {
                    if (current.data.success && current.data.data) {
                        return [...acc, ...current.data.data];
                    }
                    return acc;
                }, []);

                // --- ELIMINAR O VENCER PENDIENTES ANTIGUOS ---
                const activeBookings = [];
                const now = Date.now();
                for (const b of flattenedRequests) {
                    if (b.status === 'pending') {
                        const lastUpdate = b.updatedAt || b.createdAt || b.timestamp;
                        if (lastUpdate && (now - new Date(lastUpdate).getTime() > 2 * 60 * 1000)) {
                            try { await api.patch(`/bookings/${b._id}/status`, { status: 'deny', payment_status: 'waived', payment_type: 'normal' }); } catch(e){}
                            continue;
                        }
                    }
                    activeBookings.push(b);
                }

                setRequests(activeBookings);

                // --- DETECTAR NUEVAS CANCELACIONES PARA MOSTRAR MODAL ---
                const newCancelled = activeBookings.filter(b => b.status === 'cancelled');
                if (newCancelled.length > 0) {
                    const alreadyKnown = cancelledIds;
                    const newlyFound = newCancelled.filter(b => !alreadyKnown.has(b._id.toString()));
                    if (newlyFound.length > 0) {
                        setWithdrawalVisible(true);
                        // Marcamos como conocidas para no repetir el modal
                        const updated = new Set(alreadyKnown);
                        newlyFound.forEach(b => updated.add(b._id.toString()));
                        setCancelledIds(updated);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching requests:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        fetchRequests(true);
    };

    useEffect(() => {
        fetchRequests();
        // Iniciar polling automático cada 15 segundos
        intervalRef.current = setInterval(() => fetchRequests(true), 15000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [specificRideId]);

    const handleAccept = async (bookingId) => {
        try {
            // Verificar estado actual antes de proceder
            const checkRes = await api.get(`/bookings/${bookingId}`);
            if (checkRes.data.success && checkRes.data.data.status === 'cancelled') {
                setWithdrawalVisible(true);
                fetchRequests(); // Actualizar lista
                return;
            }

            // Determinar payment fields según offered_amount
            const bookingData = checkRes.data.data;
            const hasOffer = (bookingData.offered_amount ?? 0) > 0;

            const res = await api.patch(`/bookings/${bookingId}/status`, {
                status: 'confirmed',
                payment_status: hasOffer ? 'pending' : 'waived',
                payment_type: hasOffer ? 'normal' : 'gifted',
            });
            if (res.data.success) {
                setSuccessModalVisible(true);
                // Invalidar cache de viajes ya que cambiaron los asientos/estado
                sessionCache.clearActiveRides();
                // En lugar de filtrar, recargamos para actualizar el conteo de confirmados
                fetchRequests();
            }
        } catch (e) {
            Alert.alert('Error', e.response?.data?.message || 'No se pudo aceptar la solicitud.');
        }
    };

    const handleDeny = async (bookingId) => {
        try {
            // Verificar estado actual antes de proceder
            const checkRes = await api.get(`/bookings/${bookingId}`);
            if (checkRes.data.success && checkRes.data.data.status === 'cancelled') {
                setWithdrawalVisible(true);
                fetchRequests(); // Actualizar lista
                return;
            }

            const res = await api.patch(`/bookings/${bookingId}/status`, {
                status: 'deny',
                payment_status: 'waived',
                payment_type: 'normal',
            });
            if (res.data.success) {
                setDenyModalVisible(true);
                // Invalidar cache de viajes ya que cambiaron los asientos/estado
                sessionCache.clearActiveRides();
                fetchRequests();
            }
        } catch (e) {
            Alert.alert('Error', e.response?.data?.message || 'No se pudo rechazar la solicitud.');
        }
    };

    const handleStartRide = async () => {
        if (!specificRideId) return;
        try {
            setStartRideLoading(true);

            // 1. Consultamos los datos más recientes del viaje y los pasajeros
            const [rideRes, bookingsRes] = await Promise.all([
                api.get(`/rides/${specificRideId}`),
                api.get(`/bookings/ride/${specificRideId}`)
            ]);

            const currentStatus = rideRes.data?.data?.status;
            const currentBookings = bookingsRes.data?.data || [];
            const realConfirmedCount = currentBookings.filter(b => b.status === 'confirmed').length;

            console.log(`[DEBUG] Iniciando validación: Status=${currentStatus}, Pasajeros Confirmados=${realConfirmedCount}`);
            if (realConfirmedCount === 0) {
                console.log('[DEBUG] No hay pasajeros. Forzando finalización del viaje.');
                
                // Transición segura: El servidor requiere 'start' antes de 'complete'
                if (currentStatus === 'scheduled') {
                    console.log('[DEBUG] Paso 1: Iniciando viaje (/start)...');
                    await api.patch(`/rides/${specificRideId}/start`);
                }
                
                if (currentStatus !== 'completed') {
                    console.log('[DEBUG] Paso 2: Finalizando viaje (/complete)...');
                    await api.patch(`/rides/${specificRideId}/complete`);
                }
                
                sessionCache.clearActiveRides();
                setStartRideVisible(false);
                
                // Mostrar overlay de éxito y salir
                setTimeout(() => {
                    setTripCompletedVisible(true);
                }, 300);
                return;
            }

            // 3. Caso B: Hay pasajeros -> Validar estado y proceder
            if (currentStatus === 'in progress') {
                // Ya estaba iniciado -> Navegamos directo
                setStartRideVisible(false);
                setTimeout(() => {
                    navigation.navigate('CurrentTrip', { rideId: specificRideId });
                }, 100);
                return;
            }

            if (currentStatus === 'scheduled') {
                // Iniciamos normalmente
                const res = await api.patch(`/rides/${specificRideId}/start`);
                if (res.data.success) {
                    sessionCache.clearActiveRides();
                    setStartRideVisible(false);
                    setTimeout(() => {
                        navigation.navigate('CurrentTrip', { rideId: specificRideId });
                    }, 100);
                } else {
                    Alert.alert('Error', res.data?.message || 'No se pudo iniciar el viaje.');
                }
            } else {
                // Otros estados (cancelled, etc)
                Alert.alert('No disponible', `El viaje no se puede iniciar porque está en estado: ${currentStatus}`);
                setStartRideVisible(false);
            }

        } catch (e) {
            console.error('Error starting ride:', e.response?.data || e.message);
            Alert.alert('Error', 'Problema al conectar con el servidor.');
        } finally {
            setStartRideLoading(false);
        }
    };

    const handleCancelRide = async () => {
        if (!specificRideId) return;
        try {
            setCancelRideLoading(true);
            const res = await api.patch(`/rides/${specificRideId}/cancel`);
            if (res.data.success) {
                sessionCache.clearActiveRides();
                setCancelRideVisible(false);
                // Redirigir al conductor al dashboard
                setTimeout(() => {
                    navigation.navigate('MainTabsDriver', { screen: 'DashboardDriver' });
                }, 300);
            } else {
                Alert.alert('Error', res.data?.message || 'No se pudo cancelar el viaje.');
            }
        } catch (e) {
            console.error('Error cancelling ride:', e.response?.data || e.message);
            Alert.alert('Error', e.response?.data?.message || 'Problema al conectar con el servidor.');
        } finally {
            setCancelRideLoading(false);
        }
    };

    const handleViewDetail = async (booking) => {
        setSelectedBooking(booking);
        try {
            const rideId = booking.ride_id?._id || booking.ride_id;
            if (rideId) {
                const res = await api.get(`/rides/${rideId}`);
                if (res.data.success) {
                    setRideDetailData(res.data.data);
                }
            }
        } catch (e) {
            console.log('Error fetching ride detail for modal:', e.message);
        }
        setPassengerDetailVisible(true);
    };

    const renderPassengerItem = ({ item }) => {
        const passenger = item.passenger_id || {};
        const isPending = item.status === 'pending';

        return (
            <View style={[styles.passengerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {/* Fila principal: Avatar + Info + Botones de acción */}
                <View style={styles.cardTopRow}>
                    <PassengerAvatar
                        profileImage={passenger.profileImage}
                        passengerId={passenger._id}
                        style={styles.avatar}
                    />
                    <View style={styles.infoContainer}>
                        <View style={styles.nameRow}>
                            <Text style={[styles.nameText, { color: theme.text }]} numberOfLines={1}>{passenger.name || 'Pasajero Anónimo'}</Text>
                            {item.status === 'confirmed' && (
                                <View style={styles.confirmedBadge}>
                                    <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                                    <Text style={styles.confirmedText}>Aceptado</Text>
                                </View>
                            )}
                            {item.status === 'cancelled' && (
                                <View style={[styles.confirmedBadge, { backgroundColor: '#FEE2E2' }]}>
                                    <Ionicons name="ban" size={12} color="#EF4444" />
                                    <Text style={[styles.confirmedText, { color: '#EF4444' }]}>Cancelado</Text>
                                </View>
                            )}
                            {item.status === 'deny' && (
                                <View style={[styles.confirmedBadge, { backgroundColor: '#FEE2E2' }]}>
                                    <Ionicons name="close-circle" size={12} color="#EF4444" />
                                    <Text style={[styles.confirmedText, { color: '#EF4444' }]}>Rechazado</Text>
                                </View>
                            )}
                        </View>
                        <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 3 }}>
                            {item.seats_booked} asiento/s solicitado/s
                        </Text>
                        <View style={styles.offeredRow}>
                            <Ionicons name="cash-outline" size={14} color="#25C460" />
                            <Text style={styles.offeredText}>Ofrece: ₡{(item.offered_amount ?? 0).toLocaleString()}</Text>
                        </View>
                    </View>
                    {isPending && (
                        <View style={styles.btnGroup}>
                            <TouchableOpacity
                                style={[styles.acceptBtn, { backgroundColor: theme.accent }]}
                                onPress={() => handleAccept(item._id)}
                            >
                                <Text style={styles.btnText}>Aceptar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.denyBtn]}
                                onPress={() => handleDeny(item._id)}
                            >
                                <Text style={styles.btnText}>Rechazar</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
                {/* Fila inferior: botón de ver detalles */}
                <TouchableOpacity
                    style={[styles.detailBtn, { borderColor: theme.accent }]}
                    onPress={() => handleViewDetail(item)}
                >
                    <Ionicons name="eye-outline" size={14} color={theme.accent} />
                    <Text style={[styles.detailBtnText, { color: theme.accent }]}>Ver detalles</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const pendingRequests = requests.filter(r => r.status === 'pending');
    const displayRequests = specificRideId ? requests : pendingRequests;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.surface} />
            <View style={[styles.header, { borderBottomColor: theme.divider }]}>
                <TouchableOpacity 
                    onPress={() => {
                        if (specificRideId) {
                            navigation.navigate('MainTabsDriver', { screen: 'ManageRides' });
                        } else {
                            navigation.goBack();
                        }
                    }} 
                    style={styles.backBtn}
                >
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>Solicitudes {specificRideId ? 'del Viaje' : 'de Pasajeros'}</Text>
                <TouchableOpacity 
                    onPress={handleRefresh} 
                    style={styles.refreshBtn}
                >
                    <Ionicons name="refresh" size={24} color={theme.text} />
                </TouchableOpacity>
            </View>
            
            {loading ? (
                <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 50 }}/>
            ) : (
                <FlatList
                    data={displayRequests}
                    keyExtractor={(item, index) => item._id || index.toString()}
                    renderItem={renderPassengerItem}
                    onRefresh={handleRefresh}
                    refreshing={refreshing}
                    contentContainerStyle={{ padding: 20, paddingBottom: specificRideId ? 200 : 100 }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Ionicons name="people-outline" size={60} color={theme.border} />
                            <Text style={{ color: theme.textSecondary, marginTop: 10 }}>No hay solicitudes pendientes.</Text>
                        </View>
                    }
                />
            )}

            {specificRideId && !loading && (
                <View style={[styles.startRideContainer, { backgroundColor: theme.surface, borderTopColor: theme.divider }]}>
                    <Text style={[styles.startRideText, { color: theme.textSecondary }]}>¿Tienes todos los pasajeros a bordo?</Text>
                    <TouchableOpacity 
                        style={[styles.startRideBtn, { backgroundColor: theme.accent }]} 
                        onPress={() => setStartRideVisible(true)}
                    >
                        <Text style={styles.startRideBtnText}>Iniciar Viaje</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.cancelRideBtn]}
                        onPress={() => setCancelRideVisible(true)}
                    >
                        <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                        <Text style={styles.cancelRideBtnText}>Cancelar Viaje</Text>
                    </TouchableOpacity>
                </View>
            )}

            <StartRideModal 
                visible={startRideVisible}
                onClose={() => setStartRideVisible(false)}
                onConfirm={handleStartRide}
                loading={startRideLoading}
                confirmedCount={confirmedCount}
                theme={theme}
            />

            <WithdrawalModal
                visible={withdrawalVisible}
                theme={theme}
                onClose={() => setWithdrawalVisible(false)}
            />

            <SuccessModal
                theme={theme}
                visible={successModalVisible}
                onClose={() => setSuccessModalVisible(false)}
            />

            <DenySuccessModal
                theme={theme}
                visible={denyModalVisible}
                onClose={() => setDenyModalVisible(false)}
            />

            <CancelRideModal
                theme={theme}
                visible={cancelRideVisible}
                onClose={() => setCancelRideVisible(false)}
                onConfirm={handleCancelRide}
                loading={cancelRideLoading}
            />

            <TripCompletedOverlay 
                visible={tripCompletedVisible}
                theme={theme}
                onFinish={() => {
                    setTripCompletedVisible(false);
                    navigation.navigate('MainTabsDriver', { screen: 'DashboardDriver' });
                }}
            />

            <PassengerDetailModal
                visible={passengerDetailVisible}
                onClose={() => {
                    setPassengerDetailVisible(false);
                    setSelectedBooking(null);
                    setRideDetailData(null);
                }}
                booking={selectedBooking}
                rideData={rideDetailData}
                theme={theme}
            />

            <BottomNavigationDriver navigation={navigation} activeTab="Rutas" />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 0 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, borderBottomWidth: 1 },
    backBtn: { position: 'absolute', left: 20 },
    refreshBtn: { position: 'absolute', right: 20 },
    title: { fontSize: 18, fontWeight: 'bold' },
    passengerCard: { padding: 14, borderRadius: 15, borderWidth: 1, marginBottom: 15, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    cardTopRow: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    infoContainer: { flex: 1, marginLeft: 12 },
    nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    nameText: { fontSize: 15, fontWeight: 'bold', maxWidth: '60%' },
    confirmedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    confirmedText: { fontSize: 10, color: '#10B981', fontWeight: 'bold' },
    offeredRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    offeredText: { fontSize: 12, fontWeight: '700', color: '#25C460' },
    btnGroup: { flexDirection: 'column', gap: 5 },
    acceptBtn: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' },
    denyBtn: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, marginTop: 10, alignSelf: 'flex-start', marginLeft: 56 },
    detailBtnText: { fontSize: 12, fontWeight: '600' },
    startRideContainer: { position: 'absolute', bottom: 120, left: 20, right: 20, padding: 15, borderRadius: 20, alignItems: 'center', elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.15, shadowRadius: 8, borderWidth: 1, borderColor: '#F3F4F6' },
    startRideText: { fontSize: 13, marginBottom: 10, fontWeight: '600' },
    startRideBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 14, borderRadius: 14, gap: 10, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2 },
    startRideBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    cancelRideBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 12, borderRadius: 14, gap: 8, marginTop: 8, borderWidth: 1.5, borderColor: '#EF4444', backgroundColor: 'transparent' },
    cancelRideBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
});

const modalStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 25 },
    card: { width: '100%', backgroundColor: '#fff', borderRadius: 30, padding: 30, alignItems: 'center', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15 },
    iconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
    infoBox: { width: '100%', backgroundColor: '#F9FAFB', borderRadius: 20, padding: 20, marginBottom: 20, gap: 12, borderWidth: 1, borderColor: '#F3F4F6' },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    infoText: { fontSize: 14, fontWeight: '600', color: '#374151' },
    warningText: { fontSize: 12, color: '#EF4444', fontWeight: '700', textAlign: 'center', marginBottom: 30, paddingHorizontal: 10 },
    buttonContainer: { width: '100%', gap: 12 },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 16, elevation: 2 },
    confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    cancelBtn: { paddingVertical: 12, alignItems: 'center' },
    cancelBtnText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
    btnDisabled: { opacity: 0.6 }
});

export default ListOfRequests;
