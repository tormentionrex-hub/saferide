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
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { userService } from '../../services/userService';
import { useDriverTheme } from '../../context/DriverThemeContext';

const { width } = Dimensions.get('window');

const PasajeroProfileScreen = ({ navigation }) => {
    const { theme } = useDriverTheme();
    
    // Estados de datos persistentes
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [userPhone, setUserPhone] = useState('');
    const [userCompany, setUserCompany] = useState('');
    const [profileImage, setProfileImage] = useState(null); 
    
    // Estados de UI
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [imageLoading, setImageLoading] = useState(false);

    // Valores temporales para el formulario de edición
    const [tempName, setTempName] = useState('');
    const [tempEmail, setTempEmail] = useState('');
    const [tempPhone, setTempPhone] = useState('');
    const [tempCompany, setTempCompany] = useState('');

    // Imagen por defecto local
    const defaultAvatar = require('../../images/DefaultImageUser.png');

    useEffect(() => {
        const loadUserData = async () => {
            try {
                // 1. Cargar primero lo que tengamos en local para rapidez
                const name = await AsyncStorage.getItem('userName');
                const email = await AsyncStorage.getItem('userEmail');
                const phone = await AsyncStorage.getItem('userPhone');
                const photo = await AsyncStorage.getItem('userPhoto');
                const company = await AsyncStorage.getItem('userCompany');

                if (name) { setUserName(name); setTempName(name); }
                if (email) { setUserEmail(email); setTempEmail(email); }
                if (phone) { setUserPhone(phone); setTempPhone(phone); }
                if (company) { setUserCompany(company); setTempCompany(company); }
                if (photo && (photo.startsWith('http') || photo.startsWith('file'))) {
                    setProfileImage(photo);
                }

                // 2. Sincronizar con el servidor para obtener datos actualizados (Ej: Empresa)
                try {
                    const profileData = await userService.getProfile();
                    if (profileData && profileData.data) {
                        const user = profileData.data;
                        
                        setUserName(user.name || '');
                        setUserEmail(user.email || '');
                        setUserPhone(user.phone || '');
                        setUserCompany(user.company || '');
                        
                        // Sincronizar localmente para la próxima vez
                        await AsyncStorage.setItem('userName', user.name || '');
                        await AsyncStorage.setItem('userEmail', user.email || '');
                        await AsyncStorage.setItem('userPhone', user.phone || '');
                        await AsyncStorage.setItem('userCompany', user.company || '');
                        
                        if (user.photo) {
                            setProfileImage(user.photo);
                            await AsyncStorage.setItem('userPhoto', user.photo);
                        }
                    }
                } catch (apiError) {
                    console.log('Error fetching profile from API:', apiError);
                }
            } catch (error) {
                console.log('Error loading local user data:', error);
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
                    if (newPhoto) {
                        setProfileImage(newPhoto);
                        await AsyncStorage.setItem('userPhoto', newPhoto);
                    }
                }
            } catch (error) {
                console.error('Error uploading photo:', error);
                Alert.alert('Sincronización', 'La foto se actualizó localmente, pero hubo un error al subirla al servidor.');
            } finally {
                setImageLoading(false);
            }
        }
    };

    const handleSaveChanges = async () => {
        if (!tempName.trim() || !tempPhone.trim() || !tempEmail.trim()) {
            Alert.alert('Error', 'Todos los campos son obligatorios.');
            return;
        }

        setLoading(true);
        try {
            await userService.updateProfile({
                name: tempName,
                phone: tempPhone,
                email: tempEmail,
                company: tempCompany,
            });

            // Actualizar estados principales y storage
            setUserName(tempName);
            setUserEmail(tempEmail);
            setUserPhone(tempPhone);
            setUserCompany(tempCompany);

            await AsyncStorage.setItem('userName', tempName);
            await AsyncStorage.setItem('userEmail', tempEmail);
            await AsyncStorage.setItem('userPhone', tempPhone);
            await AsyncStorage.setItem('userCompany', tempCompany);

            Alert.alert('Éxito', 'Tus datos se han actualizado correctamente.');
            setIsEditing(false);
        } catch (error) {
            console.error('Save error:', error);
            Alert.alert('Error', 'No se pudieron guardar los cambios en el servidor.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Eliminar Perfil',
            '¿Realmente deseas ELIMINAR tu cuenta? Esta acción borrará todos tus datos corporativos de SafeRide de forma permanente.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar permanentemente',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            try { await userService.deleteAccount(); } catch(e) {}
                            const keys = await AsyncStorage.getAllKeys();
                            await AsyncStorage.multiRemove(keys);
                            navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
                        } catch (error) {
                            console.error('Delete error:', error);
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const renderMenuOption = (icon, title, subtitle, onPress, isDestructive = false, hideBorder = false) => (
        <TouchableOpacity 
            style={[
                styles.menuItem, 
                { 
                    borderBottomColor: theme.divider,
                    borderBottomWidth: hideBorder ? 0 : 1 
                }
            ]} 
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.menuIconContainer, { backgroundColor: isDestructive ? '#FFF0F0' : theme.surface }]}>
                <Ionicons name={icon} size={22} color={isDestructive ? theme.danger : theme.accent} />
            </View>
            <View style={styles.menuTextContainer}>
                <Text style={[styles.menuTitle, { color: isDestructive ? theme.danger : theme.text }]}>{title}</Text>
                {subtitle ? <Text style={[styles.menuSubtitle, { color: theme.subtext }]}>{subtitle}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
        </TouchableOpacity>
    );

    return (

        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            
            {/* ── HEADER ── */}
            <View style={[styles.header, { borderBottomColor: theme.divider }]}>

                <TouchableOpacity onPress={() => isEditing ? setIsEditing(false) : navigation.goBack()} style={styles.backButton}>
                    <Ionicons name={isEditing ? "close" : "chevron-back"} size={28} color={theme.text} />
                </TouchableOpacity>

                <Text style={[styles.headerTitle, { color: theme.text }]}>
                    {isEditing ? 'Configurar Perfil' : 'Mi Perfil'}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── SECCIÓN SUPERIOR: AVATAR ── */}
                <View style={styles.userInfoSection}>
                    <TouchableOpacity 
                        onPress={handleChangeImage} 
                        disabled={!isEditing || imageLoading}
                        style={styles.avatarWrapper}
                        activeOpacity={0.8}
                    >
                        <Image 
                            source={profileImage ? { uri: profileImage } : defaultAvatar} 
                            style={[styles.avatar, { borderColor: isEditing ? theme.accent : theme.surface }]} 
                        />
                        {imageLoading && (
                            <View style={styles.avatarOverlay}>
                                <ActivityIndicator color={theme.accent} size="large" />
                            </View>
                        )}
                        {isEditing && (
                            <View style={[styles.cameraBadge, { backgroundColor: theme.accent }]}>
                                <Ionicons name="camera" size={18} color="#FFF" />
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Información ordenada en líneas limpias */}
                    {!isEditing && (
                        <View style={styles.mainInfo}>
                            <Text style={[styles.userName, { color: theme.text }]}>{userName || 'Cargando...'}</Text>
                            
                            <View style={styles.infoRow}>
                                <Ionicons name="business-outline" size={16} color={theme.accent} />
                                <Text style={[styles.infoText, { color: theme.textSecondary }]}>{userCompany || 'Empresa'}</Text>
                            </View>

                            <View style={styles.infoRow}>
                                <Ionicons name="mail-outline" size={16} color={theme.accent} />
                                <Text style={[styles.infoText, { color: theme.textSecondary }]}>{userEmail}</Text>
                            </View>

                            <View style={styles.infoRow}>
                                <Ionicons name="call-outline" size={16} color={theme.accent} />
                                <Text style={[styles.infoText, { color: theme.textSecondary }]}>{userPhone}</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* ── MODO VISTA (MENÚ) ── */}
                {!isEditing ? (
                    <View style={styles.menuContainer}>
                        <Text style={[styles.sectionTitle, { color: theme.subtext }]}>MI CUENTA</Text>
                        
                        <View style={[styles.menuCard, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
                            {renderMenuOption(
                                'person-outline', 
                                'Editar Datos Personales', 
                                'Nombre, foto, empresa y contacto',
                                () => {
                                    setTempName(userName);
                                    setTempEmail(userEmail);
                                    setTempPhone(userPhone);
                                    setTempCompany(userCompany);
                                    setIsEditing(true);
                                }
                            )}
                            
                            {renderMenuOption(
                                'lock-closed-outline', 
                                'Seguridad', 
                                'Cambiar contraseña y accesos',
                                () => Alert.alert('Seguridad', 'Opción disponible próximamente.')
                            )}
                        </View>

                        <Text style={[styles.sectionTitle, { color: theme.subtext, marginTop: 30 }]}>GENERAL</Text>
                        
                        <View style={[styles.menuCard, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
                            {renderMenuOption(
                                'help-buoy-outline', 
                                'Centro de Ayuda', 
                                'Soporte y dudas sobre tus viajes',
                                () => {}
                            )}

                            {renderMenuOption(
                                'trash-outline', 
                                'Eliminar Cuenta', 
                                'Borrar perfil de forma permanente',
                                handleDeleteAccount,
                                true,
                                true // hideBorder
                            )}
                        </View>
                    </View>
                ) : (
                    /* ── MODO EDICIÓN ── */
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.editForm}
                    >
                        <Text style={[styles.editHint, { color: theme.subtext }]}>Toca la foto arriba para cambiarla</Text>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.subtext }]}>Nombre completo</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: theme.surface }]}>
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    value={tempName}
                                    onChangeText={setTempName}
                                    placeholder="Ej: Juan Pérez"
                                    placeholderTextColor={theme.subtext}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.subtext }]}>Empresa</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: theme.surface }]}>
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    value={tempCompany}
                                    onChangeText={setTempCompany}
                                    placeholder="Ej: Google Cloud"
                                    placeholderTextColor={theme.subtext}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.subtext }]}>Correo corporativo</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: theme.surface }]}>
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    value={tempEmail}
                                    onChangeText={setTempEmail}
                                    placeholder="correo@empresa.com"
                                    placeholderTextColor={theme.subtext}
                                    keyboardType="email-address"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.subtext }]}>Teléfono</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: theme.surface }]}>
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    value={tempPhone}
                                    onChangeText={setTempPhone}
                                    placeholder="8888 8888"
                                    placeholderTextColor={theme.subtext}
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>

                        <TouchableOpacity 
                            style={[styles.saveButton, { backgroundColor: theme.accent }]} 
                            onPress={handleSaveChanges}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Guardar Cambios</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.cancelButton} 
                            onPress={() => setIsEditing(false)}
                        >
                            <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Descartar</Text>
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        paddingTop: 50,
    },
    headerTitle: { fontSize: 24, fontFamily: 'Poppins-Bold' },
    backButton: { padding: 5 },
    scrollContent: { paddingBottom: 60 },

    // Sección Superior
    userInfoSection: {
        alignItems: 'center',
        paddingVertical: 35,
    },
    avatarWrapper: { position: 'relative', marginBottom: 20 },
    avatar: {
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 4,
    },
    avatarOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.4)',
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFF',
    },
    mainInfo: { alignItems: 'center', width: '100%', paddingHorizontal: 30 },
    userName: { 
        backgroundColor: '#FFF', 
        paddingVertical: 6, 
        paddingHorizontal: 112, 
        borderRadius: 14, 
        fontSize: 26, 
        fontFamily: 'Poppins-Bold', 
        marginBottom: 15, 
        textAlign: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 2,
    },
    infoRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginBottom: 10,
        gap: 12,
    },
    infoText: { fontSize: 16, fontFamily: 'Poppins-Medium' },

    // Menú de opciones
    menuContainer: { paddingHorizontal: 20, marginTop: 5 },
    sectionTitle: { fontSize: 11, fontFamily: 'Poppins-Bold', letterSpacing: 1.2, marginBottom: 15, marginLeft: 5 },
    menuCard: {
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
    },
    menuIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    menuTextContainer: { flex: 1 },
    menuTitle: { fontSize: 15, fontFamily: 'Poppins-Bold' },
    menuSubtitle: { fontSize: 11, fontFamily: 'Poppins-Regular', marginTop: 1, opacity: 0.7 },

    // Formulario de edición
    editForm: { paddingHorizontal: 25, marginTop: -10 },
    editHint: { fontSize: 12, fontFamily: 'Poppins-Medium', textAlign: 'center', marginBottom: 20 },
    inputGroup: { marginBottom: 18 },
    label: { fontSize: 13, fontFamily: 'Poppins-Bold', marginBottom: 10, marginLeft: 4 },
    inputWrapper: {
        borderRadius: 14,
        paddingHorizontal: 15,
        height: 55,
        justifyContent: 'center',
    },
    input: { fontSize: 15, fontFamily: 'Poppins-Regular' },
    saveButton: {
        height: 55, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
        marginTop: 25, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1, shadowRadius: 10,
    },
    saveButtonText: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins-Bold' },
    cancelButton: {
        height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
        marginTop: 10,
    },
    cancelButtonText: { fontSize: 15, fontFamily: 'Poppins-Bold' },
});

export default PasajeroProfileScreen;



