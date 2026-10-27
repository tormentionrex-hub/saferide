import React, { useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    SectionList,
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
 */

// Cada tipo trae un título legible y una paleta. El título se renderiza en
// negrita arriba del mensaje del backend para dar jerarquía visual.
const TYPE_META = {
    booking_pending:     { icon: 'person-add',          color: '#F59E0B', title: 'Nueva reserva' },
    booking_confirmed:   { icon: 'checkmark-circle',    color: '#10B981', title: 'Reserva confirmada' },
    booking_cancelled:   { icon: 'close-circle',        color: '#EF4444', title: 'Reserva cancelada' },
    booking_denied:      { icon: 'remove-circle',       color: '#EF4444', title: 'Reserva rechazada' },
    ride_reminder:       { icon: 'time',                color: '#2563EB', title: 'Recordatorio de viaje' },
    ride_started:        { icon: 'car-sport',           color: '#2563EB', title: 'Viaje iniciado' },
    ride_completed:      { icon: 'flag',                color: '#10B981', title: 'Viaje completado' },
    ride_cancelled:      { icon: 'ban',                 color: '#EF4444', title: 'Viaje cancelado' },
    review_request:      { icon: 'star',                color: '#F59E0B', title: 'Calificación pendiente' },
    trust_score_updated: { icon: 'shield-half',         color: '#7C3AED', title: 'Puntaje actualizado' },
    system:              { icon: 'information-circle',  color: '#2563EB', title: 'Notificación' },
};

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

const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

// Agrupa por antigüedad para mostrar headers Hoy / Ayer / Esta semana /
// Anteriores. Se mantiene el orden de entrada dentro de cada grupo, que
// asume que el backend ya manda las notificaciones en orden descendente.
const groupByDate = (notifications) => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const today = [];
    const yest = [];
    const week = [];
    const older = [];

    for (const n of notifications) {
        const d = new Date(n.date || n.createdAt);
        if (isNaN(d.getTime())) { older.push(n); continue; }
        if (isSameDay(d, now)) today.push(n);
        else if (isSameDay(d, yesterday)) yest.push(n);
        else if ((now - d) / 86400000 < 7) week.push(n);
        else older.push(n);
    }

    const sections = [];
    if (today.length) sections.push({ title: 'Hoy', data: today });
    if (yest.length)  sections.push({ title: 'Ayer', data: yest });
    if (week.length)  sections.push({ title: 'Esta semana', data: week });
    if (older.length) sections.push({ title: 'Anteriores', data: older });
    return sections;
};

const NotificationItem = React.memo(({ item, theme, onPress }) => {
    const meta = TYPE_META[item.type] || TYPE_META.system;
    const unread = item.status === 'unread';
    const handlePress = useCallback(() => onPress(item), [item, onPress]);

    return (
        <TouchableOpacity
            style={[
                styles.item,
                {
                    backgroundColor: theme.surface,
                    borderColor: unread ? meta.color + '33' : theme.border,
                    shadowColor: theme.dark ? '#000' : meta.color,
                },
                unread && styles.itemUnread,
            ]}
            activeOpacity={0.75}
            onPress={handlePress}
        >
            {/* Barra de acento izquierda — sólo visible cuando está sin leer */}
            <View
                style={[
                    styles.accentBar,
                    { backgroundColor: unread ? meta.color : 'transparent' },
                ]}
            />

            {/* Círculo con ícono, fondo tintado al color del tipo */}
            <View
                style={[
                    styles.iconCircle,
                    {
                        backgroundColor: meta.color + '1A',
                        borderColor: meta.color + '33',
                    },
                ]}
            >
                <Ionicons name={meta.icon} size={20} color={meta.color} />
            </View>

            {/* Contenido: título derivado del tipo + mensaje + fecha */}
            <View style={styles.itemBody}>
                <View style={styles.itemTopRow}>
                    <Text
                        style={[styles.itemTitle, { color: theme.text }]}
                        numberOfLines={1}
                    >
                        {meta.title}
                    </Text>
                    {unread && (
                        <View style={[styles.unreadDot, { backgroundColor: meta.color }]} />
                    )}
                </View>
                <Text
                    style={[styles.itemMessage, { color: theme.textSecondary }]}
                    numberOfLines={2}
                >
                    {item.message}
                </Text>
                <Text style={[styles.itemDate, { color: theme.textSecondary }]}>
                    {formatRelative(item.date || item.createdAt)}
                </Text>
            </View>

            <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.textSecondary + '88'}
                style={styles.chevron}
            />
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

    const unreadCount = useMemo(
        () => notifications.filter((n) => n.status === 'unread').length,
        [notifications]
    );
    const hasUnread = unreadCount > 0;

    const sections = useMemo(() => groupByDate(notifications), [notifications]);

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

    const renderSectionHeader = useCallback(
        ({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
                <Text style={[styles.sectionHeaderText, { color: theme.textSecondary }]}>
                    {section.title.toUpperCase()}
                </Text>
            </View>
        ),
        [theme]
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
                                    ? (StatusBar.currentHeight || 24) + 10
                                    : insets.top + 10,
                            backgroundColor: theme.bg,
                            borderBottomColor: theme.divider,
                        },
                    ]}
                >
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.headerBackBtn}
                        accessibilityLabel="Cerrar"
                    >
                        <Ionicons name="chevron-back" size={26} color={theme.text} />
                    </TouchableOpacity>

                    <View style={styles.headerTitleBlock}>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>
                            Notificaciones
                        </Text>
                        <Text
                            style={[styles.headerSubtitle, { color: theme.textSecondary }]}
                        >
                            {hasUnread
                                ? `${unreadCount} sin leer`
                                : 'Estás al día'}
                        </Text>
                    </View>

                    {hasUnread ? (
                        <TouchableOpacity
                            onPress={markAllAsRead}
                            style={[
                                styles.markAllPill,
                                {
                                    backgroundColor: theme.accent + '15',
                                    borderColor: theme.accent + '40',
                                },
                            ]}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="checkmark-done" size={14} color={theme.accent} />
                            <Text style={[styles.markAllText, { color: theme.accent }]}>
                                Leer todas
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.headerSpacer} />
                    )}
                </View>

                {loading && notifications.length === 0 ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={theme.accent} />
                    </View>
                ) : notifications.length === 0 ? (
                    <View style={styles.center}>
                        <View
                            style={[
                                styles.emptyCircle,
                                {
                                    backgroundColor: theme.surfaceVariant,
                                    borderColor: theme.border,
                                },
                            ]}
                        >
                            <Ionicons
                                name="notifications-off-outline"
                                size={48}
                                color={theme.textSecondary + 'AA'}
                            />
                        </View>
                        <Text style={[styles.emptyTitle, { color: theme.text }]}>
                            Sin notificaciones
                        </Text>
                        <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                            Cuando recibas una actualización aparecerá aquí.
                        </Text>
                    </View>
                ) : (
                    <SectionList
                        sections={sections}
                        keyExtractor={keyExtractor}
                        renderItem={renderItem}
                        renderSectionHeader={renderSectionHeader}
                        stickySectionHeadersEnabled={false}
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

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingBottom: 16,
        gap: 2,
    },
    headerBackBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
    },
    headerTitleBlock: {
        flex: 1,
        marginLeft: 4,
    },
    headerTitle: {
        fontSize: 22,
        fontFamily: 'Poppins-Bold',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        marginTop: 1,
    },
    markAllPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8,
    },
    markAllText: {
        fontSize: 12,
        fontFamily: 'Poppins-SemiBold',
    },
    headerSpacer: {
        width: 12,
    },

    // Lista
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 4,
    },

    // Section header
    sectionHeader: {
        paddingTop: 14,
        paddingBottom: 8,
    },
    sectionHeaderText: {
        fontSize: 11,
        fontFamily: 'Poppins-Bold',
        letterSpacing: 1.4,
    },

    // Card
    item: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 13,
        paddingRight: 12,
        paddingLeft: 14,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 10,
        position: 'relative',
        // Sombra (iOS) + elevation (Android)
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
        overflow: 'hidden',
    },
    itemUnread: {
        shadowOpacity: 0.14,
        elevation: 4,
    },
    accentBar: {
        position: 'absolute',
        left: 0,
        top: 12,
        bottom: 12,
        width: 3,
        borderTopRightRadius: 3,
        borderBottomRightRadius: 3,
    },
    iconCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        flexShrink: 0,
    },
    itemBody: {
        flex: 1,
        gap: 2,
    },
    itemTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    itemTitle: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'Poppins-Bold',
        letterSpacing: -0.2,
    },
    itemMessage: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        lineHeight: 18,
        marginTop: 2,
    },
    itemDate: {
        fontSize: 11,
        fontFamily: 'Poppins-Regular',
        marginTop: 5,
        letterSpacing: 0.1,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    chevron: {
        alignSelf: 'center',
        marginLeft: 2,
    },

    // Empty / loading
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        gap: 4,
    },
    emptyCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
        borderWidth: 1,
    },
    emptyTitle: {
        fontSize: 18,
        fontFamily: 'Poppins-Bold',
        marginTop: 4,
    },
    emptySub: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        lineHeight: 19,
        marginTop: 4,
    },
});

export default NotificationCenterModal;
