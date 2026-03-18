import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    StatusBar,
    Image,
    ScrollView,
    Animated,
    Easing,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/authService';

const { width, height } = Dimensions.get('window');
const ICON = require('../images/IconSafeRide.png');

export default function VerificationScreen({ route, navigation }) {

    const { email, verificationCode, name, phone, company, password } = route.params || { email: '', verificationCode: '1234' };
    const [loading, setLoading] = useState(false);
    const [code, setCode] = useState(['', '', '', '']);
    const inputs = useRef([]);

    const [fontsLoaded] = useFonts({
        'Poppins-Bold': require('../fonts/Poppins_700Bold.ttf'),
        'Poppins-SemiBold': require('../fonts/Poppins_600SemiBold.ttf'),
        'Poppins-Regular': require('../fonts/Poppins_400Regular.ttf'),
    });

    // Animation for color transition
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Create an infinite loop for background animation
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

    const handleInputChange = (text, index) => {
        const cleanText = text.replace(/[^0-9]/g, '');
        const newCode = [...code];
        newCode[index] = cleanText;
        setCode(newCode);

        if (cleanText && index < 3) {
            inputs.current[index + 1].focus();
        }
    };

    const handleKeyPress = (e, index) => {
        if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
            inputs.current[index - 1].focus();
        }
    };

    const handleVerify = async () => {
        const enteredCode = code.join('');

        if (enteredCode.length < 4) {
            Alert.alert('Error', 'Por favor ingresa todos los dígitos del PIN.');
            return;
        }

        if (enteredCode !== verificationCode) {
            Alert.alert('Error', 'El PIN de verificación es incorrecto. Por favor intenta de nuevo.');
            setCode(['', '', '', '']);
            if (inputs.current[0]) inputs.current[0].focus();
            return;
        }

        setLoading(true);
        try {
            const username = (email.split('@')[0] || 'user') + Math.floor(Math.random() * 10000);
            await authService.register({
                email: email,
                password: password,
                name: name,
                username: username,
                type: 'pasajero', 
                phone: phone,
                company: company,
            });
            navigation.replace('RoleSelection');
        } catch (error) {
            console.error('Registration Error:', error.response?.data || error);
            Alert.alert(
                "Error en el Registro",
                error.response?.data?.message || "Hubo un problema procesando tu registro. Inténtalo más tarde."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleResend = () => {
        Alert.alert('PIN Enviado', `Se ha reenviado un nuevo código a ${email}`);
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
                        {/* Back Button */}
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
                        </TouchableOpacity>

                        {/* Logo */}
                        <View style={styles.logoContainer}>
                            <Image source={ICON} style={styles.icon} resizeMode="contain" />
                        </View>

                        {/* Heading */}
                        <Text style={styles.heading}>PIN de Verificación</Text>
                        <Text style={styles.subheading}>
                            Ingresa el código de 4 dígitos enviado a tu correo electrónico.
                        </Text>

                        {/* OTP Inputs */}
                        <View style={styles.codeContainer}>
                            {[0, 1, 2, 3].map((index) => (
                                <TextInput
                                    key={index}
                                    ref={(ref) => (inputs.current[index] = ref)}
                                    style={styles.codeInput}
                                    value={code[index]}
                                    onChangeText={(text) => handleInputChange(text, index)}
                                    onKeyPress={(e) => handleKeyPress(e, index)}
                                    keyboardType="number-pad"
                                    maxLength={1}
                                />
                            ))}
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.form}>
                            <TouchableOpacity
                                style={styles.button}
                                onPress={handleVerify}
                                disabled={loading}
                                activeOpacity={0.85}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <Text style={styles.buttonText}>Verificar</Text>
                                )}
                            </TouchableOpacity>

                            <Text style={styles.Text}>¿No recibiste el código?</Text>
                            <TouchableOpacity onPress={handleResend} style={styles.resendButton}>
                                <Text style={styles.resendText}>Reenviar</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Footer Spacer */}
                        <View style={styles.footerSpacer} />
                    </ScrollView>
                </KeyboardAvoidingView>
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
    backButton: {
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 10,
        padding: 10,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 20,
        marginTop: -20,
    },
    icon: {
        width: 180,
        height: 180,
        marginBottom: -10,
    },
    brandName: {
        marginTop: 10,
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
        marginTop: 10,
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
    codeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 30,
    },
    codeInput: {
        width: 65,
        height: 70,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        fontSize: 26,
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
        textAlignVertical: 'center',
        color: '#FFFFFF',
        padding: 0,
        includeFontPadding: false,
    },
    form: {
        width: '100%',
        zIndex: 1,
    },
    button: {
        height: 52,
        backgroundColor: '#38BDF8',
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
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
    resendButton: {
        alignItems: 'center',
        marginTop: 20,
        padding: 10,
    },
    Text: {
        fontFamily: 'Poppins-SemiBold',
        color: 'rgba(235, 235, 235, 0.72)',
        fontSize: 14,
        marginTop: 30,
        marginBottom: -20,
        textAlign: 'center',
    },
    resendText: {
        fontFamily: 'Poppins-SemiBold',
        color: 'rgba(235, 235, 235, 0.93)',
        fontSize: 14,
        textDecorationLine: 'none',
    },
    footerSpacer: {
        height: 40,
    }
});
