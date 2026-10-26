import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { getCheckoutColors } from './checkoutTheme';
import { moderateScale } from '../../utils/responsive';
import { onlyDigits, formatNumber, formatExpiry, detectBrand } from '../../utils/cardFormat';

// Formulario de tarjeta del checkout en estado beta. Solo da formato y valida
// en pantalla: los datos no se envían a ningún servidor ni se guardan, y se
// pierden al salir. El cobro real con tarjeta (PayPal Card Fields) está listo
// en PayPalCheckoutScreen detrás de ONLINE_PAYMENTS_LIVE.

const BRAND_ICON = { visa: 'cc-visa', mastercard: 'cc-mastercard', amex: 'cc-amex' };

const CardFormBeta = () => {
    const { theme } = useDriverTheme();
    const C = useMemo(() => getCheckoutColors(theme), [theme]);
    const styles = useMemo(() => makeStyles(C), [C]);

    const [number, setNumber] = useState('');
    const [name, setName] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvc, setCvc] = useState('');
    const [focused, setFocused] = useState(null);

    const brand = detectBrand(number);

    const field = (key, label, input) => (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.slot, focused === key && styles.slotFocused]}>{input}</View>
        </View>
    );

    const inputProps = (key) => ({
        style: styles.input,
        placeholderTextColor: C.placeholder,
        onFocus: () => setFocused(key),
        onBlur: () => setFocused(null),
    });

    return (
        <View>
            <View style={styles.card}>
                {field('number', 'Número de tarjeta', (
                    <View style={styles.row}>
                        <TextInput
                            {...inputProps('number')}
                            style={[styles.input, { flex: 1 }]}
                            value={number}
                            onChangeText={(v) => setNumber(formatNumber(v))}
                            placeholder="0000 0000 0000 0000"
                            keyboardType="number-pad"
                            autoComplete="off"
                            importantForAutofill="no"
                            maxLength={23}
                            accessibilityLabel="Número de tarjeta"
                        />
                        {brand && (
                            <FontAwesome5 name={BRAND_ICON[brand]} brand size={24} color={C.onSurface} />
                        )}
                    </View>
                ))}
                <View style={[styles.row, { marginTop: 20, alignItems: 'flex-start' }]}>
                    <View style={{ flex: 1, marginRight: 20 }}>
                        {field('name', 'Nombre del titular de la tarjeta', (
                            <TextInput
                                {...inputProps('name')}
                                value={name}
                                onChangeText={setName}
                                placeholder="Como aparece en la tarjeta"
                                autoCapitalize="characters"
                                autoComplete="off"
                                importantForAutofill="no"
                                accessibilityLabel="Nombre del titular de la tarjeta"
                            />
                        ))}
                    </View>
                    <View style={{ width: 104 }}>
                        {field('expiry', 'Fecha de caducidad', (
                            <TextInput
                                {...inputProps('expiry')}
                                value={expiry}
                                onChangeText={(v) => setExpiry(formatExpiry(v))}
                                placeholder="MM/AA"
                                keyboardType="number-pad"
                                maxLength={5}
                                accessibilityLabel="Fecha de caducidad"
                            />
                        ))}
                    </View>
                </View>
            </View>

            <View style={[styles.card, styles.back]}>
                <View style={styles.stripe} />
                <View style={styles.cvcWrap}>
                    {field('cvc', 'CVC', (
                        <TextInput
                            {...inputProps('cvc')}
                            value={cvc}
                            onChangeText={(v) => setCvc(onlyDigits(v).slice(0, 4))}
                            placeholder="123"
                            keyboardType="number-pad"
                            secureTextEntry
                            maxLength={4}
                            accessibilityLabel="Código de seguridad CVC"
                        />
                    ))}
                </View>
            </View>
        </View>
    );
};

const makeStyles = (C) => StyleSheet.create({
    card: {
        backgroundColor: C.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.line,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
    },
    back: { marginTop: 12, paddingHorizontal: 0, paddingTop: 0, overflow: 'hidden' },
    stripe: { height: 38, backgroundColor: C.stripe, marginTop: 24, marginBottom: 16 },
    cvcWrap: { width: 96, alignSelf: 'flex-end', marginRight: 20 },
    row: { flexDirection: 'row', alignItems: 'center' },
    field: {},
    label: {
        color: C.onSurface,
        fontSize: moderateScale(13),
        fontFamily: 'Poppins-SemiBold',
    },
    slot: { borderBottomWidth: 1, borderBottomColor: C.line, minHeight: 44, justifyContent: 'center' },
    slotFocused: { borderBottomWidth: 2, borderBottomColor: C.accent },
    input: {
        color: C.onSurface,
        fontSize: moderateScale(16),
        fontFamily: 'Poppins-Regular',
        paddingVertical: 8,
    },
});

export default CardFormBeta;
