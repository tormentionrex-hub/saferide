import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
    ActivityIndicator, SafeAreaView, StatusBar, Alert, Platform, Modal, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import sessionCache from '../../services/sessionCache';
import { useDriverTheme } from '../../context/DriverThemeContext';
import BottomNavigationDriver from '../../components/BottomNavigationDriver';
import TripCompletedOverlay from '../../components/TripCompletedOverlay';

/* ─── Modal de inicio de viaje ───────────────────────────────────── */
const StartRideModal = ({ visible, onClose, onConfirm, loading, confirmedCount }) => {
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
                <Animated.View style={[modalStyles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
                    
                    {/* Icono central animado/destacado */}
                    <View style={modalStyles.iconCircle}>
                        <Ionicons name="car-sport" size={44} color="#2563EB" />
                    </View>

                    {/* Título y subtítulo */}
                    <Text style={modalStyles.title}>¿Iniciar viaje ahora?</Text>
                    <Text style={modalStyles.subtitle}>
                        Al iniciar, notificaremos a los pasajeros que estás en camino.
                    </Text>

                    {/* Información del viaje */}
                    <View style={modalStyles.infoBox}>
                        <View style={modalStyles.infoRow}>
                            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            <Text style={modalStyles.infoText}>
                                {confirmedCount} pasajeros confirmados
                            </Text>
                        </View>
                        <View style={modalStyles.infoRow}>
                            <Ionicons name="map-outline" size={18} color="#6B7280" />
                            <Text style={modalStyles.infoText}>La ruta se mostrará en el mapa</Text>
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
                            <Text style={modalStyles.cancelBtnText}>Aún no, volver</Text>
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
                                try { await api.delete(`/bookings/${b._id}`); } catch(e){}
                                continue;
                            }
                        }
                        activeBookings.push(b);
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
                            try { await api.delete(`/bookings/${b._id}`); } catch(e){}
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

            const res = await api.patch(`/bookings/${bookingId}/status`, { status: 'confirmed' });
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

            const res = await api.patch(`/bookings/${bookingId}/status`, { status: 'deny' });
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

    const renderPassengerItem = ({ item }) => {
        const passenger = item.passenger_id || {};
        const isPending = item.status === 'pending';

        return (
            <View style={[styles.passengerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Image source={{ uri: passenger.profileImage || `https://i.pravatar.cc/150?u=${passenger._id || 'default'}` }} style={styles.avatar} />
                <View style={styles.infoContainer}>
                    <View style={styles.nameRow}>
                        <Text style={[styles.nameText, { color: theme.text }]}>{passenger.name || 'Pasajero Anónimo'}</Text>
                        {item.status === 'confirmed' && (
                            <View style={styles.confirmedBadge}>
                                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                <Text style={styles.confirmedText}>Aceptado</Text>
                            </View>
                        )}
                        {item.status === 'cancelled' && (
                            <View style={[styles.confirmedBadge, { backgroundColor: '#FEE2E2' }]}>
                                <Ionicons name="ban" size={14} color="#EF4444" />
                                <Text style={[styles.confirmedText, { color: '#EF4444' }]}>Cancelado</Text>
                            </View>
                        )}
                        {item.status === 'deny' && (
                            <View style={[styles.confirmedBadge, { backgroundColor: '#FEE2E2' }]}>
                                <Ionicons name="close-circle" size={14} color="#EF4444" />
                                <Text style={[styles.confirmedText, { color: '#EF4444' }]}>Rechazado</Text>
                            </View>
                        )}
                    </View>
                    <Text style={{ color: theme.textSecondary, marginTop: 4 }}>
                        {item.seats_booked} asiento/s solicitado/s
                    </Text>
                    {item.passenger_origin && (
                        <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                            Recogida: {item.passenger_origin}
                        </Text>
                    )}
                    {item.passenger_destination && (
                        <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 1 }}>
                            Destino: {item.passenger_destination}
                        </Text>
                    )}
                </View>
                
                {item.status === 'pending' && (
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
                </View>
            )}

            <StartRideModal 
                visible={startRideVisible}
                onClose={() => setStartRideVisible(false)}
                onConfirm={handleStartRide}
                loading={startRideLoading}
                confirmedCount={confirmedCount}
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

            <TripCompletedOverlay 
                visible={tripCompletedVisible}
                theme={theme}
                onFinish={() => {
                    setTripCompletedVisible(false);
                    navigation.navigate('MainTabsDriver', { screen: 'DashboardDriver' });
                }}
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
    passengerCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, borderWidth: 1, marginBottom: 15, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    avatar: { width: 50, height: 50, borderRadius: 25 },
    infoContainer: { flex: 1, marginLeft: 15 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    nameText: { fontSize: 16, fontWeight: 'bold' },
    confirmedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    confirmedText: { fontSize: 11, color: '#10B981', fontWeight: 'bold' },
    btnGroup: { flexDirection: 'column', gap: 6 },
    acceptBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 10 },
    denyBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 10, backgroundColor: '#FEE2E2' },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
    startRideContainer: { position: 'absolute', bottom: 120, left: 20, right: 20, padding: 15, borderRadius: 20, alignItems: 'center', elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.15, shadowRadius: 8, borderWidth: 1, borderColor: '#F3F4F6' },
    startRideText: { fontSize: 13, marginBottom: 10, fontWeight: '600' },
    startRideBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 14, borderRadius: 14, gap: 10, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2 },
    startRideBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
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
