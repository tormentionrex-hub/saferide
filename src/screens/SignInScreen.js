import { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Modal,
    ActivityIndicator,
    StatusBar,
    Image,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import axios from 'axios';
import { API_URL } from '../config';

const ICON = require('../images/IconSafeRide.png');

export default function SignInScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const [fontsLoaded] = useFonts({
        'Poppins-Bold': require('../fonts/Poppins_700Bold.ttf'),
        'Poppins-SemiBold': require('../fonts/Poppins_600SemiBold.ttf'),
        'Poppins-Regular': require('../fonts/Poppins_400Regular.ttf'),
    });

    const validate = () => {
        let valid = true;
        if (!email.trim()) {
            setEmailError('El correo es requerido.');
            valid = false;
        } else {
            setEmailError('');
        }
        if (!password.trim()) {
            setPasswordError('La contraseña es requerida.');
            valid = false;
        } else {
            setPasswordError('');
        }
        return valid;
    };

    const handleLogin = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const response = await axios.post(`${API_URL}/users/login`, {
                email: email.trim(),
                password: password.trim(),
            });
            if (response.status === 200 || response.status === 201) {
                setShowSuccess(true);
                setTimeout(() => {
                    setShowSuccess(false);
                    navigation.replace('Home');
                }, 2500);
            }
        } catch (error) {
            const msg = error.response?.data?.message || 'Correo o contraseña incorrectos.';
            setEmailError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!fontsLoaded) return null;

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#045084" />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Logo */}
                    <View style={styles.logoContainer}>
                        <Image source={ICON} style={styles.icon} resizeMode="contain" />
                        <Text style={styles.brandName}>SafeRide</Text>
                    </View>

                    {/* Heading */}
                    <Text style={styles.heading}>Bienvenido de vuelta</Text>
                    <Text style={styles.subheading}>Inicia sesión para continuar.</Text>

                    {/* Form */}
                    <View style={styles.form}>
                        {/* Email */}
                        <Text style={styles.label}>Correo corporativo</Text>
                        <View style={[styles.inputBox, emailError ? styles.inputBoxError : null]}>
                            <TextInput
                                style={styles.input}
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={email}
                                onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                            />
                        </View>
                        {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

                        {/* Password */}
                        <Text style={styles.label}>Contraseña</Text>
                        <View style={[styles.inputBox, passwordError ? styles.inputBoxError : null]}>
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                value={password}
                                onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                                <Ionicons
                                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                                    size={22}
                                    color="rgba(255,255,255,0.6)"
                                />
                            </TouchableOpacity>
                        </View>
                        {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

                        {/* Forgot password */}
                        <View style={styles.forgotRow}>
                            <Text style={styles.forgotText}>¿Olvidaste tu contraseña? </Text>
                            <TouchableOpacity>
                                <Text style={styles.forgotLink}>Recuperar</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Submit */}
                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleLogin}
                            activeOpacity={0.85}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#045084" />
                            ) : (
                                <Text style={styles.buttonText}>Ingresar</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>¿No tienes una cuenta? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.footerLink}>Regístrate</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Success Modal */}
            <Modal visible={showSuccess} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.successCircle}>
                            <Ionicons name="checkmark" size={52} color="#ffffff" />
                        </View>
                        <Text style={styles.modalTitle}>¡Inicio exitoso!</Text>
                        <Text style={styles.modalSubtitle}>
                            Tu sesión ha sido iniciada correctamente.{'\n'}Redirigiendo al panel principal...
                        </Text>
                        <ActivityIndicator color="#045084" style={{ marginTop: 16 }} />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#045084',
    },
    flex: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingTop: 16,
        paddingBottom: 40,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 20,
        marginTop: -30,
    },
    icon: {
        width: 190,
        height: 190,
        marginBottom: -10,
    },
    brandName: {
        fontFamily: 'Poppins-Bold',
        fontSize: 30,
        color: '#FFFFFF',
        letterSpacing: 1,
        lineHeight: 36,
    },
    heading: {
        fontFamily: 'Poppins-Bold',
        fontSize: 24,
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 4,
    },
    subheading: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: 'rgba(255,255,255,0.65)',
        textAlign: 'center',
        marginBottom: 32,
    },
    form: {
        width: '100%',
    },
    label: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 13,
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
        borderColor: '#FF1F1F',
        borderWidth: 3,
        backgroundColor: 'rgba(255,31,31,0.12)',
    },
    input: {
        flex: 1,
        fontFamily: 'Poppins-Regular',
        fontSize: 16,
        color: '#FFFFFF',
    },
    eyeBtn: {
        paddingLeft: 8,
    },
    errorText: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FF4444',
        fontSize: 14,
        marginBottom: 8,
        marginLeft: 2,
    },
    forgotRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 24,
    },
    forgotText: {
        fontFamily: 'Poppins-Regular',
        color: 'rgba(255,255,255,0.65)',
        fontSize: 13,
    },
    forgotLink: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FFFFFF',
        fontSize: 13,
        textDecorationLine: 'underline',
    },
    button: {
        height: 52,
        backgroundColor: '#38BDF8',
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
        elevation: 8,
    },
    buttonDisabled: {
        backgroundColor: 'rgba(56,189,248,0.45)',
        elevation: 0,
        shadowOpacity: 0,
    },
    buttonText: {
        fontFamily: 'Poppins-Bold',
        color: '#045084',
        fontSize: 16,
        letterSpacing: 0.5,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 32,
    },
    footerText: {
        fontFamily: 'Poppins-Regular',
        color: 'rgba(255,255,255,0.65)',
        fontSize: 14,
    },
    footerLink: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FFFFFF',
        fontSize: 14,
        textDecorationLine: 'underline',
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    modalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        paddingVertical: 48,
        paddingHorizontal: 32,
        alignItems: 'center',
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 10,
    },
    successCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#045084',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#045084',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    modalTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 22,
        color: '#111827',
        marginBottom: 12,
    },
    modalSubtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
    },
});
