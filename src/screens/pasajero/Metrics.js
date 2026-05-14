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
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import SettingsGearButton from '../../components/SettingsGearButton';

const screenWidth = Dimensions.get('window').width;

const Metrics = ({ navigation }) => {
    const { theme } = useDriverTheme(); // El pasajero y conductor usan el mismo context de tema en la app actual
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const si = useScrollIndicator();
    
    const [stats, setStats] = useState({
        kmTotal: "0",
        viajesTotal: "0",
        co2Total: "0",
        dataKm: [0, 0, 0, 0, 0, 0],
        labels: ["-", "-", "-", "-", "-", "-"]
    });
    
    const [monthlyDetails, setMonthlyDetails] = useState([]);

    const fetchMetrics = useCallback(async () => {
        try {
            const meResponse = await api.get('/auth/me');
            const userId = meResponse.data.data._id;

            // 1. Peticiones paralelas para ganar velocidad (aquí pedimos bookings en lugar de rides)
            const [mResponse, bResponse] = await Promise.allSettled([
                api.get(`/metrics/user/${userId}`),
                api.get(`/bookings/passenger/${userId}?limit=500&status=completed`) // Filtramos directamente desde el backend para no traer cancelados
            ]);

            let metricsData = mResponse.status === 'fulfilled' ? mResponse.value.data.data : null;
            const allBookings = bResponse.status === 'fulfilled' ? bResponse.value.data.data : [];

            // 2. Preparar contenedores de tiempo (Últimos 6 meses)
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
            let calcKm = 0;
            let calcRides = 0;

            // 3. Procesamiento en UN solo loop
            allBookings.forEach(booking => {
                // Verificar que el booking esté completado y que el registro del ride exista y tenga fecha.
                if (booking.status !== 'completed' || !booking.ride_id || !booking.ride_id.fecha) return;

                const ride = booking.ride_id;
                const [y, m, d] = ride.fecha.split('-').map(Number);
                const rDate = new Date(y, m - 1, d);
                const dist = ride.distance_km || 0;

                calcKm += dist;
                calcRides += 1;

                // Para la lista histórica
                const monthKey = `${y}-${m.toString().padStart(2, '0')}`;
                if (!monthlyObj[monthKey]) {
                    monthlyObj[monthKey] = { year: y, month: m.toString().padStart(2, '0'), km: 0, rides: 0 };
                }
                monthlyObj[monthKey].km += dist;
                monthlyObj[monthKey].rides += 1;

                // Para la gráfica (si cae en el rango de los últimos 6 meses)
                last6Months.forEach(mSlot => {
                    if (rDate.getFullYear() === mSlot.year && rDate.getMonth() === mSlot.month) {
                        mSlot.km += dist;
                    }
                });
            });

            // 4. Formatear resultados
            const finalKm = metricsData?.kilometers_driven || calcKm;
            setStats({
                kmTotal: finalKm.toLocaleString(undefined, { minimumFractionDigits: 1 }),
                viajesTotal: (metricsData?.total_rides || calcRides).toString(),
                co2Total: (metricsData?.carbon_footprint || (calcKm * 0.12 * 0.6)).toFixed(1),
                dataKm: last6Months.map(m => m.km),
                labels: last6Months.map(m => m.label)
            });

            // 5. Historial detallado
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

            setMonthlyDetails(sortedDetails);
        } catch (error) {
            console.error("Error metrics:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchMetrics(); }, [fetchMetrics]));

    const chartConfig = {
        backgroundColor: theme.surface,
        backgroundGradientFrom: theme.surface,
        backgroundGradientTo: theme.surface,
        decimalPlaces: 1,
        color: (opacity = 1) => theme.dark ? `rgba(116, 143, 255, ${opacity})` : `rgba(45, 99, 237, ${opacity})`,
        labelColor: (opacity = 1) => theme.dark ? `rgba(170, 170, 200, ${opacity})` : `rgba(153, 153, 153, ${opacity})`,
        propsForBackgroundLines: { strokeWidth: 0 },
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.surface }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.surface} />
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
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchMetrics} tintColor={theme.accent} />}
                    >
                        {/* Métrica Cards */}
                        <View style={styles.statsRow}>
                            <StatCard label="Km compartidos" value={stats.kmTotal} theme={theme} />
                            <StatCard label="Viajes realizados" value={stats.viajesTotal} theme={theme} />
                            <StatCard label="CO₂ ahorrado" value={`${stats.co2Total} kg`} theme={theme} />
                        </View>

                        {/* Gráfico */}
                        <View style={[styles.chartContainer, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
                            <Text style={[styles.chartHeaderTitle, { color: theme.text }]}>Kilómetros por mes</Text>
                            <LineChart
                                data={{ labels: stats.labels, datasets: [{ data: stats.dataKm }] }}
                                width={screenWidth - 70}
                                height={180}
                                chartConfig={chartConfig}
                                bezier
                                style={styles.chartStyle}
                            />
                        </View>

                        {/* Lista Histórica */}
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Historial Mensual</Text>
                        {monthlyDetails.map((item) => (
                            <View key={item.key} style={[styles.monthRow, { borderBottomColor: theme.divider }]}>
                                <Text style={[styles.monthName, { color: theme.text }]}>{item.name}</Text>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.monthStatKm, { color: theme.text }]}>{item.km} km</Text>
                                    <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{item.rides} viajes</Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                    <ScrollIndicator si={si} thumbColor={theme.accent} />
                </View>
            )}
        </SafeAreaView>
    );
};

// Componente pequeño para las tarjetas superiores
const StatCard = ({ label, value, theme }) => (
    <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
    backBtn: { position: 'absolute', left: 20 },
    gearBtn: { position: 'absolute', right: 20 },
    innerTitle: { fontSize: 18, fontWeight: 'bold', fontFamily: 'Poppins-Bold' },
    loadingContainer: { flex: 1, justifyContent: 'center' },
    scrollBody: { padding: 20, paddingBottom: 50 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    statBox: { width: '31%', borderRadius: 12, padding: 12, alignItems: 'center' },
    statLabel: { fontSize: 10, textAlign: 'center', marginBottom: 4 },
    statValue: { fontSize: 14, fontWeight: 'bold' },
    chartContainer: { borderRadius: 16, padding: 15, borderWidth: 1, marginBottom: 20 },
    chartHeaderTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
    chartStyle: { marginVertical: 8, borderRadius: 16, marginLeft: -10 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
    monthRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 0.5 },
    monthName: { fontSize: 15, fontWeight: '500' },
    monthStatKm: { fontSize: 15, fontWeight: 'bold' }
});

export default Metrics;
