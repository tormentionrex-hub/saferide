import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Switch,
    TouchableOpacity,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNavigationDriver from '../../components/BottomNavigationDriver';
import { useDriverTheme } from '../../context/DriverThemeContext';

const SettingConductor = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { theme, toggleTheme } = useDriverTheme();

    const [ubicacion, setUbicacion]           = useState(true);
    const [notificaciones, setNotificaciones] = useState(true);
    const [overlay, setOverlay]               = useState(true);
    const [camara, setCamara]                 = useState(false);

    const isDark = theme.dark;

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

            {/* ── HEADER ── */}
            <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 16, backgroundColor: theme.bg }]}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Configuración</Text>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* ── PERFIL ── */}
                <View style={[styles.profileCard, { backgroundColor: theme.surface }]}>
                    <View style={[styles.avatar, { backgroundColor: theme.danger }]}>
                        <Text style={styles.avatarLetter}>C</Text>
                    </View>
                    <Text style={[styles.profileName, { color: theme.text }]}>Carlos Rodríguez</Text>
                    <Text style={[styles.profileRole, { color: theme.textSecondary }]}>Repartidor</Text>
                </View>

                {/* ── APARIENCIA ── */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>APARIENCIA</Text>
                <View style={[styles.card, { backgroundColor: theme.surface }]}>

                    {/* Switch modo claro/oscuro */}
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

                    {/* Botones Claro / Oscuro */}
                    <View style={styles.themeRow}>
                        <TouchableOpacity
                            style={[
                                styles.themeBtn,
                                { borderColor: theme.border, backgroundColor: theme.surface },
                                !isDark && { backgroundColor: theme.text, borderColor: theme.text },
                            ]}
                            onPress={() => toggleTheme(false)}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name="sunny-outline"
                                size={16}
                                color={!isDark ? '#FFFFFF' : theme.text}
                                style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.themeBtnText, { color: !isDark ? '#FFFFFF' : theme.text }]}>
                                Claro
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.themeBtn,
                                { borderColor: theme.border, backgroundColor: theme.surface },
                                isDark && { backgroundColor: theme.accent, borderColor: theme.accent },
                            ]}
                            onPress={() => toggleTheme(true)}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name="moon-outline"
                                size={16}
                                color={isDark ? '#FFFFFF' : theme.text}
                                style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.themeBtnText, { color: isDark ? '#FFFFFF' : theme.text }]}>
                                Oscuro
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── PERMISOS ── */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PERMISOS DE LA APP</Text>
                <View style={[styles.card, { backgroundColor: theme.surface }]}>
                    <PermissionRow
                        iconName="location-outline"
                        iconColor={theme.accent}
                        title="Ubicación"
                        subtitle="Necesaria para mapa y navegación"
                        value={ubicacion}
                        onToggle={setUbicacion}
                        theme={theme}
                    />
                    <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                    <PermissionRow
                        iconName="notifications-outline"
                        iconColor={theme.accent}
                        title="Notificaciones"
                        subtitle="Alertas de rutas y paquetes"
                        value={notificaciones}
                        onToggle={setNotificaciones}
                        theme={theme}
                    />
                    <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                    <PermissionRow
                        iconName="layers-outline"
                        iconColor={theme.accent}
                        title="Mostrar sobre apps"
                        subtitle="Overlay activo durante la ruta"
                        value={overlay}
                        onToggle={setOverlay}
                        theme={theme}
                    />
                    <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                    <PermissionRow
                        iconName="camera-outline"
                        iconColor={theme.accent}
                        title="Cámara"
                        subtitle="Para escanear códigos de barras"
                        value={camara}
                        onToggle={setCamara}
                        theme={theme}
                    />
                </View>

                {/* ── CERRAR SESIÓN ── */}
                <TouchableOpacity
                    style={[styles.logoutBtn, { borderColor: theme.danger, backgroundColor: theme.surface }]}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.logoutText, { color: theme.danger }]}>Cerrar sesión</Text>
                </TouchableOpacity>
            </ScrollView>

            <BottomNavigationDriver navigation={navigation} activeTab="Configuraciones" />
        </SafeAreaView>
    );
};

/* ── Subcomponente para cada permiso ── */
const PermissionRow = ({ iconName, iconColor, title, subtitle, value, onToggle, theme }) => (
    <View style={styles.row}>
        <View style={styles.rowIconBox}>
            <Ionicons name={iconName} size={22} color={iconColor} />
        </View>
        <View style={styles.rowTexts}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.rowSub, { color: theme.textSecondary }]}>{subtitle}</Text>
        </View>
        <Switch
            value={value}
            onValueChange={onToggle}
            trackColor={{ false: '#D1D1D6', true: theme.danger }}
            thumbColor="#FFFFFF"
        />
    </View>
);

const styles = StyleSheet.create({
    safe:   { flex: 1 },
    scroll: { flex: 1 },

    /* Header */
    header: {
        alignItems: 'center',
        paddingBottom: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: 'Poppins-Bold',
    },

    /* Perfil */
    profileCard: {
        borderRadius: 16,
        alignItems: 'center',
        paddingVertical: 24,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    avatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    avatarLetter: {
        fontSize: 32,
        fontFamily: 'Poppins-Bold',
        color: '#FFFFFF',
    },
    profileName: {
        fontSize: 18,
        fontFamily: 'Poppins-Bold',
    },
    profileRole: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        marginTop: 2,
    },

    /* Section label */
    sectionLabel: {
        fontSize: 11,
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.8,
        marginBottom: 8,
        marginLeft: 4,
    },

    /* Card */
    card: {
        borderRadius: 16,
        marginBottom: 20,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },

    /* Row */
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    rowIconBox: {
        width: 36,
        alignItems: 'center',
        marginRight: 12,
    },
    rowTexts: { flex: 1 },
    rowTitle: {
        fontSize: 15,
        fontFamily: 'Poppins-Bold',
    },
    rowSub: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        marginTop: 1,
    },

    /* Divider */
    divider: { height: 1 },

    /* Selector tema */
    themeRow: {
        flexDirection: 'row',
        paddingVertical: 14,
        gap: 10,
    },
    themeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1.5,
    },
    themeBtnText: {
        fontSize: 14,
        fontFamily: 'Poppins-Bold',
    },

    /* Cerrar sesión */
    logoutBtn: {
        borderWidth: 1.5,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 8,
    },
    logoutText: {
        fontSize: 15,
        fontFamily: 'Poppins-Bold',
    },
});

export default SettingConductor;
