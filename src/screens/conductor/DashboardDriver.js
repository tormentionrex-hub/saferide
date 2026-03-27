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
    const si = useScrollIndicator();

    useFocusEffect(
        useCallback(() => {
            const loadData = async () => {
                try {
                    const name = await AsyncStorage.getItem('userName');
                    if (name) setUserName(name.split(' ')[0]);

                    // Usa sessionCache para evitar llamadas duplicadas a /auth/me
                    const hasVehicle = await sessionCache.getVehicleStatus();
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
                            onPress={() => hasVehicle && navigation.navigate('PublishRide')}
                            activeOpacity={hasVehicle ? 0.8 : 1}
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
});
