import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image,
    SafeAreaView,
    ScrollView,
    Animated,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigationDriver from '../../components/BottomNavigationDriver';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';

export default function DashboardConductor({ route, navigation }) {
    const { theme } = useDriverTheme();
    const [userName, setUserName] = useState('Conductor');
    const si = useScrollIndicator();

    useEffect(() => {
        const fetchUserName = async () => {
            const nameFromParams = route?.params?.userName || route?.params?.name;
            if (nameFromParams) {
                setUserName(nameFromParams.split(' ')[0]);
                return;
            }
            const storedName = await AsyncStorage.getItem('userName');
            if (storedName) {
                setUserName(storedName.split(' ')[0]);
            }
        };
        fetchUserName();
    }, [route?.params]);

    return (
        <Animated.View style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
                <View style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} {...si.scrollProps}>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.welcomeText, { color: theme.text }]}>Hola, {userName}</Text>
                        <View style={styles.headerIcons}>
                            <TouchableOpacity style={styles.iconButton}>
                                <Ionicons name="notifications-outline" size={26} color={theme.text} />
                                <View style={[styles.notificationDot, { backgroundColor: theme.accent, borderColor: theme.bg }]} />
                            </TouchableOpacity>
                            <Image
                                source={{ uri: 'https://i.pravatar.cc/150?u=carlos' }}
                                style={styles.profileImage}
                            />
                        </View>
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

                        {/* Gestionar Solicitudes */}
                        <TouchableOpacity
                            style={[styles.smallCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder }]}
                            onPress={() => navigation.navigate('ManageRequests')}
                        >
                            <View style={[styles.smallIconCircle, { backgroundColor: theme.iconCircleBg }]}>
                                <Ionicons name="person-add-outline" size={28} color={theme.accent} />
                            </View>
                            <Text style={[styles.smallCardTitle, { color: theme.text }]}>Gestionar Solicitudes</Text>
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

                {/* Barra de navegación inferior */}
                <BottomNavigationDriver navigation={navigation} activeTab="Inicio" />
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
        paddingTop: 20,
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
    headerIcons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconButton: {
        marginRight: 16,
        position: 'relative',
    },
    notificationDot: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 10,
        height: 10,
        backgroundColor: '#2563EB',
        borderRadius: 5,
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    profileImage: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: '#e5e7eb',
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
