import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
    StatusBar, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { useCustomAlert } from '../../context/CustomAlertContext';
import api from '../../services/api';
import PaymentMethodCards from '../../components/PaymentMethodCards';
import ScreenHeader from '../../components/ScreenHeader';

import { moderateScale } from '../../utils/responsive';
const PendingPayment = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const { showAlert } = useCustomAlert();

    const { bookingId } = route.params || {};
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!bookingId) {
            setLoading(false);
            return;
        }
        const fetchBooking = async () => {
            try {
                const res = await api.get(`/bookings/${bookingId}`);
                if (res.data?.success) setBooking(res.data.data);
            } catch (e) {
                showAlert('Error', 'No se pudo cargar la información del viaje.', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchBooking();
    }, [bookingId]);

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.accent} />
            </SafeAreaView>
        );
    }

    if (!booking) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
                <View style={styles.center}>
                    <Ionicons name="warning-outline" size={60} color="#EF4444" />
                    <Text style={[styles.errorText, { color: theme.text }]}>
                        No encontramos la información de este viaje.
                    </Text>
                    <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent }]} onPress={() => navigation.goBack()}>
                        <Text style={styles.primaryBtnText}>Volver</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (booking.payment_status === 'paid') {
        // Ya está pagado, evitar mostrar la pantalla
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
                <View style={styles.center}>
                    <View style={[styles.paidIcon, { backgroundColor: '#E7F8EE' }]}>
                        <Ionicons name="checkmark-circle" size={70} color="#10B981" />
                    </View>
                    <Text style={[styles.errorText, { color: theme.text }]}>
                        Este viaje ya fue pagado.
                    </Text>
                    <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#10B981' }]} onPress={() => navigation.goBack()}>
                        <Text style={styles.primaryBtnText}>Volver al historial</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const ride = booking.ride_id;
    const driver = ride?.driver_id;
    const driverPhone = driver?.phone || '';
    const driverName = driver?.name || 'Conductor';
    const amount = Number(booking.charged_amount) || 0;
    const originName = ride?.origin?.name || 'Origen';
    const destName = ride?.destination?.name || 'Destino';

    const handlePayPal = () => {
        navigation.navigate('PayPalCheckout', {
            bookingId: booking._id,
            mode: 'lateCharge',
        });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

            <ScreenHeader title="Pagar viaje" onBack={() => navigation.goBack()} useInsets />

            <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
                {/* Resumen del viaje */}
                <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.summaryHeader}>
                        <View style={[styles.urgentDot, { backgroundColor: '#FF3B30' }]} />
                        <Text style={styles.urgentLabel}>COBRO PENDIENTE</Text>
                    </View>

                    <Text style={[styles.amountLabel, { color: theme.textSecondary }]}>MONTO A PAGAR</Text>
                    <Text style={[styles.amountValue, { color: theme.text }]}>
                        ₡{Number(amount).toLocaleString('es-CR')}
                    </Text>

                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    <View style={styles.metaRow}>
                        <View style={[styles.metaIcon, { backgroundColor: theme.surfaceVariant }]}>
                            <Ionicons name="person" size={16} color={theme.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>CONDUCTOR</Text>
                            <Text style={[styles.metaValue, { color: theme.text }]} numberOfLines={1}>
                                {driverName}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.routeRow}>
                        <View style={styles.routeIconCol}>
                            <Ionicons name="radio-button-on" size={14} color={theme.accent} />
                            <View style={[styles.routeLine, { backgroundColor: theme.border }]} />
                            <Ionicons name="location" size={14} color="#FF5A5F" />
                        </View>
                        <View style={{ flex: 1, gap: 14 }}>
                            <Text style={[styles.routeText, { color: theme.text }]} numberOfLines={1}>{originName}</Text>
                            <Text style={[styles.routeText, { color: theme.text }]} numberOfLines={1}>{destName}</Text>
                        </View>
                    </View>
                </View>

                <PaymentMethodCards
                    amount={amount}
                    driverPhone={driverPhone}
                    driverName={driverName}
                    onPayPal={handlePayPal}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: 18 },
    errorText: { fontSize: moderateScale(16), fontFamily: 'Poppins-SemiBold', textAlign: 'center' },
    paidIcon: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center' },
    primaryBtn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
    primaryBtnText: { color: '#fff', fontFamily: 'Poppins-Bold', fontSize: moderateScale(15) },

    summaryCard: {
        marginHorizontal: 20,
        marginBottom: 24,
        padding: 18,
        borderRadius: 22,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    urgentDot: { width: 8, height: 8, borderRadius: 4 },
    urgentLabel: {
        fontSize: moderateScale(10),
        fontFamily: 'Poppins-Bold',
        color: '#FF3B30',
        letterSpacing: 1.5,
    },
    amountLabel: { fontSize: moderateScale(10), fontFamily: 'Poppins-Bold', letterSpacing: 1.2, marginBottom: 4 },
    amountValue: { fontSize: moderateScale(34), fontFamily: 'Poppins-Bold', letterSpacing: -1 },
    divider: { height: 1, marginVertical: 16 },

    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    metaIcon: {
        width: 38, height: 38, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    metaLabel: { fontSize: moderateScale(10), fontFamily: 'Poppins-Bold', letterSpacing: 1.1, marginBottom: 2 },
    metaValue: { fontSize: moderateScale(14), fontFamily: 'Poppins-SemiBold' },

    routeRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    routeIconCol: { alignItems: 'center' },
    routeLine: { width: 2, height: 18, marginVertical: 3 },
    routeText: { fontSize: moderateScale(13), fontFamily: 'Poppins-SemiBold' },
});

export default PendingPayment;
