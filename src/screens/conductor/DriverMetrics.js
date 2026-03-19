import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    SafeAreaView, 
    StatusBar, 
    Platform, 
    ScrollView, 
    TouchableOpacity, 
    Dimensions,
    ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import BottomNavigationDriver from '../../components/BottomNavigationDriver';
import api from '../../services/api';

const screenWidth = Dimensions.get('window').width;

const DriverMetrics = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    
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
        backgroundColor: "#ffffff",
        backgroundGradientFrom: "#ffffff",
        backgroundGradientTo: "#ffffff",
        decimalPlaces: 1,
        color: (opacity = 1) => `rgba(45, 99, 237, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(153, 153, 153, ${opacity})`,
        style: { borderRadius: 16 },
        propsForDots: { r: "4", strokeWidth: "2", stroke: "#2D63ED" },
        propsForBackgroundLines: { strokeWidth: 0 }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" />
            
            <Text style={styles.outerTitle}>Métricas del Conductor</Text>

            <View style={styles.mainCard}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color="#1A2B4C" />
                    </TouchableOpacity>
                    <Text style={styles.innerTitle}>Estadísticas</Text>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#2D63ED" />
                        <Text style={styles.loadingText}>Cargando tus métricas...</Text>
                    </View>
                ) : (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
                        
                        <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Km{"\n"}compartidos</Text>
                                <Text style={styles.statValue}>{stats.kmTotal}</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Viajes{"\n"}realizados</Text>
                                <Text style={styles.statValue}>{stats.viajesTotal}</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>CO₂{"\n"}ahorrado</Text>
                                <Text style={styles.statValue}>{stats.co2Total} <Text style={{fontSize: 10}}>kg</Text></Text>
                            </View>
                        </View>

                        <View style={styles.chartContainer}>
                            <Text style={styles.chartHeaderTitle}>Kilómetros por mes</Text>
                            <View style={styles.valRow}>
                                <Text style={styles.mainValText}>{stats.kmTotal} km</Text>
                                <Text style={styles.percentText}>Total</Text>
                            </View>
                            <Text style={styles.timeLabel}>Últimos 6 meses</Text>
                            
                            <LineChart
                                data={{
                                    labels: stats.labels,
                                    datasets: [{ data: stats.dataKm.length > 0 ? stats.dataKm : [0] }]
                                }}
                                width={screenWidth - 80}
                                height={180}
                                chartConfig={chartConfig}
                                bezier
                                withInnerLines={false}
                                withOuterLines={false}
                                withShadow={true}
                                style={styles.chartStyle}
                            />
                        </View>

                        <View style={styles.chartContainer}>
                            <Text style={styles.chartHeaderTitle}>Viajes por mes</Text>
                            <View style={styles.valRow}>
                                <Text style={styles.mainValText}>{stats.viajesTotal} viajes</Text>
                                <Text style={styles.percentText}>Total</Text>
                            </View>
                            <Text style={styles.timeLabel}>Últimos 6 meses</Text>
                            
                            <LineChart
                                data={{
                                    labels: stats.labels,
                                    datasets: [{ data: stats.dataRides.length > 0 ? stats.dataRides : [0] }]
                                }}
                                width={screenWidth - 80}
                                height={180}
                                chartConfig={chartConfig}
                                bezier
                                withInnerLines={false}
                                style={styles.chartStyle}
                            />
                        </View>
                    </ScrollView>
                )}
            </View>

            <BottomNavigationDriver navigation={navigation} activeTab="Perfil" />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
    outerTitle: { 
        fontSize: 22, color: '#A0AAB5', fontWeight: 'bold', 
        paddingHorizontal: 25, marginTop: 15, marginBottom: 10 
    },
    mainCard: { 
        flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 30, 
        borderTopRightRadius: 30, marginHorizontal: 15, elevation: 5,
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10
    },
    header: { 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0'
    },
    backBtn: { position: 'absolute', left: 20 },
    innerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A2B4C' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, color: '#2D63ED', fontSize: 16 },
    scrollBody: { padding: 20, paddingBottom: 100 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
    statBox: { 
        width: '31%', backgroundColor: '#F4F6FB', borderRadius: 15, 
        padding: 10, alignItems: 'center' 
    },
    statLabel: { fontSize: 10, color: '#7E8BA0', textAlign: 'center', marginBottom: 5 },
    statValue: { fontSize: 15, fontWeight: 'bold', color: '#1A2B4C' },
    chartContainer: { 
        backgroundColor: '#FFF', borderRadius: 20, padding: 15, 
        marginBottom: 20, borderWidth: 1, borderColor: '#F0F0F0' 
    },
    chartHeaderTitle: { fontSize: 13, fontWeight: 'bold', color: '#1A2B4C' },
    valRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 5 },
    mainValText: { fontSize: 18, fontWeight: 'bold', color: '#1A2B4C' },
    percentText: { fontSize: 11, fontWeight: 'bold', color: '#4CAF50', marginLeft: 8 },
    timeLabel: { fontSize: 10, color: '#999', marginBottom: 10 },
    chartStyle: { marginLeft: -15, marginTop: 10 }
});

export default DriverMetrics;
