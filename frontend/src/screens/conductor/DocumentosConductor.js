import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput, StatusBar,
    ActivityIndicator, Platform, ScrollView, Modal, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScreenHeader from '../../components/ScreenHeader';
import CustomAlert from '../../components/CustomAlert';
import api from '../../services/api';
import sessionCache from '../../services/sessionCache';
import { uploadToCloudinary } from '../../Cloudinary/Cloudinary';
import { moderateScale } from '../../utils/responsive';
import { DOCUMENT_FORMS, STATUS_INFO, buildInitialValues, validateDocumentForm, countApproved } from '../../utils/driverDocuments';

const GREEN = '#27AE60';
const AMBER = '#D97706';

const formatDate = (iso) => {
    if (!iso) return 'dd/mm/aaaa';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'dd/mm/aaaa';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export default function DocumentosConductor({ navigation }) {
    const { theme } = useDriverTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState(null);       // { vehicle, approved, details }
    const [driverName, setDriverName] = useState('');
    const [loadError, setLoadError] = useState('');

    // Formulario del documento abierto
    const [openType, setOpenType] = useState(null);
    const [values, setValues] = useState({});
    const [image, setImage] = useState(null);      // { uri, name }
    const [showPickerFor, setShowPickerFor] = useState(null);
    const [sending, setSending] = useState(false);
    const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'warning' });

    const border = theme.dark ? theme.border : 'rgba(75,104,255,0.15)';
    const softAccent = theme.dark ? '#252560' : '#E0E7FF';

    const load = useCallback(async () => {
        setLoadError('');
        try {
            const [approvalRes, meRes] = await Promise.all([
                api.get('/vehicles/me/approval'),
                driverName ? Promise.resolve(null) : api.get('/auth/me').catch(() => null),
            ]);
            setData(approvalRes.data?.data || null);
            const name = meRes?.data?.data?.name;
            if (name) setDriverName(name);
        } catch (e) {
            setLoadError(e.response?.data?.message || 'No se pudo cargar el estado de tus documentos. Revisa tu conexión.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [driverName]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const details = data?.details || [];
    const approvedCount = countApproved(details);
    const vehicle = data?.vehicle || null;
    const cedulaNumber = details.find((d) => d.type === 'cedula')?.extractedData?.documentNumber || '';

    const openForm = (detail) => {
        if (detail.approved) return;
        setValues(buildInitialValues(detail.type, {
            driverName,
            vehicle,
            cedulaNumber,
            previous: detail.extractedData,
        }));
        setImage(null);
        setOpenType(detail.type);
    };

    const closeForm = () => {
        if (sending) return;
        setOpenType(null);
        setShowPickerFor(null);
    };

    const pickImage = async (fromCamera) => {
        const perm = fromCamera
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') {
            setAlert({ visible: true, title: 'Permiso requerido', message: fromCamera ? 'Necesitamos acceso a la cámara para fotografiar el documento.' : 'Necesitamos acceso a tu galería para cargar el documento.', type: 'warning' });
            return;
        }
        const options = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 };
        const result = fromCamera
            ? await ImagePicker.launchCameraAsync(options)
            : await ImagePicker.launchImageLibraryAsync(options);
        if (!result.canceled && result.assets?.length > 0) {
            const asset = result.assets[0];
            const parts = String(asset.fileName || asset.uri).split('/');
            setImage({ uri: asset.uri, name: parts[parts.length - 1] || 'documento.jpg', mimeType: asset.mimeType });
        }
    };

    const submit = async () => {
        const form = DOCUMENT_FORMS[openType];
        const error = validateDocumentForm(openType, values, !!image);
        if (error) {
            setAlert({ visible: true, title: 'Revisa el formulario', message: error, type: 'warning' });
            return;
        }
        setSending(true);
        try {
            const mime = image.mimeType || 'image/jpeg';
            const ext = mime.split('/')[1] || 'jpg';
            const cloud = await uploadToCloudinary({
                uri: image.uri,
                name: `doc_${openType}_${Date.now()}.${ext}`,
                type: mime,
            });
            if (!cloud?.secure_url) throw new Error('No se pudo subir la foto del documento.');

            const extractedData = {};
            for (const field of form.fields) {
                const v = values[field.key];
                if (v !== undefined && v !== null && String(v).trim() !== '') extractedData[field.key] = String(v).trim();
            }
            const res = await api.post(`/vehicles/${vehicle._id}/documents/url`, {
                type: openType,
                fileUrl: cloud.secure_url,
                extractedData,
            });
            const status = res.data?.data?.status;
            const info = STATUS_INFO[status] || STATUS_INFO.pending;
            sessionCache.clearVehicleStatus();
            setOpenType(null);
            await load();
            setAlert({
                visible: true,
                title: status === 'approved' ? 'Documento aprobado' : 'Documento enviado',
                message: status === 'approved'
                    ? `Aprobado: ${form.label}.${res.data?.approval?.approved ? ' Tus 6 documentos están aprobados: tu vehículo ya está activo.' : ''}`
                    : `${form.label}: ${info.label.toLowerCase()}. ${res.data?.data?.rejectionReason ? `Motivo: ${res.data.data.rejectionReason}` : 'Un administrador lo revisará.'}`,
                type: status === 'rejected' ? 'error' : 'success',
            });
        } catch (e) {
            setAlert({ visible: true, title: 'No se pudo enviar', message: e.response?.data?.message || e.message || 'Ocurrió un error al enviar el documento.', type: 'error' });
        } finally {
            setSending(false);
        }
    };

    const statusColor = useCallback((status) => {
        if (status === 'approved') return GREEN;
        if (status === 'rejected') return theme.danger;
        if (status === 'missing') return theme.textSecondary;
        return AMBER;
    }, [theme]);

    const progressPct = useMemo(() => `${Math.round((approvedCount / 6) * 100)}%`, [approvedCount]);
    const form = openType ? DOCUMENT_FORMS[openType] : null;

    return (
        <>
            <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
                <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
                <ScreenHeader title="Mis documentos" onBack={() => navigation.goBack()} />

                {loading ? (
                    <View style={styles.center}><ActivityIndicator color={theme.accent} size="large" /></View>
                ) : (
                    <ScrollView
                        contentContainerStyle={styles.body}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.accent} colors={[theme.accent]} />}
                    >
                        {!!loadError && (
                            <View style={[styles.notice, { backgroundColor: theme.surfaceVariant, borderColor: theme.danger }]}>
                                <Ionicons name="cloud-offline-outline" size={18} color={theme.danger} />
                                <Text style={[styles.noticeText, { color: theme.text }]}>{loadError}</Text>
                            </View>
                        )}

                        {!loadError && !vehicle && (
                            <View style={[styles.emptyCard, { backgroundColor: theme.surfaceVariant, borderColor: border }]}>
                                <View style={[styles.emptyIcon, { backgroundColor: softAccent }]}>
                                    <Ionicons name="car-outline" size={28} color={theme.accent} />
                                </View>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>Primero registra tu vehículo</Text>
                                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                                    Los documentos se revisan junto con el vehículo que vas a usar para compartir viajes.
                                </Text>
                                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent }]} onPress={() => navigation.navigate('RegisterVehicleStep1')} activeOpacity={0.85}>
                                    <Ionicons name="car-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.primaryBtnText}>Registrar vehículo</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {!loadError && vehicle && (
                            <>
                                <View style={[styles.summary, { backgroundColor: theme.surfaceVariant, borderColor: border }]}>
                                    <View style={styles.summaryTop}>
                                        <View style={[styles.summaryIcon, { backgroundColor: softAccent }]}>
                                            <Ionicons name="car-sport" size={22} color={theme.accent} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{vehicle.brand} {vehicle.model}</Text>
                                            <Text style={[styles.cardSub, { color: theme.textSecondary, marginBottom: 0 }]}>Placa {vehicle.license_plate}</Text>
                                        </View>
                                        <View style={[styles.chip, { backgroundColor: (data?.approved ? GREEN : AMBER) + '1A' }]}>
                                            <Text style={[styles.chipText, { color: data?.approved ? GREEN : AMBER }]}>{data?.approved ? 'Activo' : 'En revisión'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.progressRow}>
                                        <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>DOCUMENTOS APROBADOS</Text>
                                        <Text style={[styles.progressValue, { color: theme.accent }]}>{approvedCount} de 6</Text>
                                    </View>
                                    <View style={[styles.track, { backgroundColor: theme.dark ? '#22224A' : '#E8EAFF' }]}>
                                        <View style={[styles.fill, { width: progressPct, backgroundColor: data?.approved ? GREEN : theme.accent }]} />
                                    </View>
                                    <Text style={[styles.hint, { color: theme.textSecondary }]}>
                                        {data?.approved
                                            ? 'Tu vehículo está activo: ya puedes publicar viajes.'
                                            : 'Tu vehículo se activa cuando los 6 documentos estén aprobados. Toca uno para enviarlo o corregirlo.'}
                                    </Text>
                                </View>

                                {details.map((detail) => {
                                    const info = STATUS_INFO[detail.status] || STATUS_INFO.pending;
                                    const color = statusColor(detail.status);
                                    return (
                                        <TouchableOpacity
                                            key={detail.type}
                                            style={[styles.docRow, { backgroundColor: theme.surface, borderColor: border }]}
                                            onPress={() => openForm(detail)}
                                            activeOpacity={detail.approved ? 1 : 0.8}
                                            accessibilityRole="button"
                                            accessibilityLabel={`${detail.label}: ${info.label}`}
                                        >
                                            <View style={[styles.docIcon, { backgroundColor: color + '1A' }]}>
                                                <Ionicons name={info.icon} size={20} color={color} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.docTitle, { color: theme.text }]}>{detail.label}</Text>
                                                <Text style={[styles.docStatus, { color }]}>{info.label}</Text>
                                                {!!detail.rejectionReason && !detail.approved && detail.status !== 'missing' && (
                                                    <Text style={[styles.docReason, { color: theme.textSecondary }]} numberOfLines={3}>{detail.rejectionReason}</Text>
                                                )}
                                            </View>
                                            {!detail.approved && (
                                                <View style={styles.docAction}>
                                                    <Text style={[styles.docActionText, { color: theme.accent }]}>{detail.status === 'missing' ? 'Subir' : 'Reenviar'}</Text>
                                                    <Ionicons name="chevron-forward" size={16} color={theme.accent} />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </>
                        )}
                    </ScrollView>
                )}

                <Modal visible={!!openType} transparent animationType="slide" onRequestClose={closeForm} statusBarTranslucent>
                    <View style={styles.backdrop}>
                        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
                            <View style={styles.sheetHead}>
                                <Text style={[styles.sheetTitle, { color: theme.text }]}>{form?.label}</Text>
                                <TouchableOpacity onPress={closeForm} disabled={sending} accessibilityLabel="Cerrar" style={styles.closeBtn}>
                                    <Ionicons name="close" size={22} color={theme.textSecondary} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{form?.help}</Text>

                                <Text style={[styles.label, { color: theme.textSecondary }]}>FOTO DEL DOCUMENTO</Text>
                                {image ? (
                                    <View style={[styles.preview, { borderColor: border, backgroundColor: theme.surfaceVariant }]}>
                                        <Image source={{ uri: image.uri }} style={styles.previewImg} resizeMode="cover" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.docTitle, { color: theme.text }]} numberOfLines={1}>{image.name}</Text>
                                            <TouchableOpacity onPress={() => setImage(null)} disabled={sending}>
                                                <Text style={[styles.docActionText, { color: theme.danger }]}>Quitar</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <Ionicons name="checkmark-circle" size={20} color={GREEN} />
                                    </View>
                                ) : (
                                    <View style={styles.pickRow}>
                                        {Platform.OS !== 'web' && (
                                            <TouchableOpacity style={[styles.pickBtn, { borderColor: border, backgroundColor: theme.surfaceVariant }]} onPress={() => pickImage(true)}>
                                                <Ionicons name="camera-outline" size={22} color={theme.accent} />
                                                <Text style={[styles.pickText, { color: theme.accent }]}>Tomar foto</Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity style={[styles.pickBtn, { borderColor: border, backgroundColor: theme.surfaceVariant }]} onPress={() => pickImage(false)}>
                                            <Ionicons name="images-outline" size={22} color={theme.accent} />
                                            <Text style={[styles.pickText, { color: theme.accent }]}>Elegir de la galería</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {form?.fields.map((field) => (
                                    <View key={field.key}>
                                        <Text style={[styles.label, { color: theme.textSecondary }]}>{field.label.toUpperCase()}</Text>
                                        {field.kind === 'date' ? (
                                            <TouchableOpacity
                                                style={[styles.inputRow, { backgroundColor: theme.surfaceVariant, borderColor: border }]}
                                                onPress={() => setShowPickerFor(field.key)}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={[styles.input, { color: values[field.key] ? theme.text : theme.textSecondary }]}>{formatDate(values[field.key])}</Text>
                                                <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
                                            </TouchableOpacity>
                                        ) : (
                                            <View style={[styles.inputRow, { backgroundColor: theme.surfaceVariant, borderColor: border }]}>
                                                <TextInput
                                                    style={[styles.input, { color: theme.text }]}
                                                    value={values[field.key] || ''}
                                                    onChangeText={(t) => setValues((v) => ({ ...v, [field.key]: t }))}
                                                    placeholder={field.placeholder}
                                                    placeholderTextColor={theme.textSecondary}
                                                    autoCapitalize={field.caps || 'words'}
                                                    keyboardType={field.keyboard || 'default'}
                                                    maxLength={field.max || 60}
                                                    editable={!sending}
                                                />
                                            </View>
                                        )}
                                        {showPickerFor === field.key && (
                                            <DateTimePicker
                                                value={values[field.key] ? new Date(values[field.key]) : new Date()}
                                                mode="date"
                                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                                minimumDate={new Date()}
                                                onChange={(_, selected) => {
                                                    setShowPickerFor(null);
                                                    if (selected) setValues((v) => ({ ...v, [field.key]: selected.toISOString() }));
                                                }}
                                            />
                                        )}
                                    </View>
                                ))}

                                <View style={[styles.notice, { backgroundColor: theme.surfaceVariant, borderColor: border }]}>
                                    <Ionicons name="shield-checkmark-outline" size={18} color={theme.accent} />
                                    <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
                                        Escribe los datos tal como aparecen en el documento. Se comparan con tu cuenta y tu vehículo; si algo no coincide, un administrador lo revisa.
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={[styles.primaryBtn, { backgroundColor: sending ? theme.textSecondary : theme.accent }]}
                                    onPress={submit}
                                    disabled={sending}
                                    activeOpacity={0.85}
                                >
                                    {sending ? <ActivityIndicator color="#fff" /> : (
                                        <>
                                            <Ionicons name="cloud-upload-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                                            <Text style={styles.primaryBtnText}>Enviar documento</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>

            <CustomAlert
                visible={alert.visible}
                title={alert.title}
                message={alert.message}
                type={alert.type}
                confirmText="Entendido"
                onClose={() => setAlert((a) => ({ ...a, visible: false }))}
            />
        </>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    body: { padding: 20, paddingBottom: 100, gap: 12 },

    summary: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 4 },
    summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    summaryIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cardTitle: { fontSize: moderateScale(15), fontFamily: 'Poppins-Bold' },
    cardSub: { fontSize: moderateScale(12), lineHeight: 18, marginBottom: 12 },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    chipText: { fontSize: moderateScale(11), fontFamily: 'Poppins-Bold' },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    progressLabel: { fontSize: moderateScale(10), fontFamily: 'Poppins-Bold', letterSpacing: 0.8 },
    progressValue: { fontSize: moderateScale(12), fontFamily: 'Poppins-Bold' },
    track: { height: 6, borderRadius: 3, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
    hint: { fontSize: moderateScale(11), lineHeight: 16, marginTop: 10 },

    docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, minHeight: 64 },
    docIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    docTitle: { fontSize: moderateScale(13), fontFamily: 'Poppins-SemiBold' },
    docStatus: { fontSize: moderateScale(11), fontFamily: 'Poppins-Bold', marginTop: 1 },
    docReason: { fontSize: moderateScale(11), lineHeight: 15, marginTop: 3 },
    docAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    docActionText: { fontSize: moderateScale(12), fontFamily: 'Poppins-SemiBold' },

    emptyCard: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: 'center' },
    emptyIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },

    notice: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginVertical: 8, alignItems: 'flex-start' },
    noticeText: { flex: 1, fontSize: moderateScale(11), lineHeight: 16 },

    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 14, marginTop: 8, minHeight: 50, alignSelf: 'stretch' },
    primaryBtnText: { color: '#fff', fontSize: moderateScale(15), fontFamily: 'Poppins-Bold' },

    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16 },
    sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    sheetTitle: { fontSize: moderateScale(18), fontFamily: 'Poppins-Bold', flex: 1 },
    closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

    label: { fontSize: moderateScale(11), fontFamily: 'Poppins-Bold', letterSpacing: 0.8, marginBottom: 5, marginTop: 6 },
    inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 8, minHeight: 48 },
    input: { flex: 1, fontSize: moderateScale(14), paddingVertical: 12 },

    pickRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
    pickBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 16, alignItems: 'center', gap: 6, minHeight: 72 },
    pickText: { fontSize: moderateScale(12), fontFamily: 'Poppins-SemiBold' },
    preview: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
    previewImg: { width: 56, height: 56, borderRadius: 8 },
});
