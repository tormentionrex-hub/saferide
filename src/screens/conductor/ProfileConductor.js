import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    StatusBar, 
    TouchableOpacity, 
    ScrollView, 
    Image, 
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';

// IMPORTANTE: Asegúrate de tener configurado tu servicio de API
import api from '../../services/api'; 
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';

const COMPANIES = [
    'Intel', 'Cargill', 'Deloitte', 'Citi', 'Experian', '3M', 'DHL', 
    'Bill Gosling Outsourcing (BGO)', 'WeWork Costa Rica', 'Concentrix', 'Nestlé Costa Rica'
];

const ProfileConductor = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { theme } = useDriverTheme();
    const si = useScrollIndicator();

    // ── ESTADOS DE DATOS ──
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const [vehicleData, setVehicleData] = useState(null);

    // ── ESTADOS DEL MODAL ──
    const [modalVisible, setModalVisible] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        phone: '',
        company: '',
        profileImage: null
    });

    // ── CARGA DE DATOS DESDE EL BACKEND ──
    const loadProfile = async () => {
        try {
            setLoading(true);
            const resUser = await api.get('/auth/me');
            if (resUser.data.success) {
                const user = resUser.data.data;
                setUserData(user);
                setEditForm({
                    name: user.name || '',
                    phone: user.phone || '',
                    company: user.company || '',
                    profileImage: user.profileImage || null
                });
                
                try {
                    const resVehicle = await api.get(`/vehicles/driver/${user._id}`);
                    if (resVehicle.data.success) {
                        const vehicle = Array.isArray(resVehicle.data.data) ? resVehicle.data.data[0] : resVehicle.data.data;
                        setVehicleData(vehicle);
                    }
                } catch (vehError) {
                    if (vehError.response?.status === 404) {
                        setVehicleData(null);
                    }
                }
            }
        } catch (error) {
            console.error("Error al obtener perfil:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProfile();
    }, []);

    // ── SELECCIÓN DE IMAGEN ──
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setEditForm(prev => ({ ...prev, profileImage: result.assets[0].uri }));
        }
    };

    // ── GUARDAR CAMBIOS ──
    const handleUpdateProfile = async () => {
        try {
            setUpdating(true);
            
            // 1. Validaciones básicas
            if (!/^\d{8}$/.test(editForm.phone)) {
                Alert.alert("Formato Inválido", "El número de teléfono debe tener exactamente 8 dígitos.");
                setUpdating(false);
                return;
            }

            // 1. Actualizar datos básicos
            await api.put(`/users/${userData._id}`, {
                name: editForm.name,
                phone: editForm.phone,
                company: editForm.company
            });

            // 2. Actualizar imagen si cambió y es una URI local
            if (editForm.profileImage && editForm.profileImage !== userData.profileImage) {
                const formData = new FormData();
                const uriParts = editForm.profileImage.split('.');
                const fileType = uriParts[uriParts.length - 1];

                formData.append('image', {
                    uri: editForm.profileImage,
                    name: `profile.${fileType}`,
                    type: `image/${fileType}`,
                });

                await api.post(`/users/${userData._id}/image`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }

            Alert.alert("Éxito", "Perfil actualizado correctamente");
            setModalVisible(false);
            loadProfile(); // Recargar datos
        } catch (error) {
            console.error("Error al actualizar perfil:", error);
            Alert.alert("Error", "No se pudo actualizar el perfil. Revisa tu conexión.");
        } finally {
            setUpdating(false);
        }
    };

    // ── LÓGICA DE CIERRE DE SESIÓN ──
    const handleLogout = () => {
        Alert.alert(
            "Cerrar Sesión",
            "¿Estás seguro de que quieres salir?",
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Sí, salir", 
                    style: "destructive",
                    onPress: async () => {
                        await AsyncStorage.clear();
                        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                    } 
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.bg || theme.surface }]}>
                <ActivityIndicator size="large" color={theme.accent} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg || theme.surface }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg || theme.surface} />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : 16, borderBottomColor: theme.divider }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Mi Perfil</Text>
            </View>

            <View style={{ flex: 1 }}>
                <ScrollView 
                    {...si.scrollProps}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* SECCIÓN FOTO Y NOMBRE */}
                    <View style={styles.profileCard}>
                        <Image 
                            source={{ uri: userData?.profileImage || 'https://via.placeholder.com/150' }} 
                            style={[styles.avatar, { borderColor: theme.accent }]} 
                        />
                        <Text style={[styles.userName, { color: theme.text }]}>
                            {userData?.name || 'Conductor'}
                        </Text>
                        <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
                            {userData?.email}
                        </Text>
                    </View>

                    {/* SECCIÓN INFORMACIÓN DEL VEHÍCULO */}
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>VEHÍCULO ASIGNADO</Text>
                    <View style={[styles.infoBox, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
                        {vehicleData ? (
                            <>
                                <View style={styles.infoRow}>
                                    <Ionicons name="car-outline" size={22} color={theme.accent} />
                                    <View style={styles.infoTexts}>
                                        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Modelo</Text>
                                        <Text style={[styles.infoValue, { color: theme.text }]}>
                                            {vehicleData.brand} {vehicleData.model} ({vehicleData.year})
                                        </Text>
                                    </View>
                                </View>
                                <View style={[styles.line, { backgroundColor: theme.divider }]} />
                                <View style={styles.infoRow}>
                                    <Ionicons name="card-outline" size={22} color={theme.accent} />
                                    <View style={styles.infoTexts}>
                                        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Placa / Matrícula</Text>
                                        <Text style={[styles.infoValue, { color: theme.text }]}>
                                            {vehicleData.license_plate || 'No registrada'}
                                        </Text>
                                    </View>
                                </View>
                            </>
                        ) : (
                            <Text style={[styles.infoValue, { color: theme.text, textAlign: 'center' }]}>
                                No hay vehículo registrado
                            </Text>
                        )}
                    </View>

                    {/* BOTONES DE ACCIÓN */}
                    <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: theme.surface, borderColor: theme.divider }]}
                        onPress={() => setModalVisible(true)}
                    >
                        <Ionicons name="create-outline" size={20} color={theme.text} />
                        <Text style={[styles.actionBtnText, { color: theme.text }]}>Actualizar Información</Text>
                        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.logoutBtn, { borderColor: theme.danger }]}
                        onPress={handleLogout}
                    >
                        <Ionicons name="log-out-outline" size={20} color={theme.danger} />
                        <Text style={[styles.logoutText, { color: theme.danger }]}>Cerrar Sesión</Text>
                    </TouchableOpacity>

                </ScrollView>
                <ScrollIndicator si={si} thumbColor={theme.accent} />
            </View>

            {/* MODAL DE EDICIÓN */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Editar Perfil</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Cambiar Foto */}
                            <TouchableOpacity style={styles.modalAvatarContainer} onPress={pickImage}>
                                <Image 
                                    source={{ uri: editForm.profileImage || 'https://via.placeholder.com/150' }} 
                                    style={[styles.modalAvatar, { borderColor: theme.accent }]} 
                                />
                                <View style={[styles.editBadge, { backgroundColor: theme.accent }]}>
                                    <Ionicons name="camera" size={16} color="#FFF" />
                                </View>
                            </TouchableOpacity>

                            {/* Inputs */}
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>NOMBRE COMPLETO</Text>
                                <TextInput
                                    style={[styles.input, { color: theme.text, borderColor: theme.divider, backgroundColor: theme.bg }]}
                                    value={editForm.name}
                                    onChangeText={(t) => setEditForm(prev => ({ ...prev, name: t }))}
                                    placeholder="Tu nombre"
                                    placeholderTextColor={theme.textSecondary}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>TELÉFONO</Text>
                                <TextInput
                                    style={[styles.input, { color: theme.text, borderColor: theme.divider, backgroundColor: theme.bg }]}
                                    value={editForm.phone}
                                    onChangeText={(t) => setEditForm(prev => ({ ...prev, phone: t.replace(/[^0-9]/g, '') }))}
                                    keyboardType="phone-pad"
                                    maxLength={8}
                                    placeholder="8888-8888"
                                    placeholderTextColor={theme.textSecondary}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>EMPRESA</Text>
                                <View style={[styles.pickerContainer, { borderColor: theme.divider, backgroundColor: theme.bg }]}>
                                    <Picker
                                        selectedValue={editForm.company}
                                        onValueChange={(itemValue) => setEditForm(prev => ({ ...prev, company: itemValue }))}
                                        style={{ color: theme.text }}
                                        dropdownIconColor={theme.text}
                                    >
                                        <Picker.Item label="Selecciona una empresa" value="" />
                                        {COMPANIES.map((company) => (
                                            <Picker.Item key={company} label={company} value={company} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
                                onPress={handleUpdateProfile}
                                disabled={updating}
                            >
                                {updating ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    backBtn: { position: 'absolute', left: 16 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 20, paddingBottom: 40 },
    
    profileCard: {
        alignItems: 'center',
        marginBottom: 30,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        marginBottom: 12,
        backgroundColor: '#f0f0f0'
    },
    userName: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    userEmail: {
        fontSize: 14,
    },

    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 10,
        marginLeft: 4,
    },
    infoBox: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 20,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    infoTexts: {
        marginLeft: 15,
    },
    infoLabel: {
        fontSize: 11,
    },
    infoValue: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    line: {
        height: 1,
        marginVertical: 10,
        marginLeft: 35,
    },

    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
    },
    actionBtnText: {
        flex: 1,
        marginLeft: 12,
        fontSize: 15,
        fontWeight: 'bold',
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1.5,
        marginTop: 20,
    },
    logoutText: {
        marginLeft: 10,
        fontSize: 15,
        fontWeight: 'bold',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    modalAvatarContainer: {
        alignSelf: 'center',
        marginBottom: 24,
        position: 'relative',
    },
    modalAvatar: {
        width: 110,
        height: 110,
        borderRadius: 55,
        borderWidth: 3,
    },
    editBadge: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 15,
    },
    pickerContainer: {
        borderRadius: 12,
        borderWidth: 1,
        height: 50,
        justifyContent: 'center',
    },
    saveBtn: {
        height: 55,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default ProfileConductor;
