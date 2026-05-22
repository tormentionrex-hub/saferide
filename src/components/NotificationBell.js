import React, { useEffect, useRef } from 'react';
import {
    TouchableOpacity,
    View,
    Text,
    StyleSheet,
    Animated,
    Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * NotificationBell
 *
 * Botón con icono campana + badge de notificaciones no leídas.
 * No abre nada por sí mismo — el padre maneja onPress (típicamente
 * abrir el NotificationCenterModal).
 *
 * Cuando hay no leídas:
 *  - se usa el ícono filled ("notifications") en lugar del outline
 *  - aparece un halo que pulsa de forma sutil detrás del ícono
 *  - el badge muestra el contador con borde para destacar contra
 *    cualquier fondo
 *
 * Props:
 * - unreadCount {number} — número a mostrar en el badge (0 = sin badge)
 * - color {string}       — color del icono (típicamente theme.text)
 * - haloColor {string}   — color del pulso/halo (default rojo del badge)
 * - onPress {function}
 */
const NotificationBell = ({
    unreadCount = 0,
    color = '#1C1C1E',
    haloColor = '#FF3B30',
    onPress,
}) => {
    const count = Number(unreadCount) || 0;
    const safeCount = count > 99 ? '99+' : String(count);
    const showBadge = count > 0;

    // Halo: dos anillos desfasados que se expanden y desvanecen mientras
    // existan no leídas. Se detiene cuando count = 0 para no consumir RAF
    // en el hilo nativo de manera innecesaria.
    const ring1 = useRef(new Animated.Value(0)).current;
    const ring2 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!showBadge) {
            ring1.stopAnimation();
            ring2.stopAnimation();
            ring1.setValue(0);
            ring2.setValue(0);
            return;
        }

        const makeLoop = (val, delay) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(val, {
                        toValue: 1,
                        duration: 1800,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(val, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ])
            );

        const a = makeLoop(ring1, 0);
        const b = makeLoop(ring2, 900);
        a.start();
        b.start();
        return () => {
            a.stop();
            b.stop();
        };
    }, [showBadge, ring1, ring2]);

    const ringStyle = (anim) => ({
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
        transform: [
            {
                scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1.8],
                }),
            },
        ],
    });

    return (
        <TouchableOpacity
            style={styles.btn}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityLabel={`Notificaciones${showBadge ? `, ${safeCount} sin leer` : ''}`}
            accessibilityRole="button"
        >
            {showBadge && (
                <>
                    <Animated.View
                        pointerEvents="none"
                        style={[styles.halo, { borderColor: haloColor }, ringStyle(ring1)]}
                    />
                    <Animated.View
                        pointerEvents="none"
                        style={[styles.halo, { borderColor: haloColor }, ringStyle(ring2)]}
                    />
                </>
            )}

            <Ionicons
                name={showBadge ? 'notifications' : 'notifications-outline'}
                size={24}
                color={color}
            />

            {showBadge && (
                <View style={styles.badge} pointerEvents="none">
                    <Text style={styles.badgeText} allowFontScaling={false}>
                        {safeCount}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    btn: {
        width: 42,
        height: 42,
        justifyContent: 'center',
        alignItems: 'center',
    },
    halo: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 2,
    },
    badge: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 19,
        height: 19,
        paddingHorizontal: 4,
        borderRadius: 9.5,
        backgroundColor: '#FF3B30',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
        // Sombra leve para separar del fondo
        shadowColor: '#FF3B30',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 4,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontFamily: 'Poppins-Bold',
        lineHeight: 12,
    },
});

export default NotificationBell;
