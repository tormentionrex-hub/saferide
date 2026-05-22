import { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    StatusBar,
    Image,
    ScrollView,
    Animated,
    Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { authService } from '../../services/authService';
import { registerForPushNotifications } from '../../services/pushNotificationService';
import { LinearGradient } from 'expo-linear-gradient';

const ICON = require('../../images/IconSafeRide.png');

export default function SignInScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [emailFocus, setEmailFocus] = useState(false);
    const [passwordFocus, setPasswordFocus] = useState(false);

    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // ── Animaciones del toast de éxito ──
    const toastSlide   = useRef(new Animated.Value(120)).current;
    const toastOpacity = useRef(new Animated.Value(0)).current;
    const checkAnim    = useRef(new Animated.Value(0)).current;
    const ring1Scale   = useRef(new Animated.Value(0.4)).current;
    const ring1Opacity = useRef(new Animated.Value(1)).current;
    const ring2Scale   = useRef(new Animated.Value(0.2)).current;
    const ring2Opacity = useRef(new Animated.Value(0.7)).current;

    const [fontsLoaded] = useFonts({
        'Poppins-Bold': require('../../fonts/Poppins_700Bold.ttf'),
        'Poppins-SemiBold': require('../../fonts/Poppins_600SemiBold.ttf'),
        'Poppins-Regular': require('../../fonts/Poppins_400Regular.ttf'),
    });

    // Animation for background color transition
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Animations for input focus
    const emailFocusAnim = useRef(new Animated.Value(0)).current;
    const passwordFocusAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Create an infinite loop for background
        Animated.loop(
            Animated.sequence([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 5000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 5000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
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

    useEffect(() => {
        Animated.timing(passwordFocusAnim, {
            toValue: passwordFocus ? 1 : 0,
            duration: 400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
        }).start();
    }, [passwordFocus]);

    const emailAnimatedStyle = {
        borderColor: emailFocusAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(255,255,255,0.2)', '#1fa8f8ff'],
        }),
        borderWidth: emailFocusAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 3],
        })
    };

    const passwordAnimatedStyle = {
        borderColor: passwordFocusAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(255,255,255,0.2)', '#1fa8f8ff'],
        }),
        borderWidth: passwordFocusAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 3],
        })
    };

    const showSuccessAnimation = () => {
        // Resetear valores
        toastSlide.setValue(120);
        toastOpacity.setValue(0);
        checkAnim.setValue(0);
        ring1Scale.setValue(0.4);
        ring1Opacity.setValue(1);
        ring2Scale.setValue(0.2);
        ring2Opacity.setValue(0.7);

        setShowSuccess(true);

        // 1. Toast sube con spring
        Animated.parallel([
            Animated.spring(toastSlide, {
                toValue: 0, tension: 60, friction: 8, useNativeDriver: true,
            }),
            Animated.timing(toastOpacity, {
                toValue: 1, duration: 220, useNativeDriver: true,
            }),
        ]).start();

        // 2. Check hace pop después de 160ms
        setTimeout(() => {
            Animated.spring(checkAnim, {
                toValue: 1, tension: 220, friction: 6, useNativeDriver: true,
            }).start();
        }, 160);

        // 3. Ripple doble explota desde el círculo
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(ring1Scale, { toValue: 2.0, duration: 550, useNativeDriver: true }),
                Animated.timing(ring1Opacity, { toValue: 0, duration: 550, useNativeDriver: true }),
                Animated.timing(ring2Scale, { toValue: 2.6, duration: 750, useNativeDriver: true }),
                Animated.timing(ring2Opacity, { toValue: 0, duration: 750, useNativeDriver: true }),
            ]).start();
        }, 200);

        // 4. Fade out a los 1700ms
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(toastOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
                Animated.timing(toastSlide, { toValue: 60, duration: 350, useNativeDriver: true }),
            ]).start(() => setShowSuccess(false));
        }, 1700);
    };

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
            const data = await authService.login(email.trim(), password.trim());
            const { name: userName, type: userRole } = data.data.user;

            registerForPushNotifications().catch(() => {});

            showSuccessAnimation();

            setTimeout(() => {
                setShowSuccess(false);

                let dashboardRoute = 'Home';
                if (userRole === 'pasajero') {
                    dashboardRoute = 'MainTabsPasajero';
                } else if (userRole === 'conductor') {
                    dashboardRoute = 'MainTabsDriver';
                }
                navigation.reset({
                    index: 1,
                    routes: [
                        { name: 'SignIn' },
                        { name: dashboardRoute, params: { userName } },
                    ],
                });
            }, 2500);
        } catch (error) {
            const msg = error.response?.data?.message || 'Correo o contraseña incorrectos.';
            setEmailError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!fontsLoaded) return null;




    return (
        <Animated.View style={styles.container}>

            {/* Background Layer 1: Dark Blue Gradient */}
            <LinearGradient
                colors={['#09314bff', '#0c4469ff', '#073050ff']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Background Layer 2: Light Blue Gradient (Animated Opacity) */}
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
                            <Animated.View style={[
                                styles.inputBox,
                                emailError ? styles.inputBoxError : emailAnimatedStyle
                            ]}>
                                <TextInput
                                    style={styles.input}
                                    placeholderTextColor="rgba(255,255,255,0.4)"
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

                            {/* Password */}
                            <Text style={styles.label}>Contraseña</Text>
                            <Animated.View style={[
                                styles.inputBox,
                                passwordError ? styles.inputBoxError : passwordAnimatedStyle
                            ]}>
                                <TextInput
                                    style={[styles.input, { flex: 1 }]}
                                    placeholderTextColor="rgba(255,255,255,0.4)"
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

                            {/* Forgot password */}
                            <View style={styles.forgotRow}>
                                <Text style={styles.forgotText}>¿Olvidaste tu contraseña? </Text>
                                <TouchableOpacity onPress={() => navigation.navigate('ForgotPasswordEmail')}>
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

                {/* Toast de éxito animado */}
                {showSuccess && (
                    <Animated.View style={[
                        styles.toast,
                        { opacity: toastOpacity, transform: [{ translateY: toastSlide }] }
                    ]}>
                        {/* Ripple doble */}
                        <View style={styles.ringWrapper}>
                            <Animated.View style={[styles.ring, {
                                transform: [{ scale: ring2Scale }],
                                opacity: ring2Opacity,
                                borderColor: 'rgba(56,189,248,0.35)',
                            }]} />
                            <Animated.View style={[styles.ring, {
                                transform: [{ scale: ring1Scale }],
                                opacity: ring1Opacity,
                                borderColor: 'rgba(56,189,248,0.65)',
                            }]} />
                            {/* Círculo con check */}
                            <Animated.View style={[
                                styles.checkCircle,
                                { transform: [{ scale: checkAnim }] }
                            ]}>
                                <Ionicons name="checkmark" size={26} color="#FFF" />
                            </Animated.View>
                        </View>

                        {/* Texto */}
                        <View style={styles.toastTextBlock}>
                            <Text style={styles.toastTitle}>¡Sesión iniciada!</Text>
                            <Text style={styles.toastSub}>Bienvenido de vuelta 👋</Text>
                        </View>
                    </Animated.View>
                )}
            </SafeAreaView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#082F49',
    },
    safeArea: {
        flex: 1,
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
        marginTop: -40,
    },
    icon: {
        width: 200,
        height: 200,
        marginBottom: -10,
    },
    brandName: {
        marginTop: 20,
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
        marginTop: -10,
    },
    subheading: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: 'rgba(235, 235, 235, 0.72)',
        textAlign: 'center',
        marginBottom: 32,
    },
    form: {
        width: '100%',
        zIndex: 1,
    },
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
        backgroundColor: 'rgba(255, 59, 48, 0.15)',
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
        color: '#FF3B30',
        fontSize: 14,
        marginBottom: 8,
        marginLeft: 2,
    },
    forgotRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 3,
        marginTop: 10,
        marginBottom: 24,
    },
    forgotText: {
        fontFamily: 'Poppins-Regular',
        color: 'rgba(235, 235, 235, 0.72)',
        fontSize: 13,
    },
    forgotLink: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FFFFFF',
        fontSize: 13,
        textDecorationLine: 'none',
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
        color: '#FFFFFF',
        fontSize: 16,
        letterSpacing: 0.5,
    },
    footer: {
        flexDirection: 'row',
        gap: 4,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 32,
    },
    footerText: {
        fontFamily: 'Poppins-Regular',
        color: 'rgba(235, 235, 235, 0.72)',
        fontSize: 14,
    },
    footerLink: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FFFFFF',
        fontSize: 15,
        textDecorationLine: 'none',

    },
    // Toast de éxito
    toast: {
        position: 'absolute',
        bottom: 52,
        left: 24,
        right: 24,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(5, 18, 40, 0.96)',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(56,189,248,0.4)',
        paddingVertical: 18,
        paddingHorizontal: 22,
        gap: 18,
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 22,
        elevation: 20,
        zIndex: 999,
    },
    ringWrapper: {
        width: 54,
        height: 54,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ring: {
        position: 'absolute',
        width: 54,
        height: 54,
        borderRadius: 27,
        borderWidth: 2,
    },
    checkCircle: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#38BDF8',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 14,
        elevation: 8,
    },
    toastTextBlock: {
        flex: 1,
    },
    toastTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 16,
        color: '#FFFFFF',
        marginBottom: 2,
    },
    toastSub: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: 'rgba(200,230,255,0.75)',
    },
});
