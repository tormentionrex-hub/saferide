import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Image,
    Alert,
    ActivityIndicator,
    Animated,
    Easing,
    Dimensions,
} from 'react-native';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../services/authService';
import { useCustomAlert } from '../../context/CustomAlertContext';

const { width } = Dimensions.get('window');

export default function RoleSelectionScreen({ route, navigation }) {
    const { email, name, phone, company, password } = route.params || {};
    const [selectedRole, setSelectedRole] = useState(null);
    const [loading, setLoading] = useState(false);
    const { showAlert } = useCustomAlert();

    const [fontsLoaded] = useFonts({
        'Poppins-Bold': require('../../fonts/Poppins_700Bold.ttf'),
        'Poppins-SemiBold': require('../../fonts/Poppins_600SemiBold.ttf'),
        'Poppins-Regular': require('../../fonts/Poppins_400Regular.ttf'),
    });

    // Animation for background color transition
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

    const handleRoleSelect = (role) => {
        // Si el usuario vuelve a hacer click en la misma opción, se apaga (null)
        if (selectedRole === role) {
            setSelectedRole(null);
        } else {
            setSelectedRole(role);
        }
    };

    const handleConfirm = async () => {
        if (!selectedRole) return;

        if (!email || !name || !password || !phone || !company) {
            showAlert(
                'Sesión Expirada',
                'No pudimos encontrar tus datos de registro. Por favor, inténtalo de nuevo desde el inicio.',
                'error',
                'Volver a Registrarme',
                () => navigation.navigate('Login')
            );
            return;
        }

        setLoading(true);
        try {
            const safeEmail = email || '';
            const emailPart = safeEmail.includes('@') ? safeEmail.split('@')[0] : 'user';
            const username = emailPart + Math.floor(Math.random() * 10000);

            await authService.register({
                email: safeEmail,
                password,
                name,
                username,
                type: selectedRole,
                phone,
                company,
            });
            navigation.navigate('AccountVerificationSucess');
        } catch (error) {
            console.error('Registration Error:', error?.response?.data?.message || error?.message || 'unknown error');
            showAlert(
                'Error en el Registro',
                error.response?.data?.message || 'Hubo un problema procesando tu registro. Inténtalo más tarde.',
                'error'
            );
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

                {/* Botón Volver */}
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.content}>
                    {/* Header */}

                    <View style={styles.header}>
                        <Text style={styles.brandName}>SafeRide</Text>
                    </View>

                    {/* Titulo */}
                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>Elige tu rol</Text>
                        <Text style={styles.subtitle}>
                            Selecciona cómo quieres usar la{'\n'}aplicación.
                        </Text>
                    </View>

                    {/* Role Options */}
                    <View style={styles.rolesContainer}>

                        {/* SafeMate Option */}
                        <TouchableOpacity
                            style={[
                                styles.roleCard,
                                selectedRole === 'pasajero' && styles.roleCardSelected
                            ]}
                            onPress={() => handleRoleSelect('pasajero')}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.imageCircle, selectedRole === 'pasajero' && styles.imageCircleSelected]}>
                                <Image
                                    source={require('../../images/UserRol.png')}
                                    style={styles.iconImage}
                                    resizeMode="contain"
                                />
                            </View>
                            <View style={styles.roleTextContainer}>
                                <Text style={[styles.roleTitle, selectedRole === 'pasajero' && styles.roleTitleSelected]}>SafeMate</Text>
                                <Text style={styles.roleDescription}>
                                    Solicita viajes y viaja seguro.
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* SafeDriver Option */}
                        <TouchableOpacity
                            style={[
                                styles.roleCard,
                                selectedRole === 'conductor' && styles.roleCardSelected
                            ]}
                            onPress={() => handleRoleSelect('conductor')}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.imageCircle, selectedRole === 'conductor' && styles.imageCircleSelected]}>
                                <Image
                                    source={require('../../images/VehicleRol.png')}
                                    style={styles.iconImage}
                                    resizeMode="contain"
                                />
                            </View>
                            <View style={styles.roleTextContainer}>
                                <Text style={[styles.roleTitle, selectedRole === 'conductor' && styles.roleTitleSelected]}>SafeDriver</Text>
                                <Text style={styles.roleDescription}>
                                    Ofrece viajes y gana {'\n'} dinero extra.
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Footer con botón Seleccionar */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.button, (!selectedRole || loading) && styles.buttonDisabled]}
                        onPress={handleConfirm}
                        activeOpacity={selectedRole ? 0.85 : 1}
                        disabled={!selectedRole || loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.buttonText}>Continuar</Text>
                        )}
                    </TouchableOpacity>
                </View>
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
    content: {
        flex: 1,
        paddingHorizontal: 28,
        paddingTop: 10,
        justifyContent: 'center',
    },
    backButton: {
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 10,
        padding: 10,
        marginTop: 25,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: -40,
    },
    brandName: {
        fontFamily: 'Poppins-Bold',
        fontSize: 30,
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontFamily: 'Poppins-Bold',
        fontSize: 26,
        color: '#FFFFFF',
        marginBottom: 8,
    },
    subtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 15,
        color: 'rgba(235, 235, 235, 0.72)',
        textAlign: 'center',
        lineHeight: 22,
    },
    rolesContainer: {
        gap: 20,
    },
    roleCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(157, 182, 238, 0.33)',
        borderRadius: 24,
        padding: 20,
        alignItems: 'center',


    },
    roleCardSelected: {
        borderColor: '#38BDF8',
        backgroundColor: 'rgba(59, 176, 226, 0.74)',
        borderWidth: 2,
        transform: [{ scale: 1.02 }],
    },
    imageCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(144, 194, 250, 0.23)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 18,
    },
    imageCircleSelected: {
        backgroundColor: '#38BDF8',
    },
    iconImage: {
        width: 43,
        height: 43,
    },
    roleTextContainer: {
        flex: 1,
    },
    roleTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 18,
        color: 'rgba(255, 255, 255, 0.9)',
        marginBottom: 2,
    },
    roleTitleSelected: {
        color: '#FFFFFF',
    },
    roleDescription: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: 'rgba(235, 235, 235, 0.78)',
        lineHeight: 18,
    },
    footer: {
        paddingHorizontal: 28,
        paddingBottom: 50,
        paddingTop: -15,
    },
    button: {
        height: 54,
        backgroundColor: '#5dbbfaff',
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#172227ff',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
        elevation: 8,
        marginBottom: 50,
    },
    buttonDisabled: {
        backgroundColor: 'rgba(56, 191, 248, 0.25)',
        elevation: 0,
        shadowOpacity: 0,
    },
    buttonText: {
        fontFamily: 'Poppins-Bold',
        color: '#FFFFFF',
        fontSize: 16,
        letterSpacing: 0.5,
    },
});
