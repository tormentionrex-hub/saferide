import React from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    SafeAreaView,
    StatusBar
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AccountVerificationSucess({ navigation }) {
    const handleContinue = () => {
        navigation.replace('SignIn');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.content}>
                {/* Success Icon Section */}
                <View style={styles.iconContainer}>
                    <View style={styles.outerCircle}>
                        <View style={styles.innerCircle}>
                            <MaterialCommunityIcons name="shield-check" size={50} color="#2563EB" />
                        </View>
                    </View>
                </View>

                {/* Text Section */}
                <View style={styles.textContainer}>
                    <Text style={styles.title}>¡Cuenta Verificada!</Text>
                    <Text style={styles.subtitle}>
                        Tu cuenta ha sido verificada{'\n'}exitosamente. Ya puedes continuar y{'\n'}empezar a usar Safe Ride.
                    </Text>
                </View>

                {/* Button Section */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleContinue}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>Continuar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
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
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    iconContainer: {
        marginBottom: 40,
        alignItems: 'center',
    },
    outerCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#DBEAFE', // Light blue background
        justifyContent: 'center',
        alignItems: 'center',
    },
    innerCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 80,
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#000000',
        marginBottom: 16,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
    },
    buttonContainer: {
        width: '100%',
        position: 'absolute',
        bottom: 40,
        paddingHorizontal: 30,
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
        fontSize: 16,
        fontWeight: '600',
    },
});
