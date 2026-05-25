import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    Animated,
    StatusBar,
    ActivityIndicator,
    Modal,
    Platform,
    Image,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';
import sessionCache from '../../services/sessionCache';
import sessionStorage from '../../services/sessionStorage';
import api from '../../services/api';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import { rideService } from '../../services/rideService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePaidNotices } from '../../hooks/usePaidNotices';
import PaidNoticeBanner from '../../components/PaidNoticeBanner';
import NotificationBell from '../../components/NotificationBell';
import NotificationCenterModal from '../../components/NotificationCenterModal';
import { useNotifications } from '../../hooks/useNotifications';

import { moderateScale } from '../../utils/responsive';
export default function DashboardConductor({ route, navigation }) {
    const { theme } = useDriverTheme();
    const insets = useSafeAreaInsets();
    const [userName, setUserName] = useState('Conductor');
    const [hasVehicle, setHasVehicle] = useState(null); // null = cargando
    const [showModal, setShowModal] = useState(false);
    const [userPhoto, setUserPhoto] = useState(null);
    const [frequentRoutes, setFrequentRoutes] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const si = useScrollIndicator();
    const { notices, dismissNotice } = usePaidNotices(true);
    const currentNotice = notices[0] || null;

    // ── Centro de notificaciones (campana) ──
    const [notifCenterVisible, setNotifCenterVisible] = useState(false);
    const {
        notifications,
        unreadCount,
        loading: notifLoading,
        markAsRead,
        markAllAsRead,
    } = useNotifications(true);

    const handleNotificationPress = useCallback((notification) => {
        if (notification.status === 'unread') {
            markAsRead(notification._id);
        }
        setNotifCenterVisible(false);

        // Mapeo de tipos del backend a destinos del conductor.
        const rideId = notification.relatedEntity?.entityType === 'ride'
            ? notification.relatedEntity?.entityId
            : null;
        switch (notification.type) {
            case 'booking_pending':
            case 'booking_cancelled':
                // Solicitudes nuevas o cancelaciones de pasajero → Gestionar.
                navigation.navigate('ManageRides');
                break;
            case 'ride_started':
                // Viaje arrancado → CurrentTrip si tenemos el rideId.
                if (rideId) {
                    navigation.navigate('CurrentTrip', { rideId });
                } else {
                    navigation.navigate('ManageRides');
                }
                break;
            case 'ride_completed':
            case 'ride_cancelled':
                // Histórico → PreviousTrips
                navigation.navigate('MainTabsDriver', { screen: 'PreviousTrips' });
                break;
            default:
                // ride_reminder / trust_score_updated / system: solo cerrar
                break;
        }
    }, [navigation, markAsRead]);

    const loadData = async () => {
        try {
            try {
                const meRes = await api.get('/auth/me');
                if (meRes.data.success) {
                    const user = meRes.data.data;
                    if (user.name) setUserName(user.name);
                    setUserPhoto(user.profileImage || null);
                    await sessionStorage.setSession(user);
                }
            } catch (apiErr) {
                const name = await AsyncStorage.getItem('userName');
                if (name) setUserName(name);

                const photo = await AsyncStorage.getItem('userPhoto');
                if (photo && (photo.startsWith('http') || photo.startsWith('file'))) {
                    setUserPhoto(photo);
                }
            }

            // force=true: siempre consultar el API al regresar, nunca usar caché
            const hasVehicleRes = await sessionCache.getVehicleStatus(true);
            setHasVehicle(hasVehicleRes);

            // ── Cargar rutas frecuentes del conductor ──
            try {
                const driverId = await sessionCache.getDriverId();
                if (driverId) {
                    const completedRes = await rideService.getRidesByDriver(driverId, 'completed');
                    const completedRides = completedRes.data?.filter(
                        r => r.origin && r.destination
                    ) || [];

                    const routeMap = {};
                    completedRides.forEach(ride => {
                        const key = `${ride.origin.name}|||${ride.destination.name}`;
                        if (!routeMap[key]) {
                            routeMap[key] = {
                                count: 0,
                                origin: {
                                    name: ride.origin.name,
                                    address: ride.origin.address || ride.origin.name,
                                    lat: ride.origin.coordinates?.lat,
                                    lng: ride.origin.coordinates?.lng,
                                },
                                destination: {
                                    name: ride.destination.name,
                                    address: ride.destination.address || ride.destination.name,
                                    lat: ride.destination.coordinates?.lat,
                                    lng: ride.destination.coordinates?.lng,
                                },
                            };
                        }
                        routeMap[key].count += 1;
                    });

                    const sorted = Object.values(routeMap)
                        .filter(r => r.count >= 4)
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 2);
                    setFrequentRoutes(sorted);
                }
            } catch (e) {
                console.log('Driver frequent routes error:', e?.response?.data?.message || e?.message || 'unknown error');
            }
        } catch (err) {
            setHasVehicle(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    return (
        <Animated.View style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>

                {/* Aviso flotante: pasajero pagó cuota pendiente */}
                {currentNotice && (
                    <PaidNoticeBanner
                        key={currentNotice.bookingId}
                        notice={currentNotice}
                        onDismiss={dismissNotice}
                        topInset={insets.top}
                    />
                )}


                {/* ── MODAL ACCESO BLOQUEADO ── */}
                <Modal visible={showModal} transparent animationType="fade" statusBarTranslucent>
                    <View style={styles.backdrop}>
                        <View style={[styles.cardModal, {
                            backgroundColor: theme.dark ? '#111128' : '#FFFFFF',
                            borderColor: theme.dark ? 'rgba(116,143,255,0.25)' : 'rgba(75,104,255,0.15)',
                        }]}>
                            <View style={[styles.iconWrapperModal, { backgroundColor: theme.dark ? '#1C1C40' : '#EEF2FF', shadowColor: theme.accent }]}>
                                <View style={[styles.iconInnerModal, { backgroundColor: theme.dark ? '#252560' : '#E0E7FF' }]}>
                                    <Ionicons name="car-sport" size={42} color={theme.accent} />
                                    <View style={[styles.lockBadgeModal, { backgroundColor: theme.dark ? '#0A0A18' : '#fff' }]}>
                                        <Ionicons name="lock-closed" size={13} color={theme.accent} />
                                    </View>
                                </View>
                            </View>

                            <Text style={[styles.titleModal, { color: theme.dark ? '#EEEEFF' : '#1C1C1E' }]}>Acceso Bloqueado</Text>
                            <Text style={[styles.subtitleModal, { color: theme.dark ? '#7A7A9D' : '#6B7280' }]}>
                                Para aplicar esta acción, primero debes registrar un vehículo.
                            </Text>

                            <View style={[styles.dividerModal, { backgroundColor: theme.dark ? 'rgba(116,143,255,0.15)' : 'rgba(75,104,255,0.1)' }]} />

                            <TouchableOpacity
                                style={[styles.primaryBtnModal, { backgroundColor: theme.accent }]}
                                activeOpacity={0.85}
                                onPress={() => { setShowModal(false); navigation.navigate('RegisterVehicleStep1'); }}
                            >
                                <Ionicons name="car-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.primaryBtnTextModal}>Registrar Vehículo</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.cancelBtnModal, { borderColor: theme.dark ? 'rgba(116,143,255,0.3)' : 'rgba(75,104,255,0.2)' }]}
                                activeOpacity={0.7}
                                onPress={() => setShowModal(false)}
                            >
                                <Text style={[styles.cancelBtnTextModal, { color: theme.dark ? '#7A7A9D' : '#8E8E93' }]}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Header */}
                <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.divider || '#CBD5E1', borderBottomWidth: 1 }]}>
                    <View style={styles.headerSide}>
                        <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('AjustesConductor')}>
                            <Ionicons name="settings-sharp" size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.headerTitle, { color: theme.navActive || '#005BBF' }]}>Conductor</Text>
                    <View style={[styles.headerSide, styles.headerRight]}>
                        <NotificationBell
                            unreadCount={unreadCount}
                            color={theme.text}
                            onPress={() => setNotifCenterVisible(true)}
                        />
                        <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('ProfileConductor')}>
                            {userPhoto ? (
                                <Image source={{ uri: userPhoto }} style={styles.profileImg} />
                            ) : (
                                <View style={[styles.profileFallback, { backgroundColor: theme.surfaceVariant || '#EDF2F7' }]}>
                                    <Text style={[styles.initialsText, { color: theme.navActive || '#005BBF' }]}>
                                        {userName ? userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?'}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{ flex: 1 }}>
                    <ScrollView 
                        contentContainerStyle={styles.scrollContent} 
                        {...si.scrollProps}
                        showsVerticalScrollIndicator={false}
                        alwaysBounceVertical={true}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />
                        }
                    >

                        {/* Banner de bloqueo: sin vehículo */}
                        {hasVehicle === false && (
                            <View style={[styles.lockBanner, { backgroundColor: theme.surfaceVariant, borderColor: theme.accent }]}>
                                <View style={[styles.lockIconCircle, { backgroundColor: theme.iconCircleBg }]}>
                                    <Ionicons name="lock-closed" size={28} color={theme.accent} />
                                </View>
                                <Text style={[styles.lockTitle, { color: theme.text }]}>Vehículo requerido</Text>
                                <Text style={[styles.lockSub, { color: theme.textSecondary }]}>
                                    Para publicar y gestionar viajes debes registrar tu vehículo primero.
                                </Text>
                                <TouchableOpacity
                                    style={[styles.lockBtn, { backgroundColor: theme.accent }]}
                                    onPress={() => navigation.navigate('RegisterVehicleStep1')}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="car-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.lockBtnText}>Registrar Vehículo</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Spinner mientras carga */}
                        {hasVehicle === null && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={theme.accent} />
                            </View>
                        )}

                        {/* Card Principal: Publicar Viaje */}
                        <TouchableOpacity
                            style={[
                                styles.mainCard,
                                { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder },
                                !hasVehicle && styles.cardLocked,
                            ]}
                            onPress={() => {
                                if (hasVehicle) navigation.navigate('PublishRide');
                                else if (hasVehicle === false) setShowModal(true);
                            }}
                            activeOpacity={hasVehicle !== null ? 0.8 : 1}
                        >
                            <View style={[styles.mainIconCircle, { backgroundColor: theme.iconCircleBg }]}>
                                <Ionicons name={hasVehicle ? 'options-outline' : 'lock-closed-outline'} size={32} color={hasVehicle ? theme.accent : theme.textSecondary} />
                            </View>
                            <Text style={[styles.mainCardTitle, { color: hasVehicle ? theme.text : theme.textSecondary }]}>Publicar Viaje</Text>
                            <Text style={[styles.mainCardDescription, { color: theme.textSecondary }]}>
                                Define tu ruta y comparte los asientos libres de tu coche.
                            </Text>
                        </TouchableOpacity>

                        {/* ── SECCIÓN: Rutas Frecuentes del Conductor ── */}
                        <View style={styles.frequentSection}>
                            <Text style={[styles.frequentTitle, { color: theme.textSecondary }]}>Rutas Frecuentes</Text>
                            
                            {frequentRoutes.length > 0 && (
                                <View style={styles.frequentRow}>
                                    {frequentRoutes.map((rt, idx) => {
                                        const icons = ['navigate-circle-outline', 'location-outline'];
                                        const iconColors = [theme.accent || '#2563EB', '#FF5A5F'];
                                        return (
                                            <TouchableOpacity
                                                key={idx}
                                                style={[
                                                    styles.frequentCard,
                                                    { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder || theme.divider },
                                                    !hasVehicle && styles.cardLocked,
                                                ]}
                                                onPress={() => {
                                                    if (hasVehicle) {
                                                        navigation.navigate('PublishRide', {
                                                            prefillOrigin: rt.origin,
                                                            prefillDestination: rt.destination,
                                                        });
                                                    } else if (hasVehicle === false) {
                                                        setShowModal(true);
                                                    }
                                                }}
                                                activeOpacity={0.8}
                                            >
                                                <View style={[styles.frequentIconCircle, { backgroundColor: theme.iconCircleBg || 'rgba(37, 99, 235, 0.1)' }]}>
                                                    <Ionicons name={icons[idx] || 'navigate-outline'} size={24} color={iconColors[idx] || theme.accent} />
                                                </View>
                                                <Text style={[styles.frequentCardTitle, { color: theme.text }]} numberOfLines={1}>
                                                    {rt.destination.name}
                                                </Text>
                                                <Text style={[styles.frequentCardSub, { color: theme.textSecondary }]} numberOfLines={1}>
                                                    {rt.count} {rt.count === 1 ? 'viaje' : 'viajes'}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>

                        {/* Fila de Cards Secundarias */}
                        <View style={styles.row}>

                            {/* Gestionar Viajes */}
                            <TouchableOpacity
                                style={[
                                    styles.smallCard,
                                    { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder },
                                    !hasVehicle && styles.cardLocked,
                                ]}
                                onPress={async () => {
                                    if (hasVehicle === false) { setShowModal(true); return; }
                                    if (!hasVehicle) return;
                                    try {
                                        // force=true para evitar cache stale tras
                                        // tocar "Finalizar viaje" o "Continuar"
                                        // en PaymentVerification.
                                        const activeRides = await sessionCache.getActiveRides(true);
                                        if (activeRides && activeRides.length > 0) {
                                            // Prioridad 1: viaje pendiente de
                                            // verificación de pago → llevar al
                                            // conductor a PaymentVerification.
                                            const awaitingRide = activeRides.find(r => r.status === 'awaiting_payment_verification');
                                            if (awaitingRide) {
                                                navigation.navigate('PaymentVerification', { rideId: awaitingRide._id });
                                                return;
                                            }
                                            const inProgressRide = activeRides.find(r => r.status === 'in progress');
                                            if (inProgressRide) {
                                                navigation.navigate('CurrentTrip', { rideId: inProgressRide._id });
                                            } else {
                                                navigation.navigate('ManageRides');
                                            }
                                            return;
                                        }
                                        navigation.navigate('ManageRides');
                                    } catch (error) {
                                        console.error('Error navigating from driver dashboard:', error?.response?.data?.message || error?.message || 'unknown error');
                                        navigation.navigate('ManageRides');
                                    }
                                }}
                                activeOpacity={hasVehicle ? 0.7 : 1}
                            >
                                <View style={[styles.smallIconCircle, { backgroundColor: theme.iconCircleBg }]}>
                                    <Ionicons name={hasVehicle ? 'map-outline' : 'lock-closed-outline'} size={28} color={hasVehicle ? theme.accent : theme.textSecondary} />
                                </View>
                                <Text style={[styles.smallCardTitle, { color: hasVehicle ? theme.text : theme.textSecondary }]}>Gestionar Viajes Activos</Text>
                            </TouchableOpacity>

                            {/* Métricas Personales */}
                            <TouchableOpacity
                                style={[styles.smallCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder }]}
                                onPress={() => navigation.navigate('DriverMetrics')}
                            >
                                <View style={[styles.smallIconCircle, { backgroundColor: theme.iconCircleBg }]}>
                                    <Ionicons name="bar-chart-outline" size={28} color={theme.accent} />
                                </View>
                                <Text style={[styles.smallCardTitle, { color: theme.text }]}>Métricas Personales</Text>
                            </TouchableOpacity>

                        </View>

                    </ScrollView>
                    <ScrollIndicator si={si} thumbColor={theme.accent} />
                </View>

                <NotificationCenterModal
                    visible={notifCenterVisible}
                    onClose={() => setNotifCenterVisible(false)}
                    notifications={notifications}
                    loading={notifLoading}
                    markAllAsRead={markAllAsRead}
                    onNotificationPress={handleNotificationPress}
                />

            </SafeAreaView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 14,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 44,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    headerSide: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    headerIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: moderateScale(22), fontFamily: 'Poppins-Bold', textAlign: 'center' },
    headerRight: { justifyContent: 'flex-end', gap: 6 },
    profileButton: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: '#E2E8F0' },
    profileImg: { width: '100%', height: '100%' },
    profileFallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    initialsText: { fontSize: moderateScale(16), fontFamily: 'Poppins-Bold' },
    welcomeText: { fontSize: moderateScale(24), fontFamily: 'Poppins-Bold' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    mainCard: {
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
    },
    mainIconCircle: {
        width: 70, height: 70, borderRadius: 35,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 14, elevation: 3,
    },
    mainCardTitle: { fontSize: moderateScale(20), fontFamily: 'Poppins-Bold', marginBottom: 6, textAlign: 'center' },
    mainCardDescription: { fontSize: moderateScale(13), fontFamily: 'Poppins-Regular', textAlign: 'center', lineHeight: 20 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    smallCard: {
        borderRadius: 20, padding: 18, flex: 1, alignItems: 'center',
        elevation: 3, borderWidth: 1,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06, shadowRadius: 12,
    },
    smallIconCircle: {
        width: 50, height: 50, borderRadius: 25,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 10, elevation: 2,
    },
    smallCardTitle: { fontSize: moderateScale(13), fontFamily: 'Poppins-Bold', textAlign: 'center' },
    cardLocked: { opacity: 0.45 },
    loadingContainer: { paddingVertical: 40, alignItems: 'center' },
    lockBanner: { borderRadius: 20, borderWidth: 1.5, padding: 24, alignItems: 'center', marginBottom: 16, gap: 8 },
    lockIconCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    lockTitle: { fontSize: moderateScale(18), fontFamily: 'Poppins-Bold', textAlign: 'center' },
    lockSub: { fontSize: moderateScale(13), fontFamily: 'Poppins-Regular', textAlign: 'center', lineHeight: 19, marginBottom: 8 },
    lockBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 4 },
    lockBtnText: { color: '#fff', fontSize: moderateScale(14), fontFamily: 'Poppins-Bold' },
    // ── Frequent Routes ──
    frequentSection: { marginBottom: 16 },
    frequentTitle: {
        fontSize: moderateScale(12),
        fontFamily: 'Poppins-Bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
        marginLeft: 4,
    },
    frequentRow: { flexDirection: 'row', gap: 12 },
    frequentCard: {
        flex: 1,
        borderRadius: 18,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    frequentIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    frequentCardTitle: {
        fontSize: moderateScale(13),
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
        marginBottom: 2,
    },
    frequentCardSub: {
        fontSize: moderateScale(11),
        fontFamily: 'Poppins-Regular',
    },
    // ── Modal Styles ──
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.72)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    cardModal: {
        width: '100%',
        borderRadius: 28,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        elevation: 20,
        shadowColor: '#748FFF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    iconWrapperModal: {
        width: 110,
        height: 110,
        borderRadius: 55,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        elevation: 10,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
    },
    iconInnerModal: {
        width: 84,
        height: 84,
        borderRadius: 42,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockBadgeModal: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
    },
    titleModal: {
        fontSize: moderateScale(22),
        fontFamily: 'Poppins-Bold',
        marginBottom: 10,
        letterSpacing: 0.3,
    },
    subtitleModal: {
        fontSize: moderateScale(14),
        textAlign: 'center',
        lineHeight: 21,
        paddingHorizontal: 8,
    },
    dividerModal: {
        width: '100%',
        height: 1,
        marginVertical: 24,
    },
    primaryBtnModal: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        elevation: 6,
        shadowColor: '#748FFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        marginBottom: 12,
    },
    primaryBtnTextModal: {
        color: '#fff',
        fontSize: moderateScale(16),
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.3,
    },
    cancelBtnModal: {
        width: '100%',
        paddingVertical: 13,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
    },
    cancelBtnTextModal: {
        fontSize: moderateScale(14),
        fontFamily: 'Poppins-SemiBold',
    },
});
