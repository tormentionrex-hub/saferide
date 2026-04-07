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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';
import sessionCache from '../../services/sessionCache';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import SettingsGearButton from '../../components/SettingsGearButton';

export default function DashboardConductor({ route, navigation }) {
    const { theme } = useDriverTheme();
    const [userName, setUserName] = useState('Conductor');
    const [hasVehicle, setHasVehicle] = useState(null); // null = cargando
    const [showModal, setShowModal] = useState(false);
    const si = useScrollIndicator();

    useFocusEffect(
        useCallback(() => {
            const loadData = async () => {
                try {
                    const name = await AsyncStorage.getItem('userName');
                    if (name) setUserName(name.split(' ')[0]);

                    // force=true: siempre consultar el API al regresar, nunca usar caché
                    const hasVehicle = await sessionCache.getVehicleStatus(true);
                    setHasVehicle(hasVehicle);
                } catch (err) {
                    setHasVehicle(false);
                }
            };
            loadData();
        }, [])
    );

    return (
        <Animated.View style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
                
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

                <View style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} {...si.scrollProps}>

                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.headerLeft}>
                                <Text style={[styles.welcomeText, { color: theme.text }]}>Hola, {userName}</Text>
                            </View>
                            <SettingsGearButton navigation={navigation} color={theme.text} />
                        </View>

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
                                        const activeRides = await sessionCache.getActiveRides();
                                        if (activeRides && activeRides.length > 0) {
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
                                        console.error('Error navigating from driver dashboard:', error);
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

            </SafeAreaView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 120,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    // Card Grande (Publicar Viaje)
    mainCard: {
        backgroundColor: '#F3F7FF', // Azul muy tenue
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(37, 99, 235, 0.1)',
        elevation: 2, // Sombra suave en Android
    },
    mainIconCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        elevation: 3,
    },
    mainCardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    mainCardDescription: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 20,
    },
    // Fila y Cards Pequeñas
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    smallCard: {
        backgroundColor: '#F3F7FF',
        borderRadius: 24,
        padding: 20,
        width: '48%',
        alignItems: 'center',
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(37, 99, 235, 0.1)',
    },
    smallIconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        elevation: 2,
    },
    smallCardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
    },
    cardLocked: {
        opacity: 0.45,
    },
    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    lockBanner: {
        borderRadius: 20,
        borderWidth: 1.5,
        padding: 24,
        alignItems: 'center',
        marginBottom: 20,
        gap: 8,
    },
    lockIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    lockTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    lockSub: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 8,
    },
    lockBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 14,
        marginTop: 4,
    },
    lockBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
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
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 10,
        letterSpacing: 0.3,
    },
    subtitleModal: {
        fontSize: 14,
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
        fontSize: 16,
        fontWeight: '700',
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
        fontSize: 14,
        fontWeight: '600',
    },
});
