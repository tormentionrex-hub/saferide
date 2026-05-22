import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    TextInput, StatusBar, ActivityIndicator,
    Platform, ScrollView, Animated, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import api from '../../services/api';
import sessionCache from '../../services/sessionCache';
import { uploadToCloudinary } from '../../Cloudinary/Cloudinary';
import CustomAlert from '../../components/CustomAlert';

export default function RegisterVehicleStep2({ route, navigation }) {
    const { theme } = useDriverTheme();
    const si = useScrollIndicator();
    const vehicleData = route.params;

    const [certName, setCertName]         = useState('');
    const [certUri, setCertUri]           = useState(null);
    const [policyNumber, setPolicyNumber] = useState('');
    const [expDate, setExpDate]           = useState(null);
    const [showPicker, setShowPicker]     = useState(false);
    const [loading, setLoading]           = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [fieldAlert, setFieldAlert] = useState({ visible: false, title: '', message: '', type: 'warning' });

    // ── Animated progress (50 → 100) ──
    const progressAnim = useRef(new Animated.Value(50)).current;
    const [displayPct, setDisplayPct] = useState(50);

    useEffect(() => {
        const filled = [
            !!certName,
            !!policyNumber.trim(),
            !!expDate,
        ].filter(Boolean).length;

        const target = 50 + (filled / 3) * 50;

        Animated.timing(progressAnim, {
            toValue: target,
            duration: 450,
            useNativeDriver: false,
        }).start();

        const id = progressAnim.addListener(({ value }) => setDisplayPct(Math.round(value)));
        return () => progressAnim.removeListener(id);
    }, [certName, policyNumber, expDate]);

    const barWidth = progressAnim.interpolate({
        inputRange: [50, 100],
        outputRange: ['50%', '100%'],
    });

    const pickCertificate = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            setFieldAlert({ visible: true, title: 'Permiso requerido', message: 'Necesitamos acceso a tu galería para cargar el certificado.', type: 'warning' });
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });
        if (!result.canceled && result.assets.length > 0) {
            const asset = result.assets[0];
            const parts = asset.uri.split('/');
            setCertName(parts[parts.length - 1]);
            setCertUri(asset.uri);
        }
    };

    const handleFinish = async () => {
        if (!certUri) {
            setFieldAlert({ visible: true, title: 'Certificado requerido', message: 'Debes subir el certificado de seguro del vehículo antes de continuar.', type: 'warning' });
            return;
        }

        if (!policyNumber.trim()) {
            setFieldAlert({ visible: true, title: 'Número de póliza requerido', message: 'Ingresa el número de póliza de tu seguro.', type: 'warning' });
            return;
        }

        if (policyNumber.trim().length < 8 || policyNumber.trim().length > 12) {
            setFieldAlert({ visible: true, title: 'Póliza inválida', message: 'El número de póliza debe tener entre 8 y 12 caracteres.', type: 'warning' });
            return;
        }

        if (!expDate) {
            setFieldAlert({ visible: true, title: 'Fecha requerida', message: 'Selecciona la fecha de vencimiento de la póliza.', type: 'warning' });
            return;
        }
        setLoading(true);
        try {
            // Upload certificate to Cloudinary if one was selected
            let insuranceUrl = null;
            if (certUri) {
                const ext = certUri.split('.').pop() || 'jpg';
                const cloudResult = await uploadToCloudinary({
                    uri:  certUri,
                    name: `insurance_cert_${Date.now()}.${ext}`,
                    type: `image/${ext}`,
                });
                if (!cloudResult.secure_url) {
                    throw new Error(cloudResult.error?.message || 'Error al subir el certificado a Cloudinary');
                }
                insuranceUrl = cloudResult.secure_url;
            }

            const res = await api.post('/vehicles', {
                brand:                 vehicleData.brand,
                model:                 vehicleData.model,
                license_plate:         vehicleData.plate,
                color:                 vehicleData.color,
                year:                  vehicleData.year,
                capacity:              vehicleData.capacity,
                policy_number:         policyNumber.trim(),
                insurance_expiry:      expDate.toISOString(),
                ...(insuranceUrl && { insurance_certificate: insuranceUrl }),
            });
            if (res.data.success) {
                sessionCache.clearVehicleStatus();
                setShowSuccessModal(true);
            } else {
                setFieldAlert({ visible: true, title: 'Error', message: res.data.message || 'No se pudo registrar el vehículo.', type: 'error' });
            }
        } catch (e) {
            setFieldAlert({ visible: true, title: 'Error', message: e.response?.data?.message || e.message || 'Ocurrió un error al registrar.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const surfBg = theme.bg;
    const cardBg = theme.surfaceVariant;
    const border = theme.dark ? theme.border : 'rgba(75,104,255,0.15)';

    const formatDate = (d) => d
        ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
        : 'dd/mm/aaaa';

    return (
        <>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: surfBg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={surfBg} />

            <View style={[styles.mainContainer, { backgroundColor: surfBg }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: theme.divider }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.innerTitle, { color: theme.text }]}>Registro de Vehículo</Text>
                </View>

                <View style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false} {...si.scrollProps}>

                        {/* Progress */}
                        <View style={styles.progressRow}>
                            <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>PASO 2 DE 2</Text>
                            <Text style={[styles.pct, { color: theme.accent }]}>{displayPct}%</Text>
                        </View>
                        <View style={[styles.progressTrack, { backgroundColor: theme.dark ? '#22224A' : '#E8EAFF' }]}>
                            <Animated.View style={[styles.progressFill, { width: barWidth, backgroundColor: theme.accent }]} />
                        </View>

                        {/* Título */}
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Póliza de Seguro</Text>
                        <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                            Complete la información de cobertura para finalizar el registro del vehículo.
                        </Text>

                        {/* Upload certificado */}
                        <Text style={[styles.label, { color: theme.textSecondary }]}>CERTIFICADO DE SEGURO</Text>
                        <TouchableOpacity
                            style={[styles.uploadArea, { backgroundColor: cardBg, borderColor: border }]}
                            onPress={pickCertificate}
                            activeOpacity={0.8}
                        >
                            {certName ? (
                                <View style={styles.uploadedRow}>
                                    <View style={[styles.fileIconBox, { backgroundColor: theme.dark ? '#252560' : '#E0E7FF' }]}>
                                        <Ionicons name="document-text" size={20} color={theme.accent} />
                                    </View>
                                    <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>{certName}</Text>
                                    <Ionicons name="checkmark-circle" size={18} color="#27AE60" />
                                </View>
                            ) : (
                                <View style={styles.uploadPlaceholder}>
                                    <View style={[styles.uploadIconBox, { backgroundColor: theme.dark ? '#252560' : '#E0E7FF' }]}>
                                        <Ionicons name="cloud-upload-outline" size={26} color={theme.accent} />
                                    </View>
                                    <Text style={[styles.uploadText, { color: theme.accent }]}>Toca para cargar el archivo</Text>
                                    <Text style={[styles.uploadHint, { color: theme.textSecondary }]}>PDF, PNG o JPG (MÁX. 5MB)</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Número de póliza */}
                        <Text style={[styles.label, { color: theme.textSecondary }]}>NÚMERO DE PÓLIZA</Text>
                        <View style={[styles.inputRow, { backgroundColor: cardBg, borderColor: border }]}>
                            <TextInput
                                style={[styles.inputInner, { color: theme.text }]}
                                placeholder="Ej: POL-99283-X"
                                placeholderTextColor={theme.textSecondary}
                                value={policyNumber}
                                onChangeText={setPolicyNumber}
                                autoCapitalize="characters"
                                maxLength={12} // Limitar input a máximo 12 caracteres (estándar)
                            />
                            <Ionicons name="document-outline" size={16} color={theme.textSecondary} />
                        </View>

                        {/* Fecha de vencimiento */}
                        <Text style={[styles.label, { color: theme.textSecondary }]}>FECHA DE VENCIMIENTO</Text>
                        <TouchableOpacity
                            style={[styles.inputRow, { backgroundColor: cardBg, borderColor: border }]}
                            onPress={() => setShowPicker(true)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.inputInner, { color: expDate ? theme.text : theme.textSecondary, paddingVertical: 13 }]}>
                                {formatDate(expDate)}
                            </Text>
                            <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>

                        {showPicker && (
                            <DateTimePicker
                                value={expDate || new Date()}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                minimumDate={new Date()}
                                onChange={(_, selected) => {
                                    setShowPicker(false);
                                    if (selected) setExpDate(selected);
                                }}
                            />
                        )}

                        {/* Info box */}
                        <View style={[styles.infoBox, { backgroundColor: cardBg, borderColor: border }]}>
                            <View style={[styles.infoIconBox, { backgroundColor: theme.dark ? '#252560' : '#E0E7FF' }]}>
                                <Ionicons name="shield-checkmark" size={18} color={theme.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.infoTitle, { color: theme.text }]}>Validación de Identidad</Text>
                                <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                                    El número de placa debe coincidir con el certificado para evitar el rechazo automático.
                                </Text>
                            </View>
                        </View>

                        {/* Botón finalizar */}
                        <TouchableOpacity
                            style={[styles.finishBtn, { backgroundColor: loading ? theme.textSecondary : theme.accent }]}
                            onPress={handleFinish}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.finishBtnText}>Finalizar Registro</Text>
                                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TouchableOpacity>

                    </ScrollView>
                    <ScrollIndicator si={si} thumbColor={theme.accent} />
                </View>

                {/* ── MODAL ÉXITO REGISTRO ── */}
                <Modal
                    visible={showSuccessModal}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                >
                    <View style={styles.backdrop}>
                        <View style={[styles.card, {
                            backgroundColor: theme.dark ? '#111128' : '#FFFFFF',
                            borderColor: theme.dark ? 'rgba(116,143,255,0.25)' : 'rgba(75,104,255,0.15)',
                        }]}>

                            {/* Glow ring + icon */}
                            <View style={[styles.iconWrapper, {
                                backgroundColor: theme.dark ? '#1C1C40' : '#EEF2FF',
                                shadowColor: theme.accent,
                            }]}>
                                <View style={[styles.iconInner, {
                                    backgroundColor: theme.dark ? '#252560' : '#E0E7FF',
                                }]}>
                                    <Ionicons name="car-sport" size={42} color={theme.accent} />
                                    <View style={[styles.checkBadge, { backgroundColor: theme.dark ? '#0A0A18' : '#fff' }]}>
                                        <Ionicons name="checkmark-circle" size={18} color="#27AE60" />
                                    </View>
                                </View>
                            </View>

                            {/* Texto */}
                            <Text style={[styles.modalTitle, { color: theme.dark ? '#EEEEFF' : '#1C1C1E' }]}>
                                ¡Registro Exitoso!
                            </Text>
                            <Text style={[styles.modalSubtitle, { color: theme.dark ? '#7A7A9D' : '#6B7280' }]}>
                                Tu vehículo ha sido registrado correctamente y ya puedes empezar a compartir viajes.
                            </Text>

                            {/* Separador */}
                            <View style={[styles.modalDivider, {
                                backgroundColor: theme.dark ? 'rgba(116,143,255,0.15)' : 'rgba(75,104,255,0.1)'
                            }]} />

                            {/* Botón principal */}
                            <TouchableOpacity
                                style={[styles.modalPrimaryBtn, { backgroundColor: theme.accent }]}
                                activeOpacity={0.85}
                                onPress={() => {
                                    setShowSuccessModal(false);
                                    navigation.reset({
                                        index: 0,
                                        routes: [
                                            { name: 'MainTabsDriver' },
                                        ],
                                    });
                                }}
                            >
                                <Text style={styles.modalPrimaryBtnText}>Finalizar</Text>
                                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                            </TouchableOpacity>

                        </View>
                    </View>
                </Modal>
            </View>
        </SafeAreaView>

        {/* ── CUSTOM ALERT: VALIDACIONES Y ERRORES ── */}
        <CustomAlert
            visible={fieldAlert.visible}
            title={fieldAlert.title}
            message={fieldAlert.message}
            type={fieldAlert.type}
            confirmText="Entendido"
            onClose={() => setFieldAlert(f => ({ ...f, visible: false }))}
        />
        </>
    );
}

const styles = StyleSheet.create({
    safeArea:      { flex: 1 },
    mainContainer: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 20, borderBottomWidth: 1,
    },
    backBtn:    { position: 'absolute', left: 20 },
    innerTitle: { fontSize: 22, fontFamily: 'Poppins-Bold' },
    scrollBody: { padding: 20, paddingBottom: 100 },

    progressRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    stepLabel:    { fontSize: 11, fontFamily: 'Poppins-Bold', letterSpacing: 0.8 },
    pct:          { fontSize: 13, fontFamily: 'Poppins-Bold' },
    progressTrack:{ height: 5, borderRadius: 3, marginBottom: 20, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },

    sectionTitle: { fontSize: 20, fontFamily: 'Poppins-Bold', marginBottom: 6 },
    sectionSub:   { fontSize: 12, lineHeight: 18, marginBottom: 20 },

    label:    { fontSize: 11, fontFamily: 'Poppins-Bold', letterSpacing: 0.8, marginBottom: 5 },

    uploadArea:       { borderWidth: 1, borderRadius: 14, marginBottom: 16, overflow: 'hidden' },
    uploadPlaceholder:{ alignItems: 'center', paddingVertical: 22, paddingHorizontal: 20 },
    uploadIconBox:    { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    uploadText:       { fontSize: 12, fontFamily: 'Poppins-SemiBold', textAlign: 'center', marginBottom: 3 },
    uploadHint:       { fontSize: 10, textAlign: 'center' },
    uploadedRow:      { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
    fileIconBox:      { width: 38, height: 38, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    fileName:         { flex: 1, fontSize: 12, fontFamily: 'Poppins-SemiBold' },

    inputRow:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16 },
    inputInner: { flex: 1, fontSize: 14, paddingVertical: 13, color: '#fff' },

    infoBox:    { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 24 },
    infoIconBox:{ width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    infoTitle:  { fontSize: 12, fontFamily: 'Poppins-Bold', marginBottom: 3 },
    infoText:   { fontSize: 11, lineHeight: 16 },

    finishBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 14, elevation: 4, shadowColor: '#748FFF', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8 },
    finishBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Poppins-Bold' },

    // ── MODAL SUCCESS ──
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.72)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    card: {
        width: '100%',
        borderRadius: 28,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        elevation: 20,
        shadowColor: '#748FFF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    iconWrapper: {
        width: 110,
        height: 110,
        borderRadius: 55,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        elevation: 10,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
    },
    iconInner: {
        width: 84,
        height: 84,
        borderRadius: 42,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
    },
    modalTitle: {
        fontSize: 22,
        fontFamily: 'Poppins-Bold',
        marginBottom: 10,
        letterSpacing: 0.3,
    },
    modalSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 21,
        paddingHorizontal: 8,
    },
    modalDivider: {
        width: '100%',
        height: 1,
        marginVertical: 24,
    },
    modalPrimaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        elevation: 6,
        shadowColor: '#748FFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
    modalPrimaryBtnText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Poppins-Bold',
        letterSpacing: 0.3,
    },
});
