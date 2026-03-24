import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
    RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDriverTheme } from '../../context/DriverThemeContext';
import api from '../../services/api';
import { LinearGradient } from 'expo-linear-gradient';

const History = ({ navigation }) => {
    const { theme } = useDriverTheme();
    const insets = useSafeAreaInsets();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchHistory = async () => {
        try {
            // Obtenemos todas las reservaciones del usuario
            // El backend ya las ordena por createdAt descendente
            const response = await api.get('/bookings', {
                params: {
                    limit: 50 // Pedimos suficientes para filtrar manualmente (luego cortamos a 15)
                }
            });

            if (response.data.success) {
                const allBookings = response.data.data;
                
                // Filtrar según los requisitos:
                // 1. Estado de la reservación: 'completed' o 'cancelled'
                //    (En el backend, un viaje completado marca su booking como 'completed')
                // 2. Solo los últimos 15
                const filtered = allBookings
                    .filter(b => b.status === 'completed' || b.status === 'cancelled')
                    .slice(0, 15);

                setHistory(filtered);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchHistory();
    };

    const StatusBadge = ({ status }) => {
        const isCompleted = status === 'completed';
        const color = isCompleted ? '#27AE60' : '#FF5A5F';
        const label = isCompleted ? 'Completado' : 'Cancelado';
        const icon = isCompleted ? 'checkmark-circle' : 'close-circle';

        return (
            <View style={[styles.badge, { backgroundColor: color + '15', borderColor: color + '30' }]}>
                <Ionicons name={icon} size={14} color={color} />
                <Text style={[styles.badgeText, { color: color }]}>{label}</Text>
            </View>
        );
    };

    const renderItem = ({ item }) => {
        const ride = item.ride_id;
        if (!ride) return null;

        const dateObj = new Date(ride.fecha);
        // Ajuste manual de fecha para evitar desfase ISO
        const day = dateObj.getUTCDate();
        const month = dateObj.toLocaleString('es-ES', { month: 'short', timeZone: 'UTC' });
        
        const totalPaid = (ride.price || 0) * (item.seats_booked || 1);

        return (
            <View style={[styles.historyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.cardTop}>
                    <View style={styles.dateBlock}>
                        <Text style={[styles.dateDay, { color: theme.text }]}>{day}</Text>
                        <Text style={[styles.dateMonth, { color: theme.textSecondary }]}>{month.toUpperCase()}</Text>
                    </View>
                    <View style={styles.mainInfo}>
                        <View style={styles.statusRow}>
                            <StatusBadge status={item.status} />
                            <Text style={[styles.priceText, { color: theme.accent }]}>₡{totalPaid.toLocaleString()}</Text>
                        </View>
                        <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                            <Ionicons name="time-outline" size={14} /> Salida: {ride.hora}
                        </Text>
                    </View>
                </View>

                <View style={[styles.routeContainer, { backgroundColor: theme.bg }]}>
                    <View style={styles.routePoint}>
                        <Ionicons name="radio-button-on" size={14} color={theme.accent} />
                        <Text style={[styles.routeLabel, { color: theme.textSecondary }]}>Origen:</Text>
                        <Text style={[styles.routeValue, { color: theme.text }]} numberOfLines={1}>{ride.origin?.name}</Text>
                    </View>
                    <View style={[styles.routeConnector, { backgroundColor: theme.divider }]} />
                    <View style={styles.routePoint}>
                        <Ionicons name="location" size={14} color="#FF5A5F" />
                        <Text style={[styles.routeLabel, { color: theme.textSecondary }]}>Destino:</Text>
                        <Text style={[styles.routeValue, { color: theme.text }]} numberOfLines={1}>{ride.destination?.name}</Text>
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    <Text style={[styles.seatsInfo, { color: theme.textSecondary }]}>
                        {item.seats_booked} {item.seats_booked === 1 ? 'asiento reservado' : 'asientos reservados'}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor="transparent" translucent />
            
            {/* Header / Banner */}
            <LinearGradient
                colors={[theme.accent, theme.accent + 'CC']}
                style={[styles.header, { paddingTop: insets.top + 20 }]}
            >
                <Text style={styles.headerTitle}>Tu Historial</Text>
                <Text style={styles.headerSubtitle}>Registros de tus viajes en SafeRide</Text>
            </LinearGradient>

            <View style={styles.listContainer}>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.accent} />
                    </View>
                ) : (
                    <FlatList
                        data={history}
                        keyExtractor={(item) => item._id}
                        renderItem={renderItem}
                        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
                        ListHeaderComponent={() => (
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Viajes anteriores</Text>
                                <View style={[styles.sectionLine, { backgroundColor: theme.accent }]} />
                            </View>
                        )}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="receipt-outline" size={60} color={theme.textSecondary} />
                                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No tienes viajes anteriores registrados.</Text>
                            </View>
                        )}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
                        }
                    />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 25,
        paddingBottom: 35,
        borderBottomLeftRadius: 35,
        borderBottomRightRadius: 35,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    headerTitle: {
        fontSize: 32,
        fontFamily: 'Poppins-Bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: 'rgba(255,255,255,0.8)',
    },
    listContainer: {
        flex: 1,
        marginTop: -20,
    },
    listContent: {
        paddingHorizontal: 20,
    },
    sectionHeader: {
        marginTop: 35,
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Poppins-Bold',
    },
    sectionLine: {
        flex: 1,
        height: 2,
        opacity: 0.2,
        borderRadius: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    historyCard: {
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    cardTop: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 15,
    },
    dateBlock: {
        width: 55,
        height: 55,
        borderRadius: 15,
        backgroundColor: 'rgba(0,0,0,0.03)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateDay: {
        fontSize: 22,
        fontFamily: 'Poppins-Bold',
        lineHeight: 25,
    },
    dateMonth: {
        fontSize: 10,
        fontFamily: 'Poppins-SemiBold',
    },
    mainInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 10,
        fontFamily: 'Poppins-Bold',
    },
    priceText: {
        fontSize: 18,
        fontFamily: 'Poppins-Bold',
    },
    timeText: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
    },
    routeContainer: {
        padding: 12,
        borderRadius: 15,
        gap: 8,
    },
    routePoint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    routeLabel: {
        fontSize: 11,
        fontFamily: 'Poppins-Regular',
        width: 50,
    },
    routeValue: {
        flex: 1,
        fontSize: 13,
        fontFamily: 'Poppins-Medium',
    },
    routeConnector: {
        width: 1,
        height: 6,
        marginLeft: 6.5,
    },
    cardFooter: {
        marginTop: 12,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    seatsInfo: {
        fontSize: 11,
        fontFamily: 'Poppins-Italic',
    },
    emptyContainer: {
        marginTop: 100,
        alignItems: 'center',
        paddingHorizontal: 50,
    },
    emptyText: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        marginTop: 20,
    },
});

export default History;
