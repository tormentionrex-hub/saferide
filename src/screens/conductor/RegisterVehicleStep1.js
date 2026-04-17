import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    TextInput, StatusBar, ScrollView, Animated,
    Modal, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import CustomAlert from '../../components/CustomAlert';

const CAR_DATA = { //ESTOS SON LOS QUE VAN A IR EN EL ProfileConductor, para cuando este esa Feature.
    Acura: ['MDX', 'RDX', 'TLX', 'TSX', 'Integra'],
    Audi: ['A3', 'A4', 'Q3', 'Q5', 'Q7'],
    BMW: ['Serie 1', 'Serie 3', 'Serie 5', 'X1', 'X3', 'X5'],
    BYD: ['S1 Pro', 'Yuan Plus', 'Tang', 'Song Plus', 'F3', 'Dolphin'],
    Chery: ['Tiggo 2 Pro', 'Tiggo 4 Pro', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'QQ'],
    Chevrolet: ['Colorado', 'Tracker', 'Spark', 'Aveo', 'Captiva', 'Groove'],
    Citroen: ['C3', 'C4 Cactus', 'C5 Aircross', 'Berlingo', 'Jumpy'],
    Daihatsu: ['Terios', 'Bego', 'Sirion', 'Delta', 'Gran Max'],
    Dodge: ['RAM 1500', 'RAM 2500', 'Journey', 'Durango', 'Dakota'],
    Fiat: ['Strada', 'Fiorino', 'Pulse', 'Uno', '500', 'Fastback'],
    Ford: ['Ranger', 'Everest', 'Explorer', 'EcoSport', 'F-150', 'Focus'],
    Geely: ['Coolray', 'Azkarra', 'Okavango', 'GX3 Pro', 'Geometry C'],
    GMC: ['Sierra', 'Acadia', 'Terrain', 'Yukon', 'Canyon'],
    GreatWall: ['Wingle 5', 'Wingle 7', 'Poer', 'Haval M4', 'Voleex'],
    Haval: ['H6', 'Jolion', 'H2', 'H9', 'M4'],
    Honda: ['CR-V', 'Civic', 'HR-V', 'Accord', 'Fit', 'Pilot'],
    Hyundai: ['Tucson', 'Accent Blue', 'Elantra', 'Creta', 'Grand i10', 'Santa Fe', 'Kona'],
    Isuzu: ['D-Max', 'MU-X', 'NLR', 'NPR', 'FTR'],
    JAC: ['T8', 'JS2', 'JS4', 'S2', 'Sunray', 'E10X'],
    Jeep: ['Grand Cherokee', 'Wrangler', 'Compass', 'Renegade', 'Cherokee'],
    Jetour: ['Dashing', 'X70 Plus', 'X70', 'X90 Plus'],
    Kia: ['Sportage', 'Picanto', 'Rio', 'Seltos', 'Sorento', 'Cerato', 'Soluto'],
    LandRover: ['Defender', 'Discovery', 'Range Rover Evoque', 'Range Rover Sport'],
    Lexus: ['RX', 'NX', 'UX', 'GX', 'IS'],
    Mazda: ['CX-5', 'Mazda 3', 'CX-3', 'CX-30', 'BT-50', 'CX-9'],
    MercedesBenz: ['GLC', 'GLE', 'Clase C', 'Clase A', 'Clase E', 'Vito'],
    MG: ['ZS', 'HS', 'MG3', 'MG5', 'Marvel R', 'MG4'],
    Mitsubishi: ['Montero Sport', 'L200', 'Outlander', 'ASX', 'Eclipse Cross', 'Montero'],
    Nissan: ['Frontier', 'Sentra', 'Qashqai', 'Kicks', 'Versa', 'X-Trail', 'March'],
    Peugeot: ['2008', '3008', '5008', '208', 'Partner', 'Landtrek'],
    Renault: ['Kwid', 'Duster', 'Oroch', 'Stepway', 'Koleos', 'Logan'],
    Subaru: ['XV', 'Forester', 'Outback', 'Impreza', 'Crosstrek'],
    Suzuki: ['Vitara', 'Swift', 'Jimny', 'S-Presso', 'Ertiga', 'Dzire', 'Baleno'],
    Tesla: ['Model 3', 'Model Y', 'Model S', 'Model X'],
    Toyota: ['Hilux', 'Corolla', 'Yaris', 'RAV4', 'Prado', 'Fortuner', 'Rush', 'Agya'],
    Volkswagen: ['Amarok', 'Tiguan', 'Jetta', 'T-Cross', 'Gol', 'Taos', 'Nivus'],
    Volvo: ['XC40', 'XC60', 'XC90', 'S60', 'V40', 'C40'],
};

const BRANDS = Object.keys(CAR_DATA);
const COLORS = ['Blanco', 'Negro', 'Gris', 'Plateado', 'Rojo', 'Azul', 'Verde', 'Amarillo', 'Naranja', 'Café', 'Beige', 'Vinilado'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => String(CURRENT_YEAR - i));

// ── Custom themed select ──────────────────────────────────────────────────────
function ThemedSelect({ value, placeholder, options, onSelect, disabled, theme, border, cardBg }) {
    const [open, setOpen] = useState(false);

    const displayLabel = value || placeholder;
    const isPlaceholder = !value;

    return (
        <>
            <TouchableOpacity
                style={[
                    styles.selectTrigger,
                    { backgroundColor: cardBg, borderColor: border, opacity: disabled ? 0.5 : 1 },
                ]}
                onPress={() => !disabled && setOpen(true)}
                activeOpacity={0.7}
            >
                <Text style={[styles.selectTriggerText, { color: isPlaceholder ? theme.textSecondary : theme.text }]} numberOfLines={1}>
                    {displayLabel}
                </Text>
                <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
                    <View style={[styles.modalSheet, { backgroundColor: theme.surface, borderColor: border }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: theme.divider }]}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>{placeholder}</Text>
                            <TouchableOpacity onPress={() => setOpen(false)}>
                                <Ionicons name="close" size={22} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={options}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.optionItem,
                                        { borderBottomColor: theme.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
                                        item === value && { backgroundColor: theme.dark ? '#252560' : '#EEF2FF' },
                                    ]}
                                    onPress={() => { onSelect(item); setOpen(false); }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.optionText, { color: theme.text }]}>{item}</Text>
                                    {item === value && <Ionicons name="checkmark" size={16} color={theme.accent} />}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

export default function RegisterVehicleStep1({ navigation }) {
    const { theme } = useDriverTheme();
    const si = useScrollIndicator();

    const [brand, setBrand] = useState('');
    const [model, setModel] = useState('');
    const [plate, setPlate] = useState('');
    const [color, setColor] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [capacity, setCapacity] = useState(4);
    const [showPlateError, setShowPlateError] = useState(false);
    const [plateErrorMessage, setPlateErrorMessage] = useState('');
    const [fieldAlert, setFieldAlert] = useState({ visible: false, title: '', message: '' });

    // ── Animated progress (0 → 50) ──
    const progressAnim = useRef(new Animated.Value(0)).current;
    const [displayPct, setDisplayPct] = useState(0);

    useEffect(() => {
        const filled = [
            !!brand,
            !!model,
            plate.length === 6,
            !!color,
        ].filter(Boolean).length;

        const target = (filled / 4) * 50;

        Animated.timing(progressAnim, {
            toValue: target,
            duration: 450,
            useNativeDriver: false,
        }).start();

        const id = progressAnim.addListener(({ value }) => setDisplayPct(Math.round(value)));
        return () => progressAnim.removeListener(id);
    }, [brand, model, plate, color]);

    const barWidth = progressAnim.interpolate({
        inputRange: [0, 50],
        outputRange: ['0%', '100%'],
    });

    const models = brand ? CAR_DATA[brand] : [];

    const handlePlate = (text) =>
        setPlate(text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6));

    const handleNext = () => {
        if (!brand) {
            setFieldAlert({ visible: true, title: 'Marca requerida', message: 'Por favor selecciona la marca de tu vehículo antes de continuar.' });
            return;
        }
        if (!model) {
            setFieldAlert({ visible: true, title: 'Modelo requerido', message: 'Por favor selecciona el modelo de tu vehículo antes de continuar.' });
            return;
        }

        if (plate.length !== 6) {
            setPlateErrorMessage('La placa debe tener exactamente 6 caracteres (ej: ABC123).');
            setShowPlateError(true);
            return;
        }

        if (/^[A-Z]+$/.test(plate)) {
            setPlateErrorMessage('La placa no puede contener solo letras. Agregue al menos un número (ej: ABC123).');
            setShowPlateError(true);
            return;
        }

        if (!color) {
            setFieldAlert({ visible: true, title: 'Color requerido', message: 'Por favor selecciona el color de tu vehículo antes de continuar.' });
            return;
        }
        navigation.navigate('RegisterVehicleStep2', { brand, model, plate, color, year: parseInt(year), capacity });
    };

    const surfBg = theme.surface;
    const cardBg = theme.surfaceVariant;
    const border = theme.dark ? theme.border : 'rgba(75,104,255,0.15)';

    return (
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
                            <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>PASO 1 DE 2</Text>
                            <Text style={[styles.pct, { color: theme.accent }]}>{displayPct}%</Text>
                        </View>
                        <View style={[styles.progressTrack, { backgroundColor: theme.dark ? '#22224A' : '#E8EAFF' }]}>
                            <Animated.View style={[styles.progressFill, { width: barWidth, backgroundColor: theme.accent }]} />
                        </View>

                        {/* Título */}
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Especificaciones Técnicas</Text>
                        <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                            Ingrese los detalles básicos de su unidad para continuar.
                        </Text>

                        {/* MARCA */}
                        <Text style={[styles.label, { color: theme.textSecondary }]}>MARCA</Text>
                        <ThemedSelect
                            value={brand}
                            placeholder="Seleccione la marca"
                            options={BRANDS}
                            onSelect={(v) => { setBrand(v); setModel(''); }}
                            theme={theme} border={border} cardBg={cardBg}
                        />

                        {/* MODELO */}
                        <Text style={[styles.label, { color: theme.textSecondary }]}>MODELO</Text>
                        <ThemedSelect
                            value={model}
                            placeholder="Seleccione el modelo"
                            options={models}
                            onSelect={setModel}
                            disabled={!brand}
                            theme={theme} border={border} cardBg={cardBg}
                        />

                        {/* AÑO */}
                        <Text style={[styles.label, { color: theme.textSecondary }]}>AÑO</Text>
                        <ThemedSelect
                            value={year}
                            placeholder="Seleccione el año"
                            options={YEARS}
                            onSelect={setYear}
                            theme={theme} border={border} cardBg={cardBg}
                        />

                        {/* PLACA + COLOR */}
                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={[styles.label, { color: theme.textSecondary }]}>PLACA</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: cardBg, borderColor: border, color: theme.text }]}
                                    placeholder="ABC123"
                                    placeholderTextColor={theme.textSecondary}
                                    value={plate}
                                    onChangeText={handlePlate}
                                    autoCapitalize="characters"
                                    maxLength={6}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: theme.textSecondary }]}>COLOR</Text>
                                <ThemedSelect
                                    value={color}
                                    placeholder="Color"
                                    options={COLORS}
                                    onSelect={setColor}
                                    theme={theme} border={border} cardBg={cardBg}
                                />
                            </View>
                        </View>

                        {/* ASIENTOS */}
                        <View style={[styles.seatsCard, { backgroundColor: cardBg, borderColor: border }]}>
                            <View>
                                <Text style={[styles.seatsTitle, { color: theme.text }]}>ASIENTOS DISPONIBLES</Text>
                                <Text style={[styles.seatsHint, { color: theme.textSecondary }]}>Excluyendo al conductor</Text>
                            </View>
                            <View style={styles.counter}>
                                <TouchableOpacity
                                    style={[styles.counterBtn, { backgroundColor: theme.dark ? '#22224A' : '#E8EAFF' }]}
                                    onPress={() => setCapacity(c => Math.max(1, c - 1))}
                                >
                                    <Ionicons name="remove" size={18} color={theme.accent} />
                                </TouchableOpacity>
                                <Text style={[styles.counterVal, { color: theme.text }]}>{capacity}</Text>
                                <TouchableOpacity
                                    style={[styles.counterBtn, { backgroundColor: theme.accent }]}
                                    onPress={() => setCapacity(c => Math.min(7, c + 1))}
                                >
                                    <Ionicons name="add" size={18} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Botón */}
                        <TouchableOpacity
                            style={[styles.nextBtn, { backgroundColor: theme.accent }]}
                            onPress={handleNext}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.nextBtnText}>Siguiente: Seguro</Text>
                            <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 8 }} />
                        </TouchableOpacity>

                    </ScrollView>
                    <ScrollIndicator si={si} thumbColor={theme.accent} />
                </View>

                {/* ── MODAL ERROR PLACA ── */}
                <Modal
                    visible={showPlateError}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                >
                    <View style={styles.alertBackdrop}>
                        <View style={[styles.alertCard, {
                            backgroundColor: theme.dark ? '#111128' : '#FFFFFF',
                            borderColor: theme.dark ? 'rgba(255,160,0,0.3)' : 'rgba(255,160,0,0.2)',
                        }]}>

                            {/* Warning Icon with Glow */}
                            <View style={[styles.alertIconWrapper, {
                                backgroundColor: theme.dark ? '#2A1C00' : '#FFF8E1',
                                shadowColor: '#FFA000',
                            }]}>
                                <View style={[styles.alertIconInner, {
                                    backgroundColor: theme.dark ? '#3E2A00' : '#FFECB3',
                                }]}>
                                    <Ionicons name="alert-circle" size={42} color="#FFA000" />
                                </View>
                            </View>

                            {/* Title and Message */}
                            <Text style={[styles.alertTitle, { color: theme.dark ? '#EEEEFF' : '#1C1C1E' }]}>
                                Placa Inválida
                            </Text>
                            <Text style={[styles.alertSubtitle, { color: theme.dark ? '#A0A0C0' : '#6B7280' }]}>
                                {plateErrorMessage}
                            </Text>

                            {/* Divider */}
                            <View style={[styles.alertDivider, {
                                backgroundColor: theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
                            }]} />

                            {/* Close Button */}
                            <TouchableOpacity
                                style={[styles.alertBtn, { backgroundColor: '#FFA000' }]}
                                activeOpacity={0.85}
                                onPress={() => setShowPlateError(false)}
                            >
                                <Text style={styles.alertBtnText}>Reintentar</Text>
                            </TouchableOpacity>

                        </View>
                    </View>
                </Modal>

                {/* ── CUSTOM ALERT: MARCA / MODELO ── */}
                <CustomAlert
                    visible={fieldAlert.visible}
                    title={fieldAlert.title}
                    message={fieldAlert.message}
                    type="warning"
                    confirmText="OK"
                    onClose={() => setFieldAlert(f => ({ ...f, visible: false }))}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    mainContainer: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 20, borderBottomWidth: 1,
    },
    backBtn: { position: 'absolute', left: 20 },
    innerTitle: { fontSize: 18, fontWeight: 'bold' },
    scrollBody: { padding: 20, paddingBottom: 100 },

    progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    stepLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
    pct: { fontSize: 13, fontWeight: '800' },
    progressTrack: { height: 5, borderRadius: 3, marginBottom: 20, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },

    sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
    sectionSub: { fontSize: 12, lineHeight: 18, marginBottom: 20 },

    label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 5 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, marginBottom: 16 },
    row: { flexDirection: 'row', marginBottom: 16 },

    // Custom select
    selectTrigger: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
        marginBottom: 16,
    },
    selectTriggerText: { fontSize: 14, flex: 1, marginRight: 8 },

    // Modal
    modalBackdrop: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        borderWidth: 1, maxHeight: '65%',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
    },
    modalTitle: { fontSize: 15, fontWeight: '700' },
    optionItem: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1,
    },
    optionText: { fontSize: 14 },

    seatsCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 15, padding: 14, marginBottom: 24 },
    seatsTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    seatsHint: { fontSize: 10, marginTop: 2 },
    counter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    counterBtn: { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    counterVal: { fontSize: 18, fontWeight: '800', minWidth: 24, textAlign: 'center' },

    nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 14, elevation: 4, shadowColor: '#748FFF', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8 },
    nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    // ── MODAL AESTHETIC ALERT ──
    alertBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    alertCard: {
        width: '100%',
        borderRadius: 25,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
    },
    alertIconWrapper: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        elevation: 8,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
    alertIconInner: {
        width: 76,
        height: 76,
        borderRadius: 38,
        justifyContent: 'center',
        alignItems: 'center',
    },
    alertTitle: {
        fontSize: 22,
        fontWeight: '900',
        marginBottom: 12,
        letterSpacing: 0.2,
    },
    alertSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 10,
    },
    alertDivider: {
        width: '100%',
        height: 1,
        marginVertical: 24,
    },
    alertBtn: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#FFA000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    alertBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 1,
    },
});
