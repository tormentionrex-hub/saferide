import { useState, useEffect, useRef } from 'react';
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
    Animated,
    Easing,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import axios from 'axios';
import { API_URL } from '../config';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const ICON = require('../images/IconSafeRide.png');

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

    const [fontsLoaded] = useFonts({
        'Poppins-Bold': require('../fonts/Poppins_700Bold.ttf'),
        'Poppins-SemiBold': require('../fonts/Poppins_600SemiBold.ttf'),
        'Poppins-Regular': require('../fonts/Poppins_400Regular.ttf'),
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
            // Enviamos las credenciales al endpoint público de autenticación (/auth/login),
            // ya que /users/ requiere un token JWT y aún no tenemos uno al iniciar sesión
            const response = await axios.post(`${API_URL}/auth/login`, {
                email: email.trim(),
                password: password.trim(),
            });
            // Si la respuesta es exitosa (200 o 201)
            if (response.status === 200 || response.status === 201) {
                // Obtenemos los datos del usuario desde la respuesta del backend
                const userData = response.data.data.user;
                const userRole = userData.type; // Puede ser 'pasajero' o 'conductor'
                const userName = userData.name; // Nombre del usuario logueado

                setShowSuccess(true);
                
                // Esperamos 2.5 segundos para mostrar la animación de éxito antes de redirigir
                setTimeout(() => {
                    setShowSuccess(false);
                    
                    // Lógica de redirección basada en el tipo de usuario (rol)
                    // Se usa reset() para limpiar todo el historial de registro del stack.
                    // El stack queda [SignIn, Dashboard], así el botón atrás del Dashboard
                    // lleva al Login y nunca a pantallas de registro.
                    let dashboardRoute = 'Home';
                    if (userRole === 'pasajero') {
                        dashboardRoute = 'DashboardPasajero';
                    } else if (userRole === 'conductor') {
                        dashboardRoute = 'DashboardDriver';
                    }
                    navigation.reset({
                        index: 1,
                        routes: [
                            { name: 'SignIn' },
                            { name: dashboardRoute, params: { userName } },
                        ],
                    });
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
        <View style={styles.container}>

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
        </View>
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
        borderColor: '#f53333bb',
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
        color: '#f53333bb',
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
