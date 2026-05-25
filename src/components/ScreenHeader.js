import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDriverTheme } from '../context/DriverThemeContext';
import { moderateScale } from '../utils/responsive';

/**
 * Header unificado para todas las screens de navegación de pasajero/conductor.
 * EXCEPCIONES intencionales: dashboards (estructura diferente con tuerca + foto),
 * History y PreviousTripsScreen (usan LinearGradient propio).
 *
 * Layout: 3 zonas con flex:1 a cada lado para que el título quede siempre
 * centrado, sin importar qué haya en `right`.
 *
 * @param {string} title - Texto del header
 * @param {string} [subtitle] - Línea secundaria opcional bajo el título (ej:
 *   "5 viajes encontrados"). Usa textSecondary y se centra con el título.
 * @param {function} [onBack] - Si se pasa, dibuja el botón volver con el diseño
 *   estándar (40x40 redondo con shadow tipo BuscarViaje). Si se omite, no aparece.
 * @param {ReactNode} [right] - Slot opcional para la zona derecha (ej: botón
 *   refresh, badge, etc.)
 * @param {boolean} [useInsets=false] - Si true, añade el safe-area top inset al
 *   paddingTop. Default false porque la mayoría de screens ya están envueltas
 *   en SafeAreaView. Activar solo cuando el screen tiene un View plano arriba.
 */
const ScreenHeader = ({ title, subtitle, onBack, right, useInsets = false }) => {
    const { theme } = useDriverTheme();
    const insets = useSafeAreaInsets();

    const topPad = useInsets
        ? (Platform.OS === 'android'
            ? (insets.top || StatusBar.currentHeight || 0) + 16
            : (insets.top || 0) + 16)
        : 22;

    return (
        <View style={[
            styles.header,
            {
                backgroundColor: theme.bg,
                borderBottomColor: theme.divider || '#CBD5E1',
                paddingTop: topPad,
            },
        ]}>
            <View style={styles.side}>
                {onBack ? (
                    <TouchableOpacity
                        style={[styles.backBtn, { backgroundColor: theme.surface || '#fff' }]}
                        onPress={onBack}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={22} color={theme.text} />
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.center}>
                <Text
                    style={[styles.title, { color: theme.navActive || '#005BBF' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                >
                    {title}
                </Text>
                {subtitle ? (
                    <Text
                        style={[styles.subtitle, { color: theme.textSecondary }]}
                        numberOfLines={1}
                    >
                        {subtitle}
                    </Text>
                ) : null}
            </View>

            <View style={[styles.side, styles.sideRight]}>
                {right}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    side: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    sideRight: { justifyContent: 'flex-end', gap: 6 },
    center: { alignItems: 'center', justifyContent: 'center' },
    title: {
        fontSize: moderateScale(22),
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: moderateScale(12),
        fontFamily: 'Poppins-Regular',
        marginTop: 1,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
});

export default ScreenHeader;
