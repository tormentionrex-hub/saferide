import { useState, useRef, useEffect } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, ActivityIndicator,
    StatusBar, ScrollView, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

const PASSWORD_RULES = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export default function ForgotPasswordNewPassword({ navigation, route }) {
    const { email, code } = route.params;

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [confirmError, setConfirmError] = useState('');
    const [passwordFocus, setPasswordFocus] = useState(false);
    const [confirmFocus, setConfirmFocus] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const passwordFocusAnim = useRef(new Animated.Value(0)).current;
    const confirmFocusAnim = useRef(new Animated.Value(0)).current;
    const successScale = useRef(new Animated.Value(0)).current;
    const successOpacity = useRef(new Animated.Value(0)).current;

    const [fontsLoaded] = useFonts({
        'Poppins-Bold': require('../../fonts/Poppins_700Bold.ttf'),
        'Poppins-SemiBold': require('../../fonts/Poppins_600SemiBold.ttf'),
        'Poppins-Regular': require('../../fonts/Poppins_400Regular.ttf'),
    });

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(fadeAnim, { toValue: 1, duration: 5000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(fadeAnim, { toValue: 0, duration: 5000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        ).start();
    }, []);

    useEffect(() => {
        Animated.timing(passwordFocusAnim, {
            toValue: passwordFocus ? 1 : 0,
            duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: false,
        }).start();
    }, [passwordFocus]);

    useEffect(() => {
        Animated.timing(confirmFocusAnim, {
            toValue: confirmFocus ? 1 : 0,
            duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: false,
        }).start();
    }, [confirmFocus]);

    const makeBorderStyle = (anim) => ({
        borderColor: anim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.2)', '#1fa8f8ff'] }),
        borderWidth: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3] }),
    });

    const showSuccessAnimation = () => {
        setSuccess(true);
        Animated.parallel([
            Animated.spring(successScale, { toValue: 1, tension: 180, friction: 7, useNativeDriver: true }),
            Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
        setTimeout(() => {
            navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
        }, 2500);
    };

    const validate = () => {
        let valid = true;
        if (!PASSWORD_RULES.test(password)) {
            setPasswordError('Mín. 8 caracteres: mayúscula, minúscula, número y carácter especial (@$!%*?&).');
            valid = false;
        } else {
            setPasswordError('');
        }
        if (password !== confirmPassword) {
            setConfirmError('Las contraseñas no coinciden.');
            valid = false;
        } else {
            setConfirmError('');
        }
        return valid;
    };

    const handleReset = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            await api.post('/auth/reset-password', {
                email,
                code,
                newPassword: password,
            });
            showSuccessAnimation();
        } catch (error) {
            const status = error.response?.status;
            const msg = error.response?.data?.message || 'Error al restablecer. Intenta de nuevo.';

            if (status === 400 && msg.toLowerCase().includes('código')) {
                // Código inválido o expirado → volver a pantalla de código
                navigation.navigate('ForgotPasswordCode', {
                    email,
                    errorFromReset: 'El código es inválido o expiró. Ingresa uno nuevo.',
                });
            } else {
                setPasswordError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    if (!fontsLoaded) return null;

    // Pantalla de éxito
    if (success) {
        return (
            <Animated.View style={styles.container}>
                <LinearGradient colors={['#09314bff', '#0c4469ff', '#073050ff']} style={StyleSheet.absoluteFill} />
                <View style={styles.successContainer}>
                    <Animated.View style={[styles.successCircle, { transform: [{ scale: successScale }], opacity: successOpacity }]}>
                        <Ionicons name="checkmark" size={52} color="#FFF" />
                    </Animated.View>
                    <Animated.Text style={[styles.successTitle, { opacity: successOpacity }]}>
                        ¡Contraseña actualizada!
                    </Animated.Text>
                    <Animated.Text style={[styles.successSub, { opacity: successOpacity }]}>
                        Ya puedes iniciar sesión con tu nueva contraseña.
                    </Animated.Text>
                </View>
            </Animated.View>
        );
    }

    return (
        <Animated.View style={styles.container}>
            <LinearGradient
                colors={['#09314bff', '#0c4469ff', '#073050ff']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
                <LinearGradient
                    colors={['#0a6191ff', '#0a8ac5ff', '#3dabdaff']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0, y: 1 }}
                />
            </Animated.View>

            <SafeAreaView style={styles.safeArea}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.iconContainer}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="lock-closed-outline" size={36} color="#38BDF8" />
                            </View>
                        </View>

                        <Text style={styles.heading}>Nueva contraseña</Text>
                        <Text style={styles.subheading}>
                            Crea una contraseña segura para tu cuenta.
                        </Text>

                        <View style={styles.form}>
                            {/* Nueva contraseña */}
                            <Text style={styles.label}>Nueva contraseña</Text>
                            <Animated.View style={[
                                styles.inputBox,
                                passwordError ? styles.inputBoxError : makeBorderStyle(passwordFocusAnim),
                            ]}>
                                <TextInput
                                    style={[styles.input, { flex: 1 }]}
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    placeholder="Mín. 8 caracteres"
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    value={password}
                                    onFocus={() => setPasswordFocus(true)}
                                    onBlur={() => setPasswordFocus(false)}
                                    onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                                    <Ionicons
                                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                                        size={22}
                                        color="rgba(255,255,255,0.6)"
                                    />
                                </TouchableOpacity>
                            </Animated.View>
                            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

                            {/* Confirmar contraseña */}
                            <Text style={[styles.label, { marginTop: 12 }]}>Confirmar contraseña</Text>
                            <Animated.View style={[
                                styles.inputBox,
                                confirmError ? styles.inputBoxError : makeBorderStyle(confirmFocusAnim),
                            ]}>
                                <TextInput
                                    style={[styles.input, { flex: 1 }]}
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    placeholder="Repite la contraseña"
                                    secureTextEntry={!showConfirm}
                                    autoCapitalize="none"
                                    value={confirmPassword}
                                    onFocus={() => setConfirmFocus(true)}
                                    onBlur={() => setConfirmFocus(false)}
                                    onChangeText={(t) => { setConfirmPassword(t); setConfirmError(''); }}
                                />
                                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                                    <Ionicons
                                        name={showConfirm ? 'eye-outline' : 'eye-off-outline'}
                                        size={22}
                                        color="rgba(255,255,255,0.6)"
                                    />
                                </TouchableOpacity>
                            </Animated.View>
                            {confirmError ? <Text style={styles.errorText}>{confirmError}</Text> : null}

                            {/* Requisitos */}
                            <View style={styles.requirementsBox}>
                                <Text style={styles.requirementsTitle}>Requisitos:</Text>
                                {[
                                    'Mínimo 8 caracteres',
                                    'Una letra mayúscula',
                                    'Una letra minúscula',
                                    'Un número',
                                    'Un carácter especial (@$!%*?&)',
                                ].map((req) => (
                                    <View key={req} style={styles.requirementRow}>
                                        <Ionicons name="ellipse" size={5} color="rgba(255,255,255,0.4)" style={{ marginTop: 2 }} />
                                        <Text style={styles.requirementText}>{req}</Text>
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleReset}
                                activeOpacity={0.85}
                                disabled={loading}
                            >
                                {loading
                                    ? <ActivityIndicator color="#045084" />
                                    : <Text style={styles.buttonText}>Restablecer contraseña</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#082F49' },
    safeArea: { flex: 1 },
    flex: { flex: 1 },
    backBtn: { padding: 16, paddingBottom: 0 },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingTop: 20,
        paddingBottom: 40,
    },
    iconContainer: { alignItems: 'center', marginBottom: 28 },
    iconCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: 'rgba(56,189,248,0.12)',
        borderWidth: 1.5,
        borderColor: 'rgba(56,189,248,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    heading: {
        fontFamily: 'Poppins-Bold',
        fontSize: 24,
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 8,
    },
    subheading: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: 'rgba(235,235,235,0.72)',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    form: { width: '100%' },
    label: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 16,
        color: '#FFFFFF',
        marginBottom: 8,
        marginLeft: 2,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 16,
        height: 62,
        marginBottom: 6,
    },
    inputBoxError: {
        borderColor: '#FF3B30',
        borderWidth: 3,
        backgroundColor: 'rgba(255,59,48,0.15)',
    },
    input: {
        fontFamily: 'Poppins-Regular',
        fontSize: 16,
        color: '#FFFFFF',
    },
    eyeBtn: { paddingLeft: 8 },
    errorText: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FF3B30',
        fontSize: 13,
        marginBottom: 6,
        marginLeft: 2,
    },
    requirementsBox: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: 14,
        marginTop: 16,
        marginBottom: 4,
        gap: 4,
    },
    requirementsTitle: {
        fontFamily: 'Poppins-SemiBold',
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        marginBottom: 4,
    },
    requirementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    requirementText: {
        fontFamily: 'Poppins-Regular',
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
    button: {
        height: 52,
        backgroundColor: '#38BDF8',
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
        elevation: 8,
    },
    buttonDisabled: { backgroundColor: 'rgba(56,189,248,0.45)', elevation: 0, shadowOpacity: 0 },
    buttonText: {
        fontFamily: 'Poppins-Bold',
        color: '#FFFFFF',
        fontSize: 16,
        letterSpacing: 0.5,
    },
    // Pantalla de éxito
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        gap: 20,
    },
    successCircle: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: '#38BDF8',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 24,
        elevation: 16,
    },
    successTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 26,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    successSub: {
        fontFamily: 'Poppins-Regular',
        fontSize: 15,
        color: 'rgba(235,235,235,0.72)',
        textAlign: 'center',
        lineHeight: 24,
    },
});
