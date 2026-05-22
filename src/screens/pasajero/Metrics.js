import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import passengerBookingsCache from '../../services/passengerBookingsCache';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import SettingsGearButton from '../../components/SettingsGearButton';

const screenWidth = Dimensions.get('window').width;

// Cache a nivel módulo: evita refetcha en cada useFocusEffect cuando el usuario
// rebota entre tabs. Se invalida con pull-to-refresh o tras 60s.
const METRICS_CACHE_TTL = 60 * 1000;
let passengerMetricsCache = { userId: null, stats: null, details: null, ts: 0 };

const Metrics = ({ navigation }) => {
    const { theme } = useDriverTheme(); // El pasajero y conductor usan el mismo context de tema en la app actual
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    // Lazy mount del LineChart: react-native-chart-kit es pesado al montar por
    // primera vez. Esperamos al primer paint para no bloquear la entrada al tab.
    const [chartReady, setChartReady] = useState(false);
    const si = useScrollIndicator();
    
    const [stats, setStats] = useState({
        kmTotal: "0",
        viajesTotal: "0",
        co2Total: "0",
        dataKm: [0, 0, 0, 0, 0, 0],
        labels: ["-", "-", "-", "-", "-", "-"]
    });
    
    const [monthlyDetails, setMonthlyDetails] = useState([]);

    const fetchMetrics = useCallback(async (forceRefresh = false) => {
        try {
            const userId = await sessionCache.getPassengerId();
            if (!userId) throw new Error('No se pudo obtener información del usuario');

            // Si hay cache fresca para este usuario, salir temprano.
            if (
                !forceRefresh &&
                passengerMetricsCache.userId === userId &&
                Date.now() - passengerMetricsCache.ts < METRICS_CACHE_TTL
            ) {
                setStats(passengerMetricsCache.stats);
                setMonthlyDetails(passengerMetricsCache.details);
                setLoading(false);
                setRefreshing(false);
                return;
            }

            // 1. Totales precalculados (Metrics, rol=pasajero) + detalle histórico (bookings)
            //    Los bookings vienen de la cache compartida (DashboardPasajero + History
            //    también la usan), evitando un segundo request si ya están en memoria.
            //    El forceRefresh del pull-to-refresh también limpia la cache compartida.
            const [mResponse, bookingsResult] = await Promise.allSettled([
                api.get(`/metrics/user/${userId}?role=pasajero`),
                passengerBookingsCache.get(forceRefresh)
            ]);

            let metricsData = mResponse.status === 'fulfilled' ? mResponse.value.data.data : null;
            const allBookings = bookingsResult.status === 'fulfilled' ? (bookingsResult.value || []) : [];

            // 2. Totales: vienen directos del endpoint Metrics. Los seteamos
            //    PRIMERO para que el paint inicial muestre las tarjetas
            //    superiores sin esperar el parseo del array de bookings.
            const km = metricsData?.kilometers_driven ?? 0;
            const rides = metricsData?.total_rides ?? 0;
            const co2 = metricsData?.carbon_footprint ?? 0;
            const kmStr = km.toLocaleString(undefined, { minimumFractionDigits: 1 });
            const viajesStr = rides.toString();
            const co2Str = co2.toFixed(1);
            setStats(prev => ({
                ...prev,
                kmTotal: kmStr,
                viajesTotal: viajesStr,
                co2Total: co2Str,
            }));
            // Apagar el spinner: las tarjetas superiores ya tienen datos.
            // El gráfico y el historial entran en un segundo paint.
            setLoading(false);
            setRefreshing(false);

            // 3. Cedemos el thread para que el primer paint ocurra ANTES de
            //    parsear el array de bookings (puede ser grande). Sin este
            //    yield, el forEach bloquea el JS thread durante la transición.
            await new Promise(resolve => setTimeout(resolve, 0));

            // 4. Pre-filtramos UNA vez para no chequear status dentro del loop.
            const relevantBookings = (allBookings || []).filter(
                b => b.status === 'completed' && b.ride_id && b.ride_id.fecha
            );

            const now = new Date();
            const last6Months = Array.from({ length: 6 }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
                return {
                    year: d.getFullYear(),
                    month: d.getMonth(),
                    label: d.toLocaleString('es-ES', { month: 'short' }).replace(/^\w/, c => c.toUpperCase()),
                    km: 0
                };
            });

            const monthlyObj = {};

            relevantBookings.forEach(booking => {
                const ride = booking.ride_id;
                const [y, m] = ride.fecha.split('-').map(Number);
                const dist = ride.distance_km || 0;

                // Para la lista histórica
                const monthKey = `${y}-${m.toString().padStart(2, '0')}`;
                if (!monthlyObj[monthKey]) {
                    monthlyObj[monthKey] = { year: y, month: m.toString().padStart(2, '0'), km: 0, rides: 0 };
                }
                monthlyObj[monthKey].km += dist;
                monthlyObj[monthKey].rides += 1;

                // Para la gráfica: comparamos índices, no construimos Date por booking.
                for (let i = 0; i < last6Months.length; i++) {
                    if (last6Months[i].year === y && last6Months[i].month === m - 1) {
                        last6Months[i].km += dist;
                        break;
                    }
                }
            });

            const dataKm = last6Months.map(m => m.km);
            const labels = last6Months.map(m => m.label);

            const monthNames = { '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril', '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto', '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre' };
            const sortedDetails = Object.keys(monthlyObj)
                .sort((a, b) => b.localeCompare(a))
                .map(key => ({
                    key,
                    name: `${monthNames[monthlyObj[key].month]} ${monthlyObj[key].year}`,
                    km: monthlyObj[key].km.toFixed(1),
                    rides: monthlyObj[key].rides,
                    co2: (monthlyObj[key].km * 0.12 * 0.6).toFixed(1)
                }));

            // 5. Setear gráfico + historial — el segundo paint.
            const newStats = {
                kmTotal: kmStr,
                viajesTotal: viajesStr,
                co2Total: co2Str,
                dataKm,
                labels,
            };
            setStats(newStats);
            setMonthlyDetails(sortedDetails);

            // Guardar en cache para los próximos focuses dentro del TTL
            passengerMetricsCache = {
                userId,
                stats: newStats,
                details: sortedDetails,
                ts: Date.now(),
            };
        } catch (error) {
            console.error("Error metrics:", error?.response?.data?.message || error?.message || 'unknown error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        // Diferir el fetch hasta después de las animaciones de transición del tab
        // para que el cambio de pantalla se sienta más fluido.
        const task = InteractionManager.runAfterInteractions(() => fetchMetrics());
        return () => task.cancel();
    }, [fetchMetrics]));

    // Montar el LineChart sólo después del primer paint con datos.
    // La libreria es pesada en el primer mount y bloquea el JS thread si entra
    // al mismo tiempo que las animaciones de transición.
    useEffect(() => {
        if (!loading && !chartReady) {
            const t = InteractionManager.runAfterInteractions(() => setChartReady(true));
            return () => t.cancel();
        }
    }, [loading, chartReady]);

    const chartData = useMemo(
        () => ({ labels: stats.labels, datasets: [{ data: stats.dataKm }] }),
        [stats.labels, stats.dataKm]
    );

    const chartConfig = useMemo(() => ({
        backgroundColor: theme.surface,
        backgroundGradientFrom: theme.surface,
        backgroundGradientTo: theme.surface,
        decimalPlaces: 1,
        color: (opacity = 1) => theme.dark ? `rgba(116, 143, 255, ${opacity})` : `rgba(45, 99, 237, ${opacity})`,
        labelColor: (opacity = 1) => theme.dark ? `rgba(170, 170, 200, ${opacity})` : `rgba(153, 153, 153, ${opacity})`,
        propsForBackgroundLines: { strokeWidth: 0 },
    }), [theme.surface, theme.dark]);

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.innerTitle, { color: theme.text }]}>Estadísticas</Text>
                <SettingsGearButton
                    navigation={navigation}
                    color={theme.text}
                    style={styles.gearBtn}
                    profileScreen="PasajeroProfileScreen"
                    settingsScreen="SettingPasajero"
                />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.accent} /></View>
            ) : (
                <View style={{ flex: 1 }}>
                    <ScrollView 
                        contentContainerStyle={styles.scrollBody} 
                        {...si.scrollProps}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMetrics(true); }} tintColor={theme.accent} />}
                    >
                        {/* Métrica Cards */}
                        <View style={styles.statsRow}>
                            <StatCard label="Km compartidos" value={stats.kmTotal} theme={theme} />
                            <StatCard label="Viajes realizados" value={stats.viajesTotal} theme={theme} />
                            <StatCard label="CO₂ ahorrado" value={`${stats.co2Total} kg`} theme={theme} />
                        </View>

                        {/* Gráfico — lazy mount para no bloquear el primer paint */}
                        <View style={[styles.chartContainer, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
                            <Text style={[styles.chartHeaderTitle, { color: theme.text }]}>Kilómetros por mes</Text>
                            {chartReady ? (
                                <LineChart
                                    data={chartData}
                                    width={screenWidth - 70}
                                    height={180}
                                    chartConfig={chartConfig}
                                    bezier
                                    style={styles.chartStyle}
                                />
                            ) : (
                                <View style={[styles.chartStyle, styles.chartPlaceholder]}>
                                    <ActivityIndicator size="small" color={theme.accent} />
                                </View>
                            )}
                        </View>

                        {/* Lista Histórica */}
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
        </SafeAreaView>
    );
};

// Componente pequeño para las tarjetas superiores
const StatCard = React.memo(({ label, value, theme }) => (
    <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    </View>
));

// Fila del historial mensual, aislada para evitar re-renders de toda la lista
// cuando solo cambia el estado del padre (scroll, theme, etc.).
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
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
    backBtn: { position: 'absolute', left: 20 },
    gearBtn: { position: 'absolute', right: 20 },
    innerTitle: { fontSize: 22, fontFamily: 'Poppins-Bold' },
    loadingContainer: { flex: 1, justifyContent: 'center' },
    scrollBody: { padding: 20, paddingBottom: 50 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    statBox: { width: '31%', borderRadius: 12, padding: 12, alignItems: 'center' },
    statLabel: { fontSize: 10, textAlign: 'center', marginBottom: 4 },
    statValue: { fontSize: 14, fontFamily: 'Poppins-Bold' },
    chartContainer: { borderRadius: 20, padding: 15, borderWidth: 1, marginBottom: 20 },
    chartHeaderTitle: { fontSize: 13, fontFamily: 'Poppins-Bold' },
    chartStyle: { marginVertical: 8, borderRadius: 16, marginLeft: -10 },
    chartPlaceholder: { height: 180, alignItems: 'center', justifyContent: 'center' },
    monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    monthLeft: { flexDirection: 'row', alignItems: 'center' },
    monthIconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    monthName: { fontSize: 16, fontFamily: 'Poppins-Bold', textTransform: 'capitalize' },
    monthRight: { alignItems: 'flex-end' },
    monthStatLabel: { fontSize: 11, marginBottom: 4 },
    monthStatKm: { fontSize: 15, fontFamily: 'Poppins-Bold' }
});

export default Metrics;
