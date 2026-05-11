import { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, StatusBar, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDriverTheme } from '../../context/DriverThemeContext';

const METHODS = [
    {
        id:       'efectivo',
        icon:     'cash-outline',
        label:    'Efectivo',
        subtitle: 'Pago en mano al conductor al finalizar el viaje',
    },
    {
        id:       'sinpe',
        icon:     'phone-portrait-outline',
        label:    'SINPE Móvil',
        subtitle: 'Transferencia rápida por número de teléfono',
    },
    {
        id:       'tarjeta',
        icon:     'card-outline',
        label:    'Tarjeta',
        subtitle: 'Débito o crédito, pago digital seguro',
    },
];

const PaymentMethodScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { theme } = useDriverTheme();
    const isDark = theme.dark;
    const [selected, setSelected] = useState('');

    // Toast animation refs
    const toastSlide   = useRef(new Animated.Value(120)).current;
    const toastOpacity = useRef(new Animated.Value(0)).current;
    const checkAnim    = useRef(new Animated.Value(0)).current;
    const ring1Scale   = useRef(new Animated.Value(0.4)).current;
    const ring1Opacity = useRef(new Animated.Value(1)).current;
    const ring2Scale   = useRef(new Animated.Value(0.2)).current;
    const ring2Opacity = useRef(new Animated.Value(0.7)).current;
    const [toastVisible, setToastVisible] = useState(false);

    // ── Colores adaptativos ────────────────────────────────────────────────────
    // Tarjeta sin seleccionar: blanca en claro, oscura en dark
    const cardBg       = isDark ? theme.surfaceVariant : theme.surface;
    // Círculo del ícono sin seleccionar: azul muy suave en claro, oscuro en dark
    const iconCircleBg = isDark ? theme.iconCircleBg : '#EEF2FF';
    // Toast
    const toastBg      = isDark ? 'rgba(5,18,40,0.96)'   : 'rgba(235,241,255,0.97)';
    const toastBorder  = isDark ? 'rgba(116,143,255,0.45)': 'rgba(75,104,255,0.40)';
    const toastShadow  = isDark ? '#748FFF'               : '#4B68FF';
    const toastTitle   = isDark ? '#FFF'                  : '#1C1C1E';
    const toastSub     = isDark ? 'rgba(200,210,255,0.85)': 'rgba(75,104,255,0.85)';
    const checkBg      = '#00C88C';

    useEffect(() => {
        AsyncStorage.getItem('paymentMethod').then(val => { if (val) setSelected(val); });
    }, []);

    const showToast = () => {
        setToastVisible(true);
        toastSlide.setValue(120);
        toastOpacity.setValue(0);
        checkAnim.setValue(0);
        ring1Scale.setValue(0.4);
        ring1Opacity.setValue(1);
        ring2Scale.setValue(0.2);
        ring2Opacity.setValue(0.7);

        Animated.parallel([
            Animated.spring(toastSlide,   { toValue: 0, friction: 7, tension: 90, useNativeDriver: true }),
            Animated.timing(toastOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start(() => {
            setTimeout(() => {
                Animated.spring(checkAnim, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
            }, 160);
            setTimeout(() => {
                Animated.parallel([
                    Animated.timing(ring1Scale,   { toValue: 1.8, duration: 600, useNativeDriver: true }),
                    Animated.timing(ring1Opacity, { toValue: 0,   duration: 600, useNativeDriver: true }),
                    Animated.timing(ring2Scale,   { toValue: 2.4, duration: 750, useNativeDriver: true }),
                    Animated.timing(ring2Opacity, { toValue: 0,   duration: 750, useNativeDriver: true }),
                ]).start();
            }, 200);
            setTimeout(() => {
                Animated.parallel([
                    Animated.timing(toastOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
                    Animated.timing(toastSlide,   { toValue: 80, duration: 280, useNativeDriver: true }),
                ]).start(() => {
                    setToastVisible(false);
                    navigation.goBack();
                });
            }, 1100);
        });
    };

    const handleSave = async () => {
        if (!selected) return;
        await AsyncStorage.setItem('paymentMethod', selected);
        showToast();
    };

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
            <StatusBar
                barStyle={isDark ? 'light-content' : 'dark-content'}
                backgroundColor={theme.bg}
            />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : 16, borderBottomColor: theme.divider }]}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <View style={[styles.headerIconBtn, { backgroundColor: iconCircleBg }]}>
                        <Ionicons name="chevron-back" size={20} color={theme.accent} />
                    </View>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Método de Pago</Text>
                <View style={styles.headerIconBtn} />
            </View>

            <View style={styles.content}>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                    Elige tu forma de pago favorita para los viajes
                </Text>

                {METHODS.map(method => {
                    const isSelected = selected === method.id;
                    return (
                        <TouchableOpacity
                            key={method.id}
                            style={[
                                styles.methodCard,
                                {
                                    backgroundColor: isSelected
                                        ? (isDark ? 'rgba(116,143,255,0.12)' : 'rgba(75,104,255,0.08)')
                                        : cardBg,
                                    borderColor: isSelected
                                        ? theme.accent
                                        : (isDark ? theme.cardBorder : 'rgba(37,99,235,0.12)'),
                                    borderWidth: isSelected ? 2 : 1,
                                    // Sombra suave en claro para darle elevación
                                    shadowColor: isDark ? 'transparent' : '#C7D2FE',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: isDark ? 0 : 0.5,
                                    shadowRadius: 6,
                                }
                            ]}
                            onPress={() => setSelected(method.id)}
                            activeOpacity={0.8}
                        >
                            {/* Ícono */}
                            <View style={[
                                styles.methodIcon,
                                { backgroundColor: isSelected ? theme.accent : iconCircleBg }
                            ]}>
                                <Ionicons
                                    name={method.icon}
                                    size={24}
                                    color={isSelected ? '#FFF' : theme.accent}
                                />
                            </View>

                            {/* Texto */}
                            <View style={styles.methodTexts}>
                                <Text style={[styles.methodLabel, { color: theme.text }]}>
                                    {method.label}
                                </Text>
                                <Text style={[styles.methodSub, { color: theme.textSecondary }]}>
                                    {method.subtitle}
                                </Text>
                            </View>

                            {/* Radio */}
                            <View style={[
                                styles.radio,
                                { borderColor: isSelected ? theme.accent : theme.textSecondary }
                            ]}>
                                {isSelected && (
                                    <View style={[styles.radioDot, { backgroundColor: theme.accent }]} />
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}

                {/* Botón guardar */}
                <TouchableOpacity
                    style={[
                        styles.saveBtn,
                        {
                            backgroundColor: selected ? theme.accent : (isDark ? theme.iconCircleBg : '#EEF2FF'),
                            shadowColor: selected ? theme.accent : 'transparent',
                            marginTop: 'auto',
                            marginBottom: insets.bottom > 0 ? insets.bottom : 20
                        }
                    ]}
                    onPress={handleSave}
                    activeOpacity={0.85}
                >
                    <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color={selected ? '#FFF' : theme.textSecondary}
                        style={{ marginRight: 8 }}
                    />
                    <Text style={[styles.saveBtnText, { color: selected ? '#FFF' : theme.textSecondary }]}>
                        Guardar Preferencia
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Toast de confirmación */}
            {toastVisible && (
                <Animated.View style={[
                    styles.toast,
                    {
                        transform: [{ translateY: toastSlide }],
                        opacity: toastOpacity,
                        bottom: 52 + insets.bottom,
                        backgroundColor: toastBg,
                        borderColor: toastBorder,
                        shadowColor: toastShadow,
                    }
                ]}>
                    {/* Ripple rings */}
                    <Animated.View style={[
                        styles.ring,
                        {
                            transform: [{ scale: ring1Scale }],
                            opacity: ring1Opacity,
                            borderColor: toastBorder,
                        }
                    ]} />
                    <Animated.View style={[
                        styles.ring,
                        {
                            transform: [{ scale: ring2Scale }],
                            opacity: ring2Opacity,
                            borderColor: toastBorder,
                        }
                    ]} />

                    {/* Check icon */}
                    <Animated.View style={[
                        styles.checkCircle,
                        {
                            transform: [{ scale: checkAnim }],
                            backgroundColor: checkBg,
                            shadowColor: checkBg,
                        }
                    ]}>
                        <Ionicons name="checkmark" size={18} color="#FFF" />
                    </Animated.View>

                    <View style={styles.toastTexts}>
                        <Text style={[styles.toastTitle, { color: toastTitle }]}>¡Listo!</Text>
                        <Text style={[styles.toastSub,   { color: toastSub }]}>
                            Su método de pago ha sido actualizado
                        </Text>
                    </View>
                </Animated.View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
    },
    headerIconBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
    headerTitle:   { fontSize: 18, fontFamily: 'Poppins-Bold' },

    content: { flex: 1, paddingHorizontal: 20, paddingTop: 28 },

    subtitle: {
        fontSize: 14, fontFamily: 'Poppins-Regular',
        marginBottom: 24, lineHeight: 20,
    },

    methodCard: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: 18, padding: 18, marginBottom: 14,
        elevation: 2,
    },
    methodIcon: {
        width: 52, height: 52, borderRadius: 26,
        justifyContent: 'center', alignItems: 'center',
        marginRight: 16,
    },
    methodTexts: { flex: 1 },
    methodLabel: { fontSize: 16, fontFamily: 'Poppins-SemiBold', marginBottom: 3 },
    methodSub:   { fontSize: 12, fontFamily: 'Poppins-Regular', lineHeight: 16 },

    radio: {
        width: 22, height: 22, borderRadius: 11, borderWidth: 2,
        justifyContent: 'center', alignItems: 'center', marginLeft: 12,
    },
    radioDot: { width: 11, height: 11, borderRadius: 6 },

    saveBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        height: 56, borderRadius: 18, marginTop: 12,
        elevation: 4,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35, shadowRadius: 12,
    },
    saveBtnText: { fontSize: 15, fontFamily: 'Poppins-SemiBold' },

    // Toast
    toast: {
        position: 'absolute', left: 24, right: 24,
        flexDirection: 'row', alignItems: 'center',
        borderRadius: 20, paddingVertical: 16, paddingHorizontal: 18,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45, shadowRadius: 18, elevation: 18,
        overflow: 'visible',
    },
    ring: {
        position: 'absolute', width: 44, height: 44, borderRadius: 22,
        borderWidth: 2,
        left: 18, top: '50%', marginTop: -22,
    },
    checkCircle: {
        width: 36, height: 36, borderRadius: 18,
        justifyContent: 'center', alignItems: 'center',
        marginRight: 14,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9, shadowRadius: 10,
    },
    toastTexts: { flex: 1 },
    toastTitle: { fontSize: 14, fontFamily: 'Poppins-Bold', marginBottom: 2 },
    toastSub:   { fontSize: 12, fontFamily: 'Poppins-Regular' },
});

export default PaymentMethodScreen;
