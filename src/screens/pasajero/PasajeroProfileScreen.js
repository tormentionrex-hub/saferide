import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView,
    Image, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView,
    Platform, PanResponder, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';

import { useDriverTheme } from '../../context/DriverThemeContext';
import { uploadToCloudinary } from '../../Cloudinary/Cloudinary';
import { userService } from '../../services/userService';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';

const COMPANIES = [
    'Intel', 'Cargill', 'Deloitte', 'Citi', 'Experian',
    '3M', 'DHL', 'Bill Gosling Outsourcing (BGO)',
    'WeWork Costa Rica', 'Concentrix', 'Nestlé Costa Rica'
];

const PAYMENT_LABELS = { efectivo: 'Efectivo', sinpe: 'SINPE Móvil', tarjeta: 'Tarjeta' };
const PAYMENT_ICONS  = { efectivo: 'cash-outline', sinpe: 'phone-portrait-outline', tarjeta: 'card-outline' };

// ── Hook de animación para el modal de logout ─────────────────────────────────
const useLogoutModal = () => {
    const [visible, setVisible] = useState(false);
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const cardScale       = useRef(new Animated.Value(0.75)).current;
    const cardOpacity     = useRef(new Animated.Value(0)).current;

    const open = () => {
        setVisible(true);
        Animated.parallel([
            Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.spring(cardScale,       { toValue: 1, friction: 7, tension: 100, useNativeDriver: true }),
            Animated.timing(cardOpacity,     { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
    };

    const close = (callback) => {
        Animated.parallel([
            Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(cardScale,       { toValue: 0.85, duration: 180, useNativeDriver: true }),
            Animated.timing(cardOpacity,     { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => {
            setVisible(false);
            cardScale.setValue(0.75);
            cardOpacity.setValue(0);
            backdropOpacity.setValue(0);
            if (callback) callback();
        });
    };

    return { visible, open, close, backdropOpacity, cardScale, cardOpacity };
};

const PasajeroProfileScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { theme } = useDriverTheme();
    const si = useScrollIndicator();
    const logoutModal = useLogoutModal();

    const [loading,       setLoading]       = useState(true);
    const [userData,      setUserData]      = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [modalVisible,  setModalVisible]  = useState(false);
    const [updating,      setUpdating]      = useState(false);
    const [editForm,      setEditForm]      = useState({
        name: '', phone: '', email: '', company: '', profileImage: null
    });

    const translateY = useRef(new Animated.Value(700)).current;

    const closeModal = () => {
        Animated.timing(translateY, {
            toValue: 700, duration: 280, useNativeDriver: true,
        }).start(() => setModalVisible(false));
    };

    const panResponder = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
        onPanResponderMove: (_, g) => {
            if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
            if (g.dy > 80 || g.vy > 0.5) {
                closeModal();
            } else {
                Animated.spring(translateY, {
                    toValue: 0, useNativeDriver: true,
                }).start();
            }
        },
    })).current;

    // Animar entrada cuando el modal se hace visible
    useEffect(() => {
        if (modalVisible) {
            translateY.setValue(700);
            Animated.spring(translateY, {
                toValue: 0, useNativeDriver: true,
                damping: 22, stiffness: 180,
            }).start();
        }
    }, [modalVisible]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const name    = await AsyncStorage.getItem('userName');
            const email   = await AsyncStorage.getItem('userEmail');
            const phone   = await AsyncStorage.getItem('userPhone');
            const photo   = await AsyncStorage.getItem('userPhoto');
            const company = await AsyncStorage.getItem('userCompany');
            const payment = await AsyncStorage.getItem('paymentMethod');

            const local = {
                name:         name    || '',
                email:        email   || '',
                phone:        phone   || '',
                company:      company || '',
                profileImage: (photo && (photo.startsWith('http') || photo.startsWith('file'))) ? photo : null,
            };
            setUserData(local);
            setEditForm({ ...local });
            if (payment) setPaymentMethod(payment);

            try {
                const res = await userService.getProfile();
                if (res?.data) {
                    const u = res.data;
                    const server = {
                        name:         u.name         || '',
                        email:        u.email        || '',
                        phone:        u.phone        || '',
                        company:      u.company      || '',
                        profileImage: u.profileImage || u.photo || local.profileImage,
                    };
                    setUserData(server);
                    setEditForm({ ...server });
                    await AsyncStorage.setItem('userName',    server.name);
                    await AsyncStorage.setItem('userEmail',   server.email);
                    await AsyncStorage.setItem('userPhone',   server.phone);
                    await AsyncStorage.setItem('userCompany', server.company);
                    if (server.profileImage) await AsyncStorage.setItem('userPhoto', server.profileImage);
                }
            } catch (e) { console.log('API sync error:', e); }
        } catch (e) { console.log('Load error:', e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadProfile(); }, []);

    // Reload payment method immediately when returning from PaymentMethodScreen
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            AsyncStorage.getItem('paymentMethod').then(val => { if (val) setPaymentMethod(val); });
        });
        return unsubscribe;
    }, [navigation]);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.8,
        });
        if (!result.canceled)
            setEditForm(prev => ({ ...prev, profileImage: result.assets[0].uri }));
    };

    const handleUpdateProfile = async () => {
        try {
            setUpdating(true);
            if (!/^\d{8}$/.test(editForm.phone)) {
                Alert.alert('Formato Inválido', 'El teléfono debe tener exactamente 8 dígitos.');
                setUpdating(false);
                return;
            }

            let profileImageUrl = userData.profileImage;
            if (editForm.profileImage && editForm.profileImage !== userData.profileImage) {
                const uriParts = editForm.profileImage.split('.');
                const fileType = uriParts[uriParts.length - 1] || 'jpg';
                const cloudResult = await uploadToCloudinary({
                    uri:  editForm.profileImage,
                    name: `profile_passenger.${fileType}`,
                    type: `image/${fileType}`,
                });
                if (!cloudResult.secure_url) throw new Error('Error al subir imagen');
                profileImageUrl = cloudResult.secure_url;
            }

            await userService.updateProfile({
                name:         editForm.name,
                phone:        editForm.phone,
                email:        editForm.email,
                company:      editForm.company,
                profileImage: profileImageUrl,
            });

            await AsyncStorage.setItem('userName',    editForm.name);
            await AsyncStorage.setItem('userEmail',   editForm.email);
            await AsyncStorage.setItem('userPhone',   editForm.phone);
            await AsyncStorage.setItem('userCompany', editForm.company);
            if (profileImageUrl) await AsyncStorage.setItem('userPhoto', profileImageUrl);

            Alert.alert('¡Listo!', 'Perfil actualizado correctamente');
            closeModal();
            loadProfile();
        } catch (e) {
            console.error('Update error:', e);
            Alert.alert('Error', 'No se pudo actualizar el perfil.');
        } finally { setUpdating(false); }
    };

    const handleConfirmLogout = () => {
        logoutModal.close(async () => {
            const keys = await AsyncStorage.getAllKeys();
            await AsyncStorage.multiRemove(keys);
            navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
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
    const paymentLabel = PAYMENT_LABELS[paymentMethod] || 'No configurado';
    const paymentIcon  = PAYMENT_ICONS[paymentMethod]  || 'wallet-outline';

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
                <ScrollView {...si.scrollProps} contentContainerStyle={styles.scrollContent}>

                    {/* ── Hero card ── */}
                    <View style={[styles.heroCard, { backgroundColor: theme.surfaceVariant || '#16163A', borderColor: theme.cardBorder }]}>
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
                            <View style={[styles.onlineDot, {
                                backgroundColor: theme.accentAlt || '#00D4FF',
                                borderColor: theme.surfaceVariant || '#16163A'
                            }]} />
                        </View>

                        <Text style={[styles.heroName, { color: theme.text }]}>
                            {userData?.name || 'Pasajero'}
                        </Text>
                        <Text style={[styles.heroEmail, { color: theme.textSecondary }]}>
                            {userData?.email}
                        </Text>
                        <View style={[styles.roleBadge, { backgroundColor: theme.bg || '#0A0A18', borderColor: theme.cardBorder }]}>
                            <Ionicons name="person-outline" size={13} color={theme.accent} />
                            <Text style={[styles.roleText, { color: theme.accent }]}>Pasajero</Text>
                        </View>
                    </View>

                    {/* ── Información personal ── */}
                    <SectionHeader title="INFORMACIÓN PERSONAL" theme={theme} />
                    <InfoCard icon="person-outline"   label="Nombre completo"     value={userData?.name    || 'No registrado'} theme={theme} />
                    <InfoCard icon="mail-outline"     label="Correo electrónico"  value={userData?.email   || 'No registrado'} theme={theme} />
                    <InfoCard icon="call-outline"     label="Teléfono"            value={userData?.phone   || 'No registrado'} theme={theme} />
                    <InfoCard icon="business-outline" label="Empresa"             value={userData?.company || 'No registrada'} theme={theme} />

                    {/* ── Método de pago ── */}
                    <SectionHeader title="MÉTODO DE PAGO" theme={theme} />
                    <TouchableOpacity
                        onPress={() => navigation.navigate('PaymentMethod')}
                        activeOpacity={0.8}
                    >
                        <InfoCard
                            icon={paymentIcon}
                            label="Método favorito"
                            value={paymentLabel}
                            theme={theme}
                            showArrow
                        />
                    </TouchableOpacity>

                    {/* ── Acciones ── */}
                    <View style={styles.actionsWrapper}>
                        <TouchableOpacity
                            style={[styles.editBtn, { backgroundColor: theme.accent }]}
                            onPress={() => setModalVisible(true)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="create-outline" size={20} color="#FFF" />
                            <Text style={styles.editBtnText}>Actualizar Información</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.deleteBtn, { borderColor: theme.danger, backgroundColor: 'rgba(255,107,107,0.07)' }]}
                            onPress={logoutModal.open}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
                            <Text style={[styles.deleteBtnText, { color: theme.danger }]}>Cerrar Sesión</Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
                <ScrollIndicator si={si} thumbColor={theme.accent} />
            </View>

            {/* ── Modal Cerrar Sesión ── */}
            <Modal visible={logoutModal.visible} transparent animationType="none" statusBarTranslucent>
                <Animated.View style={[styles.logoutBackdrop, { opacity: logoutModal.backdropOpacity }]} />
                <View style={styles.logoutModalOuter} pointerEvents="box-none">
                    <Animated.View style={[
                        styles.logoutCard,
                        { backgroundColor: theme.surface, borderColor: theme.divider },
                        { opacity: logoutModal.cardOpacity, transform: [{ scale: logoutModal.cardScale }] },
                    ]}>
                        <View style={[styles.logoutIconCircle, { backgroundColor: theme.dark ? '#2A0A0A' : '#FFF0F0' }]}>
                            <Ionicons name="log-out-outline" size={34} color={theme.danger} />
                        </View>
                        <Text style={[styles.logoutModalTitle, { color: theme.text }]}>¿Cerrar sesión?</Text>
                        <Text style={[styles.logoutModalSubtitle, { color: theme.textSecondary }]}>
                            Tu sesión actual se cerrará y tendrás que volver a iniciar sesión para continuar.
                        </Text>
                        <View style={styles.logoutModalBtns}>
                            <TouchableOpacity
                                style={[styles.logoutBtnNo, { borderColor: theme.divider, backgroundColor: theme.surfaceVariant || '#16163A' }]}
                                activeOpacity={0.8}
                                onPress={() => logoutModal.close()}
                            >
                                <Text style={[styles.logoutBtnNoText, { color: theme.text }]}>No, quedarme</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.logoutBtnSi, { backgroundColor: theme.danger }]}
                                activeOpacity={0.8}
                                onPress={handleConfirmLogout}
                            >
                                <Text style={styles.logoutBtnSiText}>Sí, salir</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>

            {/* ── Modal de edición ── */}
            <Modal
                animationType="none" transparent
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <TouchableOpacity
                        style={StyleSheet.absoluteFillObject}
                        onPress={closeModal}
                        activeOpacity={1}
                    />
                    <Animated.View style={[styles.modalContent, { backgroundColor: theme.surface || '#111128', transform: [{ translateY }] }]}>
                        <View {...panResponder.panHandlers} style={styles.dragArea}>
                            <View style={[styles.handleBar, { backgroundColor: theme.divider }]} />
                        </View>

                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Editar Perfil</Text>
                            <TouchableOpacity
                                onPress={closeModal}
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
                                    <View style={[styles.modalAvatar, styles.avatarFallback, {
                                        borderColor: theme.accent,
                                        backgroundColor: theme.iconCircleBg || '#1C1C40'
                                    }]}>
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

                            <ModalInput label="NOMBRE COMPLETO"    icon="person-outline" value={editForm.name}    onChangeText={t => setEditForm(p => ({ ...p, name: t }))}    placeholder="Tu nombre"          theme={theme} />
                            <ModalInput label="CORREO ELECTRÓNICO" icon="mail-outline"   value={editForm.email}   onChangeText={t => setEditForm(p => ({ ...p, email: t }))}   placeholder="correo@empresa.com" keyboardType="email-address" theme={theme} />
                            <ModalInput label="TELÉFONO"           icon="call-outline"   value={editForm.phone}   onChangeText={t => setEditForm(p => ({ ...p, phone: t.replace(/[^0-9]/g, '') }))} placeholder="88888888" keyboardType="phone-pad" maxLength={8} theme={theme} />

                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Ionicons name="business-outline" size={14} color={theme.textSecondary} style={{ marginRight: 6 }} />
                                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>EMPRESA</Text>
                                </View>
                                <View style={[styles.pickerContainer, { borderColor: theme.divider, backgroundColor: theme.bg }]}>
                                    <Picker
                                        selectedValue={editForm.company}
                                        onValueChange={val => setEditForm(p => ({ ...p, company: val }))}
                                        style={{ color: theme.text }}
                                        dropdownIconColor={theme.accent}
                                    >
                                        <Picker.Item label="Selecciona una empresa" value="" />
                                        {COMPANIES.map(c => <Picker.Item key={c} label={c} value={c} />)}
                                    </Picker>
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
                    </Animated.View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
};

/* ── Sub-componentes ── */
const SectionHeader = ({ title, theme }) => (
    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
);

const InfoCard = ({ icon, label, value, theme, showArrow }) => (
    <View style={[styles.infoCard, { backgroundColor: theme.surfaceVariant || '#16163A', borderColor: theme.cardBorder }]}>
        <View style={[styles.infoIconCircle, { backgroundColor: theme.iconCircleBg || '#1C1C40' }]}>
            <Ionicons name={icon} size={20} color={theme.accent} />
        </View>
        <View style={styles.infoTexts}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
        </View>
        {showArrow && <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />}
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
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
    },
    headerIconBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontFamily: 'Poppins-Bold' },
    scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },

    heroCard: {
        alignItems: 'center', borderRadius: 24, borderWidth: 1,
        paddingVertical: 32, paddingHorizontal: 24, marginBottom: 28, elevation: 3,
    },
    avatarWrapper: { position: 'relative', marginBottom: 16 },
    avatar: {
        width: 120, height: 120, borderRadius: 60, borderWidth: 3,
        shadowColor: '#748FFF', shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.75, shadowRadius: 16, elevation: 10,
    },
    avatarFallback: { justifyContent: 'center', alignItems: 'center' },
    initials: { fontSize: 38, fontFamily: 'Poppins-Bold' },
    onlineDot: { position: 'absolute', bottom: 6, right: 6, width: 16, height: 16, borderRadius: 8, borderWidth: 2.5 },
    heroName:  { fontSize: 22, fontFamily: 'Poppins-Bold', marginBottom: 4 },
    heroEmail: { fontSize: 13, fontFamily: 'Poppins-Regular', marginBottom: 14 },
    roleBadge: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, gap: 6,
    },
    roleText: { fontSize: 12, fontFamily: 'Poppins-SemiBold' },

    sectionTitle: { fontSize: 11, fontFamily: 'Poppins-SemiBold', letterSpacing: 1.4, marginBottom: 10, marginLeft: 4 },

    infoCard: {
        flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1,
        paddingVertical: 16, paddingHorizontal: 16, marginBottom: 10, elevation: 2,
    },
    infoIconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    infoTexts: { flex: 1 },
    infoLabel: { fontSize: 11, fontFamily: 'Poppins-Regular', marginBottom: 2 },
    infoValue: { fontSize: 15, fontFamily: 'Poppins-SemiBold' },

    actionsWrapper: { marginTop: 18, gap: 12 },
    editBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        height: 56, borderRadius: 18, gap: 10, elevation: 5,
        shadowColor: '#748FFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
    },
    editBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins-SemiBold' },
    deleteBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        height: 56, borderRadius: 18, borderWidth: 1.5, gap: 10,
    },
    deleteBtnText: { fontSize: 15, fontFamily: 'Poppins-SemiBold' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingTop: 12, maxHeight: '92%' },
    logoutBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', opacity: 0.55 },
    logoutModalOuter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    logoutCard: {
        width: '100%', borderRadius: 24, borderWidth: 1, padding: 28, alignItems: 'center',
        elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2, shadowRadius: 20,
    },
    logoutIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
    logoutModalTitle:    { fontSize: 20, fontFamily: 'Poppins-Bold', marginBottom: 8, textAlign: 'center' },
    logoutModalSubtitle: { fontSize: 14, fontFamily: 'Poppins-Regular', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
    logoutModalBtns:     { flexDirection: 'row', gap: 12, width: '100%' },
    logoutBtnNo: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
    logoutBtnNoText: { fontSize: 14, fontFamily: 'Poppins-Bold' },
    logoutBtnSi: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    logoutBtnSiText: { fontSize: 14, fontFamily: 'Poppins-Bold', color: '#FFF' },

    dragArea: { paddingVertical: 10, alignItems: 'center' },
    handleBar: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
    modalTitle: { fontSize: 20, fontFamily: 'Poppins-Bold' },
    closeBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
    modalAvatarContainer: { alignSelf: 'center', marginBottom: 6, position: 'relative' },
    modalAvatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3 },
    cameraBadge: {
        position: 'absolute', bottom: 2, right: 2,
        width: 30, height: 30, borderRadius: 15,
        justifyContent: 'center', alignItems: 'center', borderWidth: 2,
    },
    photoHint: { textAlign: 'center', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 22 },
    inputGroup: { marginBottom: 18 },
    labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 2 },
    inputLabel: { fontSize: 11, fontFamily: 'Poppins-SemiBold', letterSpacing: 0.8 },
    input: { height: 50, borderRadius: 13, borderWidth: 1, paddingHorizontal: 16, fontSize: 15, fontFamily: 'Poppins-Regular' },
    pickerContainer: { borderRadius: 13, borderWidth: 1, height: 50, justifyContent: 'center', overflow: 'hidden' },
    saveBtn: {
        height: 54, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        marginTop: 8, marginBottom: 24, elevation: 4,
        shadowColor: '#748FFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10,
    },
    saveBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins-SemiBold' },
});

export default PasajeroProfileScreen;
