import React, { useState, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/authService';

export default function VerificationScreen({ route, navigation }) {
    const { email, verificationCode, name, phone, company, password } = route.params || { email: '', verificationCode: '1234' };
    const [loading, setLoading] = useState(false);

    const [code, setCode] = useState(['', '', '', '']);
    const inputs = useRef([]);

    const handleInputChange = (text, index) => {
        // Only allow numbers
        const cleanText = text.replace(/[^0-9]/g, '');

        const newCode = [...code];
        newCode[index] = cleanText;
        setCode(newCode);

        // Si escribimos un número y no estamos en el último, avanzamos
        if (cleanText && index < 3) {
            inputs.current[index + 1].focus();
        }
    };

    const handleKeyPress = (e, index) => {
        // Si presionamos Backspace y el campo está vacío, regresamos al anterior
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

        // PIN correcto — registrar usuario
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
        // Aquí idealmente generaríamos otro código y abriríamos el mail o llamaríamos a la API
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Safe Ride</Text>
                <View style={styles.spacer} />
            </View>

            <View style={styles.content}>
                <Text style={styles.title}>PIN de Verificación</Text>
                <Text style={styles.subtitle}>
                    Ingresa el código de 4 dígitos enviado a tu{"\n"}correo electrónico.
                </Text>

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
                            selectTextOnFocus
                        />
                    ))}
                </View>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <Text style={styles.buttonText}>Verificar</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleResend} style={styles.resendButton}>
                    <Text style={styles.resendText}>Reenviar PIN</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    spacer: {
        width: 44,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        alignItems: 'center',
        paddingTop: 30,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 24,
    },
    codeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16, // Available in newer React Native versions, otherwise use margin on children
    },
    codeInput: {
        width: 68,
        height: 76,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        backgroundColor: '#f9fafb',
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        color: '#111827',
        marginHorizontal: 8,
    },
    footer: {
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    button: {
        height: 56,
        backgroundColor: '#2563EB',
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#2563EB',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
        marginBottom: 20,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    },
    resendButton: {
        alignItems: 'center',
        padding: 8,
    },
    resendText: {
        color: '#2563EB',
        fontSize: 16,
        fontWeight: '600',
    }
});
