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
    ScrollView,
    Animated,
    Easing,
    Dimensions,
    StatusBar,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useCustomAlert } from '../../context/CustomAlertContext';

const { width, height } = Dimensions.get('window');
const ICON = require('../../images/IconSafeRide.png');

const COMPANIES = [
    'Intel', 'Cargill', 'Deloitte', 'Citi', 'Experian',
    '3M', 'DHL', 'Bill Gosling Outsourcing (BGO)',
    'WeWork Costa Rica', 'Concentrix', 'Nestlé Costa Rica'
];

export default function CreatePasswordScreen({ route, navigation }) {
    const { email } = route.params || { email: 'test@empresa.com' };
    const { showAlert } = useCustomAlert();

    const [name, setName] = useState('');
    const [company, setCompany] = useState('');
    const [phone, setPhone] = useState('');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Focus states
    const [nameFocus, setNameFocus] = useState(false);
    const [phoneFocus, setPhoneFocus] = useState(false);
    const [passFocus, setPassFocus] = useState(false);
    const [confirmFocus, setConfirmFocus] = useState(false);
    const [companyFocus, setCompanyFocus] = useState(false);
    const [isPickerVisible, setIsPickerVisible] = useState(false);

    const [fontsLoaded] = useFonts({
        'Poppins-Bold': require('../../fonts/Poppins_700Bold.ttf'),
        'Poppins-SemiBold': require('../../fonts/Poppins_600SemiBold.ttf'),
        'Poppins-Regular': require('../../fonts/Poppins_400Regular.ttf'),
    });

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const nameFocusAnim = useRef(new Animated.Value(0)).current;
    const phoneFocusAnim = useRef(new Animated.Value(0)).current;
    const passFocusAnim = useRef(new Animated.Value(0)).current;
    const confirmFocusAnim = useRef(new Animated.Value(0)).current;
    const companyFocusAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Infinite background loop
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

    const animateFocus = (anim, value) => {

        Animated.timing(anim, {
            toValue: value ? 1 : 0,
            duration: 400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
        }).start();
    };

    useEffect(() => animateFocus(nameFocusAnim, nameFocus), [nameFocus]);
    useEffect(() => animateFocus(phoneFocusAnim, phoneFocus), [phoneFocus]);
    useEffect(() => animateFocus(passFocusAnim, passFocus), [passFocus]);
    useEffect(() => animateFocus(confirmFocusAnim, confirmFocus), [confirmFocus]);
    useEffect(() => animateFocus(companyFocusAnim, companyFocus), [companyFocus]);

    const getAnimatedStyle = (anim) => ({
        borderColor: anim.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(255,255,255,0.2)', '#1fa8f8ff'],
        }),
        borderWidth: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 3],
        }),
    });

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
        let currentErrors = {};

        if (!name.trim()) {
            currentErrors.name = "El nombre es requerido.";
        } else if (name.trim().length < 4) {
            currentErrors.name = "El nombre debe tener al menos 4 caracteres.";
        }
        if (!company) {
            currentErrors.company = "Debes seleccionar una empresa.";
        }
        if (!/^\d{8}$/.test(phone)) {
            currentErrors.phone = "El teléfono debe tener exactamente 8 dígitos numéricos.";
        }

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

        const pin = Math.floor(1000 + Math.random() * 9000).toString();

        setLoading(true);

        try {
            // Llamar al backend para enviar el código real vía SMTP
            const response = await api.post('/auth/send-verification-code', {
                email: email.trim()
            });

            if (response.data.success) {
                navigation.navigate('Verification', {
                    email: email.trim(),
                    name: name.trim(),
                    phone: phone,
                    company: company,
                    password: password,
                });
            } else {
                showAlert("Error", response.data.message || "Ocurrió un problema al enviar el código.", 'error');
            }
        } catch (err) {
            console.error("Verification error:", err?.response?.data?.message || err?.message || 'unknown error');
            const msg = err.response?.data?.message || "Ocurrió un problema al intentar enviar el correo de verificación.";
            showAlert("Error", msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!fontsLoaded) return null;




    return (

        <View style={styles.container}>

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

                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Crear contraseña</Text>
                    <View style={styles.headerSpacer} />
                </View>



                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.form}>

                            {/* Name Field */}
                            <Text style={styles.label}>Nombre completo</Text>
                            <Animated.View style={[styles.inputBox, errors.name ? styles.inputBoxError : getAnimatedStyle(nameFocusAnim)]}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Tu nombre completo"
                                    placeholderTextColor="rgba(255, 255, 255, 0.57)"
                                    autoCapitalize="words"
                                    value={name}
                                    onFocus={() => setNameFocus(true)}
                                    onBlur={() => setNameFocus(false)}
                                    onChangeText={(text) => {
                                        setName(text.replace(/[^a-zA-Z ]/g, ''));
                                        if (errors.name) setErrors({ ...errors, name: null });
                                    }}
                                />
                            </Animated.View>
                            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

                            {/* Company Picker */}
                            <Text style={styles.label}>Empresa</Text>
                            <Animated.View style={[
                                styles.inputBox,
                                errors.company ? styles.inputBoxError : getAnimatedStyle(companyFocusAnim),
                                { paddingRight: 8 }
                            ]}>
                                <TouchableOpacity
                                    style={styles.pickerButton}
                                    onPress={() => { setIsPickerVisible(true); setCompanyFocus(true); if (errors.company) setErrors({ ...errors, company: null }); }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.input, { color: company ? '#FFFFFF' : 'rgba(255, 255, 255, 0.57)' }]}>
                                        {company || 'Selecciona tu empresa'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={24} color="rgba(255, 255, 255, 0.57)" />
                                </TouchableOpacity>
                            </Animated.View>
                            {errors.company && <Text style={styles.errorText}>{errors.company}</Text>}

                            {/* Phone Field */}
                            <Text style={styles.label}>Teléfono</Text>
                            <Animated.View style={[
                                styles.inputBox,
                                errors.phone ? styles.inputBoxError : getAnimatedStyle(phoneFocusAnim)
                            ]}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ej. 88001234"
                                    placeholderTextColor="rgba(255, 255, 255, 0.57)"
                                    keyboardType="phone-pad"
                                    maxLength={8}
                                    value={phone}
                                    onFocus={() => setPhoneFocus(true)}
                                    onBlur={() => setPhoneFocus(false)}
                                    onChangeText={(text) => {
                                        setPhone(text.replace(/[^0-9]/g, ''));
                                        if (errors.phone) setErrors({ ...errors, phone: null });
                                    }}
                                />
                            </Animated.View>
                            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

                            {/* New Password Field */}
                            <Text style={styles.label}>Nueva contraseña</Text>
                            <Animated.View style={[
                                styles.inputBox,
                                errors.password ? styles.inputBoxError : getAnimatedStyle(passFocusAnim)
                            ]}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor="rgba(255, 255, 255, 0.57)"
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onFocus={() => setPassFocus(true)}
                                    onBlur={() => setPassFocus(false)}
                                    onChangeText={(text) => {
                                        setPassword(text);
                                        if (errors.password) setErrors({ ...errors, password: null });
                                    }}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    <Ionicons name={showPassword ? "eye" : "eye-off"} size={22} color="rgba(255, 255, 255, 0.57)" />
                                </TouchableOpacity>
                            </Animated.View>
                            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

                            {/* Confirm Password Field */}
                            <Text style={styles.label}>Confirmar contraseña</Text>
                            <Animated.View style={[
                                styles.inputBox,
                                errors.confirmPassword ? styles.inputBoxError : getAnimatedStyle(confirmFocusAnim)
                            ]}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Confirma tu contraseña"
                                    placeholderTextColor="rgba(255, 255, 255, 0.57)"
                                    secureTextEntry={!showConfirmPassword}
                                    value={confirmPassword}
                                    onFocus={() => setConfirmFocus(true)}
                                    onBlur={() => setConfirmFocus(false)}
                                    onChangeText={(text) => {
                                        setConfirmPassword(text);
                                        if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: null });
                                    }}
                                />
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                    <Ionicons name={showConfirmPassword ? "eye" : "eye-off"} size={22} color="rgba(255, 255, 255, 0.57)" />
                                </TouchableOpacity>
                            </Animated.View>
                            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}

                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleConfirm}
                                disabled={loading}
                                activeOpacity={0.85}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.buttonText}>Confirmar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* Custom Styled Selection Box (Modal) */}
            <Modal visible={isPickerVisible} transparent animationType="slide">

                <View style={styles.modalOverlay}>

                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Selecciona tu empresa</Text>
                            <TouchableOpacity onPress={() => { setIsPickerVisible(false); setCompanyFocus(false); }}>
                                <Ionicons name="close-circle" size={32} color="#FFFFFF" opacity={0.7} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {COMPANIES.map((comp) => (
                                <TouchableOpacity
                                    key={comp}
                                    style={[styles.companyItem, company === comp && styles.companyItemActive]}
                                    onPress={() => { setCompany(comp); setIsPickerVisible(false); setCompanyFocus(false); }}
                                    activeOpacity={0.6}
                                >
                                    <Text style={[styles.companyText, company === comp && styles.companyTextActive]}>
                                        {comp}
                                    </Text>
                                    {company === comp && <Ionicons name="checkmark-circle" size={24} color="#38abf8ff" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? 10 : 0,
        height: 60,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontFamily: 'Poppins-Bold',
        fontSize: 18,
        color: '#FFFFFF',
    },
    headerSpacer: {
        width: 44,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 28,
        paddingBottom: 40,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 10,
        marginTop: -30,
    },
    form: {
        marginTop: 40,
        width: '100%',
    },
    label: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 15,
        color: '#FFFFFF',
        marginBottom: 8,
        marginTop: 10,
        marginLeft: 2,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 60,
        marginBottom: 4,
    },
    inputBoxError: {
        borderColor: '#FF3B30',
        borderWidth: 3,
        backgroundColor: 'rgba(255, 59, 48, 0.15)',
    },
    input: {
        flex: 1,
        fontFamily: 'Poppins-Regular',
        fontSize: 15,
        color: '#FFFFFF',
    },
    errorText: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FF3B30',
        fontSize: 13,
        marginBottom: 16,
        marginLeft: 2,
        lineHeight: 18,
    },
    button: {
        height: 52,
        backgroundColor: '#38BDF8',
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 50,
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
        elevation: 8,
    },
    buttonDisabled: {
        backgroundColor: 'rgba(56,189,248,0.45)',
        elevation: 0,
    },
    buttonText: {
        fontFamily: 'Poppins-Bold',
        color: '#FFFFFF',
        fontSize: 16,
        letterSpacing: 0.5,
    },
    // Custom Modal Picker Styles
    pickerButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '100%',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(10, 10, 29, 0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#0c4469ff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 28,
        paddingTop: 20,
        paddingBottom: 50,
        height: '60%',
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
    },
    modalTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 20,
        color: '#FFFFFF',
    },
    companyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(199, 199, 199, 0.17)',
    },
    companyItemActive: {
        backgroundColor: 'rgba(31,168,248,0.1)',
        borderRadius: 20,
        paddingHorizontal: 20,
        marginHorizontal: -12,
    },
    companyText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
    },
    companyTextActive: {
        color: '#FFFFFF',
        fontFamily: 'Poppins-SemiBold',
    },
});
