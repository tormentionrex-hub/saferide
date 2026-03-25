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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import SettingsGearButton from '../../components/SettingsGearButton';

export default function DashboardConductor({ route, navigation }) {
    const { theme } = useDriverTheme();
    const [userName, setUserName] = useState('Conductor');
    const si = useScrollIndicator();

    useFocusEffect(
        useCallback(() => {
            AsyncStorage.getItem('userName').then((name) => {
                if (name) setUserName(name.split(' ')[0]);
            });
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
                                <TouchableOpacity style={styles.iconButton}>
                                    <Ionicons name="notifications-outline" size={24} color={theme.text} />
                                    <View style={[styles.notificationDot, { backgroundColor: theme.accent, borderColor: theme.bg }]} />
                                </TouchableOpacity>
                            </View>
                            <SettingsGearButton navigation={navigation} color={theme.text} />
                        </View>

                        {/* Card Principal: Publicar Viaje */}
                        <TouchableOpacity
                            style={[styles.mainCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder }]}
                            onPress={() => navigation.navigate('PublishRide')}
                        >
                            <View style={[styles.mainIconCircle, { backgroundColor: theme.iconCircleBg }]}>
                                <Ionicons name="options-outline" size={32} color={theme.accent} />
                            </View>
                            <Text style={[styles.mainCardTitle, { color: theme.text }]}>Publicar Viaje</Text>
                            <Text style={[styles.mainCardDescription, { color: theme.textSecondary }]}>
                                Define tu ruta y comparte los asientos libres de tu coche.
                            </Text>
                        </TouchableOpacity>

                        {/* Fila de Cards Secundarias */}
                        <View style={styles.row}>

                            {/* Gestionar Viajes */}
                            <TouchableOpacity
                                style={[styles.smallCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder }]}
                                onPress={() => navigation.navigate('ManageRides')}
                            >
                                <View style={[styles.smallIconCircle, { backgroundColor: theme.iconCircleBg }]}>
                                    <Ionicons name="map-outline" size={28} color={theme.accent} />
                                </View>
                                <Text style={[styles.smallCardTitle, { color: theme.text }]}>Gestionar Viajes Activos</Text>
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
        paddingBottom: 40,
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
    iconButton: {
        position: 'relative',
    },
    notificationDot: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 1.5,
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
});
