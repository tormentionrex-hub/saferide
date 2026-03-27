import React, { useState, useEffect, useRef } from 'react';
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
    Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';

import api from '../../services/api';
import sessionCache from '../../services/sessionCache';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { uploadToCloudinary } from '../../Cloudinary/Cloudinary';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import StarRating from '../../components/StarRating';

const COMPANIES = [
    'Intel', 'Cargill', 'Deloitte', 'Citi', 'Experian',
    '3M', 'DHL', 'Bill Gosling Outsourcing (BGO)',
    'WeWork Costa Rica', 'Concentrix', 'Nestlé Costa Rica'
];

const VEHICLE_BRANDS = [
    'Toyota', 'Hyundai', 'Suzuki', 'Nissan', 'Kia', 'Mitsubishi',
    'Honda', 'Mazda', 'Ford', 'Chevrolet', 'Volkswagen', 'BMW', 'Mercedes-Benz'
];

const MODELS_MAP = {
    'Toyota': ['Corolla', 'RAV4', 'Hilux', 'Yaris', 'Land Cruiser', 'Fortuner', 'Prado', 'Etios'],
    'Hyundai': ['Tucson', 'Accent', 'Elantra', 'Santa Fe', 'Creta', 'I10', 'Venue', 'Staria'],
    'Suzuki': ['Swift', 'Vitara', 'Jimny', 'Grand Vitara', 'S-Presso', 'Ertiga', 'Baleno', 'Dzire'],
    'Nissan': ['Sentra', 'Versa', 'Frontier', 'Kicks', 'Qashqai', 'X-Trail', 'Navara'],
    'Kia': ['Rio', 'Sportage', 'Sorento', 'Picanto', 'Seltos', 'Cerato', 'Soluto'],
    'Mitsubishi': ['L200', 'Montero', 'ASX', 'Outlander', 'Eclipse Cross', 'Xpander'],
    'Honda': ['Civic', 'CR-V', 'HR-V', 'Accord', 'Fit', 'City'],
    'Mazda': ['CX-5', 'CX-3', 'Mazda 3', 'Mazda 2', 'BT-50', 'CX-30'],
    'Ford': ['Ranger', 'Everest', 'Explorer', 'EcoSport', 'F-150'],
    'Chevrolet': ['Tracker', 'Colorado', 'Spark', 'Aveo', 'Captiva'],
};

const DEFAULT_MODELS = ['Sedan', 'SUV', 'Pickup', 'Microbus', 'Hatchback', 'Van', 'Otro'];

const VEHICLE_COLORS = [
    'Blanco', 'Negro', 'Plateado', 'Gris', 'Azul', 'Rojo', 'Verde',
    'Blanco Perla', 'Bronce', 'Champagne', 'Bordeaux', 'Café', 'Oro', 'Crema'
];

const YEARS = Array.from({ length: 31 }, (_, i) => (new Date().getFullYear() - i).toString());

const ProfileConductor = ({ navigation, route }) => {
    const insets = useSafeAreaInsets();
    const { theme } = useDriverTheme();
    const si = useScrollIndicator();

    const scrollRef = useRef(null);
    const [vehicleSectionY, setVehicleSectionY] = useState(0);

    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const [vehicleData, setVehicleData] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '', phone: '', company: '', profileImage: null
    });
    const [editVehicleForm, setEditVehicleForm] = useState({
        brand: '', model: '', year: '', color: '', licensePlate: ''
    });

    // ── CONFIGURACIÓN DE ALERTAS PERSONALIZADAS ──
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        type: 'success', // success, error, warning, confirm
        title: '',
        message: '',
        onConfirm: null,
        onCancel: null,
    });

    const showAlert = (type, title, message, onConfirm = null, onCancel = null) => {
        setAlertConfig({
            visible: true,
            type,
            title,
            message,
            onConfirm,
            onCancel,
        });
    };

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
                        const vehicle = Array.isArray(resVehicle.data.data)
                            ? resVehicle.data.data[0]
                            : resVehicle.data.data;
                        setVehicleData(vehicle);
                        setEditVehicleForm({
                            brand: vehicle.brand || '',
                            model: vehicle.model || '',
                            year: vehicle.year?.toString() || '',
                            color: vehicle.color || '',
                            licensePlate: vehicle.license_plate || ''
                        });
                    }
                } catch (vehError) {
                    if (vehError.response?.status === 404) setVehicleData(null);
                }
            }
        } catch (error) {
            console.error('Error al obtener perfil:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadProfile(); }, []);

    useEffect(() => {
        if (!loading && route?.params?.scrollToVehicle && vehicleSectionY > 0 && scrollRef.current) {
            setTimeout(() => {
                scrollRef.current.scrollTo({ y: vehicleSectionY, animated: true });
            }, 400);
        }
    }, [loading, vehicleSectionY]);

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

    const handleUpdateProfile = async () => {

        try {
            setUpdating(true);

            // 1. Validar que al menos algo haya cambiado
            const Changes =
                editForm.name !== userData.name ||
                editForm.phone !== userData.phone ||
                editForm.company !== userData.company ||
                (editForm.profileImage !== userData.profileImage && editForm.profileImage !== null);

            if (!Changes) {
                showAlert('warning', 'Sin cambios', 'No has realizado ningún cambio para actualizar.');
                setUpdating(false);
                return;
            }

            // 2. Validar campos obligatorios
            if (!editForm.name.trim() || !editForm.phone.trim() || !editForm.company.trim()) {
                showAlert('warning', 'Datos incompletos', 'Todos los campos son obligatorios para actualizar tu perfil.');
                setUpdating(false);
                return;
            }

            // 3. Validar formato de nombre
            if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ ]+$/.test(editForm.name.trim())) {
                showAlert('error', 'Formato Inválido', 'El nombre solo puede contener letras y espacios.');
                setUpdating(false);
                return;
            }

            // 4. Validar formato de teléfono
            if (!/^\d{8}$/.test(editForm.phone)) {
                showAlert('error', 'Formato Inválido', 'El número de teléfono debe tener exactamente 8 dígitos.');
                setUpdating(false);
                return;
            }

            let profileImageUrl = userData.profileImage;
            if (editForm.profileImage && editForm.profileImage !== userData.profileImage) {
                const uriParts = editForm.profileImage.split('.');
                const fileType = uriParts[uriParts.length - 1] || 'jpg';
                const cloudResult = await uploadToCloudinary({
                    uri: editForm.profileImage,
                    name: `profile_${userData._id}.${fileType}`,
                    type: `image/${fileType}`,
                });
                if (!cloudResult.secure_url) {
                    throw new Error(cloudResult.error?.message || 'Error al subir imagen a Cloudinary');
                }
                profileImageUrl = cloudResult.secure_url;
            }

            await api.put(`/users/${userData._id}`, {
                name: editForm.name,
                phone: editForm.phone,
                company: editForm.company,
                profileImage: profileImageUrl,
            });
            showAlert('success', '¡Listo!', 'Perfil actualizado correctamente.');
            setModalVisible(false);
            loadProfile();

        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            showAlert('error', 'Error', 'No se pudo actualizar el perfil. Revisa tu conexión.');
        } finally {
            setUpdating(false);
        }
    };

    const handleUpdateVehicle = async () => {
        try {
            setUpdating(true);

            if (!vehicleData) {
                showAlert('error', 'Error', 'No hay información de vehículo para actualizar.');
                setUpdating(false);
                return;
            }

            // 1. Validar si hay cambios
            const hasChanges = 
                editVehicleForm.brand !== vehicleData.brand ||
                editVehicleForm.model !== vehicleData.model ||
                editVehicleForm.year !== (vehicleData.year ? vehicleData.year.toString() : '') ||
                editVehicleForm.color !== vehicleData.color ||
                editVehicleForm.licensePlate !== vehicleData.license_plate;

            if (!hasChanges) {
                showAlert('warning', 'Sin cambios', 'No has realizado ningún cambio en los datos del vehículo.');
                setUpdating(false);
                return;
            }

            // 2. Validar que tengamos datos mínimos
            if (!editVehicleForm.brand || !editVehicleForm.model || !editVehicleForm.year || !editVehicleForm.color || !editVehicleForm.licensePlate) {
                showAlert('warning', 'Datos incompletos', 'Por favor selecciona marca, modelo, año, color y placa.');
                setUpdating(false);
                return;
            }

            // 3. Validar placa (3 letras + 3 números)
            const plateRegex = /^[A-Z]{3}[0-9]{3}$/;
            if (!plateRegex.test(editVehicleForm.licensePlate.toUpperCase())) {
                showAlert('error', 'Placa Inválida', 'La placa debe tener 3 letras seguidas de 3 números (ej: ABC123).');
                setUpdating(false);
                return;
            }

            // Solicitud al backend
            await api.put(`/vehicles/${vehicleData._id}`, {
                brand: editVehicleForm.brand,
                model: editVehicleForm.model,
                year: parseInt(editVehicleForm.year),
                color: editVehicleForm.color,
                license_plate: editVehicleForm.licensePlate.toUpperCase(),
            });

            showAlert('success', '¡Listo!', 'Información del vehículo actualizada.');
            setVehicleModalVisible(false);
            loadProfile(); // Recargamos para refrescar la vista principal
        } catch (error) {
            console.error('Error al actualizar vehículo:', error);
            const msg = error.response?.data?.message || 'No se pudo actualizar el vehículo.';
            showAlert('error', 'Error', msg);
        } finally {
            setUpdating(false);
        }
    };

    const handleLogout = () => {
        showAlert('confirm', 'Cerrar Sesión', '¿Estás seguro de que quieres salir?', async () => {
            await AsyncStorage.clear();
            sessionCache.clear();
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        });
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.bg || '#0A0A18' }]}>
                <ActivityIndicator size="large" color={theme.accent} />
            </View>
        );
    }

    const initials = userData?.name
        ? userData.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : '?';



    return (

        <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg || '#0A0A18' }]}>
            <StatusBar barStyle="light-content" backgroundColor={theme.bg || '#0A0A18'} />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : 16, borderBottomColor: theme.divider }]}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <View style={[styles.headerIconBtn, { backgroundColor: theme.iconCircleBg || '#1C1C40' }]}>
                        <Ionicons name="chevron-back" size={20} color={theme.accent} />
                    </View>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Mi Perfil</Text>
                <View style={styles.headerIconBtn} />
            </View>

            <View style={{ flex: 1 }}>
                <ScrollView ref={scrollRef} {...si.scrollProps} contentContainerStyle={styles.scrollContent}>

                    {/* ── Tarjeta hero con foto ── */}
                    <View style={[styles.heroCard, { backgroundColor: theme.surfaceVariant || '#16163A', borderColor: theme.cardBorder }]}>

                        {/* Foto de perfil */}
                        <View style={styles.avatarWrapper}>
                            {userData?.profileImage ? (
                                <Image
                                    source={{ uri: userData.profileImage }}
                                    style={[styles.avatar, { borderColor: theme.accent }]}
                                />
                            ) : (
                                <View style={[styles.avatar, styles.avatarFallback, {
                                    borderColor: theme.accent,
                                    backgroundColor: theme.iconCircleBg || '#1C1C40'
                                }]}>
                                    <Text style={[styles.initials, { color: theme.accent }]}>{initials}</Text>
                                </View>
                            )}
                            <View style={[styles.onlineDot, { backgroundColor: theme.accentAlt || '#00D4FF', borderColor: theme.surfaceVariant || '#16163A' }]} />
                        </View>

                        <Text style={[styles.userName, { color: theme.text }]}>
                            {userData?.name || 'Conductor'}
                        </Text>

                        {/* Rating */}
                        <View style={styles.ratingContainer}>
                            <StarRating
                                value={Math.round(userData?.rating || 5)}
                                size={18}
                                disabled
                                color="#FFC107"
                            />
                            <Text style={[styles.ratingValue, { color: theme.textSecondary }]}>
                                {Number(userData?.rating || 5).toFixed(1)}
                            </Text>
                        </View>

                        <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
                            {userData?.email}
                        </Text>

                        {/* Badge rol */}
                        <View style={[styles.roleBadge, { backgroundColor: theme.bg || '#0A0A18', borderColor: theme.cardBorder }]}>
                            <Ionicons name="car-sport-outline" size={13} color={theme.accent} />
                            <Text style={[styles.roleText, { color: theme.accent }]}>Conductor Verificado</Text>
                        </View>
                    </View>

                    {/* ── Sección: Información Personal ── */}
                    <SectionHeader title="INFORMACIÓN PERSONAL" theme={theme} />

                    <InfoCard icon="person-outline" label="Nombre completo" value={userData?.name || 'No registrado'} theme={theme} />
                    <InfoCard icon="mail-outline" label="Correo electrónico" value={userData?.email || 'No registrado'} theme={theme} />
                    <InfoCard icon="call-outline" label="Teléfono" value={userData?.phone || 'No registrado'} theme={theme} />
                    <InfoCard icon="business-outline" label="Empresa" value={userData?.company || 'No registrada'} theme={theme} />

                    {/* ── Sección: Vehículo ── */}
                    <View onLayout={(e) => setVehicleSectionY(e.nativeEvent.layout.y)}>
                        <SectionHeader title="VEHÍCULO ASIGNADO" theme={theme} />

                        {vehicleData ? (
                            <>
                                <InfoCard
                                    icon="car-outline"
                                    label="Modelo"
                                    value={`${vehicleData.brand} ${vehicleData.model} (${vehicleData.year})`}
                                    theme={theme}
                                />
                                <InfoCard
                                    icon="card-outline"
                                    label="Placa / Matrícula"
                                    value={vehicleData.license_plate || 'No registrada'}
                                    theme={theme}
                                />
                            </>
                        ) : (
                            <View style={[styles.emptyCard, { backgroundColor: theme.surfaceVariant || '#16163A', borderColor: theme.cardBorder }]}>
                                <Ionicons name="car-outline" size={30} color={theme.textSecondary} />
                                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                    No hay vehículo registrado
                                </Text>
                            </View>
                        )}

                    </View>

                    {/* ── Acciones ── */}
                    <View style={styles.actionsWrapper}>
                        <TouchableOpacity
                            style={[styles.editBtn, { backgroundColor: theme.accent }]}
                            onPress={() => setModalVisible(true)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="create-outline" size={20} color="#FFF" />
                            <Text style={styles.editBtnText}>Actualizar Información Personal</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.editBtn, { backgroundColor: theme.accent }]}
                            onPress={() => {
                                if (!vehicleData) {
                                    showAlert('warning', 'Sin Vehículo', 'No tienes un vehículo registrado para editar.');
                                } else {
                                    setVehicleModalVisible(true);
                                }
                            }}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="create-outline" size={20} color="#FFF" />
                            <Text style={styles.editBtnText}>Actualizar Información del Vehículo</Text>
                        </TouchableOpacity>



                        <TouchableOpacity
                            style={[styles.logoutBtn, { borderColor: theme.danger, backgroundColor: 'rgba(255,107,107,0.07)' }]}
                            onPress={handleLogout}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
                            <Text style={[styles.logoutText, { color: theme.danger }]}>Cerrar Sesión</Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
                <ScrollIndicator si={si} thumbColor={theme.accent} />
            </View>

            {/* ── Modal de edición ── */}
            <Modal
                animationType="slide"
                transparent
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.modalContent, { backgroundColor: theme.surface || '#111128' }]}>
                        <View style={[styles.handleBar, { backgroundColor: theme.divider }]} />

                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Editar Perfil</Text>
                            <TouchableOpacity
                                onPress={() => setModalVisible(false)}
                                style={[styles.closeBtn, { backgroundColor: theme.iconCircleBg || '#1C1C40' }]}
                            >
                                <Ionicons name="close" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Avatar editable */}
                            <TouchableOpacity style={styles.modalAvatarContainer} onPress={pickImage} activeOpacity={0.8}>
                                {editForm.profileImage ? (
                                    <Image source={{ uri: editForm.profileImage }} style={[styles.modalAvatar, { borderColor: theme.accent }]} />
                                ) : (
                                    <View style={[styles.modalAvatar, styles.avatarFallback, { borderColor: theme.accent, backgroundColor: theme.iconCircleBg || '#1C1C40' }]}>
                                        <Text style={[styles.initials, { color: theme.accent, fontSize: 28 }]}>{initials}</Text>
                                    </View>
                                )}
                                <View style={[styles.cameraBadge, { backgroundColor: theme.accent, borderColor: theme.surface || '#111128' }]}>
                                    <Ionicons name="camera" size={15} color="#FFF" />
                                </View>
                            </TouchableOpacity>
                            <Text style={[styles.photoHint, { color: theme.textSecondary }]}>
                                Toca para cambiar la foto
                            </Text>

                            <ModalInput label="NOMBRE COMPLETO" icon="person-outline" value={editForm.name}
                                onChangeText={t => setEditForm(prev => ({ ...prev, name: t }))}
                                placeholder="Tu nombre" theme={theme} />

                            <ModalInput label="TELÉFONO" icon="call-outline" value={editForm.phone}
                                onChangeText={t => setEditForm(prev => ({ ...prev, phone: t.replace(/[^0-9]/g, '') }))}
                                placeholder="88888888" keyboardType="phone-pad" maxLength={8} theme={theme} />

                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Ionicons name="business-outline" size={14} color={theme.textSecondary} style={{ marginRight: 6 }} />
                                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>EMPRESA</Text>
                                </View>
                                <View style={styles.chipsContainer}>
                                    {COMPANIES.map(comp => {
                                        const isSelected = editForm.company === comp;
                                        return (
                                            <TouchableOpacity
                                                key={comp}
                                                activeOpacity={0.7}
                                                onPress={() => setEditForm(prev => ({ ...prev, company: comp }))}
                                                style={[
                                                    styles.chip,
                                                    {
                                                        backgroundColor: isSelected ? theme.accent : theme.bg,
                                                        borderColor: isSelected ? theme.accent : theme.divider,
                                                    }
                                                ]}
                                            >
                                                <Ionicons 
                                                    name="business" 
                                                    size={14} 
                                                    color={isSelected ? "#FFF" : theme.textSecondary} 
                                                />
                                                <Text style={[
                                                    styles.chipText,
                                                    { color: isSelected ? "#FFF" : theme.text }
                                                ]}>
                                                    {comp}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
                                onPress={handleUpdateProfile}
                                disabled={updating}
                                activeOpacity={0.85}
                            >
                                {updating ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                        <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>


            {/* ─── Modal de Edición del vehículo ─── */}
            <Modal
                visible={vehicleModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setVehicleModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
                        <View style={[styles.handleBar, { backgroundColor: theme.divider }]} />

                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Editar información del vehículo</Text>
                            <TouchableOpacity
                                onPress={() => setVehicleModalVisible(false)}
                                style={[styles.closeBtn, { backgroundColor: theme.iconCircleBg || '#1C1C40' }]}
                            >
                                <Ionicons name="close" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* MARCA SELECT */}
                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Ionicons name="car-outline" size={14} color={theme.textSecondary} style={{ marginRight: 6 }} />
                                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>MARCA</Text>
                                </View>
                                <View style={[styles.pickerContainer, { borderColor: theme.divider, backgroundColor: theme.bg }]}>
                                    <Picker
                                        selectedValue={editVehicleForm.brand}
                                        onValueChange={val => setEditVehicleForm(prev => ({ ...prev, brand: val, model: '' }))}
                                        style={{ color: theme.text }}
                                        dropdownIconColor={theme.accent}
                                    >
                                        <Picker.Item label="Selecciona marca" value="" />
                                        {VEHICLE_BRANDS.map(b => <Picker.Item key={b} label={b} value={b} />)}
                                    </Picker>
                                </View>
                            </View>

                            {/* MODELO SELECT */}
                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Ionicons name="car-outline" size={14} color={theme.textSecondary} style={{ marginRight: 6 }} />
                                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>MODELO</Text>
                                </View>
                                <View style={[styles.pickerContainer, { borderColor: theme.divider, backgroundColor: theme.bg }]}>
                                    <Picker
                                        selectedValue={editVehicleForm.model}
                                        onValueChange={val => setEditVehicleForm(prev => ({ ...prev, model: val }))}
                                        style={{ color: theme.text }}
                                        dropdownIconColor={theme.accent}
                                    >
                                        <Picker.Item label="Selecciona modelo" value="" />
                                        {(MODELS_MAP[editVehicleForm.brand] || DEFAULT_MODELS).map(m => (
                                            <Picker.Item key={m} label={m} value={m} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>

                            {/* AÑO SELECT */}
                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} style={{ marginRight: 6 }} />
                                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>AÑO</Text>
                                </View>
                                <View style={[styles.pickerContainer, { borderColor: theme.divider, backgroundColor: theme.bg }]}>
                                    <Picker
                                        selectedValue={editVehicleForm.year}
                                        onValueChange={val => setEditVehicleForm(prev => ({ ...prev, year: val }))}
                                        style={{ color: theme.text }}
                                        dropdownIconColor={theme.accent}
                                    >
                                        <Picker.Item label="Selecciona año" value="" />
                                        {YEARS.map(y => <Picker.Item key={y} label={y} value={y} />)}
                                    </Picker>
                                </View>
                            </View>

                            {/* COLOR SELECT */}
                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Ionicons name="color-palette-outline" size={14} color={theme.textSecondary} style={{ marginRight: 6 }} />
                                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>COLOR</Text>
                                </View>
                                <View style={[styles.pickerContainer, { borderColor: theme.divider, backgroundColor: theme.bg }]}>
                                    <Picker
                                        selectedValue={editVehicleForm.color}
                                        onValueChange={val => setEditVehicleForm(prev => ({ ...prev, color: val }))}
                                        style={{ color: theme.text }}
                                        dropdownIconColor={theme.accent}
                                    >
                                        <Picker.Item label="Selecciona color" value="" />
                                        {VEHICLE_COLORS.map(c => <Picker.Item key={c} label={c} value={c} />)}
                                    </Picker>
                                </View>
                            </View>

                            {/* MATRÍCULA */}
                            <ModalInput
                                label="MATRÍCULA"
                                icon="document-text-outline"
                                value={editVehicleForm.licensePlate}
                                placeholder="ABC123"
                                theme={theme}
                                onChangeText={t => setEditVehicleForm(prev => ({ ...prev, licensePlate: t.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) }))}
                            />

                            <TouchableOpacity
                                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
                                onPress={handleUpdateVehicle}
                                disabled={updating}
                                activeOpacity={0.85}
                            >
                                {updating ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                        <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ── MODAL DE ALERTA PERSONALIZADA (AESTHETIC) ── */}
            <Modal
                visible={alertConfig.visible}
                transparent
                animationType="fade"
                statusBarTranslucent
            >
                <View style={styles.alertBackdrop}>
                    <View style={[styles.alertCard, {
                        backgroundColor: theme.dark ? '#111128' : '#FFFFFF',
                        borderColor: theme.dark ? 'rgba(116,143,255,0.2)' : 'rgba(75,104,255,0.1)',
                    }]}>

                        {/* Icono con Glow */}
                        <View style={[styles.alertIconWrapper, {
                            backgroundColor:
                                alertConfig.type === 'success' ? (theme.dark ? '#0A2A1A' : '#E8F5E9') :
                                alertConfig.type === 'error'   ? (theme.dark ? '#2A0A0A' : '#FFEBEE') :
                                alertConfig.type === 'warning' ? (theme.dark ? '#2A1C00' : '#FFF8E1') :
                                (theme.dark ? '#1C1C40' : '#EEF2FF'),
                            shadowColor:
                                alertConfig.type === 'success' ? '#27AE60' :
                                alertConfig.type === 'error'   ? '#FF5252' :
                                alertConfig.type === 'warning' ? '#FFA000' :
                                theme.accent,
                        }]}>
                            <View style={[styles.alertIconInner, {
                                backgroundColor:
                                    alertConfig.type === 'success' ? (theme.dark ? '#0E3E26' : '#C8E6C9') :
                                    alertConfig.type === 'error'   ? (theme.dark ? '#3E0E0E' : '#FFCDD2') :
                                    alertConfig.type === 'warning' ? (theme.dark ? '#3E2A00' : '#FFECB3') :
                                    (theme.dark ? '#252560' : '#E0E7FF'),
                            }]}>
                                <Ionicons
                                    name={
                                        alertConfig.type === 'success' ? 'checkmark-circle' :
                                        alertConfig.type === 'error'   ? 'alert-circle' :
                                        alertConfig.type === 'warning' ? 'warning' :
                                        'help-circle'
                                    }
                                    size={42}
                                    color={
                                        alertConfig.type === 'success' ? '#27AE60' :
                                        alertConfig.type === 'error'   ? '#FF5252' :
                                        alertConfig.type === 'warning' ? '#FFA000' :
                                        theme.accent
                                    }
                                />
                            </View>
                        </View>

                        {/* Texto */}
                        <Text style={[styles.alertTitle, { color: theme.dark ? '#EEEEFF' : '#1C1C1E' }]}>
                            {alertConfig.title}
                        </Text>
                        <Text style={[styles.alertSubtitle, { color: theme.dark ? '#A0A0C0' : '#6B7280' }]}>
                            {alertConfig.message}
                        </Text>

                        {/* Separador */}
                        <View style={[styles.alertDivider, {
                            backgroundColor: theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
                        }]} />

                        {/* Botones */}
                        <View style={styles.alertBtnRow}>
                            {alertConfig.type === 'confirm' ? (
                                <>
                                    <TouchableOpacity
                                        style={[styles.alertBtnSecondary, { borderColor: theme.divider }]}
                                        onPress={() => {
                                            setAlertConfig(prev => ({ ...prev, visible: false }));
                                            if (alertConfig.onCancel) alertConfig.onCancel();
                                        }}
                                    >
                                        <Text style={[styles.alertBtnTextSecondary, { color: theme.textSecondary }]}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.alertBtnPrimary, { backgroundColor: theme.danger || '#FF5252' }]}
                                        onPress={() => {
                                            setAlertConfig(prev => ({ ...prev, visible: false }));
                                            if (alertConfig.onConfirm) alertConfig.onConfirm();
                                        }}
                                    >
                                        <Text style={styles.alertBtnTextPrimary}>Salir</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.alertBtnPrimary, {
                                        backgroundColor:
                                            alertConfig.type === 'success' ? '#27AE60' :
                                            alertConfig.type === 'error'   ? '#FF5252' :
                                            alertConfig.type === 'warning' ? '#FFA000' :
                                            theme.accent
                                    }]}
                                    onPress={() => {
                                        setAlertConfig(prev => ({ ...prev, visible: false }));
                                        if (alertConfig.onConfirm) alertConfig.onConfirm();
                                    }}
                                >
                                    <Text style={styles.alertBtnTextPrimary}>Aceptar</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
};

/* ── Sub-componentes ── */

const SectionHeader = ({ title, theme }) => (
    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
);

const InfoCard = ({ icon, label, value, theme }) => (
    <View style={[styles.infoCard, { backgroundColor: theme.surfaceVariant || '#16163A', borderColor: theme.cardBorder }]}>
        <View style={[styles.infoIconCircle, { backgroundColor: theme.iconCircleBg || '#1C1C40' }]}>
            <Ionicons name={icon} size={20} color={theme.accent} />
        </View>
        <View style={styles.infoTexts}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
        </View>
    </View>
);

const ModalInput = ({ label, icon, theme, ...props }) => (
    <View style={styles.inputGroup}>
        <View style={styles.labelRow}>
            <Ionicons name={icon} size={14} color={theme.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{label}</Text>
        </View>
        <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.divider, backgroundColor: theme.bg }]}
            placeholderTextColor={theme.textSecondary}
            {...props}
        />
    </View>
);

/* ── Estilos ── */
const styles = StyleSheet.create({
    safe: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    headerIconBtn: {
        width: 38, height: 38, borderRadius: 19,
        justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { fontSize: 18, fontFamily: 'Poppins-Bold' },

    scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },

    // Hero card
    heroCard: {
        alignItems: 'center',
        borderRadius: 24,
        borderWidth: 1,
        paddingVertical: 32,
        paddingHorizontal: 24,
        marginBottom: 28,
        elevation: 3,
    },
    avatarWrapper: { position: 'relative', marginBottom: 16 },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        shadowColor: '#748FFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.75,
        shadowRadius: 16,
        elevation: 10,
    },
    avatarFallback: { justifyContent: 'center', alignItems: 'center' },
    initials: { fontSize: 38, fontFamily: 'Poppins-Bold' },
    onlineDot: {
        position: 'absolute', bottom: 6, right: 6,
        width: 16, height: 16, borderRadius: 8, borderWidth: 2.5,
    },
    userName: { fontSize: 22, fontFamily: 'Poppins-Bold', marginBottom: 4 },
    userEmail: { fontSize: 13, fontFamily: 'Poppins-Regular', marginBottom: 14 },
    roleBadge: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 6,
        borderRadius: 20, borderWidth: 1, gap: 6,
    },
    roleText: { fontSize: 12, fontFamily: 'Poppins-SemiBold' },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 4,
    },
    ratingValue: {
        fontSize: 14,
        fontFamily: 'Poppins-Bold',
        marginLeft: 2,
    },

    // Section title
    sectionTitle: {
        fontSize: 11, fontFamily: 'Poppins-SemiBold',
        letterSpacing: 1.4, marginBottom: 10, marginLeft: 4,
    },

    // Info cards individuales
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginBottom: 10,
        elevation: 2,
    },
    infoIconCircle: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center',
        marginRight: 14,
    },
    infoTexts: { flex: 1 },
    infoLabel: { fontSize: 11, fontFamily: 'Poppins-Regular', marginBottom: 2 },
    infoValue: { fontSize: 15, fontFamily: 'Poppins-SemiBold' },

    emptyCard: {
        borderRadius: 16, borderWidth: 1,
        paddingVertical: 28,
        alignItems: 'center', gap: 10,
        marginBottom: 10,
    },
    emptyText: { fontSize: 14, fontFamily: 'Poppins-Regular' },

    // Acciones
    actionsWrapper: { marginTop: 18, gap: 12 },
    editBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        height: 56, borderRadius: 18, gap: 10,
        elevation: 5,
        shadowColor: '#748FFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    editBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins-SemiBold' },
    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        height: 56, borderRadius: 18, borderWidth: 1.5, gap: 10,
        marginTop: 8,
    },
    logoutText: { fontSize: 15, fontFamily: 'Poppins-Bold' },

    // ── ESTILOS ALERTAS PERSONALIZADAS ──
    alertBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    alertCard: {
        width: '100%',
        borderRadius: 28,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    alertIconWrapper: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        elevation: 10,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
    },
    alertIconInner: {
        width: 76, height: 76, borderRadius: 38,
        justifyContent: 'center', alignItems: 'center',
    },
    alertTitle: {
        fontSize: 22, fontFamily: 'Poppins-Bold', marginBottom: 10,
    },
    alertSubtitle: {
        fontSize: 14, fontFamily: 'Poppins-Regular', textAlign: 'center',
        lineHeight: 22, paddingHorizontal: 10,
    },
    alertDivider: {
        width: '100%', height: 1, marginVertical: 24,
    },
    alertBtnRow: {
        flexDirection: 'row', width: '100%', gap: 12,
    },
    alertBtnPrimary: {
        flex: 1, height: 54, borderRadius: 15,
        justifyContent: 'center', alignItems: 'center',
        elevation: 6,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    alertBtnSecondary: {
        flex: 1, height: 54, borderRadius: 15,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1.5,
    },
    alertBtnTextPrimary: {
        color: '#FFF', fontSize: 16, fontFamily: 'Poppins-Bold',
    },
    alertBtnTextSecondary: {
        fontSize: 16, fontFamily: 'Poppins-Bold',
    },
    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: 24, paddingTop: 12, maxHeight: '92%',
    },
    handleBar: {
        width: 40, height: 4, borderRadius: 2,
        alignSelf: 'center', marginBottom: 18,
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 22,
    },
    modalTitle: { fontSize: 20, fontFamily: 'Poppins-Bold' },
    closeBtn: {
        width: 34, height: 34, borderRadius: 17,
        justifyContent: 'center', alignItems: 'center',
    },
    modalAvatarContainer: {
        alignSelf: 'center', marginBottom: 6, position: 'relative',
    },
    modalAvatar: {
        width: 100, height: 100, borderRadius: 50, borderWidth: 3,
    },
    cameraBadge: {
        position: 'absolute', bottom: 2, right: 2,
        width: 30, height: 30, borderRadius: 15,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2,
    },
    photoHint: {
        textAlign: 'center', fontSize: 12,
        fontFamily: 'Poppins-Regular', marginBottom: 22,
    },
    inputGroup: { marginBottom: 18 },
    labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 2 },
    inputLabel: { fontSize: 11, fontFamily: 'Poppins-SemiBold', letterSpacing: 0.8 },
    input: {
        height: 50, borderRadius: 13, borderWidth: 1,
        paddingHorizontal: 16, fontSize: 15, fontFamily: 'Poppins-Regular',
    },
    pickerContainer: {
        borderRadius: 13, borderWidth: 1,
        height: 50, justifyContent: 'center', overflow: 'hidden',
    },
    saveBtn: {
        height: 54, borderRadius: 16,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        marginTop: 8, marginBottom: 24,
        elevation: 4,
        shadowColor: '#748FFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
    },
    saveBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins-SemiBold' },
    // Chip Selection
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    chipText: {
        fontSize: 12,
        fontFamily: 'Poppins-Medium',
    },
});

export default ProfileConductor;
