import React, { useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDriverTheme } from '../context/DriverThemeContext';

/**
 * NotificationCenterModal
 *
 * Modal full-screen con la lista de las últimas notificaciones del usuario.
 * Recibe los datos ya cargados (provienen del hook useNotifications del padre,
 * que mantiene polling activo). Este componente sólo renderiza y delega
 * acciones (mark as read, navegar al recurso) al padre.
 *
 * Props:
 * - visible {boolean}
 * - onClose {function}
 * - notifications {Array}      — última lista del hook
 * - loading {boolean}
 * - markAsRead {function(id)}  — del hook
 * - markAllAsRead {function()} — del hook
 * - onNotificationPress {function(notification)} — el padre decide a dónde
 *   navegar según el tipo (ride/booking/etc.). Permite mantener navegación
 *   centralizada y sin que este modal toque navigation directamente.
 */

const TYPE_META = {
    booking_pending:        { icon: 'person-add-outline',   color: '#F59E0B' },
    booking_confirmed:      { icon: 'checkmark-circle',     color: '#10B981' },
    booking_cancelled:      { icon: 'close-circle',         color: '#EF4444' },
    booking_denied:         { icon: 'remove-circle',        color: '#EF4444' },
    ride_reminder:          { icon: 'time-outline',         color: '#2563EB' },
    ride_started:           { icon: 'car-sport',            color: '#2563EB' },
    ride_completed:         { icon: 'flag',                 color: '#10B981' },
    ride_cancelled:         { icon: 'ban',                  color: '#EF4444' },
    review_request:         { icon: 'star-outline',         color: '#F59E0B' },
    trust_score_updated:    { icon: 'shield-half-outline',  color: '#7C3AED' },
    system:                 { icon: 'information-circle',   color: '#2563EB' },
};

/**
 * Convierte una fecha ISO en texto relativo corto en español.
 * Ej: "hace 2 min", "hace 3 h", "ayer", "hace 5 d".
 */
const formatRelative = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';

    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffSec < 60) return 'hace un momento';
    if (diffMin < 60) return `hace ${diffMin} min`;
    if (diffH < 24)   return `hace ${diffH} h`;
    if (diffD === 1)  return 'ayer';
    if (diffD < 7)    return `hace ${diffD} d`;
    return date.toLocaleDateString();
};

const NotificationItem = React.memo(({ item, theme, onPress }) => {
    const meta = TYPE_META[item.type] || TYPE_META.system;
    const unread = item.status === 'unread';
    const handlePress = useCallback(() => onPress(item), [item, onPress]);

    return (
        <TouchableOpacity
            style={[
                styles.item,
                { backgroundColor: theme.surface, borderColor: theme.border },
                unread && { backgroundColor: theme.surfaceVariant },
            ]}
            activeOpacity={0.7}
            onPress={handlePress}
        >
            <View style={[styles.iconCircle, { backgroundColor: meta.color + '22' }]}>
                <Ionicons name={meta.icon} size={20} color={meta.color} />
            </View>
            <View style={styles.itemBody}>
                <Text
                    style={[
                        styles.itemMessage,
                        { color: theme.text },
                        unread && styles.itemMessageUnread,
                    ]}
                    numberOfLines={3}
                >
                    {item.message}
                </Text>
                <Text style={[styles.itemDate, { color: theme.textSecondary }]}>
                    {formatRelative(item.date || item.createdAt)}
                </Text>
            </View>
            {unread && <View style={[styles.unreadDot, { backgroundColor: theme.accent }]} />}
        </TouchableOpacity>
    );
});

const NotificationCenterModal = ({
    visible,
    onClose,
    notifications,
    loading,
    markAllAsRead,
    onNotificationPress,
}) => {
    const { theme } = useDriverTheme();
    const insets = useSafeAreaInsets();

    const hasUnread = useMemo(
        () => notifications.some((n) => n.status === 'unread'),
        [notifications]
    );

    const renderItem = useCallback(
        ({ item }) => (
            <NotificationItem
                item={item}
                theme={theme}
                onPress={onNotificationPress}
            />
        ),
        [theme, onNotificationPress]
    );

    const keyExtractor = useCallback((item) => item._id, []);

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { backgroundColor: theme.bg }]}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
                <View
                    style={[
                        styles.header,
                        {
                            paddingTop:
                                Platform.OS === 'android'
                                    ? (StatusBar.currentHeight || 24) + 12
                                    : insets.top + 12,
                            backgroundColor: theme.bg,
                            borderBottomColor: theme.divider,
                        },
                    ]}
                >
                    <TouchableOpacity onPress={onClose} style={styles.headerBtn} accessibilityLabel="Cerrar">
                        <Ionicons name="chevron-back" size={26} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>
                        Notificaciones
                    </Text>
                    {hasUnread ? (
                        <TouchableOpacity onPress={markAllAsRead} style={styles.headerBtn}>
                            <Text style={[styles.markAllText, { color: theme.accent }]}>
                                Leer todas
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.headerBtn} />
                    )}
                </View>

                {loading && notifications.length === 0 ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={theme.accent} />
                    </View>
                ) : notifications.length === 0 ? (
                    <View style={styles.center}>
                        <Ionicons
                            name="notifications-off-outline"
                            size={64}
                            color={theme.textSecondary + '55'}
                        />
                        <Text style={[styles.emptyTitle, { color: theme.text }]}>
                            Sin notificaciones
                        </Text>
                        <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                            Cuando recibas una actualización aparecerá aquí.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={notifications}
                        keyExtractor={keyExtractor}
                        renderItem={renderItem}
                        contentContainerStyle={[
                            styles.listContent,
                            { paddingBottom: insets.bottom + 24 },
                        ]}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    headerBtn: {
        minWidth: 80,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Poppins-Bold',
    },
    markAllText: {
        fontSize: 13,
        fontFamily: 'Poppins-SemiBold',
        textAlign: 'right',
        alignSelf: 'flex-end',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 10,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    itemBody: { flex: 1, gap: 4 },
    itemMessage: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        lineHeight: 19,
    },
    itemMessageUnread: { fontFamily: 'Poppins-SemiBold' },
    itemDate: {
        fontSize: 11,
        fontFamily: 'Poppins-Regular',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 6,
        flexShrink: 0,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        gap: 8,
    },
    emptyTitle: {
        fontSize: 17,
        fontFamily: 'Poppins-Bold',
        marginTop: 8,
    },
    emptySub: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
    },
});

export default NotificationCenterModal;
