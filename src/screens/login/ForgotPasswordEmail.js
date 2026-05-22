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

export default function ForgotPasswordEmail({ navigation }) {
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [emailFocus, setEmailFocus] = useState(false);
    const [loading, setLoading] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const emailFocusAnim = useRef(new Animated.Value(0)).current;

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
        Animated.timing(emailFocusAnim, {
            toValue: emailFocus ? 1 : 0,
            duration: 400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
        }).start();
    }, [emailFocus]);

    const emailAnimatedStyle = {
        borderColor: emailFocusAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(255,255,255,0.2)', '#1fa8f8ff'],
        }),
        borderWidth: emailFocusAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 3] }),
    };

    const validate = () => {
        if (!email.trim()) {
            setEmailError('El correo es requerido.');
            return false;
        }
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email.trim())) {
            setEmailError('Ingresa un correo válido.');
            return false;
        }
        setEmailError('');
        return true;
    };

    const handleSendCode = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            await api.post('/auth/send-verification-code', {
                email: email.trim().toLowerCase(),
            });
            navigation.navigate('ForgotPasswordCode', { email: email.trim().toLowerCase() });
        } catch (error) {
            const msg = error.response?.data?.message || 'Error al enviar el código. Intenta de nuevo.';
            setEmailError(msg);
        } finally {
            setLoading(false);
        }
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
                                <Ionicons name="mail-outline" size={36} color="#38BDF8" />
                            </View>
                        </View>

                        <Text style={styles.heading}>¿Olvidaste tu contraseña?</Text>
                        <Text style={styles.subheading}>
                            Ingresa tu correo corporativo y te enviaremos un código de verificación.
                        </Text>

                        <View style={styles.form}>
                            <Text style={styles.label}>Correo corporativo</Text>
                            <Animated.View style={[
                                styles.inputBox,
                                emailError ? styles.inputBoxError : emailAnimatedStyle,
                            ]}>
                                <Ionicons name="mail-outline" size={20} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    placeholder="usuario@empresa.com"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={email}
                                    onFocus={() => setEmailFocus(true)}
                                    onBlur={() => setEmailFocus(false)}
                                    onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                                />
                            </Animated.View>
                            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleSendCode}
                                activeOpacity={0.85}
                                disabled={loading}
                            >
                                {loading
                                    ? <ActivityIndicator color="#045084" />
                                    : <Text style={styles.buttonText}>Enviar código</Text>
                                }
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.footer} onPress={() => navigation.goBack()}>
                            <Text style={styles.footerText}>Volver a </Text>
                            <Text style={styles.footerLink}>Iniciar sesión</Text>
                        </TouchableOpacity>
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
    inputIcon: { marginRight: 10 },
    input: {
        flex: 1,
        fontFamily: 'Poppins-Regular',
        fontSize: 16,
        color: '#FFFFFF',
    },
    errorText: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FF3B30',
        fontSize: 14,
        marginBottom: 8,
        marginLeft: 2,
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
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 32,
    },
    footerText: {
        fontFamily: 'Poppins-Regular',
        color: 'rgba(235,235,235,0.72)',
        fontSize: 14,
    },
    footerLink: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FFFFFF',
        fontSize: 14,
    },
});
