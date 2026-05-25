import { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Switch,
    TouchableOpacity, StatusBar, Modal, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import ScreenHeader from '../../components/ScreenHeader';
import { authService } from '../../services/authService';

import { moderateScale } from '../../utils/responsive';
const PAYMENT_LABELS = { efectivo: 'Efectivo', sinpe: 'SINPE Móvil', tarjeta: 'Tarjeta' };
const PAYMENT_ICONS  = { efectivo: 'cash-outline', sinpe: 'phone-portrait-outline', tarjeta: 'card-outline' };

// ── Hook modal logout ─────────────────────────────────────────────────────────
const useLogoutModal = () => {
    const [visible, setVisible] = useState(false);
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const cardScale       = useRef(new Animated.Value(0.75)).current;
    const cardOpacity     = useRef(new Animated.Value(0)).current;

    const open = () => {
        setVisible(true);
        Animated.parallel([
            Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.spring(cardScale,       { toValue: 1, friction: 7, tension: 100, useNativeDriver: true }),
            Animated.timing(cardOpacity,     { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
    };

    const close = (callback) => {
        Animated.parallel([
            Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(cardScale,       { toValue: 0.85, duration: 180, useNativeDriver: true }),
            Animated.timing(cardOpacity,     { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => {
            setVisible(false);
            cardScale.setValue(0.75);
            cardOpacity.setValue(0);
            backdropOpacity.setValue(0);
            if (callback) callback();
        });
    };

    return { visible, open, close, backdropOpacity, cardScale, cardOpacity };
};

// ── Pantalla ──────────────────────────────────────────────────────────────────
const CustomizeApp = ({ navigation }) => {
    const { theme, toggleTheme } = useDriverTheme();
    const isDark = theme.dark;
    const si     = useScrollIndicator();
    const modal  = useLogoutModal();

    const [ubicacion,      setUbicacion]      = useState(true);
    const [notificaciones, setNotificaciones] = useState(true);
    const [camara,         setCamara]         = useState(false);
    const [paymentMethod,  setPaymentMethod]  = useState('');

    useEffect(() => {
        AsyncStorage.getItem('paymentMethod').then(val => { if (val) setPaymentMethod(val); });
    }, []);

    // Recargar pago al volver de PaymentMethod screen
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            AsyncStorage.getItem('paymentMethod').then(val => { if (val) setPaymentMethod(val); });
        });
        return unsubscribe;
    }, [navigation]);

    const handleConfirmLogout = () => {
        modal.close(async () => {
            await authService.logout();
            navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
        });
    };

    const paymentLabel = PAYMENT_LABELS[paymentMethod] || 'No configurado';
    const paymentIcon  = PAYMENT_ICONS[paymentMethod]  || 'wallet-outline';

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

            <ScreenHeader title="Ajustes" onBack={() => navigation.goBack()} />

            <View style={styles.scrollWrapper}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100 }}
                    {...si.scrollProps}
                >
                    {/* ── APARIENCIA ── */}
                    <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>APARIENCIA</Text>
                    <View style={[styles.card, { backgroundColor: theme.surface }]}>
                        <View style={styles.row}>
                            <View style={styles.rowIconBox}>
                                <Ionicons name={isDark ? 'moon' : 'sunny'} size={22} color={isDark ? theme.accent : '#F4A433'} />
                            </View>
                            <View style={styles.rowTexts}>
                                <Text style={[styles.rowTitle, { color: theme.text }]}>
                                    {isDark ? 'Modo oscuro' : 'Modo claro'}
                                </Text>
                                <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                                    {isDark ? 'Fondo oscuro activado' : 'Fondo claro activado'}
                                </Text>
                            </View>
                            <Switch
                                value={isDark}
                                onValueChange={(val) => toggleTheme(val)}
                                trackColor={{ false: '#D1D1D6', true: theme.accent }}
                                thumbColor="#FFFFFF"
                            />
                        </View>

                        <View style={[styles.divider, { backgroundColor: theme.divider }]} />

                        <View style={styles.themeRow}>
                            <TouchableOpacity
                                style={[styles.themeBtn, { borderColor: theme.border, backgroundColor: theme.surface },
                                    !isDark && { backgroundColor: theme.text, borderColor: theme.text }]}
                                onPress={() => toggleTheme(false)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="sunny-outline" size={16} color={!isDark ? '#FFF' : theme.text} style={{ marginRight: 6 }} />
                                <Text style={[styles.themeBtnText, { color: !isDark ? '#FFF' : theme.text }]}>Claro</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.themeBtn, { borderColor: theme.border, backgroundColor: theme.surface },
                                    isDark && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                                onPress={() => toggleTheme(true)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="moon-outline" size={16} color={isDark ? '#FFF' : theme.text} style={{ marginRight: 6 }} />
                                <Text style={[styles.themeBtnText, { color: isDark ? '#FFF' : theme.text }]}>Oscuro</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ── MÉTODO DE PAGO ── */}
                    <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>MÉTODO DE PAGO</Text>
                    <TouchableOpacity
                        style={[styles.card, styles.rowTouchable, { backgroundColor: theme.surface }]}
                        onPress={() => navigation.navigate('PaymentMethod')}
                        activeOpacity={0.8}
                    >
                        <View style={styles.rowIconBox}>
                            <Ionicons name={paymentIcon} size={22} color={theme.accent} />
                        </View>
                        <View style={styles.rowTexts}>
                            <Text style={[styles.rowTitle, { color: theme.text }]}>Método favorito</Text>
                            <Text style={[styles.rowSub, { color: theme.textSecondary }]}>{paymentLabel}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>

                    {/* ── PERMISOS ── */}
                    <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PERMISOS DE LA APP</Text>
                    <View style={[styles.card, { backgroundColor: theme.surface }]}>
                        <PermissionRow iconName="location-outline"      iconColor={theme.accent} title="Ubicación"          subtitle="Necesaria para el mapa y la navegación"   value={ubicacion}      onToggle={setUbicacion}      theme={theme} />
                        <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                        <PermissionRow iconName="notifications-outline" iconColor={theme.accent} title="Notificaciones"     subtitle="Alertas de rutas y nuevas solicitudes"     value={notificaciones} onToggle={setNotificaciones} theme={theme} />
                        <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                        <PermissionRow iconName="camera-outline"        iconColor={theme.accent} title="Cámara"             subtitle="Para fotos de perfil y escaneos"           value={camara}         onToggle={setCamara}         theme={theme} />
                    </View>

                    {/* ── CERRAR SESIÓN ── */}
                    <TouchableOpacity
                        style={[styles.logoutBtn, { borderColor: theme.danger, backgroundColor: theme.surface }]}
                        activeOpacity={0.75}
                        onPress={modal.open}
                    >
                        <Ionicons name="log-out-outline" size={20} color={theme.danger} style={{ marginRight: 8 }} />
                        <Text style={[styles.logoutText, { color: theme.danger }]}>Cerrar sesión</Text>
                    </TouchableOpacity>
                </ScrollView>
                <ScrollIndicator si={si} thumbColor={theme.accent} />
            </View>

            {/* ── MODAL LOGOUT ── */}
            <Modal visible={modal.visible} transparent animationType="none" statusBarTranslucent>
                <Animated.View style={[styles.backdrop, { opacity: modal.backdropOpacity }]} />
                <View style={styles.modalOuter} pointerEvents="box-none">
                    <Animated.View style={[
                        styles.modalCard,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                        { opacity: modal.cardOpacity, transform: [{ scale: modal.cardScale }] },
                    ]}>
                        <View style={[styles.modalIconCircle, { backgroundColor: theme.dark ? '#2A0A0A' : '#FFF0F0' }]}>
                            <Ionicons name="log-out-outline" size={34} color={theme.danger} />
                        </View>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>¿Cerrar sesión?</Text>
                        <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                            Tu sesión actual se cerrará y tendrás que volver a iniciar sesión para continuar.
                        </Text>
                        <View style={styles.modalBtns}>
                            <TouchableOpacity
                                style={[styles.btnNo, { borderColor: theme.border, backgroundColor: theme.surfaceVariant }]}
                                activeOpacity={0.8}
                                onPress={() => modal.close()}
                            >
                                <Text style={[styles.btnNoText, { color: theme.text }]}>No, quedarme</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btnSi, { backgroundColor: theme.danger }]}
                                activeOpacity={0.8}
                                onPress={handleConfirmLogout}
                            >
                                <Text style={styles.btnSiText}>Sí, salir</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const PermissionRow = ({ iconName, iconColor, title, subtitle, value, onToggle, theme }) => (
    <View style={styles.row}>
        <View style={styles.rowIconBox}>
            <Ionicons name={iconName} size={22} color={iconColor} />
        </View>
        <View style={styles.rowTexts}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.rowSub, { color: theme.textSecondary }]}>{subtitle}</Text>
        </View>
        <Switch value={value} onValueChange={onToggle} trackColor={{ false: '#D1D1D6', true: iconColor }} thumbColor="#FFFFFF" />
    </View>
);

const styles = StyleSheet.create({
    safe:          { flex: 1 },
    scrollWrapper: { flex: 1 },
    scroll:        { flex: 1 },

    sectionLabel: { fontSize: moderateScale(11), fontFamily: 'Poppins-Bold', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },

    card: {
        borderRadius: 16, marginBottom: 24, paddingHorizontal: 16, elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
    },
    rowTouchable: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
    row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
    rowIconBox:   { width: 36, alignItems: 'center', marginRight: 12 },
    rowTexts:     { flex: 1 },
    rowTitle:     { fontSize: moderateScale(15), fontFamily: 'Poppins-Bold' },
    rowSub:       { fontSize: moderateScale(12), fontFamily: 'Poppins-Regular', marginTop: 1 },
    divider:      { height: 1 },

    themeRow:     { flexDirection: 'row', paddingVertical: 14, gap: 10 },
    themeBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
    themeBtnText: { fontSize: moderateScale(14), fontFamily: 'Poppins-Bold' },

    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderRadius: 14, paddingVertical: 16, marginBottom: 8,
    },
    logoutText: { fontSize: moderateScale(15), fontFamily: 'Poppins-Bold' },

    backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', opacity: 0.55 },
    modalOuter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    modalCard: {
        width: '100%', borderRadius: 24, borderWidth: 1, padding: 28, alignItems: 'center',
        elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2, shadowRadius: 20,
    },
    modalIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
    modalTitle:    { fontSize: moderateScale(20), fontFamily: 'Poppins-Bold', marginBottom: 8, textAlign: 'center' },
    modalSubtitle: { fontSize: moderateScale(14), fontFamily: 'Poppins-Regular', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
    modalBtns:     { flexDirection: 'row', gap: 12, width: '100%' },
    btnNo:     { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
    btnNoText: { fontSize: moderateScale(14), fontFamily: 'Poppins-Bold' },
    btnSi:     { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    btnSiText: { fontSize: moderateScale(14), fontFamily: 'Poppins-Bold', color: '#FFF' },
});

export default CustomizeApp;
