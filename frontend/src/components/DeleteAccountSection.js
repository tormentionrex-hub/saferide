import React, { useState } from 'react';
import {
    View, Text, TextInput, Modal, Pressable, StyleSheet, ActivityIndicator,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../context/DriverThemeContext';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { moderateScale } from '../utils/responsive';

// Opción «Eliminar mi cuenta» de Ajustes (pasajero y conductor). Google Play y
// App Store exigen que una app con registro permita borrar la cuenta desde la
// propia app. Pide la contraseña para confirmar; el backend anonimiza los datos
// y rechaza el borrado si hay viajes activos o cobros pendientes.

const ERROR_MESSAGES = {
    WRONG_PASSWORD: 'La contraseña no es correcta.',
    ACTIVE_TRIPS: 'Tienes viajes activos. Cancélalos o termínalos antes de eliminar tu cuenta.',
    PENDING_PAYMENTS: 'Tienes cobros pendientes. Págalos antes de eliminar tu cuenta.',
};

const DeleteAccountSection = ({ navigation }) => {
    const { theme } = useDriverTheme();
    const [visible, setVisible] = useState(false);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const close = () => {
        if (loading) return;
        setVisible(false);
        setPassword('');
        setError(null);
    };

    const confirm = async () => {
        if (!password) { setError('Escribe tu contraseña para confirmar.'); return; }
        setLoading(true);
        setError(null);
        try {
            await userService.deleteMyAccount(password);
            await authService.logout().catch(() => {});
            setVisible(false);
            navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
        } catch (e) {
            const code = e.response?.data?.code;
            setError(ERROR_MESSAGES[code] || 'No se pudo eliminar la cuenta. Revisa tu conexión e intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Pressable
                onPress={() => setVisible(true)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
            >
                <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.linkText, { color: theme.textSecondary }]}>Eliminar mi cuenta</Text>
            </Pressable>

            <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.backdrop}
                >
                    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <View style={[styles.iconCircle, { backgroundColor: theme.dark ? '#2A0A0A' : '#FFF0F0' }]}>
                            <Ionicons name="trash-outline" size={30} color={theme.danger} />
                        </View>
                        <Text style={[styles.title, { color: theme.text }]}>¿Eliminar tu cuenta?</Text>
                        <Text style={[styles.body, { color: theme.textSecondary }]}>
                            Se borrarán tu nombre, correo, teléfono y foto, y no podrás volver a entrar con esta cuenta.
                            Tus viajes pasados se conservan de forma anónima. Esta acción no se puede deshacer.
                        </Text>

                        <Text style={[styles.label, { color: theme.text }]}>Contraseña</Text>
                        <TextInput
                            value={password}
                            onChangeText={(v) => { setPassword(v); setError(null); }}
                            secureTextEntry
                            autoCapitalize="none"
                            placeholder="Tu contraseña"
                            placeholderTextColor={theme.textSecondary}
                            style={[styles.input, { color: theme.text, borderColor: error ? theme.danger : theme.border, backgroundColor: theme.bg }]}
                            accessibilityLabel="Contraseña para confirmar"
                        />
                        {error && <Text style={[styles.error, { color: theme.danger }]} accessibilityLiveRegion="polite">{error}</Text>}

                        <View style={styles.actions}>
                            <Pressable
                                onPress={close}
                                disabled={loading}
                                style={[styles.btn, { borderColor: theme.border, borderWidth: 1 }]}
                                accessibilityRole="button"
                            >
                                <Text style={[styles.btnText, { color: theme.text }]}>Cancelar</Text>
                            </Pressable>
                            <Pressable
                                onPress={confirm}
                                disabled={loading}
                                style={[styles.btn, { backgroundColor: theme.danger }]}
                                accessibilityRole="button"
                                accessibilityState={{ busy: loading }}
                            >
                                {loading
                                    ? <ActivityIndicator color="#FFFFFF" />
                                    : <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Eliminar</Text>}
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    link: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 48,
        marginTop: 8,
    },
    linkText: { fontSize: moderateScale(14), fontFamily: 'Poppins-SemiBold' },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 24,
    },
    card: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: 'stretch' },
    iconCircle: {
        width: 64, height: 64, borderRadius: 32,
        alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12,
    },
    title: { fontSize: moderateScale(18), fontFamily: 'Poppins-Bold', textAlign: 'center' },
    body: {
        fontSize: moderateScale(13), fontFamily: 'Poppins-Regular', textAlign: 'center',
        lineHeight: moderateScale(19), marginTop: 6, marginBottom: 16,
    },
    label: { fontSize: moderateScale(13), fontFamily: 'Poppins-SemiBold', marginBottom: 6 },
    input: {
        borderWidth: 1, borderRadius: 12, height: 48, paddingHorizontal: 14,
        fontSize: moderateScale(15), fontFamily: 'Poppins-Regular',
    },
    error: { fontSize: moderateScale(12), fontFamily: 'Poppins-Regular', marginTop: 6 },
    actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
    btn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: moderateScale(15), fontFamily: 'Poppins-Bold' },
});

export default DeleteAccountSection;
