import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AUTO_DISMISS_MS = 9000;

/**
 * Banner deslizable desde arriba que avisa al conductor que un pasajero
 * recién pagó un viaje pendiente. Se auto-descarta tras unos segundos.
 */
const PaidNoticeBanner = ({ notice, onDismiss, topInset = 0 }) => {
    const translateY = useRef(new Animated.Value(-160)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    const close = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -160,
                duration: 280,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss?.(notice?.bookingId);
        });
    };

    useEffect(() => {
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 9,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();

        const t = setTimeout(close, AUTO_DISMISS_MS);
        return () => clearTimeout(t);
    }, []);

    if (!notice) return null;
    const firstName = (notice.passengerName || 'Tu pasajero').split(' ')[0];

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[styles.wrap, { paddingTop: topInset + 8, transform: [{ translateY }], opacity }]}
        >
            <View style={styles.card}>
                <View style={styles.iconCircle}>
                    <Ionicons name="cash" size={22} color="#fff" />
                </View>
                <View style={styles.textCol}>
                    <Text style={styles.title}>¡Pago recibido!</Text>
                    <Text style={styles.body} numberOfLines={3}>
                        <Text style={styles.bodyBold}>{firstName}</Text>
                        {' '}ya pagó su viaje pendiente, por favor revisa tu monedero.
                    </Text>
                </View>
                <TouchableOpacity onPress={close} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={18} color="#0F2A1A" />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 14,
        zIndex: 9999,
        elevation: 30,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#E7F8EE',
        borderColor: '#10B981',
        borderWidth: 1.5,
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 14,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
        elevation: 12,
    },
    iconCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 4,
    },
    textCol: { flex: 1 },
    title: {
        fontSize: 13,
        fontFamily: 'Poppins-Bold',
        color: '#0F2A1A',
        letterSpacing: 0.2,
        marginBottom: 2,
    },
    body: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#1F4737',
        lineHeight: 16,
    },
    bodyBold: {
        fontFamily: 'Poppins-Bold',
        color: '#0F2A1A',
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(15,42,26,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default PaidNoticeBanner;
