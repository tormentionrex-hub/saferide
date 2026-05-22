import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    RefreshControl,
    InteractionManager
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
import BottomNavigationDriver from '../../components/BottomNavigationDriver';

const screenWidth = Dimensions.get('window').width;

// Cache a nivel módulo: evita refetcha en cada useFocusEffect cuando el usuario
// rebota entre tabs. Se invalida con pull-to-refresh o tras 60s.
const METRICS_CACHE_TTL = 60 * 1000;
let driverMetricsCache = { userId: null, stats: null, details: null, ts: 0 };

const DriverMetrics = ({ navigation }) => {
    const { theme } = useDriverTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const si = useScrollIndicator();

    // --- ESTADO PARA DATOS ---
    const [stats, setStats] = useState({
        kmTotal: "0",            // Km manejados (vehículo)
        passengerKmTotal: "0",   // Km compartidos (vehículo × pasajeros)
        co2Total: "0",
        dataKm: [0, 0, 0, 0, 0, 0],
        dataRides: [0, 0, 0, 0, 0, 0],
        labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun"]
    });

    // --- ESTADO PARA HISTORIAL POR MESES ---
    const [monthlyDetails, setMonthlyDetails] = useState([]);

    const fetchMetrics = useCallback(async (forceRefresh = false) => {
        try {
            // 1. Obtener ID del usuario actual mediante sessionCache
            const userId = await sessionCache.getDriverId();
            if (!userId) throw new Error("No se pudo obtener información del usuario");

            // Cache hit: salir temprano si está fresco para este usuario
            if (
                !forceRefresh &&
                driverMetricsCache.userId === userId &&
                Date.now() - driverMetricsCache.ts < METRICS_CACHE_TTL
            ) {
                setStats(driverMetricsCache.stats);
                setMonthlyDetails(driverMetricsCache.details);
                setLoading(false);
                return;
            }

            // 2. Totales precalculados desde el backend (rol=conductor).
            //    El backend se refresca automáticamente al completar viajes (hooks en ride/booking).
            let metricsData = {
                kilometers_driven: 0,
                total_rides: 0,
                carbon_footprint: 0,
                passenger_kilometers: 0,
            };

            try {
                const mResponse = await api.get(`/metrics/user/${userId}?role=conductor`);
                if (mResponse.data.success) {
                    metricsData = mResponse.data.data;
                }
            } catch (e) {
                console.log("No se pudieron cargar métricas, usando ceros.");
            }

            // 3. Detalle mensual (gráfico + historial): se sigue armando en vivo desde rides+bookings.
            //    Filtramos rides que efectivamente tuvieron pasajeros para que el desglose sea
            //    consistente con los totales del backend.
            const rResponse = await api.get(`/rides/driver/${userId}?limit=1000&status=completed`);
            const rawRides = rResponse.data.data || [];

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

            const allRides = ridesWithPassData.filter(ride =>
                ride.bookings && ride.bookings.some(b => b.status === 'completed')
            );

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

            const monthlyObj = {};

            allRides.forEach(ride => {
                if (!ride.fecha) return;

                if (ride.driver_id) {
                    const rideDriverId = typeof ride.driver_id === 'object' ? ride.driver_id._id : ride.driver_id;
                    if (rideDriverId.toString() !== userId.toString()) return;
                }

                // Cantidad real de pasajeros que completaron este viaje
                const passengersInRide = (ride.bookings || []).filter(b => b.status === 'completed').length;
                const rideKm = ride.distance_km || 0;
                const ridePassengerKm = rideKm * passengersInRide;

                const [y, mStr] = ride.fecha.split('-');
                const monthKey = `${y}-${mStr}`;
                if (!monthlyObj[monthKey]) {
                    monthlyObj[monthKey] = { year: y, month: mStr, km: 0, passenger_km: 0, rides: 0 };
                }
                monthlyObj[monthKey].km += rideKm;
                monthlyObj[monthKey].passenger_km += ridePassengerKm;
                monthlyObj[monthKey].rides += 1;

                const [y_num, mm, dd] = ride.fecha.split('-').map(Number);
                const rideDate = new Date(y_num, mm - 1, dd);

                months.forEach((m, idx) => {
                    if (rideDate.getFullYear() === m.year && rideDate.getMonth() === m.month) {
                        kmByMonth[idx] += rideKm;
                        ridesByMonth[idx] += 1;
                    }
                });
            });

            // Totales: fuente única son las métricas precalculadas del backend.
            const km = metricsData?.kilometers_driven ?? 0;
            const passengerKm = metricsData?.passenger_kilometers ?? 0;
            const co2 = metricsData?.carbon_footprint ?? 0;

            const newStats = {
                kmTotal: km.toFixed(1),
                passengerKmTotal: passengerKm.toFixed(1),
                co2Total: co2.toFixed(1),
                dataKm: kmByMonth,
                dataRides: ridesByMonth,
                labels: monthLabels
            };
            setStats(newStats);

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
                    // CO₂ mensual usa passenger-km para que la suma de todos los meses
                    // coincida con el CO₂ total mostrado en la tarjeta superior.
                    const monthCo2 = item.passenger_km * 0.12 * 0.6;
                    return {
                        key,
                        name: `${monthNamesDict[item.month]} ${item.year}`,
                        km: item.km.toFixed(1),
                        rides: item.rides,
                        co2: monthCo2.toFixed(1)
                    };
                });

            setMonthlyDetails(sortedMonthlyData);

            // Guardar en cache para los próximos focuses dentro del TTL
            driverMetricsCache = {
                userId,
                stats: newStats,
                details: sortedMonthlyData,
                ts: Date.now(),
            };

        } catch (error) {
            console.error("Error al traer datos de Mongo:", error?.response?.data?.message || error?.message || 'unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            // Diferir el fetch hasta después de las animaciones de transición del tab
            // para que el cambio de pantalla se sienta más fluido.
            const task = InteractionManager.runAfterInteractions(() => fetchMetrics());
            return () => task.cancel();
        }, [fetchMetrics])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchMetrics(true); // forceRefresh: bypass cache
        setRefreshing(false);
    };

    const chartData = useMemo(
        () => ({
            labels: stats.labels,
            datasets: [{ data: stats.dataKm.length > 0 ? stats.dataKm : [0] }],
        }),
        [stats.labels, stats.dataKm]
    );

    const chartConfig = useMemo(() => ({
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
    }), [theme.surface, theme.dark, theme.accent]);

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

                            {/* Tarjeta prominente: CO₂ ahorrado */}
                            <View style={[styles.statBox, styles.statBoxPrimary, { backgroundColor: theme.surfaceVariant }]}>
                                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>CO₂ ahorrado</Text>
                                <Text style={[styles.statValue, styles.statValuePrimary, { color: theme.text }]}>
                                    {stats.co2Total} <Text style={{ fontSize: 12, color: theme.textSecondary }}>kg</Text>
                                </Text>
                            </View>

                            {/* Segunda fila: dos métricas de kilómetros */}
                            <View style={styles.statsRow}>
                                <View style={[styles.statBox, styles.statBoxHalf, { backgroundColor: theme.surfaceVariant }]}>
                                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Km manejados</Text>
                                    <Text style={[styles.statValue, { color: theme.text }]}>{stats.kmTotal}</Text>
                                </View>
                                <View style={[styles.statBox, styles.statBoxHalf, { backgroundColor: theme.surfaceVariant }]}>
                                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Km compartidos</Text>
                                    <Text style={[styles.statValue, { color: theme.text }]}>{stats.passengerKmTotal}</Text>
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
                                    data={chartData}
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
                                        <MonthRow
                                            key={item.key}
                                            item={item}
                                            theme={theme}
                                            isLast={index === monthlyDetails.length - 1}
                                        />
                                    ))}
                                </View>
                            )}
                        </ScrollView>
                        <ScrollIndicator si={si} thumbColor={theme.accent} />
                    </View>
                )}
            </View>

            <BottomNavigationDriver navigation={navigation} activeTab="none" />
        </SafeAreaView>
    );
};

// Fila del historial mensual aislada y memoizada para evitar re-renders
// de toda la lista cuando solo cambia el estado del padre.
const MonthRow = React.memo(({ item, theme, isLast }) => (
    <View
        style={[
            styles.monthRow,
            {
                borderBottomColor: theme.divider,
                borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
            },
        ]}
    >
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
));

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
    statBoxPrimary: { width: '100%', padding: 16, marginBottom: 12 },
    statBoxHalf: { width: '48%', padding: 12 },
    statLabel: { fontSize: 10, textAlign: 'center', marginBottom: 5 },
    statValue: { fontSize: 15, fontWeight: 'bold' },
    statValuePrimary: { fontSize: 26, fontWeight: 'bold', marginTop: 2 },
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
