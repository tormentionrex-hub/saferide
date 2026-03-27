import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated as RNAnimated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDriverTheme } from '../context/DriverThemeContext';
import sessionCache from '../services/sessionCache';

const BottomNavigationBarAlt = ({ state, descriptors, navigation, activeTab: manualActiveTab }) => {
    const insets = useSafeAreaInsets();
    const { theme } = useDriverTheme();
    const [showModal, setShowModal] = useState(false);
    
    // Estado para saber si el conductor ya registró su auto (inicio como true para no parpadear)
    const [hasVehicleRegistered, setHasVehicleRegistered] = useState(true);
    const [loadingVehicle, setLoadingVehicle] = useState(true);

    let currentTab = manualActiveTab || 'Inicio';
    if (state) {
        const routeName = state.routes[state.index].name;
        if (routeName === 'DashboardDriver') currentTab = 'Inicio';
        else if (routeName === 'PublishRide') currentTab = 'Viajes';
        else if (routeName === 'ManageRides' || routeName === 'CurrentTrip' || routeName === 'ListOfRequests') currentTab = 'Rutas';
        else if (routeName === 'PreviousTrips') currentTab = 'History';
    }

    // Re-verificar estado del vehículo cada vez que el tab navigator recibe foco.
    // useFocusEffect garantiza que se ejecute también cuando hacemos navigation.reset().
    useFocusEffect(
        useCallback(() => {
            let active = true;
            const checkVehicle = async () => {
                try {
                    setLoadingVehicle(true);
                    // force=true para ignorar el caché y siempre consultar el API
                    const hasVehicle = await sessionCache.getVehicleStatus(true);
                    if (active) {
                        setHasVehicleRegistered(hasVehicle);
                    }
                } catch (e) {
                    console.error('[BottomNav] Error in vehicle check:', e);
                    if (active) setHasVehicleRegistered(false);
                } finally {
                    if (active) setLoadingVehicle(false);
                }
            };
            checkVehicle();
            return () => { active = false; };
        }, [])
    );

    const getColor = (tabName) => currentTab === tabName ? theme.navActive : theme.navInactive;

    const handleRestrictedPress = (routeName) => {
        if (!hasVehicleRegistered) {
            setShowModal(true);
        } else {
            navigateTo(routeName);
        }
    };

    const navigateTo = (routeName) => {
        if (state) {
            const event = navigation.emit({
                type: 'tabPress',
                target: routeName,
                canPreventDefault: true,
            });
            if (currentTab !== routeName && !event.defaultPrevented) {
                navigation.navigate(routeName);
            }
        } else {
            navigation.navigate('MainTabsDriver', { screen: routeName });
        }
    };

    return (
        <>
            {/* ── MODAL ACCESO BLOQUEADO ── */}
            <Modal
                visible={showModal}
                transparent
                animationType="fade"
                statusBarTranslucent
            >
                <View style={styles.backdrop}>
                    <View style={[styles.card, {
                        backgroundColor: theme.dark ? '#111128' : '#FFFFFF',
                        borderColor: theme.dark ? 'rgba(116,143,255,0.25)' : 'rgba(75,104,255,0.15)',
                    }]}>

                        {/* Glow ring + icon */}
                        <View style={[styles.iconWrapper, {
                            backgroundColor: theme.dark ? '#1C1C40' : '#EEF2FF',
                            shadowColor: theme.accent,
                        }]}>
                            <View style={[styles.iconInner, {
                                backgroundColor: theme.dark ? '#252560' : '#E0E7FF',
                            }]}>
                                <Ionicons name="car-sport" size={42} color={theme.accent} />
                                <View style={[styles.lockBadge, { backgroundColor: theme.dark ? '#0A0A18' : '#fff' }]}>
                                    <Ionicons name="lock-closed" size={13} color={theme.accent} />
                                </View>
                            </View>
                        </View>

                        {/* Texto */}
                        <Text style={[styles.title, { color: theme.dark ? '#EEEEFF' : '#1C1C1E' }]}>
                            Acceso Bloqueado
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.dark ? '#7A7A9D' : '#6B7280' }]}>
                            Para comenzar a aceptar viajes, primero debes registrar un vehículo.
                        </Text>

                        {/* Separador */}
                        <View style={[styles.divider, {
                            backgroundColor: theme.dark ? 'rgba(116,143,255,0.15)' : 'rgba(75,104,255,0.1)'
                        }]} />

                        {/* Botón principal */}
                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
                            activeOpacity={0.85}
                            onPress={() => {
                                setShowModal(false);
                                navigation.navigate('RegisterVehicleStep1');
                            }}
                        >
                            <Ionicons name="car-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.primaryBtnText}>Registrar Vehículo</Text>
                        </TouchableOpacity>

                        {/* Botón cancelar */}
                        <TouchableOpacity
                            style={[styles.cancelBtn, {
                                borderColor: theme.dark ? 'rgba(116,143,255,0.3)' : 'rgba(75,104,255,0.2)'
                            }]}
                            activeOpacity={0.7}
                            onPress={() => setShowModal(false)}
                        >
                            <Text style={[styles.cancelBtnText, { color: theme.dark ? '#7A7A9D' : '#8E8E93' }]}>
                                Cancelar
                            </Text>
                        </TouchableOpacity>

                    </View>
                </View>
            </Modal>

            {/* ── BARRA DE NAVEGACIÓN ── */}
            <View style={[
                styles.container,
                {
                    paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
                    height: 70 + (insets.bottom > 0 ? insets.bottom : 20),
                    backgroundColor: theme.navBg,
                    borderTopColor: theme.navBorder,
                }
            ]}>

                <TouchableOpacity style={styles.navItem} activeOpacity={0.6} onPress={() => navigateTo('DashboardDriver')}>
                    <Ionicons name={currentTab === 'Inicio' ? "home" : "home-outline"} size={24} color={getColor('Inicio')} />
                    <Text style={[styles.navText, { color: getColor('Inicio') }]} numberOfLines={1} adjustsFontSizeToFit allowFontScaling={false}>Inicio</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} activeOpacity={0.6} onPress={() => handleRestrictedPress('PublishRide')}>
                    <View>
                        <Ionicons name={currentTab === 'Viajes' ? "map" : "map-outline"} size={24} color={!hasVehicleRegistered ? theme.textSecondary : getColor('Viajes')} />
                        {!hasVehicleRegistered && !loadingVehicle && (
                            <View style={styles.smallLock}>
                                <Ionicons name="lock-closed" size={10} color="#FFF" />
                            </View>
                        )}
                    </View>
                    <Text style={[styles.navText, { color: !hasVehicleRegistered ? theme.textSecondary : getColor('Viajes') }]} numberOfLines={1} adjustsFontSizeToFit allowFontScaling={false}>Viajes</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.navItem}
                    activeOpacity={0.6}
                    onPress={async () => {
                        if (!hasVehicleRegistered) { setShowModal(true); return; }
                        try {
                            const activeRides = await sessionCache.getActiveRides();
                            if (activeRides && activeRides.length > 0) {
                                const inProgressRide = activeRides.find(r => r.status === 'in progress');
                                if (inProgressRide) {
                                    navigation.navigate('CurrentTrip', { rideId: inProgressRide._id });
                                } else {
                                    navigateTo('ManageRides');
                                }
                                return;
                            }
                            navigateTo('ManageRides');
                        } catch (error) {
                            console.error('Error navigating Rutas:', error);
                            navigateTo('ManageRides');
                        }
                    }}
                >
                    <View>
                        <Ionicons name={currentTab === 'Rutas' ? "map" : "map-outline"} size={24} color={!hasVehicleRegistered ? theme.textSecondary : getColor('Rutas')} />
                        {!hasVehicleRegistered && !loadingVehicle && (
                            <View style={styles.smallLock}>
                                <Ionicons name="lock-closed" size={10} color="#FFF" />
                            </View>
                        )}
                    </View>
                    <Text style={[styles.navText, { color: !hasVehicleRegistered ? theme.textSecondary : getColor('Rutas') }]} numberOfLines={1} adjustsFontSizeToFit allowFontScaling={false}>Rutas</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.navItem} activeOpacity={0.6} onPress={() => navigateTo('PreviousTrips')}>
                    <Ionicons name={currentTab === 'History' ? "time" : "time-outline"} size={24} color={getColor('History')} />
                    <Text style={[styles.navText, { color: getColor('History') }]} numberOfLines={1} adjustsFontSizeToFit allowFontScaling={false}>Historial</Text>
                </TouchableOpacity>

            </View>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        width: '100%',
        alignItems: 'center',
        position: 'absolute',
        bottom: 0,
        paddingHorizontal: 8,
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        borderTopWidth: 1,
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        paddingTop: 10,
    },
    navText: {
        fontSize: 11,
        marginTop: 4,
        fontFamily: 'Poppins-SemiBold',
        textAlign: 'center',
        includeFontPadding: false,
        width: '100%',
    },
    navTextActive: {
        fontFamily: 'Poppins-SemiBold',
    },
    smallLock: {
        position: 'absolute',
        bottom: -2,
        right: -4,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#EF5350',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#FFF',
    },
    // ── Modal ──
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.72)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    card: {
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
    iconWrapper: {
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
    iconInner: {
        width: 84,
        height: 84,
        borderRadius: 42,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockBadge: {
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
    title: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 10,
        letterSpacing: 0.3,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 21,
        paddingHorizontal: 8,
    },
    divider: {
        width: '100%',
        height: 1,
        marginVertical: 24,
    },
    primaryBtn: {
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
    primaryBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    cancelBtn: {
        width: '100%',
        paddingVertical: 13,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
});

export default BottomNavigationBarAlt;
