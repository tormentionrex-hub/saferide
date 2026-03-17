import { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';

const FORBIDDEN_DOMAINS = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'live.com'
];

const ICON = require('../images/IconSafeRide.png');

export default function RegisterScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    const [fontsLoaded] = useFonts({
        'Poppins-Bold': require('../fonts/Poppins_700Bold.ttf'),
        'Poppins-SemiBold': require('../fonts/Poppins_600SemiBold.ttf'),
        'Poppins-Regular': require('../fonts/Poppins_400Regular.ttf'),
    });

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
                    <Text style={styles.heading}>Crea tu cuenta</Text>
                    <Text style={styles.subheading}>
                        Ingresa tu correo corporativo para comenzar.
                    </Text>

                    {/* Form */}
                    <View style={styles.form}>
                        <Text style={styles.label}>Correo corporativo</Text>
                        <View style={[styles.inputBox, error ? styles.inputBoxError : null]}>
                            <TextInput
                                style={styles.input}
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={email}
                                onChangeText={(text) => {
                                    setEmail(text);
                                    if (error) setError('');
                                }}
                            />
                        </View>
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
                            <Text style={styles.termsLink}>Términos de Servicio</Text>.
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
        paddingHorizontal: 16,
        lineHeight: 22,
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
    errorText: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FF4444',
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
        color: '#045084',
        fontSize: 16,
        letterSpacing: 0.5,
    },
    terms: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
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
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 48,
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
});
