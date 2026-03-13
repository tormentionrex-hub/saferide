import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MailComposer from 'expo-mail-composer';

const FORBIDDEN_DOMAINS = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'live.com'
];

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    const validateEmail = (email) => {
        // Basic email format validation
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(email)) {
            return "Ingresa un correo con formato válido.";
        }

        const domain = email.split('@')[1]?.toLowerCase();

        if (FORBIDDEN_DOMAINS.includes(domain)) {
            return "Para registrarte, usa el correo electrónico de tu empresa. No se permiten correos personales.";
        }

        return null; // Valid
    };

    const handleContinue = async () => {
        setError('');

        if (!email.trim()) {
            setError("El correo es requerido.");
            return;
        }

        const validationError = validateEmail(email.trim());

        if (validationError) {
            setError(validationError);
            return;
        }

        // Generate 4-digit PIN
        const pin = Math.floor(1000 + Math.random() * 9000).toString();

        try {
            // Check if mail is available
            const isAvailable = await MailComposer.isAvailableAsync();
            if (isAvailable) {
                // Send email using expo-mail-composer
                await MailComposer.composeAsync({
                    recipients: [email.trim()],
                    subject: 'Tu código de verificación SafeRide',
                    body: `Hola,\n\nTu código de verificación de 4 dígitos es: ${pin}\n\nPor favor, ingrésalo en la aplicación para proceder con el registro.\n\nEl equipo de SafeRide.`
                });

                // Navigate to Verification Screen after mail composer is handled
                navigation.navigate('Verification', {
                    email: email.trim(),
                    verificationCode: pin
                });
            } else {
                Alert.alert("Error", "No se puede abrir el cliente de correo en este dispositivo.");
            }
        } catch (err) {
            console.error("MailComposer error:", err);
            Alert.alert("Error", "Ocurrió un problema al intentar enviar el correo de verificación.");
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                {/* Logo Section */}
                <View style={styles.logoContainer}>
                    <Ionicons name="car-sport-outline" size={64} color="#2563EB" />
                    <Text style={styles.title}>Safe Ride</Text>
                    <Text style={styles.subtitle}>
                        Ingresa tu correo corporativo para comenzar
                    </Text>
                </View>

                {/* Form Section */}
                <View style={styles.formContainer}>
                    <TextInput
                        style={[styles.input, error ? styles.inputError : null]}
                        placeholder="Correo Corporativo"
                        placeholderTextColor="#9ca3af"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={email}
                        onChangeText={(text) => {
                            setEmail(text);
                            if (error) setError('');
                        }}
                    />

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity style={styles.button} onPress={handleContinue}>
                        <Text style={styles.buttonText}>Continuar</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Al continuar, aceptas nuestros <Text style={styles.linkText}>Términos de Servicio</Text>.
                </Text>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
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
        color: '#6b7280',
        textAlign: 'center',
        paddingHorizontal: 32,
        lineHeight: 24,
    },
    formContainer: {
        width: '100%',
    },
    input: {
        height: 56,
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 28,
        paddingHorizontal: 24,
        fontSize: 16,
        color: '#111827',
        backgroundColor: '#ffffff',
        marginBottom: 16,
    },
    inputError: {
        borderColor: '#ef4444',
        borderWidth: 1.5,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 14,
        marginBottom: 16,
        paddingHorizontal: 12,
    },
    button: {
        height: 56,
        backgroundColor: '#2563EB',
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#2563EB',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
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
        color: '#6b7280',
        textAlign: 'center',
    },
    linkText: {
        color: '#2563EB',
        textDecorationLine: 'underline',
    }
});
