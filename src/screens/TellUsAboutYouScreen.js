import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

const COMPANIES = [
    'Intel', 'Cargill', 'Deloitte', 'Citi', 'Experian',
    '3M', 'DHL', 'Bill Gosling Outsourcing (BGO)',
    'WeWork Costa Rica', 'Concentrix', 'Nestlé Costa Rica'
];

const DEPARTMENTS = [
    'Recursos Humanos',
    'Tecnología',
    'Finanzas',
    'Marketing',
    'Ventas',
    'Operaciones',
    'Servicio al Cliente',
    'Administración',
    'Logística',
    'Otro'
];

export default function TellUsAboutYouScreen({ navigation }) {
    const [name, setName] = useState('');
    const [company, setCompany] = useState('');
    const [department, setDepartment] = useState('');
    const [schedule, setSchedule] = useState('');
    const [errors, setErrors] = useState({});

    // Time picker states
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);
    const [startTime, setStartTime] = useState(new Date());
    const [endTime, setEndTime] = useState(new Date());
    const [startTimeText, setStartTimeText] = useState('');
    const [endTimeText, setEndTimeText] = useState('');

    const formatTime = (date) => {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;
        const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
        return `${formattedHours}:${formattedMinutes} ${ampm}`;
    };

    const onStartTimeChange = (event, selectedDate) => {
        setShowStartTimePicker(false);
        if (selectedDate) {
            setStartTime(selectedDate);
            const formatted = formatTime(selectedDate);
            setStartTimeText(formatted);
            updateSchedule(formatted, endTimeText);
        }
    };

    const onEndTimeChange = (event, selectedDate) => {
        setShowEndTimePicker(false);
        if (selectedDate) {
            setEndTime(selectedDate);
            const formatted = formatTime(selectedDate);
            setEndTimeText(formatted);
            updateSchedule(startTimeText, formatted);
        }
    };

    const updateSchedule = (start, end) => {
        if (start && end) {
            setSchedule(`${start} - ${end}`);
            if (errors.schedule) setErrors({ ...errors, schedule: null });
        }
    };

    const handleContinue = () => {
        let currentErrors = {};

        if (!name.trim() || name.trim().length < 2) {
            currentErrors.name = 'Por favor ingresa tu nombre';
        }

        if (!company) {
            currentErrors.company = 'Por favor selecciona tu empresa';
        }

        if (!department) {
            currentErrors.department = 'Por favor selecciona tu departamento';
        }

        if (!schedule.trim()) {
            currentErrors.schedule = 'Por favor ingresa tu horario laboral';
        }

        if (Object.keys(currentErrors).length > 0) {
            setErrors(currentErrors);
            Alert.alert(
                'Error en el formulario',
                'Por favor completa todos los campos correctamente antes de continuar.'
            );
            return;
        }

        // Si no hay errores, navegar a la selección de roles
        navigation.navigate('RoleSelection', { name, company, department, schedule });
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#2563EB" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Safe Ride</Text>
            </View>

            <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Cuéntanos sobre ti</Text>

                {/* Nombre Field */}
                <Text style={styles.label}>Nombre</Text>
                <View style={[styles.inputContainer, errors.name ? styles.inputErrorBorder : null]}>
                    <TextInput
                        style={styles.input}
                        placeholder="Ingresa tu nombre"
                        placeholderTextColor="#9ca3af"
                        value={name}
                        onChangeText={(text) => {
                            setName(text);
                            if (errors.name) setErrors({ ...errors, name: null });
                        }}
                    />
                </View>
                {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

                {/* Empresa Field */}
                <Text style={[styles.label, { marginTop: 24 }]}>Empresa</Text>
                <View style={[styles.pickerContainer, errors.company ? styles.inputErrorBorder : null]}>
                    <Picker
                        selectedValue={company}
                        onValueChange={(itemValue) => {
                            setCompany(itemValue);
                            if (errors.company) setErrors({ ...errors, company: null });
                        }}
                        style={styles.picker}
                    >
                        <Picker.Item label="Ingresa tu empresa" value="" color="#9ca3af" />
                        {COMPANIES.map((comp) => (
                            <Picker.Item key={comp} label={comp} value={comp} />
                        ))}
                    </Picker>
                </View>
                {errors.company && <Text style={styles.errorText}>{errors.company}</Text>}

                {/* Departamento Field */}
                <Text style={[styles.label, { marginTop: 24 }]}>Departamento</Text>
                <View style={[styles.pickerContainer, errors.department ? styles.inputErrorBorder : null]}>
                    <Picker
                        selectedValue={department}
                        onValueChange={(itemValue) => {
                            setDepartment(itemValue);
                            if (errors.department) setErrors({ ...errors, department: null });
                        }}
                        style={styles.picker}
                    >
                        <Picker.Item label="Ingresa tu departamento" value="" color="#9ca3af" />
                        {DEPARTMENTS.map((dept) => (
                            <Picker.Item key={dept} label={dept} value={dept} />
                        ))}
                    </Picker>
                </View>
                {errors.department && <Text style={styles.errorText}>{errors.department}</Text>}

                {/* Horario laboral Field */}
                <Text style={[styles.label, { marginTop: 24 }]}>Horario laboral</Text>
                <View style={styles.timePickerRow}>
                    {/* Hora de inicio */}
                    <TouchableOpacity
                        style={[styles.timeButton, errors.schedule ? styles.inputErrorBorder : null]}
                        onPress={() => setShowStartTimePicker(true)}
                    >
                        <Text style={startTimeText ? styles.timeText : styles.timePlaceholder}>
                            {startTimeText || 'Hora inicio'}
                        </Text>
                        <Ionicons name="time-outline" size={20} color="#9ca3af" />
                    </TouchableOpacity>

                    <Text style={styles.timeSeparator}>-</Text>

                    {/* Hora de fin */}
                    <TouchableOpacity
                        style={[styles.timeButton, errors.schedule ? styles.inputErrorBorder : null]}
                        onPress={() => setShowEndTimePicker(true)}
                    >
                        <Text style={endTimeText ? styles.timeText : styles.timePlaceholder}>
                            {endTimeText || 'Hora fin'}
                        </Text>
                        <Ionicons name="time-outline" size={20} color="#9ca3af" />
                    </TouchableOpacity>
                </View>
                {errors.schedule && <Text style={styles.errorText}>{errors.schedule}</Text>}

                {/* Start Time Picker */}
                {showStartTimePicker && (
                    <DateTimePicker
                        value={startTime}
                        mode="time"
                        is24Hour={false}
                        display="spinner"
                        onChange={onStartTimeChange}
                    />
                )}

                {/* End Time Picker */}
                {showEndTimePicker && (
                    <DateTimePicker
                        value={endTime}
                        mode="time"
                        is24Hour={false}
                        display="spinner"
                        onChange={onEndTimeChange}
                    />
                )}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.button} onPress={handleContinue}>
                    <Text style={styles.buttonText}>Continuar</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2563EB',
        marginLeft: 16,
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 32,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        paddingHorizontal: 16,
    },
    inputErrorBorder: {
        borderColor: '#ef4444',
        borderWidth: 1.5,
    },
    input: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        color: '#111827',
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        overflow: 'hidden',
    },
    picker: {
        height: 56,
        width: '100%',
        color: '#111827',
    },
    errorText: {
        color: '#ef4444',
        fontSize: 13,
        marginTop: 8,
        lineHeight: 18,
    },
    timePickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    timeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        paddingHorizontal: 16,
    },
    timeText: {
        fontSize: 16,
        color: '#111827',
    },
    timePlaceholder: {
        fontSize: 16,
        color: '#9ca3af',
    },
    timeSeparator: {
        fontSize: 18,
        color: '#6B7280',
        fontWeight: '500',
    },
    footer: {
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    button: {
        height: 56,
        backgroundColor: '#2563EB',
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#2563EB',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    },
});
