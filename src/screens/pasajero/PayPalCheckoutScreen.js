import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView,
    Platform, StatusBar, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { API_URL } from '../../config';
import { useCustomAlert } from '../../context/CustomAlertContext';
import PaymentOptionList from '../../components/checkout/PaymentOptionList';
import { getCheckoutColors } from '../../components/checkout/checkoutTheme';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { moderateScale } from '../../utils/responsive';

// Checkout en línea del viaje. Todos los medios se procesan con PayPal (la
// única pasarela con credenciales hoy):
//   - Tarjeta: formulario propio servido por el backend (public/checkout) con
//     PayPal Card Fields; los datos de la tarjeta van directo a PayPal.
//   - PayPal: la página oficial de PayPal, que además acepta tarjeta como
//     invitado.
//   - Apple Pay / Google Pay: se muestran solo en su plataforma, pero exigen
//     dominio HTTPS verificado y cuenta de comercio habilitada; hasta entonces
//     quedan como no disponibles y lo dicen, en vez de fingir un cobro.
// Un pago capturado deja la reserva pagada en el backend sin esperar al
// conductor.

const API_ORIGIN = (API_URL || '').replace(/\/api\/v\d+\/?$/, '');
const RETURN_HOST = 'saferide.app/paypal/';

const WALLET_PENDING_MSG =
    'Disponible cuando SafeRide se publique con dominio HTTPS y la cuenta de comercio esté verificada. Mientras tanto, paga con tarjeta o PayPal.';

const buildOptions = () => {
    const options = [
        { id: 'card', title: 'Tarjeta de crédito o débito', subtitle: 'Pague con tarjeta de débito o crédito Visa, Mastercard o Maestro' },
        { id: 'paypal', title: 'PayPal', subtitle: 'Paga con tu cuenta de PayPal' },
    ];
    if (Platform.OS === 'ios') {
        options.push({ id: 'apple_pay', title: 'Apple Pay', subtitle: 'Pagar con Apple Pay', unavailable: true });
    }
    if (Platform.OS === 'android') {
        options.push({ id: 'google_pay', title: 'Google Pay', subtitle: 'Paga con Google Pay', unavailable: true });
    }
    return options;
};

const PayPalCheckoutScreen = ({ navigation, route }) => {
    const {
        bookingId,
        rideId,
        driverId,
        driverName,
        driverImage,
        chargedAmount,
        mode,
    } = route.params || {};
    const isLateCharge = mode === 'lateCharge';
    const { showAlert } = useCustomAlert();
    const { theme } = useDriverTheme();
    const C = useMemo(() => getCheckoutColors(theme), [theme]);
    const styles = useMemo(() => makeStyles(C), [C]);

    const options = useMemo(buildOptions, []);
    const [selected, setSelected] = useState('card');
    const [step, setStep] = useState('choose'); // choose | card | paypal | capturing
    const [order, setOrder] = useState(null);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);
    // Ref y no estado: el retorno de PayPal puede llegar por dos callbacks en
    // el mismo ciclo y la captura no debe dispararse dos veces.
    const captureStarted = useRef(false);

    const selectedOption = options.find(o => o.id === selected);
    const amountCrc = order?.amountCrc ?? (Number(chargedAmount) || 0);

    const backToChoose = useCallback(() => {
        setStep('choose');
        setOrder(null);
        captureStarted.current = false;
    }, []);

    // Back de hardware: dentro de un paso de pago vuelve a la lista de
    // métodos; en la lista deja el comportamiento normal.
    useFocusEffect(
        useCallback(() => {
            const onBack = () => {
                if (step === 'card' || step === 'paypal') { backToChoose(); return true; }
                return step === 'capturing';
            };
            const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
            return () => sub.remove();
        }, [step, backToChoose])
    );

    const goToNext = () => {
        if (isLateCharge) {
            navigation.navigate('MainTabsPasajero', { screen: 'History' });
            return;
        }
        // La reserva ya quedó pagada y revisada: WaitingPaymentConfirmation
        // lo detecta en su primer sondeo, muestra el éxito y pasa a calificar.
        navigation.replace('WaitingPaymentConfirmation', {
            bookingId,
            rideId,
            driverId,
            driverName,
            driverImage,
            paymentMethod: selected,
            chargedAmount,
        });
    };

    const capture = async (orderId, method) => {
        if (captureStarted.current) return;
        captureStarted.current = true;
        setStep('capturing');
        try {
            const res = await api.post('/paypal/capture-order', { orderId, bookingId, method });
            if (res.data?.success) {
                if (isLateCharge) {
                    showAlert('Pago realizado', 'Tu cuota pendiente quedó pagada. Gracias.', 'success', 'Continuar', goToNext);
                } else {
                    goToNext();
                }
                return;
            }
            setError('El pago fue autorizado pero no se pudo confirmar. No se te cobró dos veces; intenta de nuevo.');
        } catch (err) {
            setError(err.response?.data?.message === 'Payment not completed or failed'
                ? 'El pago no se completó. Puedes intentarlo de nuevo con otro método.'
                : 'Ocurrió un error confirmando el pago. Revisa tu conexión e intenta de nuevo.');
        }
        setStep('choose');
        captureStarted.current = false;
    };

    const handleContinue = async () => {
        if (!bookingId) { setError('No se encontró la reserva a pagar.'); return; }
        if (selectedOption?.unavailable) return;
        setCreating(true);
        setError(null);
        try {
            const res = await api.post('/paypal/create-order', { bookingId });
            if (!res.data?.success) throw new Error(res.data?.message);
            setOrder(res.data);
            setStep(selected === 'card' ? 'card' : 'paypal');
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            setError(msg === 'Booking is already paid'
                ? 'Esta reserva ya está pagada.'
                : 'No se pudo iniciar el pago. Revisa tu conexión e intenta de nuevo.');
        } finally {
            setCreating(false);
        }
    };

    const onCardMessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.nativeEvent.data); } catch (_) { return; }
        if (msg.type === 'approved') {
            capture(msg.orderID || order?.orderId, 'card');
        } else if (msg.type === 'unavailable') {
            backToChoose();
            setSelected('paypal');
            setError(msg.code === 'NOT_ELIGIBLE'
                ? 'El pago directo con tarjeta no está habilitado todavía. Usa PayPal: también acepta tarjeta sin crear cuenta.'
                : msg.message);
        }
    };

    // PayPal redirige a return_url/cancel_url de saferide.app; se interceptan
    // aquí y nunca llegan a cargarse.
    const onPayPalRequest = (request) => {
        const url = request.url || '';
        if (!url.includes(RETURN_HOST)) return true;
        if (url.includes('/paypal/success')) {
            capture(order?.orderId, 'paypal');
        } else {
            backToChoose();
        }
        return false;
    };

    const header = (
        <View style={styles.header}>
            <Pressable
                onPress={() => (step === 'choose' ? navigation.goBack() : backToChoose())}
                hitSlop={12}
                style={styles.backBtn}
                accessibilityRole="button"
                accessibilityLabel={step === 'choose' ? 'Volver' : 'Cambiar método de pago'}
            >
                <Ionicons name="chevron-back" size={24} color={C.onSurface} />
            </Pressable>
            <Text style={styles.headerTitle}>
                {step === 'card' ? 'Pago con tarjeta' : step === 'paypal' ? 'PayPal' : 'Método de pago'}
            </Text>
            <View style={styles.backBtn} />
        </View>
    );

    if (step === 'capturing') {
        return (
            <SafeAreaView style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={C.accent} />
                <Text style={styles.centerText}>Confirmando tu pago…</Text>
            </SafeAreaView>
        );
    }

    if (step === 'card' && order) {
        const uri = `${API_ORIGIN}/checkout/card.html?orderId=${encodeURIComponent(order.orderId)}`
            + `&crc=${order.amountCrc}&usd=${order.amountUsd}&theme=${theme.dark ? 'dark' : 'light'}`;
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <StatusBar barStyle={C.statusBar} backgroundColor={C.bg} />
                {header}
                <WebView
                    source={{ uri }}
                    onMessage={onCardMessage}
                    style={{ backgroundColor: C.bg }}
                    javaScriptEnabled
                    domStorageEnabled
                    setSupportMultipleWindows={false}
                    startInLoadingState
                    renderLoading={() => (
                        <View style={[StyleSheet.absoluteFill, styles.center]}>
                            <ActivityIndicator size="large" color={C.accent} />
                        </View>
                    )}
                    onError={() => { backToChoose(); setError('No se pudo abrir el formulario de pago. Revisa tu conexión.'); }}
                />
            </SafeAreaView>
        );
    }

    if (step === 'paypal' && order) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <StatusBar barStyle={C.statusBar} backgroundColor={C.bg} />
                {header}
                <WebView
                    source={{ uri: order.approvalUrl }}
                    onShouldStartLoadWithRequest={onPayPalRequest}
                    // Respaldo: algunas versiones de Android no consultan
                    // onShouldStartLoadWithRequest en redirecciones del servidor.
                    onNavigationStateChange={(nav) => {
                        if ((nav.url || '').includes(RETURN_HOST)) onPayPalRequest(nav);
                    }}
                    javaScriptEnabled
                    domStorageEnabled
                    startInLoadingState
                    renderLoading={() => (
                        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: '#FFFFFF' }]}>
                            <ActivityIndicator size="large" color={C.accent} />
                        </View>
                    )}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={C.statusBar} backgroundColor={C.bg} />
            {header}
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.amountBlock}>
                    <Text style={styles.amountLabel}>
                        {isLateCharge ? 'Cuota pendiente' : 'Total del viaje'}
                    </Text>
                    <Text style={styles.amountValue}>₡{Number(amountCrc || 0).toLocaleString('es-CR')}</Text>
                    <Text style={styles.amountHint}>El cobro se procesa en dólares al tipo de cambio del día.</Text>
                </View>

                <Text style={styles.sectionTitle}>Elige cómo pagar</Text>
                <PaymentOptionList
                    options={options}
                    selected={selected}
                    onSelect={(id) => { setSelected(id); setError(null); }}
                />

                {selectedOption?.unavailable && (
                    <View style={styles.notice} accessibilityLiveRegion="polite">
                        <Ionicons name="information-circle" size={18} color={C.warning} />
                        <Text style={styles.noticeText}>{WALLET_PENDING_MSG}</Text>
                    </View>
                )}

                {error && (
                    <View style={[styles.notice, { backgroundColor: C.errorBg }]} accessibilityLiveRegion="polite">
                        <Ionicons name="alert-circle" size={18} color={C.error} />
                        <Text style={[styles.noticeText, { color: C.error }]}>{error}</Text>
                    </View>
                )}

                <View style={styles.secure}>
                    <Ionicons name="lock-closed" size={14} color={C.muted} />
                    <Text style={styles.secureText}>Tu pago es seguro</Text>
                </View>

                <Pressable
                    onPress={handleContinue}
                    disabled={creating || !!selectedOption?.unavailable}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: creating || !!selectedOption?.unavailable, busy: creating }}
                    style={({ pressed }) => [
                        styles.cta,
                        (creating || selectedOption?.unavailable) && { opacity: 0.5 },
                        pressed && { opacity: 0.85 },
                    ]}
                >
                    {creating
                        ? <ActivityIndicator color={C.ctaText} />
                        : <Text style={styles.ctaText}>Continuar</Text>}
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
};

const makeStyles = (C) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    center: { justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
    centerText: {
        marginTop: 16,
        color: C.onSurface,
        fontSize: moderateScale(15),
        fontFamily: 'Poppins-Regular',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        height: 56,
    },
    backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    headerTitle: {
        color: C.onSurface,
        fontSize: moderateScale(17),
        fontFamily: 'Poppins-SemiBold',
    },
    scroll: { paddingHorizontal: 16, paddingBottom: 32 },
    amountBlock: { alignItems: 'center', paddingTop: 8, paddingBottom: 24 },
    amountLabel: {
        color: C.muted,
        fontSize: moderateScale(13),
        fontFamily: 'Poppins-SemiBold',
    },
    amountValue: {
        color: C.onSurface,
        fontSize: moderateScale(32),
        fontFamily: 'Poppins-Bold',
        letterSpacing: -0.5,
    },
    amountHint: {
        color: C.muted,
        fontSize: moderateScale(12),
        fontFamily: 'Poppins-Regular',
        marginTop: 2,
    },
    sectionTitle: {
        color: C.onSurface,
        fontSize: moderateScale(15),
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 12,
    },
    notice: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: C.warningBg,
        borderRadius: 10,
        padding: 12,
        marginTop: 12,
    },
    noticeText: {
        flex: 1,
        color: C.warning,
        fontSize: moderateScale(13),
        fontFamily: 'Poppins-Regular',
        lineHeight: moderateScale(18),
    },
    secure: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 24,
        marginBottom: 12,
    },
    secureText: {
        color: C.muted,
        fontSize: moderateScale(13),
        fontFamily: 'Poppins-Regular',
    },
    cta: {
        height: 52,
        borderRadius: 12,
        backgroundColor: C.ctaBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaText: {
        color: C.ctaText,
        fontSize: moderateScale(16),
        fontFamily: 'Poppins-Bold',
    },
});

export default PayPalCheckoutScreen;
