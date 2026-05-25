import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, StatusBar, Animated, Easing, Image, BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { useCustomAlert } from '../../context/CustomAlertContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import ScreenHeader from '../../components/ScreenHeader';
import BottomNavigationBar from '../../components/BottomNavigationBar';

import { moderateScale } from '../../utils/responsive';
const POLL_INTERVAL_MS = 3000;

const WaitingPaymentConfirmation = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const { showAlert } = useCustomAlert();
    const insets = useSafeAreaInsets();

    const {
        bookingId,
        rideId,
        driverId,
        driverName,
        driverImage,
        paymentMethod = 'efectivo',
        chargedAmount = null,
    } = route.params || {};

    const [amount, setAmount] = useState(chargedAmount);
    const [resolved, setResolved] = useState(false);

    const baselineUpdatedRef = useRef(null);
    const pollRef = useRef(null);
    const mountedRef = useRef(true);
    const fetchingRef = useRef(false);

    // Animaciones de los anillos pulsantes
    const ring1 = useRef(new Animated.Value(0)).current;
    const ring2 = useRef(new Animated.Value(0)).current;
    const dotsAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Back hardware (Android) → DashboardPasajero.
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
        const loop = (val, delay) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(val, {
                        toValue: 1,
                        duration: 2200,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(val, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ]),
            );

        loop(ring1, 0).start();
        loop(ring2, 1100).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(dotsAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
                Animated.timing(dotsAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
            ]),
        ).start();
    }, []);

    const goToRate = (extra = {}) => {
        navigation.replace('RateDriver', {
            rideId,
            driverId,
            driverName,
            driverImage,
            ...extra,
        });
    };

    const stopPolling = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    useEffect(() => {
        if (!bookingId) return;

        const poll = async () => {
            if (fetchingRef.current || resolved) return;
            fetchingRef.current = true;
            try {
                const res = await api.get(`/bookings/${bookingId}`);
                if (!mountedRef.current || resolved) return;
                if (res.data?.success) {
                    const b = res.data.data;

                    if (b?.charged_amount && amount == null) {
                        setAmount(b.charged_amount);
                    }

                    // Una sola señal para liberar al pasajero: el conductor
                    // seteó payment_reviewed_at al tocar "Continuar" en
                    // PaymentVerification (o el toggle de pago en
                    // PreviousTripsScreen). Es independiente del veredicto
                    // Pagó/No pagó — eso se lee después de payment_status.
                    //
                    // Por qué este enfoque: el caso "auto-cancel del ride
                    // + conductor marca No pagó" no genera cambios en
                    // ride.status (queda cancelled) ni en payment_status
                    // (queda pending), así que sin un campo dedicado el
                    // polling no tendría manera de saber que el conductor
                    // ya tomó su decisión.
                    if (!b.payment_reviewed_at) {
                        return;
                    }

                    setResolved(true);
                    stopPolling();

                    const isCancelled = b.status === 'cancelled' || b.status === 'canceled';

                    // Los bookings cancelados NO van a RateDriver (el backend
                    // rechaza calificar reservas canceladas). Van directo al
                    // Dashboard donde la deuda se ve en History/BuscarViaje.
                    const navigateAfter = (extra = {}) => {
                        if (isCancelled) {
                            navigation.navigate('MainTabsPasajero', { screen: 'DashboardPasajero' });
                        } else {
                            goToRate(extra);
                        }
                    };

                    // Viaje regalado: no hay pago que confirmar. Pasa directo
                    // a calificar (o al Dashboard si la reserva quedó cancelada).
                    if (b.payment_type === 'gifted') {
                        if (isCancelled) {
                            navigateAfter();
                        } else {
                            goToRate({ paidConfirmed: true, gifted: true });
                        }
                        return;
                    }

                    // Caso normal: el veredicto del conductor está en payment_status.
                    if (b.payment_status === 'paid') {
                        showAlert(
                            '¡Pago realizado correctamente!',
                            isCancelled
                                ? 'La penalización por cancelación fue cubierta. Gracias.'
                                : 'Gracias por viajar usando SafeRide.',
                            'success',
                            'Continuar',
                            () => navigateAfter({ paidConfirmed: true })
                        );
                    } else if (b.payment_status === 'pending') {
                        showAlert(
                            'El pago no fue realizado',
                            'Por favor ve al historial a realizar el pago antes de recibir una amonestación.',
                            'warning',
                            'Entendido',
                            () => navigateAfter({ paidConfirmed: false, hasUnpaidCharge: true })
                        );
                    }
                }
            } catch (e) {
                console.log('[WaitingPayment] poll error:', e?.message);
            } finally {
                fetchingRef.current = false;
            }
        };

        poll();
        pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
            fetchingRef.current = false;
        };
    }, [bookingId, resolved]);

    const methodLabel = paymentMethod === 'tarjeta' ? 'tarjeta' : 'efectivo';
    const methodIcon = paymentMethod === 'tarjeta' ? 'card-outline' : 'cash-outline';

    const ringStyle = (anim) => ({
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.9] }) }],
    });

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

            <ScreenHeader
                title="Confirmando pago"
                useInsets
                right={
                    <View style={[styles.headerIcon, { backgroundColor: theme.surfaceVariant }]}>
                        <Ionicons name={methodIcon} size={20} color={theme.accent} />
                    </View>
                }
            />

            <View style={styles.center}>
                <View style={styles.avatarWrap}>
                    <Animated.View style={[styles.ring, { borderColor: theme.accent }, ringStyle(ring1)]} />
                    <Animated.View style={[styles.ring, { borderColor: theme.accent }, ringStyle(ring2)]} />
                    <View style={[styles.avatarCircle, { backgroundColor: theme.surface, borderColor: theme.accent }]}>
                        {driverImage ? (
                            <Image source={{ uri: driverImage }} style={styles.avatarImg} />
                        ) : (
                            <Ionicons name="person" size={48} color={theme.accent} />
                        )}
                    </View>
                </View>

                <Text style={[styles.title, { color: theme.text }]}>
                    Esperando la respuesta{'\n'}del conductor
                </Text>

                <View style={styles.dotsRow}>
                    {[0, 1, 2].map((i) => (
                        <Animated.View
                            key={i}
                            style={[
                                styles.dot,
                                { backgroundColor: theme.accent },
                                {
                                    opacity: dotsAnim.interpolate({
                                        inputRange: [0, 0.5, 1],
                                        outputRange: i === 0 ? [1, 0.3, 1] : i === 1 ? [0.3, 1, 0.3] : [1, 0.3, 1],
                                    }),
                                },
                            ]}
                        />
                    ))}
                </View>

                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                    {driverName ? `${driverName.split(' ')[0]} ` : 'Tu conductor '}
                    está confirmando si recibió tu pago en {methodLabel}.
                </Text>

                {amount != null && Number(amount) > 0 && (
                    <View style={[styles.amountCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <Text style={[styles.amountLabel, { color: theme.textSecondary }]}>MONTO DEL VIAJE</Text>
                        <Text style={[styles.amountValue, { color: theme.text }]}>₡{amount}</Text>
                    </View>
                )}
            </View>

            <View style={[styles.footer, { paddingBottom: 90 + (insets.bottom > 0 ? insets.bottom : 14) }]}>
                <View style={[styles.tipBox, { backgroundColor: theme.surfaceVariant }]}>
                    <Ionicons name="information-circle-outline" size={18} color={theme.accent} />
                    <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                        Esto suele tardar solo unos segundos. No cierres la aplicación.
                    </Text>
                </View>
            </View>

            <BottomNavigationBar navigation={navigation} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerIcon: {
        width: 38, height: 38, borderRadius: 19,
        justifyContent: 'center', alignItems: 'center',
    },

    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
    },

    avatarWrap: {
        width: 170, height: 170,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 26,
    },
    ring: {
        position: 'absolute',
        width: 170, height: 170, borderRadius: 85,
        borderWidth: 2,
    },
    avatarCircle: {
        width: 120, height: 120, borderRadius: 60,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 3,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        overflow: 'hidden',
    },
    avatarImg: { width: '100%', height: '100%' },

    title: {
        fontSize: moderateScale(24),
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
        letterSpacing: -0.5,
        lineHeight: 32,
        marginBottom: 14,
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    dot: {
        width: 8, height: 8, borderRadius: 4,
    },
    subtitle: {
        fontSize: moderateScale(14),
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 22,
        paddingHorizontal: 6,
    },

    amountCard: {
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
    },
    amountLabel: {
        fontSize: moderateScale(10),
        fontFamily: 'Poppins-Bold',
        letterSpacing: 1.4,
        marginBottom: 4,
    },
    amountValue: {
        fontSize: moderateScale(26),
        fontFamily: 'Poppins-Bold',
        letterSpacing: -0.5,
    },

    footer: {
        paddingHorizontal: 22,
        paddingTop: 12,
    },
    tipBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
    },
    tipText: {
        flex: 1,
        fontSize: moderateScale(12),
        fontFamily: 'Poppins-Regular',
        lineHeight: 17,
    },
});

export default WaitingPaymentConfirmation;
