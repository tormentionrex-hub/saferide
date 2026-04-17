import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView,
    Image, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView,
    Platform, PanResponder, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';

import { useDriverTheme } from '../../context/DriverThemeContext';
import { useCustomAlert } from '../../context/CustomAlertContext';
import { uploadToCloudinary } from '../../Cloudinary/Cloudinary';
import { userService } from '../../services/userService';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import StarRating from '../../components/StarRating';

const COMPANIES = [
    'Intel', 'Cargill', 'Deloitte', 'Citi', 'Experian',
    '3M', 'DHL', 'Bill Gosling Outsourcing (BGO)',
    'WeWork Costa Rica', 'Concentrix', 'Nestlé Costa Rica'
];

const PAYMENT_LABELS = { efectivo: 'Efectivo', sinpe: 'SINPE Móvil', tarjeta: 'Tarjeta' };
const PAYMENT_ICONS  = { efectivo: 'cash-outline', sinpe: 'phone-portrait-outline', tarjeta: 'card-outline' };

// ── Burbujas y colores por modo ───────────────────────────────────────────────
const BUBBLES_LIGHT = ['#4F8EF7','#34D399','#F59E0B','#EC4899','#8B5CF6','#06B6D4','#F97316','#10B981'];
const BUBBLES_DARK  = ['#818CF8','#A78BFA','#C084FC','#F472B6','#38BDF8','#34D399','#FB923C','#FBBF24'];

// ── Hook sweet-alert con explosión de burbujas ────────────────────────────────
const useSuccessAlert = () => {
    const [visible, setVisible] = useState(false);
    const cardScale   = useRef(new Animated.Value(0)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;
    const checkScale  = useRef(new Animated.Value(0)).current;
    const bubbles     = useRef(
        Array.from({ length: 8 }, () => ({
            scale:  new Animated.Value(0),
            transX: new Animated.Value(0),
            transY: new Animated.Value(0),
            opacity: new Animated.Value(1),
        }))
    ).current;

    const show = () => {
        // Reset
        cardScale.setValue(0); cardOpacity.setValue(0); checkScale.setValue(0);
        bubbles.forEach(b => { b.scale.setValue(0); b.transX.setValue(0); b.transY.setValue(0); b.opacity.setValue(1); });
        setVisible(true);

        // 1) Tarjeta entra con spring
        Animated.parallel([
            Animated.spring(cardScale,   { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }),
            Animated.timing(cardOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();

        // 2) Check pop (delay 120ms)
        setTimeout(() => {
            Animated.spring(checkScale, { toValue: 1, friction: 4, tension: 220, useNativeDriver: true }).start();
        }, 120);

        // 3) Explosión de burbujas (delay 60ms)
        setTimeout(() => {
            bubbles.forEach((b, i) => {
                const angle    = (i / 8) * Math.PI * 2;
                const dist     = 70 + (i % 3) * 20;
                Animated.parallel([
                    Animated.spring(b.scale,  { toValue: 1, friction: 6, tension: 180, useNativeDriver: true }),
                    Animated.timing(b.transX, { toValue: Math.cos(angle) * dist, duration: 500, useNativeDriver: true }),
                    Animated.timing(b.transY, { toValue: Math.sin(angle) * dist, duration: 500, useNativeDriver: true }),
                    Animated.timing(b.opacity,{ toValue: 0, duration: 500, delay: 120, useNativeDriver: true }),
                ]).start();
            });
        }, 60);

        // 4) Salida de la tarjeta a los 1750ms → todo termina ~2s
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(cardScale,   { toValue: 0.8, duration: 250, useNativeDriver: true }),
                Animated.timing(cardOpacity, { toValue: 0,   duration: 250, useNativeDriver: true }),
            ]).start(() => setVisible(false));
        }, 1750);
    };

    return { visible, show, cardScale, cardOpacity, checkScale, bubbles };
};

// ── Componente visual del sweet-alert ────────────────────────────────────────
const SuccessAlert = ({ hook, isDark }) => {
    const colors = isDark ? BUBBLES_DARK : BUBBLES_LIGHT;
    const cardBg = isDark ? '#1E1B4B' : '#FFFFFF';
    const checkBg = isDark ? '#6D28D9' : '#10B981';
    const titleColor = isDark ? '#E0E7FF' : '#111827';
    const subColor   = isDark ? '#A5B4FC' : '#6B7280';

    if (!hook.visible) return null;

    return (
        <Modal transparent animationType="none" visible={hook.visible} statusBarTranslucent>
            <View style={saStyles.overlay} pointerEvents="none">
                {/* Burbujas */}
                {hook.bubbles.map((b, i) => (
                    <Animated.View
                        key={i}
                        style={[
                            saStyles.bubble,
                            {
                                backgroundColor: colors[i],
                                width:  10 + (i % 3) * 5,
                                height: 10 + (i % 3) * 5,
                                borderRadius: 10,
                                opacity: b.opacity,
                                transform: [
                                    { scale: b.scale },
                                    { translateX: b.transX },
                                    { translateY: b.transY },
                                ],
                            },
                        ]}
                    />
                ))}

                {/* Tarjeta central */}
                <Animated.View
                    style={[
                        saStyles.card,
                        {
                            backgroundColor: cardBg,
                            opacity: hook.cardOpacity,
                            transform: [{ scale: hook.cardScale }],
                            shadowColor: isDark ? '#6D28D9' : '#000',
                        },
                    ]}
                >
                    {/* Círculo check */}
                    <Animated.View style={[saStyles.checkCircle, { backgroundColor: checkBg, transform: [{ scale: hook.checkScale }] }]}>
                        <Ionicons name="checkmark" size={34} color="#fff" />
                    </Animated.View>
                    <Text style={[saStyles.title, { color: titleColor }]}>¡Listo!</Text>
                    <Text style={[saStyles.sub, { color: subColor }]}>Perfil actualizado</Text>
                </Animated.View>
            </View>
        </Modal>
    );
};

const saStyles = StyleSheet.create({
    overlay: {
        flex: 1, justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    bubble: { position: 'absolute' },
    card: {
        alignItems: 'center', paddingVertical: 36, paddingHorizontal: 48,
        borderRadius: 28, elevation: 20,
        shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20,
    },
    checkCircle: {
        width: 72, height: 72, borderRadius: 36,
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    title: { fontSize: 22, fontFamily: 'Poppins-Bold', marginBottom: 4 },
    sub:   { fontSize: 14, fontFamily: 'Poppins-Regular' },
});

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
    const logoutModal  = useLogoutModal();
    const successAlert = useSuccessAlert();
    const { showAlert } = useCustomAlert();

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

            // 1. Validar que al menos algo haya cambiado
            const hasChanges = 
                editForm.name !== userData.name || 
                editForm.phone !== userData.phone || 
                editForm.company !== userData.company || 
                (editForm.profileImage !== userData.profileImage && editForm.profileImage !== null);

            if (!hasChanges) {
                showAlert('No hay cambios', 'No has realizado ningún cambio para actualizar.', 'warning');
                setUpdating(false);
                return;
            }

            // 2. Validar campos obligatorios
            if (!editForm.name.trim() || !editForm.phone.trim() || !editForm.company.trim()) {
                showAlert('Datos incompletos', 'Todos los campos son obligatorios.', 'warning');
                setUpdating(false);
                return;
            }

            // 3. Validar formato de nombre
            if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ ]+$/.test(editForm.name.trim())) {
                showAlert('Formato Inválido', 'El nombre solo puede contener letras y espacios.', 'error');
                setUpdating(false);
                return;
            }

            // 4. Validar formato de teléfono
            if (!/^\d{8}$/.test(editForm.phone)) {
                showAlert('Formato Inválido', 'El teléfono debe tener exactamente 8 dígitos.', 'error');
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

            closeModal();
            loadProfile();
            setTimeout(() => successAlert.show(), 320);
        } catch (e) {
            console.error('Update error:', e);
            showAlert('Error', 'No se pudo actualizar el perfil.', 'error');
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
                            <Text style={styles.editBtnText}>Editar perfil</Text>
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
                    <Animated.View style={[styles.modalContent, { backgroundColor: theme.surface || '#111128', borderColor: theme.divider, transform: [{ translateY }] }]}>
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
                            <ModalInput label="CORREO ELECTRÓNICO" icon="mail-outline" value={editForm.email} placeholder="correo@empresa.com" keyboardType="email-address" theme={theme} editable={false} locked />
                            <ModalInput label="TELÉFONO"           icon="call-outline"   value={editForm.phone}   onChangeText={t => setEditForm(p => ({ ...p, phone: t.replace(/[^0-9]/g, '') }))} placeholder="88888888" keyboardType="phone-pad" maxLength={8} theme={theme} />

                            <CustomSelect 
                                label="EMPRESA" 
                                icon="business-outline" 
                                value={editForm.company}
                                options={COMPANIES}
                                onValueChange={val => setEditForm(p => ({ ...p, company: val }))}
                                theme={theme}
                                placeholder="Selecciona una empresa"
                            />

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

            {/* ── Sweet Alert: éxito con burbujas ── */}
            <SuccessAlert hook={successAlert} isDark={theme.dark} />

        </SafeAreaView>
    );
};

/* ── Sub-componentes ── */

const CustomSelect = ({ label, icon, value, options, onValueChange, theme, placeholder = "Selecciona..." }) => {
    const [visible, setVisible] = useState(false);

    return (
        <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
                <Ionicons name={icon} size={22} color={theme.textSecondary} style={{ marginRight: 6 }} />
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{label}</Text>
            </View>
            
            <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setVisible(true)}
                style={[styles.pickerContainer, { borderColor: theme.divider, backgroundColor: theme.bg }]}
            >
                <Text style={{ color: value ? theme.text : theme.textSecondary, fontSize: 15, fontFamily: 'Poppins-Regular' }}>
                    {value || placeholder}
                </Text>
                <Ionicons name="chevron-down" size={18} color={theme.accent} />
            </TouchableOpacity>

            <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
                <TouchableOpacity 
                    style={styles.selectOverlay} 
                    activeOpacity={1} 
                    onPress={() => setVisible(false)}
                >
                    <View style={[styles.selectBox, { backgroundColor: theme.surface || '#111128', borderColor: theme.divider }]}>
                        <View style={[styles.handleBar, { backgroundColor: theme.divider, marginBottom: 16 }]} />
                        <Text style={[styles.selectTitle, { color: theme.text }]}>{label}</Text>
                        
                        <ScrollView 
                            showsVerticalScrollIndicator={false} 
                            style={{ height: 350 }}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        >
                            {options && options.length > 0 ? options.map((opt, i) => (
                                <TouchableOpacity 
                                    key={i}
                                    style={[
                                        styles.selectOption, 
                                        i < options.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.divider }
                                    ]}
                                    activeOpacity={0.6}
                                    onPress={() => {
                                        onValueChange(opt);
                                        setVisible(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.selectOptionText, 
                                        { color: theme.text || '#FFFFFF' }, 
                                        value === opt && { color: theme.accent, fontFamily: 'Poppins-Bold' }
                                    ]}>
                                        {opt}
                                    </Text>
                                    {value === opt && <Ionicons name="checkmark-circle" size={20} color={theme.accent} />}
                                </TouchableOpacity>
                            )) : (
                                <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>No hay opciones disponibles</Text>
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

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

const ModalInput = ({ label, icon, theme, locked, ...props }) => (
    <View style={styles.inputGroup}>
        <View style={styles.labelRow}>
            <Ionicons name={icon} size={14} color={locked ? theme.textSecondary : theme.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{label}</Text>
            {locked && (
                <View style={[styles.lockedBadge, { backgroundColor: theme.iconCircleBg || '#1C1C40' }]}>
                    <Ionicons name="lock-closed" size={10} color={theme.textSecondary} style={{ marginRight: 3 }} />
                    <Text style={[styles.lockedBadgeText, { color: theme.textSecondary }]}>No editable</Text>
                </View>
            )}
        </View>
        <TextInput
            style={[
                styles.input,
                { color: locked ? theme.textSecondary : theme.text, borderColor: theme.divider, backgroundColor: theme.bg },
                locked && { opacity: 0.5 },
            ]}
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

    modalOverlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.65)', 
        justifyContent: 'flex-end',
    },

    modalContent: { 
        borderTopLeftRadius: 32, 
        borderTopRightRadius: 32, 
        padding: 24, 
        paddingTop: 12, 
        maxHeight: '92%',
        borderWidth: 1.5,
        borderBottomWidth: 0,
    },

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

    photoHint: {
        textAlign: 'center', 
        fontSize: 12,
        fontFamily: 'Poppins-Regular', 
        marginBottom: 22,
    },
    
    inputGroup: { 
        marginBottom: 18 
    },
    
    labelRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginBottom: 8, 
        marginLeft: 2 
    },
    
    inputLabel: { 
        fontSize: 11, 
        fontFamily: 'Poppins-SemiBold', 
        letterSpacing: 0.8 
    },

    lockedBadge: {
        flexDirection: 'row', 
        alignItems: 'center', 
        marginLeft: 8, 
        paddingHorizontal: 7, 
        paddingVertical: 2, 
        borderRadius: 6
    },

    lockedBadgeText: {
        fontSize: 10, 
        fontFamily: 'Poppins-Regular'
    },
    
    input: {
        height: 52, 
        borderRadius: 15, 
        borderWidth: 1.5,
        paddingHorizontal: 16, 
        fontSize: 15, 
        fontFamily: 'Poppins-Regular',
    },
    
    pickerContainer: {
        borderRadius: 15, 
        borderWidth: 1.5,
        height: 52, 
        justifyContent: 'space-between', 
        overflow: 'hidden',
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16,
    },
    
    selectOverlay: {
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.4)', 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: 24
    },
    
    selectBox: {
        width: '100%', 
        borderRadius: 24, 
        padding: 20, 
        borderWidth: 2,
        elevation: 10, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 10 }, 
        shadowOpacity: 0.3, 
        shadowRadius: 15
    },
    
    selectTitle: { 
        fontSize: 16, 
        fontFamily: 'Poppins-Bold', 
        marginBottom: 16, 
        textAlign: 'center' 
    },
    
    selectOption: {
        paddingVertical: 15, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center'
    },
    
    selectOptionText: { 
        fontSize: 15, 
        fontFamily: 'Poppins-Regular' 
    },

    saveBtn: {
        height: 54, 
        borderRadius: 16, 
        flexDirection: 'row', 
        justifyContent: 'center', 
        alignItems: 'center',
        marginTop: 8, 
        marginBottom: 24, 
        elevation: 4,
        shadowColor: '#748FFF', 
        shadowOffset: { width: 0, height: 4 }, 
        shadowOpacity: 0.35, 
        shadowRadius: 10,
    },
    
    saveBtnText: { 
        color: '#FFF', 
        fontSize: 16, 
        fontFamily: 'Poppins-SemiBold' 
    },
});

export default PasajeroProfileScreen;
