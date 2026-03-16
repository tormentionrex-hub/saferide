import React, { useState } from 'react';
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
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../config';

export default function SignInScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

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

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" />
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.content}>
                    {/* Logo */}
                    <View style={styles.logoContainer}>
                        <Ionicons name="car-sport-outline" size={64} color="#2563EB" />
                        <Text style={styles.title}>Safe Ride</Text>
                        <Text style={styles.subtitle}>Inicia sesión en tu cuenta</Text>
                    </View>

                    {/* Form */}
                    <View style={styles.formContainer}>
                        {/* Email */}
                        <View style={styles.inputWrapper}>
                            <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, emailError ? styles.inputError : null]}
                                placeholder="Correo electrónico"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={email}
                                onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                            />
                        </View>
                        {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

                        {/* Password */}
                        <View style={styles.inputWrapper}>
                            <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, styles.inputPassword, passwordError ? styles.inputError : null]}
                                placeholder="Contraseña"
                                placeholderTextColor="#9CA3AF"
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                value={password}
                                onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeButton}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                                    size={20}
                                    color="#9CA3AF"
                                />
                            </TouchableOpacity>
                        </View>
                        {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

                        {/* Button */}
                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleLogin}
                            activeOpacity={0.8}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={styles.buttonText}>Iniciar sesión</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Al continuar, aceptas nuestros{' '}
                        <Text style={styles.linkText}>Términos de Servicio</Text>.
                    </Text>
                </View>
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
                        <ActivityIndicator color="#2563EB" style={{ marginTop: 16 }} />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 48,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#111827',
        marginTop: 16,
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
    },
    formContainer: {
        width: '100%',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 28,
        backgroundColor: '#ffffff',
        marginBottom: 8,
        paddingHorizontal: 20,
        height: 56,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    inputPassword: {
        paddingRight: 8,
    },
    inputError: {
        borderColor: '#EF4444',
    },
    eyeButton: {
        padding: 4,
    },
    errorText: {
        color: '#EF4444',
        fontSize: 13,
        marginBottom: 10,
        paddingHorizontal: 16,
    },
    button: {
        height: 56,
        backgroundColor: '#2563EB',
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        backgroundColor: '#93C5FD',
        elevation: 0,
        shadowOpacity: 0,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    },
    footer: {
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    footerText: {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
    },
    linkText: {
        color: '#2563EB',
        textDecorationLine: 'underline',
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
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
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
    },
    successCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#2563EB',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 12,
    },
    modalSubtitle: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
    },
});
