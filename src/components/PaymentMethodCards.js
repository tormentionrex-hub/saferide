import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Clipboard, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../context/DriverThemeContext';
import { useCustomAlert } from '../context/CustomAlertContext';
import { formatCRC } from '../utils/currency';

const PAYPAL_BLUE = '#003087';
const PAYPAL_YELLOW = '#FFC439';
const SINPE_PURPLE = '#5A2A82';

const PaymentMethodCards = ({
    amount = 0,
    driverPhone = '',
    driverName = 'Conductor',
    onPayPal,
    sectionTitle = 'Elige tu método de pago',
}) => {
    const { theme } = useDriverTheme();
    const { showAlert } = useCustomAlert();
    const [selected, setSelected] = useState(null);

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
            `Hola ${driverName.split(' ')[0]}, ya realicé el pago pendiente del viaje por SINPE Móvil por un monto de ${formatCRC(amount)}. ¿Podrías confirmarlo desde tu app? ¡Gracias!`
        );
        const url = `https://wa.me/${finalPhone.replace('+', '')}?text=${msg}`;
        Linking.openURL(url).catch(() =>
            showAlert('Error', 'No se pudo abrir WhatsApp.', 'error')
        );
    };

    return (
        <View>
            {!!sectionTitle && (
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{sectionTitle}</Text>
            )}

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
                        <Text style={{ fontFamily: 'Poppins-Bold' }}>2.</Text> Envía <Text style={{ fontFamily: 'Poppins-Bold' }}>{formatCRC(amount)}</Text> al número del conductor:
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
                    <Ionicons name="card" size={22} color={PAYPAL_BLUE} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.methodTitle, { color: theme.text }]}>Pago en línea</Text>
                    <Text style={[styles.methodSub, { color: theme.textSecondary }]}>
                        Tarjeta de crédito o débito, PayPal o billetera digital. Se confirma al instante.
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
                    onPress={onPayPal}
                    activeOpacity={0.9}
                >
                    <Ionicons name="lock-closed" size={18} color={PAYPAL_BLUE} />
                    <Text style={[styles.paypalBtnText, { color: PAYPAL_BLUE, fontFamily: 'Poppins-Bold' }]}>
                        Pagar {formatCRC(amount)} en línea
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
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

export default PaymentMethodCards;
