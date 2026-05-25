import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, StatusBar, Platform, ScrollView, ActivityIndicator, Image, Alert, Linking } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { useCustomAlert } from '../../context/CustomAlertContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import api from '../../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { moderateScale } from '../../utils/responsive';
// Mismo correo configurado en el backend para los códigos de verificación
const SUPPORT_EMAIL = 'saferidefwd@gmail.com';

const handleContactSupport = async () => {
    const subject = encodeURIComponent('Soporte: Problemas con el Pago');
    const body = encodeURIComponent('Hola, tengo un inconveniente con el pago de un viaje. \n\nDetalle del problema:\n');

    const gmailUrl = `googlegmail:///co?to=${SUPPORT_EMAIL}&subject=${subject}&body=${body}`;
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

    const canOpenGmail = await Linking.canOpenURL(gmailUrl);
    if (canOpenGmail) {
        await Linking.openURL(gmailUrl);
    } else {
        await Linking.openURL(mailtoUrl);
    }
};

const PaymentVerification = ({ route, navigation }) => {
    const { theme } = useDriverTheme();
    const { showAlert } = useCustomAlert();
    const si = useScrollIndicator();
    const insets = useSafeAreaInsets();
    
    // Recibe el rideId (o los bookings directamente si se pasaron)
    const { rideId } = route.params || {};

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [bookings, setBookings] = useState([]);
    
    // Objeto para guardar el estado del pago por cada booking: { "bookingId": "paid" | "unpaid" }
    const [paymentStatuses, setPaymentStatuses] = useState({});

    // Función para obtener todos los pasajeros del viaje (sólo los conformados/completados)
    const fetchBookings = async () => {
        try {
            const res = await api.get(`/bookings/ride/${rideId}`);
            if (res.data?.success) {
                // Filtramos pasajeros confirmados, completados o cancelados (para cobrar penalizaciones)
                const validBookings = res.data.data.filter(b => 
                    b.status === 'confirmed' || 
                    b.status === 'completed' || 
                    b.status === 'cancelled' || 
                    b.status === 'canceled'
                );
                setBookings(validBookings);
                
                // Inicializamos los estados que ya vengan de BD
                const initialStatus = {};
                validBookings.forEach(b => {
                    if (b.payment_type === 'gifted') {
                        // El viaje fue regalado, se habilita automáticamente
                        initialStatus[b._id] = 'gifted';
                    } else if (b.status === 'cancelled' || b.status === 'canceled') {
                        // Booking cancelado: no requiere selección de pago,
                        // se auto-marca para permitir continuar sin acción.
                        initialStatus[b._id] = b.payment_status || 'waived';
                    } else if (b.payment_status === 'paid') {
                        initialStatus[b._id] = 'paid';
                    }
                });
                setPaymentStatuses(initialStatus);
            }
        } catch (error) {
            console.error('Error fetching bookings for payment:', error.message);
            showAlert('Error', 'No se pudieron cargar los pasajeros.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!rideId) {
            setLoading(false);
            return;
        }
        fetchBookings();
    }, [rideId]);

    const handleSelectPayment = (bookingId, status) => {
        setPaymentStatuses(prev => ({
            ...prev,
            [bookingId]: status,
        }));
    };

    const handleContinue = async () => {
        // Validar que todos los pasajeros tengan una opción seleccionada
        const allSelected = bookings.every(b => paymentStatuses[b._id]);
        if (!allSelected) {
            showAlert('Advertencia', 'Por favor, selecciona si cada pasajero pagó o no pagó.', 'warning');
            return;
        }

        try {
            setSubmitting(true);
            
            // Subimos cada estado de pago al backend
            const updatePromises = bookings.map(b => {
                if (b.payment_type === 'gifted') {
                    // Viaje regalado: NO modificar absolutamente nada del booking.
                    return Promise.resolve();
                }

                // Booking cancelado: ya quedó con payment_status 'waived' al
                // cancelarse, así que no enviamos ningún update.
                if (b.status === 'cancelled' || b.status === 'canceled') {
                    return Promise.resolve();
                }

                const status = paymentStatuses[b._id];
                return api.patch(`/bookings/${b._id}/payment`, {
                    payment_status: status,
                    // NO enviamos payment_type para no alterarlo
                });
            });
            
            await Promise.all(updatePromises);
            
            // Navegamos al rating usando el primer pasajero activo (no cancelado)
            const primaryPassenger = bookings.find(b =>
                b.status !== 'cancelled' && b.status !== 'canceled'
            ) || bookings[0];
            navigation.replace('RatePassenger', {
                rideId,
                passengerId: primaryPassenger?.passenger_id?._id?.toString() || primaryPassenger?.passenger_id?.toString(),
                passengerName: primaryPassenger?.passenger_id?.name,
                passengerImage: primaryPassenger?.passenger_id?.profileImage,
                bookingId: primaryPassenger?._id?.toString?.() || primaryPassenger?._id,
                bookingStatus: primaryPassenger?.status,
            });

        } catch (error) {
            console.error('Error saving payments:', error?.response?.data?.message || error?.message || 'unknown error');
            showAlert('Error', 'No se pudieron guardar los estados de pago.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.accent} />
            </SafeAreaView>
        );
    }

    const allSelected = bookings.length > 0 && bookings.every(b => paymentStatuses[b._id]);
    // Hay al menos un pasajero marcado como no pagó (pending)
    const hasUnpaid = bookings.some(b => paymentStatuses[b._id] === 'pending');

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            
            <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={theme.accent} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.navActive || '#005BBF' }]}>Trip Details</Text>
                <TouchableOpacity>
                    <Ionicons name="ellipsis-vertical" size={24} color={theme.accent} />
                </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} {...si.scrollProps}>
                    
                    <View style={styles.topIconContainer}>
                        <View style={[styles.moneyIconCircle, { backgroundColor: 'rgba(26,115,232,0.1)' }]}>
                            <MaterialCommunityIcons name="currency-usd" size={32} color="#1A73E8" />
                        </View>
                    </View>

                    <Text style={[styles.mainTitle, { color: theme.text }]}>¿Recibiste tu pago?</Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                        Verifica que todos los pasajeros hayan pagado su parte antes de continuar.
                    </Text>

                    <View style={styles.passengersContainer}>
                        {bookings.map((booking) => {
                            const passenger = booking.passenger_id;
                            const isGifted = booking.payment_type === 'gifted';
                            const isCancelled = booking.status === 'cancelled' || booking.status === 'canceled';
                            const isPaid = paymentStatuses[booking._id] === 'paid';
                            const isUnpaid = paymentStatuses[booking._id] === 'pending';
                            // Cuando el booking quedó cancelado (por el pasajero o por el
                            // conductor), no se requiere acción de pago: deshabilitamos
                            // los selectores y mostramos un badge "CANCELADO".
                            const isLocked = isGifted || isCancelled;

                            return (
                                <View key={booking._id} style={[styles.passengerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                    <View style={styles.passengerInfo}>
                                        <Image
                                            source={{ uri: passenger?.profileImage || 'https://via.placeholder.com/150' }}
                                            style={styles.avatar}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.passengerName, { color: theme.text }]}>{passenger?.name || 'Pasajero'}</Text>
                                            <View style={styles.badgeRow}>
                                                {isCancelled ? (
                                                    <View style={[styles.badge, styles.badgeDanger]}>
                                                        <Text style={styles.badgeTextDanger}>CANCELADO</Text>
                                                    </View>
                                                ) : isPaid ? (
                                                    <View style={[styles.badge, styles.badgeSuccess]}>
                                                        <Text style={styles.badgeTextSuccess}>VERIFICADO</Text>
                                                    </View>
                                                ) : isUnpaid ? (
                                                    <View style={[styles.badge, styles.badgeDanger]}>
                                                        <Text style={styles.badgeTextDanger}>PENDIENTE</Text>
                                                    </View>
                                                ) : isGifted ? (
                                                    <View style={[styles.badge, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                                                        <Text style={[styles.badgeTextSuccess, { color: '#10B981' }]}>GIFTED</Text>
                                                    </View>
                                                ) : (
                                                    <View style={[styles.badge, { backgroundColor: theme.border }]}>
                                                        <Text style={[styles.badgeTextSuccess, { color: theme.textSecondary }]}>STANDARD TRIP</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <View style={{ justifyContent: 'center', alignItems: 'flex-end', marginLeft: 10 }}>
                                            <Text style={{ fontSize: moderateScale(18), fontFamily: 'Poppins-Bold', color: theme.text }}>
                                                ₡{booking.charged_amount ?? 0}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.selectorContainer}>
                                        <TouchableOpacity
                                            style={[
                                                styles.selectBtn,
                                                styles.leftBtn,
                                                { backgroundColor: theme.bg },
                                                isUnpaid && !isCancelled && styles.unpaidSelected,
                                                isLocked && { opacity: 0.5 }
                                            ]}
                                            activeOpacity={isLocked ? 1 : 0.7}
                                            disabled={isLocked}
                                            onPress={() => handleSelectPayment(booking._id, 'pending')}
                                        >
                                            <Text style={[
                                                styles.selectBtnText,
                                                { color: theme.textSecondary },
                                                isUnpaid && !isCancelled && styles.unpaidSelectedText
                                            ]}>No pagó</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.selectBtn,
                                                styles.rightBtn,
                                                { backgroundColor: theme.bg },
                                                isPaid && !isCancelled && styles.paidSelected,
                                                isLocked && { opacity: 0.5 }
                                            ]}
                                            activeOpacity={isLocked ? 1 : 0.7}
                                            disabled={isLocked}
                                            onPress={() => handleSelectPayment(booking._id, 'paid')}
                                        >
                                            <Text style={[
                                                styles.selectBtnText,
                                                { color: theme.textSecondary },
                                                isPaid && !isCancelled && styles.paidSelectedText
                                            ]}>Pagó</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    <View style={[styles.supportBox, { backgroundColor: hasUnpaid ? 'rgba(255,59,48,0.06)' : 'rgba(26,115,232,0.05)' }]}>
                        <View style={[styles.supportIcon, { backgroundColor: hasUnpaid ? 'rgba(255,59,48,0.1)' : '#fff' }]}>
                            <Ionicons name="chatbubbles" size={24} color={hasUnpaid ? '#FF3B30' : '#1A73E8'} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.supportTitle, { color: theme.text }]}>¿Problemas con el pago?</Text>
                            <Text style={[styles.supportText, { color: theme.textSecondary }]}>
                                Si un pasajero se niega a pagar, repórtalo inmediatamente para que nuestro equipo de soporte pueda asistirte.
                            </Text>
                            <TouchableOpacity
                                style={[styles.emailBtn, { borderColor: hasUnpaid ? '#FF3B30' : '#1A73E8' }]}
                                onPress={handleContactSupport}
                                activeOpacity={0.75}
                            >
                                <Ionicons name="mail-outline" size={15} color={hasUnpaid ? '#FF3B30' : '#1A73E8'} />
                                <Text style={[styles.emailBtnText, { color: hasUnpaid ? '#FF3B30' : '#1A73E8' }]}>
                                    {SUPPORT_EMAIL}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
                <ScrollIndicator si={si} thumbColor={theme.accent} />
            </View>

            <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: (insets.bottom > 0 ? insets.bottom : 20) + 12 }]}>
                <TouchableOpacity 
                    style={[
                        styles.continueBtn, 
                        (!allSelected || submitting) && styles.continueBtnDisabled
                    ]}
                    activeOpacity={0.8}
                    disabled={!allSelected || submitting}
                    onPress={handleContinue}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <>
                            <Text style={styles.continueBtnText}>Continuar</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 6,
        paddingBottom: 12,
    },
    headerTitle: { fontSize: moderateScale(22), fontFamily: 'Poppins-Bold' },
    scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
    topIconContainer: { alignItems: 'center', marginBottom: 14 },
    moneyIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
    mainTitle: { fontSize: moderateScale(26), fontFamily: 'Poppins-Bold', textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
    subtitle: { fontSize: moderateScale(15), textAlign: 'center', lineHeight: 22, paddingHorizontal: 10, marginBottom: 22 },
    passengersContainer: { gap: 16, marginBottom: 32 },
    passengerCard: {
        borderRadius: 24, padding: 20, borderWidth: 1,
        elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    },
    passengerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 16 },
    passengerName: { fontSize: moderateScale(17), fontFamily: 'Poppins-Bold', marginBottom: 4 },
    badgeRow: { flexDirection: 'row' },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    badgeSuccess: { backgroundColor: 'rgba(52,199,89,0.1)' },
    badgeDanger: { backgroundColor: 'rgba(255,59,48,0.1)' },
    badgeTextSuccess: { color: '#34C759', fontSize: moderateScale(11), fontFamily: 'Poppins-Bold', letterSpacing: 0.5 },
    badgeTextDanger: { color: '#FF3B30', fontSize: moderateScale(11), fontFamily: 'Poppins-Bold', letterSpacing: 0.5 },
    selectorContainer: { flexDirection: 'row', borderRadius: 99, overflow: 'hidden', borderWidth: 1, borderColor: '#EAECF0' },
    selectBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    leftBtn: { borderRightWidth: 1, borderRightColor: '#EAECF0' },
    rightBtn: { },
    selectBtnText: { fontSize: moderateScale(15), fontFamily: 'Poppins-SemiBold' },
    unpaidSelected: { backgroundColor: '#FFEEED' },
    unpaidSelectedText: { color: '#FF3B30' },
    paidSelected: { backgroundColor: '#E8F5E9' },
    paidSelectedText: { color: '#34C759' },
    supportBox: { flexDirection: 'row', padding: 20, borderRadius: 20, alignItems: 'center', gap: 16 },
    supportIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    supportTitle: { fontSize: moderateScale(16), fontFamily: 'Poppins-Bold', marginBottom: 6 },
    supportText: { fontSize: moderateScale(13), lineHeight: 18, marginBottom: 10 },
    emailBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    emailBtnText: { fontSize: moderateScale(12), fontFamily: 'Poppins-SemiBold' },
    footer: { paddingHorizontal: 24, paddingTop: 20, borderTopWidth: 1 },
    continueBtn: {
        backgroundColor: '#1A73E8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 18, borderRadius: 99, gap: 8,
    },
    continueBtnDisabled: { backgroundColor: '#B0C6FF' },
    continueBtnText: { color: '#fff', fontSize: moderateScale(16), fontFamily: 'Poppins-Bold' },
});

export default PaymentVerification;
