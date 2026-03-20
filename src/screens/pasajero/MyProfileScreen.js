import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    SafeAreaView,
    TouchableOpacity,
    TextInput,
    Image,
    Alert,
    ScrollView,
    StatusBar,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MyProfileScreen = ({ navigation }) => {
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [userPhone, setUserPhone] = useState('8888-8888'); // Placeholder or from storage
    const [loading, setLoading] = useState(false);
    const [profileImage, setProfileImage] = useState('https://i.pravatar.cc/150?u=saferide');

    useEffect(() => {
        const loadUserData = async () => {
            const name = await AsyncStorage.getItem('userName');
            const email = await AsyncStorage.getItem('userEmail');
            if (name) setUserName(name);
            if (email) setUserEmail(email);
        };
        loadUserData();
    }, []);

    const handleSaveChanges = async () => {
        setLoading(true);
        // Simular guardado
        setTimeout(() => {
            setLoading(false);
            Alert.alert('Éxito', 'Perfil actualizado correctamente.');
        }, 1500);
    };

    const handleLogout = async () => {
        Alert.alert(
            'Cerrar Sesión',
            '¿Estás seguro de que quieres salir?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Cerrar Sesión',
                    style: 'destructive',
                    onPress: async () => {
                        await AsyncStorage.clear();
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'SignIn' }],
                        });
                    },
                },
            ]
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Eliminar Cuenta',
            'Esta acción no se puede deshacer. ¿Estás seguro?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: () => {
                        // Lógica para eliminar cuenta
                        Alert.alert('Cuenta Eliminada', 'Tu cuenta ha sido eliminada.');
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'SignIn' }],
                        });
                    },
                },
            ]
        );
    };

    const handleChangePassword = () => {
        Alert.alert('Cambiar Contraseña', 'Función próximamente disponible.');
    };

    const handleChangeImage = () => {
        Alert.alert('Cambiar Foto', 'Abrir galería/cámara próximamente.');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#045084" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Mi Perfil</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Sección de Imagen */}
                    <View style={styles.profileImageSection}>
                        <View style={styles.imageWrapper}>
                            <Image 
                                source={{ uri: profileImage }} 
                                style={styles.profileImage} 
                            />
                            <TouchableOpacity style={styles.editImageBadge} onPress={handleChangeImage}>
                                <Ionicons name="camera" size={20} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Formulario */}
                    <View style={styles.formSection}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Nombre completo</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="person-outline" size={20} color="#045084" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    value={userName}
                                    onChangeText={setUserName}
                                    placeholder="Juan Pérez"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Correo corporativo</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="mail-outline" size={20} color="#045084" style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, styles.disabledInput]}
                                    value={userEmail}
                                    editable={false}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Teléfono</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="call-outline" size={20} color="#045084" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    value={userPhone}
                                    onChangeText={setUserPhone}
                                    placeholder="8888 8888"
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>

                        {/* Botón Guardar */}
                        <TouchableOpacity 
                            style={styles.saveButton} 
                            onPress={handleSaveChanges}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.divider} />

                    {/* Sección de Acciones */}
                    <View style={styles.actionSection}>
                        <TouchableOpacity style={styles.actionItem} onPress={handleChangePassword}>
                            <View style={[styles.actionIconContainer, { backgroundColor: '#E0F2FE' }]}>
                                <Ionicons name="lock-closed-outline" size={22} color="#0369A1" />
                            </View>
                            <Text style={styles.actionText}>Cambiar Contraseña</Text>
                            <Ionicons name="chevron-forward" size={20} color="#A0ADB8" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionItem} onPress={handleLogout}>
                            <View style={[styles.actionIconContainer, { backgroundColor: '#FEE2E2' }]}>
                                <Ionicons name="log-out-outline" size={22} color="#DC2626" />
                            </View>
                            <Text style={styles.actionText}>Cerrar Sesión</Text>
                            <Ionicons name="chevron-forward" size={20} color="#A0ADB8" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionItem} onPress={handleDeleteAccount}>
                            <View style={[styles.actionIconContainer, { backgroundColor: '#F3F4F6' }]}>
                                <Ionicons name="trash-outline" size={22} color="#4B5563" />
                            </View>
                            <Text style={[styles.actionText, { color: '#4B5563' }]}>Eliminar Cuenta</Text>
                            <Ionicons name="chevron-forward" size={20} color="#A0ADB8" />
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: 'Poppins-Bold',
        color: '#045084',
    },
    backButton: {
        padding: 5,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    profileImageSection: {
        alignItems: 'center',
        marginVertical: 30,
    },
    imageWrapper: {
        position: 'relative',
    },
    profileImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: '#E0F2FE',
    },
    editImageBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#2563EB',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    formSection: {
        paddingHorizontal: 25,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: '#7E8BA0',
        marginBottom: 8,
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F7FA',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 55,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#1A2B4C',
        fontFamily: 'Poppins-Regular',
    },
    disabledInput: {
        color: '#A0ADB8',
    },
    saveButton: {
        backgroundColor: '#045084',
        height: 55,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#045084',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Poppins-Bold',
    },
    divider: {
        height: 8,
        backgroundColor: '#F3F7FA',
        marginVertical: 30,
    },
    actionSection: {
        paddingHorizontal: 25,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    actionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    actionText: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'Poppins-Regular',
        color: '#1A2B4C',
    },
});

export default MyProfileScreen;
