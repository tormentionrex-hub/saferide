import { useState, useRef, useEffect } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, ActivityIndicator,
    StatusBar, ScrollView, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../../config.js';

const CODE_LENGTH = 6;

export default function ForgotPasswordCode({ navigation, route }) {
    const { email } = route.params;

    const [code, setCode] = useState('');
    const [codeError, setCodeError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(60);
    const inputRef = useRef(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;

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

    // Countdown para reenviar código
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const shakeError = () => {
        shakeAnim.setValue(0);
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
    };

    const handleContinue = () => {
        if (code.length !== CODE_LENGTH) {
            setCodeError('Ingresa el código de 6 dígitos.');
            shakeError();
            return;
        }
        setCodeError('');
        navigation.navigate('ForgotPasswordNewPassword', { email, code });
    };

    const handleResend = async () => {
        setResendLoading(true);
        try {
            await axios.post(`${API_URL}/auth/send-verification-code`, { email });
            setCode('');
            setCodeError('');
            setResendCooldown(60);
        } catch (error) {
            setCodeError('Error al reenviar. Intenta de nuevo.');
        } finally {
            setResendLoading(false);
        }
    };

    // Render de celdas del código
    const renderCells = () => {
        return Array(CODE_LENGTH).fill(null).map((_, i) => {
            const isFilled = i < code.length;
            const isActive = i === code.length;
            return (
                <TouchableOpacity
                    key={i}
                    style={[
                        styles.cell,
                        isFilled && styles.cellFilled,
                        isActive && styles.cellActive,
                        codeError && styles.cellError,
                    ]}
                    onPress={() => inputRef.current?.focus()}
                    activeOpacity={1}
                >
                    <Text style={styles.cellText}>{code[i] || ''}</Text>
                </TouchableOpacity>
            );
        });
    };

    if (!fontsLoaded) return null;

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
                                <Ionicons name="key-outline" size={36} color="#38BDF8" />
                            </View>
                        </View>

                        <Text style={styles.heading}>Código de verificación</Text>
                        <Text style={styles.subheading}>
                            Enviamos un código de 6 dígitos a{'\n'}
                            <Text style={styles.emailHighlight}>{email}</Text>
                        </Text>

                        {/* Input oculto que recibe la entrada */}
                        <TextInput
                            ref={inputRef}
                            style={styles.hiddenInput}
                            value={code}
                            onChangeText={(t) => {
                                const clean = t.replace(/\D/g, '').slice(0, CODE_LENGTH);
                                setCode(clean);
                                setCodeError('');
                            }}
                            keyboardType="number-pad"
                            maxLength={CODE_LENGTH}
                            autoFocus
                        />

                        {/* Celdas visuales */}
                        <Animated.View style={[styles.cellsRow, { transform: [{ translateX: shakeAnim }] }]}>
                            {renderCells()}
                        </Animated.View>

                        {codeError ? <Text style={styles.errorText}>{codeError}</Text> : null}

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleContinue}
                            activeOpacity={0.85}
                            disabled={loading}
                        >
                            {loading
                                ? <ActivityIndicator color="#045084" />
                                : <Text style={styles.buttonText}>Continuar</Text>
                            }
                        </TouchableOpacity>

                        {/* Reenviar código */}
                        <View style={styles.resendRow}>
                            <Text style={styles.resendText}>¿No recibiste el código? </Text>
                            {resendCooldown > 0 ? (
                                <Text style={styles.resendCooldown}>Reenviar en {resendCooldown}s</Text>
                            ) : (
                                <TouchableOpacity onPress={handleResend} disabled={resendLoading}>
                                    {resendLoading
                                        ? <ActivityIndicator size="small" color="#38BDF8" />
                                        : <Text style={styles.resendLink}>Reenviar</Text>
                                    }
                                </TouchableOpacity>
                            )}
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
        marginBottom: 36,
        lineHeight: 22,
    },
    emailHighlight: {
        fontFamily: 'Poppins-SemiBold',
        color: '#38BDF8',
    },
    hiddenInput: {
        position: 'absolute',
        opacity: 0,
        width: 1,
        height: 1,
    },
    cellsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 8,
    },
    cell: {
        width: 46,
        height: 58,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cellFilled: {
        backgroundColor: 'rgba(56,189,248,0.15)',
        borderColor: '#38BDF8',
    },
    cellActive: {
        borderColor: '#38BDF8',
        borderWidth: 2.5,
        backgroundColor: 'rgba(56,189,248,0.1)',
    },
    cellError: {
        borderColor: '#FF3B30',
        backgroundColor: 'rgba(255,59,48,0.1)',
    },
    cellText: {
        fontFamily: 'Poppins-Bold',
        fontSize: 22,
        color: '#FFFFFF',
    },
    errorText: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FF3B30',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 8,
    },
    button: {
        height: 52,
        backgroundColor: '#38BDF8',
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 28,
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
    resendRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
    },
    resendText: {
        fontFamily: 'Poppins-Regular',
        color: 'rgba(235,235,235,0.72)',
        fontSize: 13,
    },
    resendLink: {
        fontFamily: 'Poppins-SemiBold',
        color: '#38BDF8',
        fontSize: 13,
    },
    resendCooldown: {
        fontFamily: 'Poppins-Regular',
        color: 'rgba(56,189,248,0.5)',
        fontSize: 13,
    },
});
