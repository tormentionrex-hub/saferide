import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { getCheckoutColors } from './checkoutTheme';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { moderateScale } from '../../utils/responsive';

// Logos dentro de un recuadro blanco en ambos temas (los logos de marca solo
// se leen bien sobre blanco). Todo
// vectorial: íconos de marca de FontAwesome5 y los círculos de Mastercard
// dibujados con vistas.
const logoStyles = StyleSheet.create({
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    mcWrap: { width: 34, height: 22, flexDirection: 'row' },
    mcCircle: { width: 22, height: 22, borderRadius: 11 },
    mcRight: { marginLeft: -10, opacity: 0.92 },
    paypalWord: {
        fontSize: moderateScale(22),
        fontFamily: 'Poppins-Bold',
        fontStyle: 'italic',
        letterSpacing: -0.5,
    },
});

const MastercardMark = () => (
    <View style={logoStyles.mcWrap} accessibilityElementsHidden>
        <View style={[logoStyles.mcCircle, { backgroundColor: '#EB001B' }]} />
        <View style={[logoStyles.mcCircle, logoStyles.mcRight, { backgroundColor: '#F79E1B' }]} />
    </View>
);

export const Logo = ({ id }) => {
    switch (id) {
        case 'card':
            return (
                <View style={logoStyles.logoRow}>
                    <FontAwesome5 name="cc-visa" brand size={26} color="#1A1F71" />
                    <MastercardMark />
                </View>
            );
        case 'paypal':
            return (
                <Text style={logoStyles.paypalWord}>
                    <Text style={{ color: '#003087' }}>Pay</Text>
                    <Text style={{ color: '#009CDE' }}>Pal</Text>
                </Text>
            );
        case 'apple_pay':
            return <FontAwesome5 name="apple-pay" brand size={40} color="#000000" />;
        case 'google_pay':
            return <FontAwesome5 name="google-pay" brand size={40} color="#3C4043" />;
        default:
            return null;
    }
};

const PaymentOptionList = ({ options, selected, onSelect }) => {
    const { theme } = useDriverTheme();
    const styles = useMemo(() => makeStyles(getCheckoutColors(theme)), [theme]);
    return (
    <View style={styles.list} accessibilityRole="radiogroup">
        {options.map((opt) => {
            const isSelected = selected === opt.id;
            return (
                <Pressable
                    key={opt.id}
                    onPress={() => onSelect(opt.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected, disabled: !!opt.unavailable }}
                    accessibilityLabel={`${opt.title}. ${opt.subtitle}`}
                    style={({ pressed }) => [
                        styles.row,
                        isSelected && styles.rowSelected,
                        pressed && { opacity: 0.85 },
                    ]}
                >
                    <View style={styles.logoBox}>
                        <Logo id={opt.id} />
                    </View>
                    <View style={styles.texts}>
                        <Text style={styles.title}>{opt.title}</Text>
                        <Text style={styles.subtitle}>{opt.subtitle}</Text>
                    </View>
                    <View style={[styles.radio, isSelected && styles.radioOn]}>
                        {isSelected && <View style={styles.radioDot} />}
                    </View>
                </Pressable>
            );
        })}
    </View>
    );
};

const makeStyles = (C) => StyleSheet.create({
    list: { gap: 8 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.surface,
        borderRadius: 10,
        paddingVertical: 16,
        paddingHorizontal: 16,
        minHeight: 84,
        borderWidth: 1.5,
        borderColor: C.line,
    },
    rowSelected: { borderColor: C.accent },
    logoBox: {
        width: 92,
        height: 52,
        borderRadius: 6,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: C.logoBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    texts: { flex: 1, marginLeft: 16, marginRight: 12 },
    title: {
        color: C.onSurface,
        fontSize: moderateScale(15),
        fontFamily: 'Poppins-SemiBold',
    },
    subtitle: {
        color: C.muted,
        fontSize: moderateScale(13),
        fontFamily: 'Poppins-Regular',
        lineHeight: moderateScale(18),
        marginTop: 2,
    },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: C.muted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOn: { borderColor: C.accent },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent },
});

export default PaymentOptionList;
