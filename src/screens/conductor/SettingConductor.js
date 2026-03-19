import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Switch,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNavigationDriver from '../../components/BottomNavigationDriver';

const PRIMARY = '#4B68FF';
const DANGER  = '#FF3B30';
const BG      = '#F2F2F7';
const CARD    = '#FFFFFF';
const LABEL   = '#8E8E93';
const TEXT    = '#1C1C1E';
const SUBTEXT = '#8E8E93';

const SettingConductor = ({ navigation }) => {
    const insets = useSafeAreaInsets();

    const [modoClaro, setModoClaro]           = useState(false);
    const [temaSeleccionado, setTema]         = useState('claro');
    const [ubicacion, setUbicacion]           = useState(true);
    const [notificaciones, setNotificaciones] = useState(true);
    const [overlay, setOverlay]               = useState(true);
    const [camara, setCamara]                 = useState(false);

    return (
        <SafeAreaView style={styles.safe}>
            {/* ── HEADER ── */}
            <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 16 }]}>
                <Text style={styles.headerTitle}>Configuración</Text>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: 100 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* ── PERFIL ── */}
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarLetter}>C</Text>
                    </View>
                    <Text style={styles.profileName}>Carlos Rodríguez</Text>
                    <Text style={styles.profileRole}>Repartidor</Text>
                </View>

                {/* ── APARIENCIA ── */}
                <Text style={styles.sectionLabel}>APARIENCIA</Text>
                <View style={styles.card}>
                    {/* Modo claro */}
                    <View style={styles.row}>
                        <View style={styles.rowIconBox}>
                            <Ionicons name="sunny" size={22} color="#F4A433" />
                        </View>
                        <View style={styles.rowTexts}>
                            <Text style={styles.rowTitle}>Modo claro</Text>
                            <Text style={styles.rowSub}>Fondo claro activado</Text>
                        </View>
                        <Switch
                            value={modoClaro}
                            onValueChange={setModoClaro}
                            trackColor={{ false: '#D1D1D6', true: PRIMARY }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    <View style={styles.divider} />

                    {/* Selector Claro / Oscuro */}
                    <View style={styles.themeRow}>
                        <TouchableOpacity
                            style={[
                                styles.themeBtn,
                                temaSeleccionado === 'claro' && styles.themeBtnActive,
                            ]}
                            onPress={() => setTema('claro')}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name="sunny-outline"
                                size={16}
                                color={temaSeleccionado === 'claro' ? '#FFFFFF' : TEXT}
                                style={{ marginRight: 6 }}
                            />
                            <Text
                                style={[
                                    styles.themeBtnText,
                                    temaSeleccionado === 'claro' && styles.themeBtnTextActive,
                                ]}
                            >
                                Claro
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.themeBtn,
                                temaSeleccionado === 'oscuro' && styles.themeBtnActive,
                            ]}
                            onPress={() => setTema('oscuro')}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name="moon-outline"
                                size={16}
                                color={temaSeleccionado === 'oscuro' ? '#FFFFFF' : TEXT}
                                style={{ marginRight: 6 }}
                            />
                            <Text
                                style={[
                                    styles.themeBtnText,
                                    temaSeleccionado === 'oscuro' && styles.themeBtnTextActive,
                                ]}
                            >
                                Oscuro
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── PERMISOS ── */}
                <Text style={styles.sectionLabel}>PERMISOS DE LA APP</Text>
                <View style={styles.card}>
                    <PermissionRow
                        iconName="location-outline"
                        iconColor={PRIMARY}
                        title="Ubicación"
                        subtitle="Necesaria para mapa y navegación"
                        value={ubicacion}
                        onToggle={setUbicacion}
                    />
                    <View style={styles.divider} />
                    <PermissionRow
                        iconName="notifications-outline"
                        iconColor={PRIMARY}
                        title="Notificaciones"
                        subtitle="Alertas de rutas y paquetes"
                        value={notificaciones}
                        onToggle={setNotificaciones}
                    />
                    <View style={styles.divider} />
                    <PermissionRow
                        iconName="layers-outline"
                        iconColor={PRIMARY}
                        title="Mostrar sobre apps"
                        subtitle="Overlay activo durante la ruta"
                        value={overlay}
                        onToggle={setOverlay}
                    />
                    <View style={styles.divider} />
                    <PermissionRow
                        iconName="camera-outline"
                        iconColor={PRIMARY}
                        title="Cámara"
                        subtitle="Para escanear códigos de barras"
                        value={camara}
                        onToggle={setCamara}
                    />
                </View>

                {/* ── CERRAR SESIÓN ── */}
                <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.7}>
                    <Text style={styles.logoutText}>Cerrar sesión</Text>
                </TouchableOpacity>
            </ScrollView>

            <BottomNavigationDriver navigation={navigation} activeTab="Configuraciones" />
        </SafeAreaView>
    );
};

/* ── Subcomponente reutilizable para cada permiso ── */
const PermissionRow = ({ iconName, iconColor, title, subtitle, value, onToggle }) => (
    <View style={styles.row}>
        <View style={styles.rowIconBox}>
            <Ionicons name={iconName} size={22} color={iconColor} />
        </View>
        <View style={styles.rowTexts}>
            <Text style={styles.rowTitle}>{title}</Text>
            <Text style={styles.rowSub}>{subtitle}</Text>
        </View>
        <Switch
            value={value}
            onValueChange={onToggle}
            trackColor={{ false: '#D1D1D6', true: DANGER }}
            thumbColor="#FFFFFF"
        />
    </View>
);

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: BG,
    },

    /* Header */
    header: {
        backgroundColor: BG,
        alignItems: 'center',
        paddingBottom: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: 'Poppins-Bold',
        color: TEXT,
    },

    /* Scroll */
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },

    /* Perfil */
    profileCard: {
        backgroundColor: CARD,
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
        backgroundColor: DANGER,
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
        color: TEXT,
    },
    profileRole: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: SUBTEXT,
        marginTop: 2,
    },

    /* Section label */
    sectionLabel: {
        fontSize: 11,
        fontFamily: 'Poppins-Bold',
        color: LABEL,
        letterSpacing: 0.8,
        marginBottom: 8,
        marginLeft: 4,
    },

    /* Card */
    card: {
        backgroundColor: CARD,
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
    rowTexts: {
        flex: 1,
    },
    rowTitle: {
        fontSize: 15,
        fontFamily: 'Poppins-Bold',
        color: TEXT,
    },
    rowSub: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: SUBTEXT,
        marginTop: 1,
    },

    /* Divider */
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
    },

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
        borderColor: '#D1D1D6',
        backgroundColor: '#FFFFFF',
    },
    themeBtnActive: {
        backgroundColor: TEXT,
        borderColor: TEXT,
    },
    themeBtnText: {
        fontSize: 14,
        fontFamily: 'Poppins-Bold',
        color: TEXT,
    },
    themeBtnTextActive: {
        color: '#FFFFFF',
    },

    /* Cerrar sesión */
    logoutBtn: {
        borderWidth: 1.5,
        borderColor: DANGER,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 8,
        backgroundColor: '#FFFFFF',
    },
    logoutText: {
        fontSize: 15,
        fontFamily: 'Poppins-Bold',
        color: DANGER,
    },
});

export default SettingConductor;
