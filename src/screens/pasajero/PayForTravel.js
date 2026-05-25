import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, ActivityIndicator, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { useCustomAlert } from '../../context/CustomAlertContext';
import api from '../../services/api';
import PaymentMethodCards from '../../components/PaymentMethodCards';
import ScreenHeader from '../../components/ScreenHeader';
import BottomNavigationBar from '../../components/BottomNavigationBar';

import { moderateScale } from '../../utils/responsive';
const PayForTravel = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const { showAlert } = useCustomAlert();

    const {
        bookingId,
        rideId,
        driverId,
        driverName: driverNameParam,
        driverImage,
        paymentMethod = 'efectivo',
        chargedAmount: chargedAmountParam = null,
    } = route.params || {};

    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);

    // Back (header + hardware) → DashboardPasajero siempre.
    const navigateToDashboard = useCallback(() => {
        navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' });
    }, [navigation]);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => { navigateToDashboard(); return true; };
            const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => sub.remove();
        }, [navigateToDashboard])
    );

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

    const ride = booking?.ride_id;
    const driver = ride?.driver_id;
    const driverPhone = driver?.phone || '';
    const driverName = driver?.name || driverNameParam || 'Conductor';
    const amount = Number(booking?.charged_amount ?? chargedAmountParam) || 0;
    const originName = ride?.origin?.name || 'Origen';
    const destName = ride?.destination?.name || 'Destino';

    const handlePayPalDirect = () => {
        // Flujo post-viaje (NO es lateCharge). Pasamos los datos del conductor
        // para que después del capture, PayPalCheckout pueda redirigir a
        // WaitingPaymentConfirmation con todo lo necesario.
        navigation.navigate('PayPalCheckout', {
            bookingId,
            rideId,
            driverId,
            driverName,
            driverImage,
            chargedAmount: amount,
        });
    };

    const handleContinue = () => {
        // En CustomAlert: confirmText (botón "Sí") dispara onConfirm,
        // cancelText (botón "Aún no") dispara onClose. Por eso la navegación
        // va en onConfirm y onClose se deja en null.
        showAlert(
            '¿Confirmar pago?',
            '¿Estás seguro que ya realizaste el pago correspondiente?',
            'warning',
            'Sí',
            null,
            'Aún no',
            () => {
                navigation.replace('WaitingPaymentConfirmation', {
                    bookingId,
                    rideId,
                    driverId,
                    driverName,
                    driverImage,
                    paymentMethod,
                    chargedAmount: amount,
                });
            },
        );
    };

    const handleSkip = () => {
        showAlert(
            'Aviso',
            'Tendrás un pendiente en tu historial. No podrás hacer uso de nuestros servicios hasta que canceles el viaje o puedes comunicarte con un administrador. Gracias.',
            'warning',
            'OK',
            () => {
                navigation.replace('RateDriver', {
                    rideId,
                    driverId,
                    driverName,
                    driverImage,
                });
            },
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

            <ScreenHeader title="Realizar el pago" onBack={navigateToDashboard} />

            <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                <View style={styles.introBlock}>
                    <View style={[styles.introIcon, { backgroundColor: theme.accent + '18' }]}>
                        <Ionicons name="card" size={30} color={theme.accent} />
                    </View>
                    <Text style={[styles.introTitle, { color: theme.text }]}>
                        ¿Deseas proceder con el pago?
                    </Text>
                    <Text style={[styles.introParagraph, { color: theme.textSecondary }]}>
                        Tu viaje ha finalizado. Selecciona un método de pago a continuación y, una vez completado, presiona Continuar.
                    </Text>
                </View>

                {/* Resumen del viaje */}
                {booking && (
                    <View style={[styles.summaryCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder || theme.border }]}>
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

                        <View style={[styles.routeRow, { backgroundColor: theme.surface, borderColor: theme.cardBorder || theme.border, borderWidth: 1, borderRadius: 12, padding: 12 }]}>
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
                )}

                <PaymentMethodCards
                    amount={amount}
                    driverPhone={driverPhone}
                    driverName={driverName}
                    onPayPal={handlePayPalDirect}
                />

                {/* Botones de acción */}
                <View style={styles.actionsBlock}>
                    <TouchableOpacity
                        style={[styles.continueBtn, { backgroundColor: theme.accent }]}
                        onPress={handleContinue}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.continueBtnText}>Continuar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.skipBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                        onPress={handleSkip}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.skipBtnText, { color: theme.text }]}>Omitir pago</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <BottomNavigationBar navigation={navigation} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },

    introBlock: {
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 24,
    },
    introIcon: {
        width: 64, height: 64, borderRadius: 20,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 14,
    },
    introTitle: {
        fontSize: moderateScale(20),
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
        letterSpacing: -0.4,
        marginBottom: 6,
    },
    introParagraph: {
        fontSize: moderateScale(14),
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        lineHeight: 20,
    },

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

    actionsBlock: {
        paddingHorizontal: 20,
        paddingTop: 8,
        gap: 12,
    },
    continueBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 54,
        borderRadius: 14,
    },
    continueBtnText: {
        color: '#fff',
        fontSize: moderateScale(16),
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.3,
    },
    skipBtn: {
        height: 50,
        borderRadius: 14,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    skipBtnText: {
        fontSize: moderateScale(16),
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.3,
    },
});

export default PayForTravel;
