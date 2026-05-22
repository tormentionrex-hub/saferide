import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * NotificationBell
 *
 * Botón con icono campana + badge de notificaciones no leídas.
 * No abre nada por sí mismo — el padre maneja onPress (típicamente
 * abrir el NotificationCenterModal).
 *
 * Props:
 * - unreadCount {number} — número a mostrar en el badge (0 = sin badge)
 * - color {string}       — color del icono (típicamente theme.text)
 * - onPress {function}
 */
const NotificationBell = ({ unreadCount = 0, color = '#1C1C1E', onPress }) => {
    const safeCount = Number(unreadCount) > 99 ? '99+' : String(Number(unreadCount) || 0);
    const showBadge = Number(unreadCount) > 0;

    return (
        <TouchableOpacity
            style={styles.btn}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityLabel={`Notificaciones${showBadge ? `, ${safeCount} sin leer` : ''}`}
            accessibilityRole="button"
        >
            <Ionicons name="notifications-outline" size={24} color={color} />
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
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badge: {
        position: 'absolute',
        top: 4,
        right: 4,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: '#FF3B30',
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontFamily: 'Poppins-Bold',
        lineHeight: 12,
    },
});

export default NotificationBell;
