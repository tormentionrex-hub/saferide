import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { moderateScale } from '../utils/responsive';

// Edición de un viaje programado: hora de salida y asientos disponibles. El
// backend solo permite viajes del día y exige 5 minutos de anticipación; sus
// mensajes de validación se muestran tal cual. Si cambia la hora, el backend
// avisa a los pasajeros con reserva.

const MIN_SEATS = 1;
const MAX_SEATS = 7;

const toTimeDate = (hora) => {
    const d = new Date();
    if (hora && /^\d{1,2}:\d{2}$/.test(hora)) {
        const [h, m] = hora.split(':').map(Number);
        d.setHours(h, m, 0, 0);
    }
    return d;
};

const toHora = (date) =>
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const EditRideModal = ({ visible, ride, onClose, onSaved, theme }) => {
    const [time, setTime] = useState(new Date());
    const [seats, setSeats] = useState(1);
    const [showPicker, setShowPicker] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (visible && ride) {
            setTime(toTimeDate(ride.hora));
            setSeats(Math.min(MAX_SEATS, Math.max(MIN_SEATS, Number(ride.available_seats) || 1)));
            setError(null);
            setShowPicker(false);
        }
    }, [visible, ride]);

    if (!ride) return null;

    const save = async () => {
        // Solo se envía lo que cambió: el backend valida la hora cada vez que
        // la recibe, y cambiar los asientos de un viaje cuya hora ya está
        // cerca no debe fallar por una hora que el conductor no tocó.
        const payload = {};
        if (toHora(time) !== ride.hora) {
            payload.fecha = ride.fecha;
            payload.hora = toHora(time);
        }
        if (seats !== Number(ride.available_seats)) payload.available_seats = seats;
        if (Object.keys(payload).length === 0) { onClose(); return; }

        setSaving(true);
        setError(null);
        try {
            const res = await api.put(`/rides/${ride._id}`, payload);
            onSaved(res.data?.data || { ...ride, hora: toHora(time), available_seats: seats });
        } catch (e) {
            const data = e.response?.data;
            setError(Array.isArray(data?.errors)
                ? data.errors.map((x) => x.message).join('\n')
                : data?.message || 'No se pudo guardar el cambio. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    const stepper = (delta) => setSeats((s) => Math.min(MAX_SEATS, Math.max(MIN_SEATS, s + delta)));

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.title, { color: theme.text }]}>Editar viaje</Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={2}>
                        {ride.origin?.name || 'Origen'} → {ride.destination?.name || 'Destino'}
                    </Text>

                    <Text style={[styles.label, { color: theme.text }]}>Hora de salida</Text>
                    <Pressable
                        onPress={() => setShowPicker(true)}
                        style={[styles.field, { borderColor: theme.border, backgroundColor: theme.bg }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Hora de salida ${toHora(time)}. Cambiar`}
                    >
                        <Ionicons name="time-outline" size={20} color={theme.accent} />
                        <Text style={[styles.fieldText, { color: theme.text }]}>{toHora(time)}</Text>
                        <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                    </Pressable>
                    {showPicker && (
                        <DateTimePicker
                            value={time}
                            mode="time"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(_e, date) => {
                                if (Platform.OS === 'android') setShowPicker(false);
                                if (date) setTime(date);
                            }}
                        />
                    )}

                    <Text style={[styles.label, { color: theme.text, marginTop: 16 }]}>Asientos disponibles</Text>
                    <View style={styles.stepperRow}>
                        <Pressable
                            onPress={() => stepper(-1)}
                            disabled={seats <= MIN_SEATS}
                            style={[styles.stepBtn, { borderColor: theme.border, opacity: seats <= MIN_SEATS ? 0.4 : 1 }]}
                            accessibilityRole="button"
                            accessibilityLabel="Quitar un asiento"
                        >
                            <Ionicons name="remove" size={22} color={theme.text} />
                        </Pressable>
                        <Text style={[styles.seats, { color: theme.text }]} accessibilityLiveRegion="polite">{seats}</Text>
                        <Pressable
                            onPress={() => stepper(1)}
                            disabled={seats >= MAX_SEATS}
                            style={[styles.stepBtn, { borderColor: theme.border, opacity: seats >= MAX_SEATS ? 0.4 : 1 }]}
                            accessibilityRole="button"
                            accessibilityLabel="Agregar un asiento"
                        >
                            <Ionicons name="add" size={22} color={theme.text} />
                        </Pressable>
                    </View>

                    {error && <Text style={[styles.error, { color: theme.danger }]} accessibilityLiveRegion="polite">{error}</Text>}

                    <View style={styles.actions}>
                        <Pressable
                            onPress={onClose}
                            disabled={saving}
                            style={[styles.btn, { borderWidth: 1, borderColor: theme.border }]}
                            accessibilityRole="button"
                        >
                            <Text style={[styles.btnText, { color: theme.text }]}>Cancelar</Text>
                        </Pressable>
                        <Pressable
                            onPress={save}
                            disabled={saving}
                            style={[styles.btn, { backgroundColor: theme.accent }]}
                            accessibilityRole="button"
                            accessibilityState={{ busy: saving }}
                        >
                            {saving
                                ? <ActivityIndicator color="#FFFFFF" />
                                : <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Guardar</Text>}
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    card: { borderRadius: 20, borderWidth: 1, padding: 24 },
    title: { fontSize: moderateScale(18), fontFamily: 'Poppins-Bold' },
    subtitle: { fontSize: moderateScale(13), fontFamily: 'Poppins-Regular', marginTop: 2, marginBottom: 16 },
    label: { fontSize: moderateScale(13), fontFamily: 'Poppins-SemiBold', marginBottom: 6 },
    field: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        borderWidth: 1, borderRadius: 12, height: 48, paddingHorizontal: 14,
    },
    fieldText: { flex: 1, fontSize: moderateScale(16), fontFamily: 'Poppins-SemiBold' },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    stepBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    seats: { fontSize: moderateScale(22), fontFamily: 'Poppins-Bold', minWidth: 28, textAlign: 'center' },
    error: { fontSize: moderateScale(12), fontFamily: 'Poppins-Regular', marginTop: 12 },
    actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
    btn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: moderateScale(15), fontFamily: 'Poppins-Bold' },
});

export default EditRideModal;
