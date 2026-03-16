import React, { useState } from 'react';
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
    ScrollView // Added ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { authService } from '../services/authService';

const COMPANIES = [
    'Intel', 'Cargill', 'Deloitte', 'Citi', 'Experian',
    '3M', 'DHL', 'Bill Gosling Outsourcing (BGO)',
    'WeWork Costa Rica', 'Concentrix', 'Nestlé Costa Rica'
];

export default function CreatePasswordScreen({ route, navigation }) {
    const { email } = route.params || { email: 'test@empresa.com' };

    const [phone, setPhone] = useState('');
    const [company, setCompany] = useState(COMPANIES[0]);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const validatePassword = (pass) => {
        const errorMsgs = {};
        const minLength = pass.length >= 8;
        const hasUpper = /[A-Z]/.test(pass);
        const hasLower = /[a-z]/.test(pass);
        const hasNumber = /[0-9]/.test(pass);
        const hasSpecial = /[@$!%*?&]/.test(pass);

        if (!minLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
            errorMsgs.password = "Su contraseña debe tener al menos 8 caracteres. Debe contener una letra mayúscula, una minúscula, un número y un carácter especial (@$!%*?&).";
        }

        return errorMsgs;
    };

    const handleConfirm = async () => {
        setErrors({});
        let currentErrors = {}; // Use a temporary object to collect all errors

        // Phone Validation
        if (!/^\d{8}$/.test(phone)) {
            currentErrors.phone = "El teléfono debe tener exactamente 8 dígitos numéricos.";
        }

        // Initial Validations for password
        const passValidationErrors = validatePassword(password);
        if (passValidationErrors.password) {
            currentErrors = { ...currentErrors, ...passValidationErrors };
        }

        if (password !== confirmPassword) {
            currentErrors.confirmPassword = "Las contraseñas no coinciden.";
        }

        if (Object.keys(currentErrors).length > 0) {
            setErrors(currentErrors);
            return;
        }

        // Connect to Backend Endpoint
        setLoading(true);
        try {
            // Generate a temporary name and username from email
            const tempName = email.split('@')[0] || "Usuario";
            const tempUsername = (email.split('@')[0] || "user") + Math.floor(Math.random() * 10000);

            const response = await authService.register({
                email: email,
                password: password,
                name: tempName,
                username: tempUsername,
                type: 'pasajero',
                phone: phone,
                company: company,
            });

            if (response.success) {
                navigation.replace('TellUsAboutYou');
            }
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

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Crear contraseña</Text>
                <View style={styles.spacer} />
            </View>

            <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>

                {/* Company Picker Field */}
                <Text style={styles.label}>Empresa</Text>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={company}
                        onValueChange={(itemValue) => setCompany(itemValue)}
                        style={styles.picker}
                    >
                        {COMPANIES.map((comp) => (
                            <Picker.Item key={comp} label={comp} value={comp} />
                        ))}
                    </Picker>
                </View>

                {/* Phone Field */}
                <Text style={[styles.label, { marginTop: 24 }]}>Teléfono</Text>
                <View style={[styles.inputContainer, errors.phone ? styles.inputErrorBorder : null]}>
                    <TextInput
                        style={styles.input}
                        placeholder="Ej. 88001234"
                        placeholderTextColor="#9ca3af"
                        keyboardType="phone-pad"
                        maxLength={8}
                        value={phone}
                        onChangeText={(text) => {
                            setPhone(text.replace(/[^0-9]/g, '')); // only allow numbers
                            if (errors.phone) setErrors({ ...errors, phone: null });
                        }}
                    />
                </View>
                {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

                {/* New Password Field */}
                <Text style={[styles.label, { marginTop: 24 }]}>Nueva contraseña</Text>
                <View style={[styles.inputContainer, errors.password ? styles.inputErrorBorder : null]}>
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="#9ca3af"
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={(text) => {
                            setPassword(text);
                            if (errors.password) setErrors({ ...errors, password: null });
                        }}
                    />
                    <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowPassword(!showPassword)}
                    >
                        <Ionicons name={showPassword ? "eye" : "eye-off"} size={22} color="#9ca3af" />
                    </TouchableOpacity>
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

                {/* Confirm Password Field */}
                <Text style={[styles.label, { marginTop: 24 }]}>Confirmar contraseña</Text>
                <View style={[styles.inputContainer, errors.confirmPassword ? styles.inputErrorBorder : null]}>
                    <TextInput
                        style={styles.input}
                        placeholder="Confirma tu nueva contraseña"
                        placeholderTextColor="#9ca3af"
                        secureTextEntry={!showConfirmPassword}
                        value={confirmPassword}
                        onChangeText={(text) => {
                            setConfirmPassword(text);
                            if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: null });
                        }}
                    />
                    <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                        <Ionicons name={showConfirmPassword ? "eye" : "eye-off"} size={22} color="#9ca3af" />
                    </TouchableOpacity>
                </View>
                {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.button} onPress={handleConfirm} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <Text style={styles.buttonText}>Confirmar</Text>
                    )}
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
    contentContainer: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 10,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        overflow: 'hidden',
    },
    picker: {
        height: 56,
        width: '100%',
        color: '#111827',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        paddingHorizontal: 16,
    },
    inputErrorBorder: {
        borderColor: '#ef4444',
        borderWidth: 1.5,
    },
    input: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        color: '#111827',
    },
    eyeIcon: {
        padding: 4,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 13,
        marginTop: 8,
        lineHeight: 18,
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
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    }
});
