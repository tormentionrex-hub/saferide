import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';

import api from '../../services/api';
import sessionCache from '../../services/sessionCache';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import SettingsGearButton from '../../components/SettingsGearButton';

const screenWidth = Dimensions.get('window').width;

const DriverMetrics = ({ navigation }) => {
    const { theme } = useDriverTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const si = useScrollIndicator();

    // --- ESTADO PARA DATOS ---
    const [stats, setStats] = useState({
        kmTotal: "0",
        viajesTotal: "0",
        co2Total: "0",
        dataKm: [0, 0, 0, 0, 0, 0],
        dataRides: [0, 0, 0, 0, 0, 0],
        labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun"]
    });

    // --- ESTADO PARA HISTORIAL POR MESES ---
    const [monthlyDetails, setMonthlyDetails] = useState([]);

    const fetchMetrics = useCallback(async () => {
        try {
            // 1. Obtener ID del usuario actual mediante sessionCache
            const userId = await sessionCache.getDriverId();
            if (!userId) throw new Error("No se pudo obtener información del usuario");

            // 2. Obtener Métricas Generales (Carbono, Km totales, etc.)
            let metricsData = {
                kilometers_driven: 0,
                total_rides: 0,
                carbon_footprint: 0
            };

            try {
                const mResponse = await api.get(`/metrics/user/${userId}`);
                if (mResponse.data.success) {
                    metricsData = mResponse.data.data;
                }
            } catch (e) {
                console.log("No se encontraron métricas previas, usando ceros.");
            }            // 3. Obtener Historial de Viajes para armar el gráfico
            // Se solicita un límite alto y filtramos solo viajes enteramente 'completed'
            const rResponse = await api.get(`/rides/driver/${userId}?limit=1000&status=completed`);
            const rawRides = rResponse.data.data || [];
            
            // --- NUEVO: Verificación de pasajeros por viaje (Frontend Only) ---
            // Consultamos las reservaciones de cada viaje para asegurar que hubo pasajeros reales.
            // Esto se hace porque no podemos tocar el backend para que lo devuelva poblado.
            const ridesWithPassData = await Promise.all(
                rawRides.map(async (ride) => {
                    try {
                        const bRes = await api.get(`/bookings/ride/${ride._id}`);
                        const bookings = bRes.data.data || [];
                        return { ...ride, bookings };
                    } catch (e) {
                        return { ...ride, bookings: [] };
                    }
                })
            );

            // Filtramos solo aquellos viajes que tienen al menos una reservación en estado 'completed'
            const allRides = ridesWithPassData.filter(ride => 
                ride.bookings && ride.bookings.some(b => b.status === 'completed')
            );
            
            // Procesar viajes de los últimos 6 meses
            const now = new Date();
            const months = [];
            const monthLabels = [];
            const kmByMonth = [];
            const ridesByMonth = [];

            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                months.push({ year: d.getFullYear(), month: d.getMonth() });
                monthLabels.push(d.toLocaleString('es-ES', { month: 'short' }).replace(/^\w/, c => c.toUpperCase()));
                kmByMonth.push(0);
                ridesByMonth.push(0);
            }

            let calcTotalKm = 0;
            let calcTotalRides = 0;
            const monthlyObj = {};

            allRides.forEach(ride => {
                if (!ride.fecha) return;

                // Verificamos driver_id (puede venir como objeto poblado o como string)
                if (ride.driver_id) {
                    const rideDriverId = typeof ride.driver_id === 'object' ? ride.driver_id._id : ride.driver_id;
                    if (rideDriverId.toString() !== userId.toString()) return;
                }

                // El filtro a continuación asegura que solo contemos KM y viajes con pasajeros reales
                calcTotalKm += (ride.distance_km || 0);
                calcTotalRides += 1;

                // Agrupación mensual
                const [y, mStr] = ride.fecha.split('-');
                const monthKey = `${y}-${mStr}`;
                if (!monthlyObj[monthKey]) {
                    monthlyObj[monthKey] = { year: y, month: mStr, km: 0, rides: 0 };
                }
                monthlyObj[monthKey].km += (ride.distance_km || 0);
                monthlyObj[monthKey].rides += 1;

                const [y_num, mm, dd] = ride.fecha.split('-').map(Number);
                const rideDate = new Date(y_num, mm - 1, dd);

                months.forEach((m, idx) => {
                    if (rideDate.getFullYear() === m.year && rideDate.getMonth() === m.month) {
                        kmByMonth[idx] += (ride.distance_km || 0);
                        ridesByMonth[idx] += 1;
                    }
                });
            });

            // Forzamos el uso del cálculo local (calcTotalKm, calcTotalRides) 
            // ya que el endpoint /metrics del backend cuenta viajes vacíos.
            const finalKm = calcTotalKm;
            const finalRides = calcTotalRides;
            // Cálculo estimado de CO2 basado en los KM reales con pasajeros
            const finalCo2 = (calcTotalKm * 0.12 * 0.6);

            setStats({
                kmTotal: finalKm.toFixed(1),
                viajesTotal: finalRides.toString(),
                co2Total: finalCo2.toFixed(1),
                dataKm: kmByMonth,
                dataRides: ridesByMonth,
                labels: monthLabels
            });

            // Mapear, procesar y guardar la data agrupada
            const monthNamesDict = {
                '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
                '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
                '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
            };

            const sortedMonthlyData = Object.keys(monthlyObj)
                .sort((a, b) => b.localeCompare(a)) // Ordenar descendente (más nuevos primero)
                .map(key => {
                    const item = monthlyObj[key];
                    const monthCo2 = item.km * 0.12 * 0.6;
                    return {
                        key,
                        name: `${monthNamesDict[item.month]} ${item.year}`,
                        km: item.km.toFixed(1),
                        rides: item.rides,
                        co2: monthCo2.toFixed(1)
                    };
                });

            setMonthlyDetails(sortedMonthlyData);

        } catch (error) {
            console.error("Error al traer datos de Mongo:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchMetrics();
        }, [fetchMetrics])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchMetrics();
        setRefreshing(false);
    };

    const chartConfig = {
        backgroundColor: theme.surface,
        backgroundGradientFrom: theme.surface,
        backgroundGradientTo: theme.surface,
        decimalPlaces: 1,
        color: (opacity = 1) => theme.dark
            ? `rgba(116, 143, 255, ${opacity})`
            : `rgba(45, 99, 237, ${opacity})`,
        labelColor: (opacity = 1) => theme.dark
            ? `rgba(170, 170, 200, ${opacity})`
            : `rgba(153, 153, 153, ${opacity})`,
        style: { borderRadius: 16 },
        propsForDots: {
            r: "4",
            strokeWidth: "2",
            stroke: theme.accent,
        },
        propsForBackgroundLines: { strokeWidth: 0 },
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.surface }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.surface} />

            <View style={[styles.mainCard, { backgroundColor: theme.surface }]}>
                <View style={[styles.header, { borderBottomColor: theme.divider }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.innerTitle, { color: theme.text }]}>Estadísticas</Text>
                    <SettingsGearButton navigation={navigation} color={theme.text} style={styles.gearBtn} />
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.accent} />
                        <Text style={[styles.loadingText, { color: theme.accent }]}>
                            Cargando tus métricas...
                        </Text>
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        <ScrollView
                            contentContainerStyle={styles.scrollBody}
                            {...si.scrollProps}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    colors={[theme.accent]}
                                    tintColor={theme.accent}
                                />
                            }
                        >

                            <View style={styles.statsRow}>
                                <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
                                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Km{"\n"}compartidos</Text>
                                    <Text style={[styles.statValue, { color: theme.text }]}>{stats.kmTotal}</Text>
                                </View>
                                <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
                                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Viajes{"\n"}realizados</Text>
                                    <Text style={[styles.statValue, { color: theme.text }]}>{stats.viajesTotal}</Text>
                                </View>
                                <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
                                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>CO₂{"\n"}ahorrado</Text>
                                    <Text style={[styles.statValue, { color: theme.text }]}>
                                        {stats.co2Total} <Text style={{ fontSize: 10, color: theme.textSecondary }}>kg</Text>
                                    </Text>
                                </View>
                            </View>

                            <View style={[styles.chartContainer, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
                                <Text style={[styles.chartHeaderTitle, { color: theme.text }]}>Kilómetros por mes</Text>
                                <View style={styles.valRow}>
                                    <Text style={[styles.mainValText, { color: theme.text }]}>{stats.kmTotal} km</Text>
                                    <Text style={styles.percentText}>Total</Text>
                                </View>
                                <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>Últimos 6 meses</Text>
                                <LineChart
                                    data={{
                                        labels: stats.labels,
                                        datasets: [{ data: stats.dataKm.length > 0 ? stats.dataKm : [0] }]
                                    }}
                                    width={screenWidth - 90}
                                    height={180}
                                    chartConfig={chartConfig}
                                    bezier
                                    withInnerLines={false}
                                    withOuterLines={false}
                                    withShadow={!theme.dark}
                                    style={styles.chartStyle}
                                />
                            </View>

                            {/* SECTION: DETALLE POR MES */}
                            {monthlyDetails.length > 0 && (
                                <View style={[styles.chartContainer, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
                                    <Text style={[styles.chartHeaderTitle, { color: theme.text, marginBottom: 15 }]}>Historial Mensual</Text>
                                    {monthlyDetails.map((item, index) => (
                                        <View key={item.key} style={[styles.monthRow, { borderBottomColor: theme.divider, borderBottomWidth: index === monthlyDetails.length - 1 ? 0 : StyleSheet.hairlineWidth }]}>
                                            <View style={styles.monthLeft}>
                                                <View style={[styles.monthIconBg, { backgroundColor: theme.surfaceVariant }]}>
                                                    <Ionicons name="calendar-outline" size={20} color={theme.accent} />
                                                </View>
                                                <Text style={[styles.monthName, { color: theme.text }]}>{item.name}</Text>
                                            </View>
                                            <View style={styles.monthRight}>
                                                <Text style={[styles.monthStatLabel, { color: theme.textSecondary }]}>{item.rides} Viajes • {item.co2} kg CO₂</Text>
                                                <Text style={[styles.monthStatKm, { color: theme.text }]}>{item.km} km</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>
                        <ScrollIndicator si={si} thumbColor={theme.accent} />
                    </View>
                )}
            </View>


        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    mainCard: {
        flex: 1,
    },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 20, borderBottomWidth: 1,
    },
    backBtn: { position: 'absolute', left: 20 },
    gearBtn: { position: 'absolute', right: 20 },
    innerTitle: { fontSize: 18, fontWeight: 'bold' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, fontSize: 16 },
    scrollBody: { padding: 20, paddingBottom: 100 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
    statBox: {
        width: '31%', borderRadius: 15,
        padding: 10, alignItems: 'center'
    },
    statLabel: { fontSize: 10, textAlign: 'center', marginBottom: 5 },
    statValue: { fontSize: 15, fontWeight: 'bold' },
    chartContainer: {
        borderRadius: 20, padding: 15,
        marginBottom: 20, borderWidth: 1,
    },
    chartHeaderTitle: { fontSize: 13, fontWeight: 'bold' },
    valRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 5 },
    mainValText: { fontSize: 18, fontWeight: 'bold' },
    percentText: { fontSize: 11, fontWeight: 'bold', color: '#4CAF50', marginLeft: 8 },
    timeLabel: { fontSize: 10, marginBottom: 10 },
    chartStyle: { marginLeft: -15, marginTop: 10 },
    monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    monthLeft: { flexDirection: 'row', alignItems: 'center' },
    monthIconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    monthName: { fontSize: 16, fontWeight: 'bold', textTransform: 'capitalize' },
    monthRight: { alignItems: 'flex-end' },
    monthStatLabel: { fontSize: 11, marginBottom: 4 },
    monthStatKm: { fontSize: 15, fontWeight: 'bold' }
});

export default DriverMetrics;
