import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
    StatusBar, ActivityIndicator, Linking, Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { useCustomAlert } from '../../context/CustomAlertContext';
import api from '../../services/api';

const PAYPAL_BLUE = '#003087';
const PAYPAL_YELLOW = '#FFC439';
const SINPE_PURPLE = '#5A2A82';

const PendingPayment = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const { showAlert } = useCustomAlert();
    const insets = useSafeAreaInsets();

    const { bookingId } = route.params || {};
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null); // 'sinpe' | 'paypal'

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

    const handleCopyPhone = async () => {
        try {
            Clipboard.setString(driverPhone);
            showAlert('Número copiado', `El número ${driverPhone} se copió al portapapeles.`, 'success');
        } catch (e) {
            showAlert('Error', 'No se pudo copiar el número.', 'error');
        }
    };

    const handleNotifyDriver = () => {
        if (!driverPhone) {
            showAlert('Sin número', 'El conductor no tiene un número de teléfono registrado.', 'warning');
            return;
        }
        const cleanPhone = driverPhone.replace(/[^\d+]/g, '');
        const finalPhone = cleanPhone.startsWith('+') ? cleanPhone : '+506' + cleanPhone;
        const msg = encodeURIComponent(
            `Hola ${driverName.split(' ')[0]}, ya realicé el pago pendiente del viaje por SINPE Móvil por un monto de ₡${Number(amount).toLocaleString('es-CR')}. ¿Podrías confirmarlo desde tu app? ¡Gracias!`
        );
        const url = `https://wa.me/${finalPhone.replace('+', '')}?text=${msg}`;
        Linking.openURL(url).catch(() =>
            showAlert('Error', 'No se pudo abrir WhatsApp.', 'error')
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

            <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Pagar viaje</Text>
                <View style={{ width: 40 }} />
            </View>

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

                <Text style={[styles.sectionTitle, { color: theme.text }]}>Elige tu método de pago</Text>

                {/* SINPE */}
                <TouchableOpacity
                    style={[
                        styles.methodCard,
                        {
                            backgroundColor: theme.surface,
                            borderColor: selected === 'sinpe' ? SINPE_PURPLE : theme.border,
                            borderWidth: selected === 'sinpe' ? 2 : 1,
                        },
                    ]}
                    onPress={() => setSelected(prev => prev === 'sinpe' ? null : 'sinpe')}
                    activeOpacity={0.85}
                >
                    <View style={[styles.methodIcon, { backgroundColor: SINPE_PURPLE }]}>
                        <Ionicons name="phone-portrait" size={22} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.methodTitle, { color: theme.text }]}>SINPE Móvil</Text>
                        <Text style={[styles.methodSub, { color: theme.textSecondary }]}>
                            Transferencia directa al teléfono del conductor
                        </Text>
                    </View>
                    <View style={[
                        styles.radio,
                        { borderColor: selected === 'sinpe' ? SINPE_PURPLE : theme.textSecondary },
                    ]}>
                        {selected === 'sinpe' && <View style={[styles.radioDot, { backgroundColor: SINPE_PURPLE }]} />}
                    </View>
                </TouchableOpacity>

                {selected === 'sinpe' && (
                    <View style={[styles.sinpeBox, { backgroundColor: theme.surface, borderColor: SINPE_PURPLE + '30' }]}>
                        <View style={styles.sinpeHeader}>
                            <Ionicons name="information-circle" size={18} color={SINPE_PURPLE} />
                            <Text style={[styles.sinpeHeaderText, { color: SINPE_PURPLE }]}>Instrucciones</Text>
                        </View>

                        <Text style={[styles.sinpeStep, { color: theme.text }]}>
                            <Text style={{ fontFamily: 'Poppins-Bold' }}>1.</Text> Abre tu banco y selecciona SINPE Móvil.
                        </Text>
                        <Text style={[styles.sinpeStep, { color: theme.text }]}>
                            <Text style={{ fontFamily: 'Poppins-Bold' }}>2.</Text> Envía <Text style={{ fontFamily: 'Poppins-Bold' }}>₡{Number(amount).toLocaleString('es-CR')}</Text> al número del conductor:
                        </Text>

                        <View style={[styles.phoneBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                            <Ionicons name="call" size={18} color={SINPE_PURPLE} />
                            <Text style={[styles.phoneText, { color: theme.text }]}>
                                {driverPhone || 'No disponible'}
                            </Text>
                            {!!driverPhone && (
                                <TouchableOpacity onPress={handleCopyPhone} style={styles.copyBtn}>
                                    <Ionicons name="copy-outline" size={16} color={SINPE_PURPLE} />
                                    <Text style={[styles.copyBtnText, { color: SINPE_PURPLE }]}>Copiar</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <Text style={[styles.sinpeStep, { color: theme.text }]}>
                            <Text style={{ fontFamily: 'Poppins-Bold' }}>3.</Text> Una vez realizado el pago, avísale al conductor por WhatsApp para que confirme la recepción desde su app.
                        </Text>

                        <View style={[styles.noticeBox, { backgroundColor: '#FFF8E6', borderColor: '#FFB020' }]}>
                            <Ionicons name="warning" size={16} color="#B26B00" />
                            <Text style={styles.noticeText}>
                                Tu cuenta se desbloqueará automáticamente cuando el conductor confirme tu pago.
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.sinpeBtn, { backgroundColor: '#25D366' }]}
                            onPress={handleNotifyDriver}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                            <Text style={styles.sinpeBtnText}>Avisar al conductor por WhatsApp</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* PayPal */}
                <TouchableOpacity
                    style={[
                        styles.methodCard,
                        {
                            backgroundColor: theme.surface,
                            borderColor: selected === 'paypal' ? PAYPAL_BLUE : theme.border,
                            borderWidth: selected === 'paypal' ? 2 : 1,
                        },
                    ]}
                    onPress={() => setSelected(prev => prev === 'paypal' ? null : 'paypal')}
                    activeOpacity={0.85}
                >
                    <View style={[styles.methodIcon, { backgroundColor: '#EAF1FB' }]}>
                        <Ionicons name="logo-paypal" size={22} color={PAYPAL_BLUE} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.methodTitle, { color: theme.text }]}>PayPal</Text>
                        <Text style={[styles.methodSub, { color: theme.textSecondary }]}>
                            Pago instantáneo y automático. Tu cuenta se libera al instante.
                        </Text>
                    </View>
                    <View style={[
                        styles.radio,
                        { borderColor: selected === 'paypal' ? PAYPAL_BLUE : theme.textSecondary },
                    ]}>
                        {selected === 'paypal' && <View style={[styles.radioDot, { backgroundColor: PAYPAL_BLUE }]} />}
                    </View>
                </TouchableOpacity>

                {selected === 'paypal' && (
                    <TouchableOpacity
                        style={[styles.paypalBtn]}
                        onPress={handlePayPal}
                        activeOpacity={0.9}
                    >
                        <Ionicons name="logo-paypal" size={22} color={PAYPAL_BLUE} />
                        <Text style={styles.paypalBtnText}>
                            <Text style={{ color: PAYPAL_BLUE, fontFamily: 'Poppins-Bold' }}>Pay</Text>
                            <Text style={{ color: '#009CDE', fontFamily: 'Poppins-Bold' }}>Pal</Text>
                            <Text style={{ color: PAYPAL_BLUE, fontFamily: 'Poppins-SemiBold' }}>  · Pagar ₡{Number(amount).toLocaleString('es-CR')}</Text>
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: 18 },
    errorText: { fontSize: 16, fontFamily: 'Poppins-SemiBold', textAlign: 'center' },
    paidIcon: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center' },
    primaryBtn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
    primaryBtnText: { color: '#fff', fontFamily: 'Poppins-Bold', fontSize: 15 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 14,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: { fontSize: 18, fontFamily: 'Poppins-Bold', letterSpacing: -0.3 },

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
        fontSize: 10,
        fontFamily: 'Poppins-Bold',
        color: '#FF3B30',
        letterSpacing: 1.5,
    },
    amountLabel: { fontSize: 10, fontFamily: 'Poppins-Bold', letterSpacing: 1.2, marginBottom: 4 },
    amountValue: { fontSize: 34, fontFamily: 'Poppins-Bold', letterSpacing: -1 },
    divider: { height: 1, marginVertical: 16 },

    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    metaIcon: {
        width: 38, height: 38, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    metaLabel: { fontSize: 10, fontFamily: 'Poppins-Bold', letterSpacing: 1.1, marginBottom: 2 },
    metaValue: { fontSize: 14, fontFamily: 'Poppins-SemiBold' },

    routeRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    routeIconCol: { alignItems: 'center' },
    routeLine: { width: 2, height: 18, marginVertical: 3 },
    routeText: { fontSize: 13, fontFamily: 'Poppins-SemiBold' },

    sectionTitle: {
        fontSize: 16,
        fontFamily: 'Poppins-Bold',
        paddingHorizontal: 20,
        marginBottom: 12,
        letterSpacing: -0.3,
    },

    methodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginHorizontal: 20,
        marginBottom: 12,
        padding: 16,
        borderRadius: 18,
    },
    methodIcon: {
        width: 46, height: 46, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center',
    },
    methodTitle: { fontSize: 15, fontFamily: 'Poppins-Bold', marginBottom: 2 },
    methodSub: { fontSize: 12, fontFamily: 'Poppins-Regular', lineHeight: 16 },
    radio: {
        width: 22, height: 22, borderRadius: 11, borderWidth: 2,
        justifyContent: 'center', alignItems: 'center',
    },
    radioDot: { width: 10, height: 10, borderRadius: 5 },

    sinpeBox: {
        marginHorizontal: 20,
        marginTop: -4,
        marginBottom: 16,
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
    },
    sinpeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    sinpeHeaderText: { fontSize: 11, fontFamily: 'Poppins-Bold', letterSpacing: 0.6, textTransform: 'uppercase' },
    sinpeStep: { fontSize: 13, fontFamily: 'Poppins-Regular', lineHeight: 20, marginBottom: 10 },

    phoneBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 10,
    },
    phoneText: { flex: 1, fontSize: 16, fontFamily: 'Poppins-Bold', letterSpacing: 0.5 },
    copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    copyBtnText: { fontSize: 12, fontFamily: 'Poppins-Bold' },

    noticeBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        marginTop: 6,
        marginBottom: 12,
    },
    noticeText: {
        flex: 1,
        fontSize: 11,
        fontFamily: 'Poppins-Regular',
        color: '#7A4A00',
        lineHeight: 16,
    },

    sinpeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 14,
        marginTop: 4,
    },
    sinpeBtnText: { color: '#fff', fontFamily: 'Poppins-Bold', fontSize: 14 },

    paypalBtn: {
        marginHorizontal: 20,
        marginTop: 4,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 30,
        backgroundColor: PAYPAL_YELLOW,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 5,
    },
    paypalBtnText: { fontSize: 15, letterSpacing: 0.3 },
});

export default PendingPayment;
