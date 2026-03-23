import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { useDriverTheme } from '../../context/DriverThemeContext';
import SettingsGearButton from '../../components/SettingsGearButton';

const ManageRides = ({ navigation }) => {
    const { theme } = useDriverTheme();
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRides = async () => {
            try {
                setLoading(true);
                const meResponse = await api.get('/auth/me');
                if (!meResponse.data.success) throw new Error('No se pudo identificar al conductor');
                const driverId = meResponse.data.data._id;

                const ridesResponse = await api.get(`/rides/driver/${driverId}?status=scheduled`);
                setRides(ridesResponse.data.data || []);
            } catch (error) {
                console.error('Error fetching rides:', error);
            } finally {
                setLoading(false);
            }
        };

        const unsubscribe = navigation.addListener('focus', () => {
            fetchRides();
        });

        return unsubscribe;
    }, [navigation]);

    const renderRideItem = ({ item }) => {
        const originName = item.origin?.name || 'Origen Desconocido';
        const destName = item.destination?.name || 'Destino Desconocido';
        const date = new Date(item.date_time);

        return (
            <View style={[styles.rideCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.routeContainer}>
                    <Ionicons name="radio-button-on" size={16} color={theme.accent} />
                    <View style={[styles.line, { backgroundColor: theme.divider }]} />
                    <Ionicons name="location" size={16} color="#FF5A5F" />

                    <View style={styles.routeTextContainer}>
                        <Text style={[styles.locationText, { color: theme.text }]} numberOfLines={1}>{originName}</Text>
                        <Text style={[styles.locationText, { color: theme.text, marginTop: 15 }]} numberOfLines={1}>{destName}</Text>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.divider }]} />

                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                        <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
                        <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                            {date.toLocaleDateString()}
                        </Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
                        <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Ionicons name="people-outline" size={16} color={theme.textSecondary} />
                        <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                            {item.available_seats} asientOS
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.manageBtn, { backgroundColor: theme.accent }]}
                    onPress={() => navigation.navigate('ListOfRequests', { rideId: item._id })}
                >
                    <Text style={styles.manageBtnText}>Gestionar solicitudes</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.surface} />
            <View style={[styles.header, { borderBottomColor: theme.divider }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>Mis Viajes Publicados</Text>
                <SettingsGearButton navigation={navigation} color={theme.text} style={styles.gearBtn} />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={rides}
                    keyExtractor={(item, index) => item._id || index.toString()}
                    renderItem={renderRideItem}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Ionicons name="map-outline" size={60} color={theme.border} />
                            <Text style={{ color: theme.textSecondary, marginTop: 10 }}>No tienes viajes publicados activos.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, borderBottomWidth: 1 },
    backBtn: { position: 'absolute', left: 20 },
    gearBtn: { position: 'absolute', right: 20 },
    title: { fontSize: 18, fontWeight: 'bold' },
    rideCard: { padding: 15, borderRadius: 15, borderWidth: 1, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    routeContainer: { flexDirection: 'row', alignItems: 'center', minHeight: 60 },
    line: { width: 2, height: 25, position: 'absolute', left: 7, top: 18 },
    routeTextContainer: { marginLeft: 15, flex: 1, justifyContent: 'space-between', height: 50 },
    locationText: { fontSize: 15, fontWeight: 'bold' },
    divider: { height: 1, marginVertical: 15 },
    detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    detailText: { fontSize: 13, fontWeight: '500' },
    manageBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    manageBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});

export default ManageRides;
