import { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Image,
    ScrollView,
    Animated,
    Easing,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const FORBIDDEN_DOMAINS = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'live.com'
];

const ICON = require('../../images/IconSafeRide.png');


export default function RegisterScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [Focused, setFocused] = useState(false);

    const [fontsLoaded] = useFonts({
        'Poppins-Bold': require('../../fonts/Poppins_700Bold.ttf'),
        'Poppins-SemiBold': require('../../fonts/Poppins_600SemiBold.ttf'),
        'Poppins-Regular': require('../../fonts/Poppins_400Regular.ttf'),
    });


    // Animacion para el color de fondo
    const fadeAnim = useRef(new Animated.Value(0)).current;
    // Animacion para el input
    const focusAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {

        // Crear un bucle infinito
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
        Animated.timing(focusAnim, {
            toValue: Focused ? 1 : 0,
            duration: 400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
        }).start();
    }, [Focused]);

    const animatedInputBoxStyle = {
        borderColor: focusAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(255,255,255,0.2)', '#1fa8f8ff'],
        }),
        borderWidth: focusAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 3],
        }),
    };


    const validateEmail = (email) => {

        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(email)) {
            return 'Ingresa un correo con formato válido.';
        }

        const domain = email.split('@')[1]?.toLowerCase();
        if (FORBIDDEN_DOMAINS.includes(domain)) {
            return 'Para registrarte, usa el correo electrónico de tu empresa. No se permiten correos personales.';
        }
        return null;
    };

    const handleContinue = () => {
        setError('');

        if (!email.trim()) {
            setError('El correo es requerido.');
            return;
        }

        const validationError = validateEmail(email.trim());
        if (validationError) {
            setError(validationError);
            return;
        }

        navigation.navigate('CreatePassword', { email: email.trim() });
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
                        <Text style={styles.heading}>Crea tu cuenta</Text>
                        <Text style={styles.subheading}>
                            Ingresa tu correo corporativo para comenzar.
                        </Text>

                        {/* Form */}
                        <View style={styles.form}>
                            <Text style={styles.label}>Correo corporativo</Text>

                            <Animated.View style={[
                                styles.inputBox,
                                error ? styles.inputBoxError : animatedInputBoxStyle
                            ]}>
                                <TextInput
                                    style={styles.input}
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={email}
                                    onFocus={() => setFocused(true)}
                                    onBlur={() => setFocused(false)}
                                    onChangeText={(text) => {
                                        setEmail(text);
                                        if (error) setError('');
                                    }}
                                />
                            </Animated.View>
                            {error ? <Text style={styles.errorText}>{error}</Text> : null}

                            <TouchableOpacity
                                style={styles.button}
                                onPress={handleContinue}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.buttonText}>Continuar</Text>
                            </TouchableOpacity>

                            <Text style={styles.terms}>
                                Al continuar, aceptas nuestros{' '}
                                <TouchableOpacity onPress={() => navigation.navigate('TermsOfService')}>
                                    <Text style={styles.termsLink}>Términos de Servicio</Text>
                                </TouchableOpacity>
                            </Text>
                        </View>

                        {/* Footer */}
                        <View style={styles.footer}>

                            <Text style={styles.footerText}>¿Ya tienes una cuenta? </Text>

                            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
                                <Text style={styles.footerLink}>Inicia sesión</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
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
    },
    subheading: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: 'rgba(235, 235, 235, 0.72)',
        textAlign: 'center',
        marginBottom: 32,
        paddingHorizontal: 16,
        lineHeight: 22,
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

    inputBoxFocus: {
        borderColor: '#1fa8f8ff',
        borderWidth: 3,
        backgroundColor: 'rgba(255,255,255,0.15)',
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
    errorText: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FF3B30',
        fontSize: 14,
        marginBottom: 12,
        marginLeft: 2,
    },
    button: {
        height: 52,
        backgroundColor: '#38BDF8',
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
        elevation: 8,
    },
    buttonText: {
        fontFamily: 'Poppins-Bold',
        color: '#ffffffff',
        fontSize: 16,
        letterSpacing: 0.5,
    },
    terms: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: 'rgba(235, 235, 235, 0.72)',
        textAlign: 'center',
        marginTop: 16,
    },
    termsLink: {
        fontFamily: 'Poppins-SemiBold',
        color: 'rgba(255,255,255,0.8)',
        textDecorationLine: 'underline',
    },
    footer: {
        flexDirection: 'row',
        gap: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 48,
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
});
