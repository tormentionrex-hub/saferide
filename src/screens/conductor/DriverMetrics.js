import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import BottomNavigationDriver from '../../components/BottomNavigationDriver';
import api from '../../services/api';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';

const screenWidth = Dimensions.get('window').width;

const DriverMetrics = ({ navigation }) => {
    const { theme } = useDriverTheme();
    const [loading, setLoading] = useState(true);
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

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                // 1. Obtener ID del usuario actual
                const meResponse = await api.get('/auth/me');
                if (!meResponse.data.success) throw new Error("No se pudo obtener información del usuario");
                const userId = meResponse.data.data._id;

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
                }

                // 3. Obtener Historial de Viajes para armar el gráfico
                const rResponse = await api.get(`/rides/driver/${userId}`);
                const allRides = rResponse.data.data || [];
                
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

                allRides.forEach(ride => {
                    const rideDate = new Date(ride.date_time);
                    months.forEach((m, idx) => {
                        if (rideDate.getFullYear() === m.year && rideDate.getMonth() === m.month && ride.status === 'completed') {
                            kmByMonth[idx] += (ride.distance_km || 0);
                            ridesByMonth[idx] += 1;
                        }
                    });
                });

                setStats({
                    kmTotal: metricsData.kilometers_driven.toLocaleString(),
                    viajesTotal: metricsData.total_rides.toString(),
                    co2Total: metricsData.carbon_footprint.toFixed(1),
                    dataKm: kmByMonth,
                    dataRides: ridesByMonth,
                    labels: monthLabels
                });

                setLoading(false);
            } catch (error) {
                console.error("Error al traer datos de Mongo:", error);
                setLoading(false);
            }
        };
        fetchMetrics();
    }, []);

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
                    <ScrollView contentContainerStyle={styles.scrollBody} {...si.scrollProps}>

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
                    </ScrollView>
                    <ScrollIndicator si={si} thumbColor={theme.accent} />
                    </View>
                )}
            </View>

            <BottomNavigationDriver navigation={navigation} activeTab="Perfil" />
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
    chartStyle: { marginLeft: -15, marginTop: 10 }
});

export default DriverMetrics;
