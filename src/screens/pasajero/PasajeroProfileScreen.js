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
import * as ImagePicker from 'expo-image-picker';
import { userService } from '../../services/userService';
import { useDriverTheme } from '../../context/DriverThemeContext';

const PasajeroProfileScreen = ({ navigation }) => {
    const { theme } = useDriverTheme();
    
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [userPhone, setUserPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [imageLoading, setImageLoading] = useState(false);
    const [profileImage, setProfileImage] = useState('https://i.pravatar.cc/150?u=saferide');

    useEffect(() => {
        const loadUserData = async () => {
            try {
                // Primero cargar de storage para velocidad
                const name = await AsyncStorage.getItem('userName');
                const email = await AsyncStorage.getItem('userEmail');
                const phone = await AsyncStorage.getItem('userPhone') || '';
                const photo = await AsyncStorage.getItem('userPhoto');

                if (name) setUserName(name);
                if (email) setUserEmail(email);
                if (phone) setUserPhone(phone);
                if (photo) setProfileImage(photo);

                // Luego intentar cargar del backend para estar actualizados
                const profile = await userService.getProfile();
                if (profile && profile.data) {
                    const user = profile.data.user;
                    setUserName(user.name);
                    setUserEmail(user.email);
                    setUserPhone(user.phone);
                    if (user.photo) setProfileImage(user.photo);

                    // Actualizar storage con info fresca
                    await AsyncStorage.multiSet([
                        ['userName', user.name],
                        ['userPhone', user.phone || ''],
                        ['userPhoto', user.photo || ''],
                    ]);
                }
            } catch (error) {
                console.log('Error loading data:', error);
            }
        };
        loadUserData();
    }, []);

    const handleChangeImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso Requerido', 'Necesitamos acceso a tu galería para cambiar la foto.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        if (!result.canceled && result.assets && result.assets[0].uri) {
            const selectedUri = result.assets[0].uri;
            setProfileImage(selectedUri);
            
            try {
                setImageLoading(true);
                const response = await userService.updateProfilePicture(selectedUri);
                if (response && response.data) {
                    const newPhoto = response.data.photo;
                    setProfileImage(newPhoto);
                    await AsyncStorage.setItem('userPhoto', newPhoto);
                    Alert.alert('Éxito', 'Foto de perfil actualizada.');
                }
            } catch (error) {
                console.error('Error uploading photo:', error);
                Alert.alert('Error', 'No se pudo subir la foto.');
            } finally {
                setImageLoading(false);
            }
        }
    };

    const handleSaveChanges = async () => {
        if (!userName.trim() || !userPhone.trim()) {
            Alert.alert('Error', 'El nombre y el teléfono son requeridos.');
            return;
        }

        setLoading(true);
        try {
            await userService.updateProfile({
                name: userName,
                phone: userPhone,
            });

            await AsyncStorage.setItem('userName', userName);
            await AsyncStorage.setItem('userPhone', userPhone);

            Alert.alert('Éxito', 'Perfil actualizado correctamente.');
        } catch (error) {
            console.error('Save error:', error);
            Alert.alert('Error', 'Hubo un problema al guardar los cambios.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Eliminar Cuenta',
            'Esta acción no se puede deshacer y borrará todos tus datos. ¿Estás seguro?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar permanentemente',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await userService.deleteAccount();
                            await AsyncStorage.multiRemove(['userToken', 'userRole', 'userName', 'userEmail', 'userPhone', 'userPhoto']);
                            
                            Alert.alert('Cuenta Eliminada', 'Tu cuenta ha sido eliminada permanentemente.');
                            
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'SignIn' }],
                            });
                        } catch (error) {
                            console.error('Delete error:', error);
                            Alert.alert('Error', 'No se pudo eliminar la cuenta. Inténtalo más tarde.');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleChangePassword = () => {
        Alert.alert('Cambiar Contraseña', 'Esta función se habilitará próximamente.');
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.divider }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Mi Perfil</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Sección de Imagen */}
                    <View style={styles.profileImageSection}>
                        <TouchableOpacity 
                            style={styles.imageWrapper} 
                            onPress={handleChangeImage} 
                            disabled={imageLoading}
                            activeOpacity={0.8}
                        >
                            <Image 
                                source={{ uri: profileImage }} 
                                style={[styles.profileImage, { borderColor: theme.surface }]} 
                            />
                            {imageLoading && (
                                <View style={styles.imageOverlay}>
                                    <ActivityIndicator color="#FFFFFF" />
                                </View>
                            )}
                            <View style={[styles.editImageBadge, { backgroundColor: theme.accent }]}>
                                <Ionicons name="camera" size={20} color="#FFFFFF" />
                            </View>
                        </TouchableOpacity>
                        <Text style={[styles.tapToChange, { color: theme.subtext }]}>Toca para cambiar la foto</Text>
                    </View>

                    {/* Formulario */}
                    <View style={styles.formSection}>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.subtext }]}>Nombre completo</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: theme.surface }]}>
                                <Ionicons name="person-outline" size={20} color={theme.accent} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    value={userName}
                                    onChangeText={setUserName}
                                    placeholder="Tu nombre"
                                    placeholderTextColor={theme.subtext}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.subtext }]}>Correo corporativo</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: theme.surface }]}>
                                <Ionicons name="mail-outline" size={20} color={theme.accent} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, styles.disabledInput, { color: theme.subtext }]}
                                    value={userEmail}
                                    editable={false}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.subtext }]}>Teléfono</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: theme.surface }]}>
                                <Ionicons name="call-outline" size={20} color={theme.accent} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    value={userPhone}
                                    onChangeText={setUserPhone}
                                    placeholder="8888 8888"
                                    placeholderTextColor={theme.subtext}
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>

                        {/* Botón Guardar */}
                        <TouchableOpacity 
                            style={[
                                styles.saveButton, 
                                { backgroundColor: theme.accent },
                                loading && styles.buttonDisabled
                            ]} 
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

                    <View style={[styles.divider, { backgroundColor: theme.surface }]} />

                    {/* Sección de Acciones */}
                    <View style={styles.actionSection}>
                        <TouchableOpacity style={styles.actionItem} onPress={handleChangePassword}>
                            <View style={[styles.actionIconContainer, { backgroundColor: theme.surface }]}>
                                <Ionicons name="lock-closed-outline" size={22} color={theme.text} />
                            </View>
                            <Text style={[styles.actionText, { color: theme.text }]}>Cambiar Contraseña</Text>
                            <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionItem} onPress={handleDeleteAccount}>
                            <View style={[styles.actionIconContainer, { backgroundColor: theme.surface }]}>
                                <Ionicons name="trash-outline" size={22} color={theme.danger} />
                            </View>
                            <Text style={[styles.actionText, { color: theme.danger }]}>Eliminar Cuenta</Text>
                            <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
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
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: 'Poppins-Bold',
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
        width: 130,
        height: 130,
        borderRadius: 65,
        borderWidth: 4,
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 65,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editImageBadge: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    tapToChange: {
        marginTop: 12,
        fontSize: 13,
        fontFamily: 'Poppins-Medium',
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
        marginBottom: 8,
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
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
        fontFamily: 'Poppins-Regular',
    },
    disabledInput: {
        opacity: 0.7,
    },
    saveButton: {
        height: 55,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Poppins-Bold',
    },
    divider: {
        height: 8,
        marginVertical: 30,
    },
    actionSection: {
        paddingHorizontal: 25,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
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
        fontFamily: 'Poppins-Medium',
    },
});

export default PasajeroProfileScreen;


