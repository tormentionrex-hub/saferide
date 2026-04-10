import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, SafeAreaView, StatusBar, Platform,
    Modal, Animated, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import sessionCache from '../../services/sessionCache';
import { useDriverTheme } from '../../context/DriverThemeContext';
import SettingsGearButton from '../../components/SettingsGearButton';

/* ─── Modal de cancelación ────────────────────────────────────────── */
const CancelModal = ({ visible, ride, onClose, onConfirm, cancelling }) => {
    const [step, setStep] = useState(1); // 1 = primera confirmación, 2 = segunda confirmación
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setStep(1);
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0.85);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    if (!ride) return null;

    const originName = ride.origin?.name || 'Origen Desconocido';
    const destName = ride.destination?.name || 'Destino Desconocido';

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={modal.overlay}>
                <Animated.View style={[modal.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>

                    {/* Ícono central */}
                    <View style={modal.iconCircle}>
                        <Ionicons
                            name={step === 1 ? 'alert-circle' : 'warning'}
                            size={44}
                            color={step === 1 ? '#F59E0B' : '#EF4444'}
                        />
                    </View>

                    {/* Título y subtítulo */}
                    <Text style={modal.title}>
                        {step === 1 ? 'Cancelar viaje' : '¿Completamente seguro?'}
                    </Text>

                    {step === 1 ? (
                        <>
                            <Text style={modal.subtitle}>Estás a punto de cancelar el siguiente viaje:</Text>

                            {/* Resumen del viaje */}
                            <View style={modal.routeSummary}>
                                <View style={modal.routeRow}>
                                    <Ionicons name="radio-button-on" size={14} color="#2563EB" />
                                    <Text style={modal.routeText} numberOfLines={1}>{originName}</Text>
                                </View>
                                <View style={modal.routeDotLine} />
                                <View style={modal.routeRow}>
                                    <Ionicons name="location" size={14} color="#EF4444" />
                                    <Text style={modal.routeText} numberOfLines={1}>{destName}</Text>
                                </View>
                            </View>

                            <Text style={modal.hint}>
                                Los pasajeros con reservas serán notificados automáticamente.
                            </Text>
                        </>
                    ) : (
                        <Text style={modal.subtitle}>
                            Esta acción{' '}
                            <Text style={{ fontWeight: '800', color: '#EF4444' }}>no se puede deshacer</Text>
                            . El viaje quedará cancelado de forma permanente y se notificará a todos los pasajeros.
                        </Text>
                    )}

                    {/* Botones */}
                    <View style={modal.buttonsCol}>
                        {step === 1 ? (
                            <>
                                <TouchableOpacity
                                    style={modal.btnDestructive}
                                    onPress={() => setStep(2)}
                                >
                                    <Ionicons name="arrow-forward-circle-outline" size={18} color="#fff" />
                                    <Text style={modal.btnDestructiveText}>Sí, quiero cancelarlo</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={modal.btnGhost} onPress={onClose}>
                                    <Text style={modal.btnGhostText}>No, volver</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[modal.btnDestructive, modal.btnDestructiveFinal, cancelling && modal.btnDisabled]}
                                    onPress={onConfirm}
                                    disabled={cancelling}
                                >
                                    {cancelling ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Ionicons name="trash-outline" size={18} color="#fff" />
                                    )}
                                    <Text style={modal.btnDestructiveText}>
                                        {cancelling ? 'Cancelando...' : 'Cancelar viaje definitivamente'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={modal.btnGhost} onPress={() => setStep(1)} disabled={cancelling}>
                                    <Text style={modal.btnGhostText}>← Volver atrás</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>

                    {/* Indicador de pasos */}
                    <View style={modal.stepsRow}>
                        <View style={[modal.stepDot, step === 1 && modal.stepDotActive]} />
                        <View style={[modal.stepDot, step === 2 && modal.stepDotActive]} />
                    </View>

                </Animated.View>
            </View>
        </Modal>
    );
};

/* ─── Modal de Éxito de Cancelación ───────────────────────────────── */
const SuccessCancelModal = ({ visible, onClose }) => {
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
            <View style={modal.overlay}>
                <Animated.View style={[modal.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
                    <View style={[modal.iconCircle, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="checkmark-circle" size={44} color="#10B981" />
                    </View>
                    <Text style={modal.title}>Viaje cancelado</Text>
                    <Text style={[modal.subtitle, { marginBottom: 25 }]}>
                        El viaje fue cancelado exitosamente y los pasajeros han sido notificados.
                    </Text>
                    <View style={modal.buttonsCol}>
                        <TouchableOpacity style={[modal.btnDestructive, { backgroundColor: '#10B981' }]} onPress={onClose}>
                            <Text style={modal.btnDestructiveText}>Entendido</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

/* ─── Pantalla principal ──────────────────────────────────────────── */
const ManageRides = ({ navigation }) => {
    const { theme } = useDriverTheme();
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cancellingId, setCancellingId] = useState(null);
    const [selectedRide, setSelectedRide] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [successModalVisible, setSuccessModalVisible] = useState(false);

    const fetchRides = async () => {
        try {
            setLoading(true);
            const activeRides = await sessionCache.getActiveRides();

            // Filtrar los viajes que queremos mostrar (scheduled e in progress)
            const filtered = (activeRides || []).filter(r =>
                r.status === 'scheduled' || r.status === 'in progress'
            );

            setRides(filtered);
        } catch (error) {
            console.error('Error fetching rides in ManageRides:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => fetchRides());
        return unsubscribe;
    }, [navigation]);

    const handleCancelRide = (item) => {
        if (item.status === 'in progress') return;
        setSelectedRide(item);
        setModalVisible(true);
    };

    const handleModalConfirm = async () => {
        if (!selectedRide) return;
        try {
            setCancellingId(selectedRide._id);
            await api.patch(`/rides/${selectedRide._id}/cancel`);

            // 1. Actualizar estado localmente sin re-fetch
            setRides(prev => prev.filter(r => r._id !== selectedRide._id));

            // 2. Invalidar cache global para que otros screens se actualicen
            sessionCache.clearActiveRides();

            setModalVisible(false);
            setSelectedRide(null);
            setSuccessModalVisible(true);
        } catch (error) {
            console.error('Error cancelando viaje:', error);
            Alert.alert('Error', 'No se pudo cancelar el viaje. Inténtalo de nuevo.');
        } finally {
            setCancellingId(null);
        }
    };

    const getStatusInfo = (status) => {
        if (status === 'scheduled') return { label: 'Agendado', color: '#2563EB', bg: '#EFF6FF' };
        if (status === 'in progress') return { label: 'En curso', color: '#D97706', bg: '#FFFBEB' };
        return { label: status, color: '#6B7280', bg: '#F3F4F6' };
    };

    const renderRideItem = ({ item }) => {
        const originName = item.origin?.name || 'Origen Desconocido';
        const destName = item.destination?.name || 'Destino Desconocido';

        let date;
        if (item.fecha && item.hora) date = new Date(`${item.fecha}T${item.hora}:00`);
        else if (item.date_time) date = new Date(item.date_time);
        else date = new Date();

        const isValidDate = !isNaN(date.getTime());
        const displayDate = isValidDate ? date.toLocaleDateString() : (item.fecha || '--/--/----');
        const displayTime = isValidDate ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (item.hora || '--:--');

        const statusInfo = getStatusInfo(item.status);
        const isInProgress = item.status === 'in progress';
        const isCancelling = cancellingId === item._id;

        return (
            <View style={[styles.rideCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                </View>

                <View style={styles.routeContainer}>
                    <Ionicons name="radio-button-on" size={16} color={theme.accent} />
                    <View style={[styles.line, { backgroundColor: theme.divider }]} />
                    <Ionicons name="location" size={16} color="#FF5A5F" />
                    <View style={styles.routeTextContainer}>
                        <Text style={[styles.locationText, { color: theme.text }]} numberOfLines={1}>Origen: {originName}</Text>
                        <Text style={[styles.locationText, { color: theme.text, marginTop: 15 }]} numberOfLines={1}>Destino: {destName}</Text>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.divider }]} />

                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                        <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
                        <Text style={[styles.detailText, { color: theme.textSecondary }]}>{displayDate}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
                        <Text style={[styles.detailText, { color: theme.textSecondary }]}>{displayTime}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Ionicons name="people-outline" size={16} color={theme.textSecondary} />
                        <Text style={[styles.detailText, { color: theme.textSecondary }]}>{item.available_seats} asientos</Text>
                    </View>
                </View>

                <View style={styles.buttonsRow}>
                    <TouchableOpacity
                        style={[styles.manageBtn, { backgroundColor: theme.accent, flex: 1, marginRight: 8 }]}
                        onPress={() => navigation.navigate('ListOfRequests', { rideId: item._id })}
                    >
                        <Text style={styles.manageBtnText}>Gestionar solicitudes</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.cancelBtn,
                            (isInProgress || isCancelling) && styles.cancelBtnDisabled,
                        ]}
                        onPress={() => handleCancelRide(item)}
                        disabled={isInProgress || isCancelling}
                    >
                        {isCancelling ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons
                                name="close-circle-outline"
                                size={18}
                                color={isInProgress ? '#9CA3AF' : '#fff'}
                            />
                        )}
                        <Text style={[styles.cancelBtnText, isInProgress && { color: '#9CA3AF' }]}>
                            Cancelar
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.surface} />
            <View style={[styles.header, { borderBottomColor: theme.divider }]}>
                <TouchableOpacity
                    onPress={() => navigation.navigate('MainTabsDriver', { screen: 'DashboardDriver' })}
                    style={styles.backBtn}
                >
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>Mis Viajes Publicados</Text>
                <SettingsGearButton navigation={navigation} color={theme.text} style={styles.gearBtn} />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={rides}
                    keyExtractor={(item, index) => item._id || index.toString()}
                    renderItem={renderRideItem}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Ionicons name="map-outline" size={60} color={theme.border} />
                            <Text style={{ color: theme.textSecondary, marginTop: 10 }}>No tienes viajes publicados activos.</Text>
                        </View>
                    }
                />
            )}

            <CancelModal
                visible={modalVisible}
                ride={selectedRide}
                onClose={() => { setModalVisible(false); setSelectedRide(null); }}
                onConfirm={handleModalConfirm}
                cancelling={!!cancellingId}
            />

            <SuccessCancelModal
                visible={successModalVisible}
                onClose={() => setSuccessModalVisible(false)}
            />
        </SafeAreaView>
    );
};

/* ─── Estilos ─────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 0 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, borderBottomWidth: 1 },
    backBtn: { position: 'absolute', left: 20 },
    gearBtn: { position: 'absolute', right: 20 },
    title: { fontSize: 18, fontWeight: 'bold' },
    rideCard: { padding: 15, borderRadius: 15, borderWidth: 1, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 12, gap: 6 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
    routeContainer: { flexDirection: 'row', alignItems: 'center', minHeight: 60 },
    line: { width: 2, height: 25, position: 'absolute', left: 7, top: 18 },
    routeTextContainer: { marginLeft: 15, flex: 1, justifyContent: 'space-between', height: 50 },
    locationText: { fontSize: 15, fontWeight: 'bold' },
    divider: { height: 1, marginVertical: 15 },
    detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    detailText: { fontSize: 13, fontWeight: '500' },
    buttonsRow: { flexDirection: 'row', alignItems: 'center' },
    manageBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    manageBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#EF4444', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10 },
    cancelBtnDisabled: { backgroundColor: '#E5E7EB' },
    cancelBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});

const modal = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    card: { width: '100%', backgroundColor: '#fff', borderRadius: 28, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 16 },
    iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
    title: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21, marginBottom: 18 },
    hint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 20, lineHeight: 18 },
    routeSummary: { width: '100%', backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    routeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151' },
    routeDotLine: { width: 2, height: 14, backgroundColor: '#E5E7EB', marginLeft: 6, marginVertical: 4 },
    buttonsCol: { width: '100%', gap: 10, marginTop: 4 },
    btnDestructive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F59E0B', paddingVertical: 14, borderRadius: 14 },
    btnDestructiveFinal: { backgroundColor: '#EF4444' },
    btnDisabled: { opacity: 0.6 },
    btnDestructiveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    btnGhost: { alignItems: 'center', paddingVertical: 10 },
    btnGhostText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
    stepsRow: { flexDirection: 'row', gap: 6, marginTop: 20 },
    stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
    stepDotActive: { backgroundColor: '#EF4444', width: 18 },
});

export default ManageRides;
