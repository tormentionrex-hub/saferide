import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RoleSelectionScreen({ navigation }) {
    const [selectedRole, setSelectedRole] = useState(null);

    const handleRoleSelect = (role) => {
        setSelectedRole(role);
    };

    const handleConfirm = () => {
        if (selectedRole) {
            navigation.navigate('AccountVerificationSucess', { role: selectedRole });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.brandName}>Safe Ride</Text>
                </View>

                {/* Title Section */}
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
                        activeOpacity={0.8}
                    >
                        <Image
                            source={require('../images/UserRol.png')}
                            style={styles.iconImage}
                            resizeMode="contain"
                        />
                        <Text style={styles.roleTitle}>SafeMate</Text>
                        <Text style={styles.roleDescription}>
                            Solicita viajes y viaja seguro.
                        </Text>
                    </TouchableOpacity>

                    {/* SafeDriver Option */}
                    <TouchableOpacity
                        style={[
                            styles.roleCard,
                            selectedRole === 'conductor' && styles.roleCardSelected
                        ]}
                        onPress={() => handleRoleSelect('conductor')}
                        activeOpacity={0.8}
                    >
                        <Image
                            source={require('../images/VehicleRol.png')}
                            style={styles.iconImage}
                            resizeMode="contain"
                        />
                        <Text style={styles.roleTitle}>SafeDriver</Text>
                        <Text style={styles.roleDescription}>
                            Ofrece viajes y gana dinero.
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Footer con botón Seleccionar */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, !selectedRole && styles.buttonDisabled]}
                    onPress={handleConfirm}
                    activeOpacity={selectedRole ? 0.8 : 1}
                    disabled={!selectedRole}
                >
                    <Text style={styles.buttonText}>Seleccionar</Text>
                </TouchableOpacity>
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
        paddingHorizontal: 24,
    },
    header: {
        alignItems: 'center',
        paddingTop: 40,
        marginBottom: 60,
    },
    brandName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2563EB',
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 50,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 24,
    },
    rolesContainer: {
        gap: 24,
    },
    roleCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        transform: [{ scale: 1 }],
    },
    roleCardSelected: {
        borderColor: '#2563EB',
        backgroundColor: '#EFF6FF',
        transform: [{ scale: 1.02 }],
        shadowColor: '#2563EB',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    iconImage: {
        width: 80,
        height: 80,
        marginBottom: 20,
    },
    roleTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    roleDescription: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 16,
    },
    button: {
        height: 56,
        backgroundColor: '#2563EB',
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        backgroundColor: '#93C5FD',
        shadowOpacity: 0,
        elevation: 0,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    },
});
