import React, { useState } from 'react';
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
import { useDriverTheme } from '../../context/DriverThemeContext';

const CustomizeApp = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { theme, toggleTheme } = useDriverTheme();

    // Estados para los permisos (copiados de SettingConductor)
    const [ubicacion, setUbicacion] = useState(true);
    const [notificaciones, setNotificaciones] = useState(true);
    const [overlay, setOverlay] = useState(true);
    const [camara, setCamara] = useState(false);

    const isDark = theme.dark;

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

            {/* HEADER */}
            <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 16, backgroundColor: theme.bg }]}>
                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Personalizar</Text>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
            >
                {/* APARIENCIA (Modos de la app) */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>APARIENCIA</Text>
                <View style={[styles.card, { backgroundColor: theme.surface }]}>
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
                            <Ionicons name="sunny-outline" size={16} color={!isDark ? '#FFF' : theme.text} style={{ marginRight: 6 }} />
                            <Text style={[styles.themeBtnText, { color: !isDark ? '#FFF' : theme.text }]}>Claro</Text>
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
                            <Ionicons name="moon-outline" size={16} color={isDark ? '#FFF' : theme.text} style={{ marginRight: 6 }} />
                            <Text style={[styles.themeBtnText, { color: isDark ? '#FFF' : theme.text }]}>Oscuro</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* PERMISOS DE LA APP */}
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PERMISOS DE LA APP</Text>
                <View style={[styles.card, { backgroundColor: theme.surface }]}>
                    <PermissionRow iconName="location-outline" iconColor={theme.accent} title="Ubicación" subtitle="Necesaria para mapa y navegación" value={ubicacion} onToggle={setUbicacion} theme={theme} />
                    <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                    <PermissionRow iconName="notifications-outline" iconColor={theme.accent} title="Notificaciones" subtitle="Alertas de rutas y paquetes" value={notificaciones} onToggle={setNotificaciones} theme={theme} />
                    <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                    <PermissionRow iconName="layers-outline" iconColor={theme.accent} title="Mostrar sobre apps" subtitle="Overlay activo durante la ruta" value={overlay} onToggle={setOverlay} theme={theme} />
                    <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                    <PermissionRow iconName="camera-outline" iconColor={theme.accent} title="Cámara" subtitle="Para escanear códigos de barras" value={camara} onToggle={setCamara} theme={theme} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

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
            trackColor={{ false: '#D1D1D6', true: iconColor }}
            thumbColor="#FFFFFF"
        />
    </View>
);

const styles = StyleSheet.create({
    safe: { flex: 1 },
    scroll: { flex: 1 },
    header: { 
        flexDirection: 'row',
        alignItems: 'center', 
        paddingBottom: 12,
        paddingHorizontal: 16
    },
    backButton: {
        marginRight: 16,
    },
    headerTitle: { fontSize: 20, fontFamily: 'Poppins-Bold' },
    sectionLabel: { fontSize: 11, fontFamily: 'Poppins-Bold', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
    card: {
        borderRadius: 16, marginBottom: 20, paddingHorizontal: 16, elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
    },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
    rowIconBox: { width: 36, alignItems: 'center', marginRight: 12 },
    rowTexts: { flex: 1 },
    rowTitle: { fontSize: 15, fontFamily: 'Poppins-Bold' },
    rowSub: { fontSize: 12, fontFamily: 'Poppins-Regular', marginTop: 1 },
    divider: { height: 1 },
    themeRow: { flexDirection: 'row', paddingVertical: 14, gap: 10 },
    themeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
    themeBtnText: { fontSize: 14, fontFamily: 'Poppins-Bold' },
});

export default CustomizeApp;
