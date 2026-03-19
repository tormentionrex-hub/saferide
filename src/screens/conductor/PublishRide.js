import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StatusBar,
    Platform,
    ScrollView
} from 'react-native';
// Selector de fecha y hora nativo
import DateTimePicker from '@react-native-community/datetimepicker';
// Selector tipo dropdown para asientos
import { Picker } from '@react-native-picker/picker';
// Íconos vectoriales
import { Ionicons } from '@expo/vector-icons';
// Barra de navegación personalizada para conductores
import BottomNavigationDriver from '../../components/BottomNavigationDriver';
// Servicio de API configurado con axios y token
import api from '../../services/api';
// Configuración de la API
import { API_URL } from '../../config';

/**
 * Pantalla para que los conductores publiquen un nuevo viaje.
 */
const PublishRide = ({ navigation }) => {
    // --- ESTADOS DEL FORMULARIO ---
    const [origen, setOrigen] = useState('');
    const [destino, setDestino] = useState('');
    const [asientos, setAsientos] = useState('1'); // Valor por defecto 1 asiento

    // --- ESTADOS DE FECHA Y HORA ---
    const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
    const [horaSeleccionada, setHoraSeleccionada] = useState(null);
    const [mostrarCalendario, setMostrarCalendario] = useState(false);
    const [mostrarHora, setMostrarHora] = useState(false);

    // --- ESTADOS DE UI ---
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    /**
     * Formatea un objeto Date a string DD/MM/YYYY para visualización.
     */
    const formatearFechaDisplay = (date) => {
        if (!date) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    /**
     * Formatea un objeto Date a string HH:MM AM/PM para visualización.
     */
    const formatearHoraDisplay = (date) => {
        if (!date) return '';
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    };

    /**
     * Genera el texto para mostrar en el botón de selección de fecha/hora.
     */
    const getFechaHoraText = () => {
        if (fechaSeleccionada && horaSeleccionada) {
            return `${formatearFechaDisplay(fechaSeleccionada)} a las ${formatearHoraDisplay(horaSeleccionada)}`;
        } else if (fechaSeleccionada) {
            return `${formatearFechaDisplay(fechaSeleccionada)} (Seleccionar hora...)`;
        }
        return 'Fecha y Hora';
    };

    /**
     * Maneja el cambio de fecha seleccionado.
     * En Android cierra el calendario y abre el selector de hora.
     */
    const onCambiarFecha = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setMostrarCalendario(false);
        }
        if (event.type === 'set' && selectedDate) {
            setFechaSeleccionada(selectedDate);
            if (errors.fechaHora) setErrors({ ...errors, fechaHora: null });

            if (Platform.OS === 'android') {
                setTimeout(() => setMostrarHora(true), 100);
            }
        } else if (event.type === 'dismissed') {
            setMostrarCalendario(false);
        }
    };

    /**
     * Maneja el cambio de la hora seleccionada.
     */
    const onCambiarHora = (event, selectedTime) => {
        if (Platform.OS === 'android') {
            setMostrarHora(false);
        }
        if (event.type === 'set' && selectedTime) {
            setHoraSeleccionada(selectedTime);
            if (errors.fechaHora) setErrors({ ...errors, fechaHora: null });
        } else if (event.type === 'dismissed') {
            setMostrarHora(false);
        }
    };

    const handlePublish = async () => {
        const newErrors = {};

        // Validaciones básicas antes de enviar
        if (!origen.trim()) newErrors.origen = 'Requerido';
        if (!destino.trim()) newErrors.destino = 'Requerido';
        if (!fechaSeleccionada || !horaSeleccionada) newErrors.fechaHora = 'Requerido';
        if (!asientos) newErrors.asientos = 'Requerido';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            Alert.alert('Campos incompletos', 'Por favor llena todos los campos para publicar el viaje.');
            return;
        }

        setLoading(true);
        try {
            // Combinar fecha y hora para enviarlo al backend en formato UTC
            const fullDateTime = new Date(fechaSeleccionada);
            fullDateTime.setHours(horaSeleccionada.getHours());
            fullDateTime.setMinutes(horaSeleccionada.getMinutes());

            // Estructura del payload según lo que el modelo de backend espera (Ride.js/rideRoutes.js)
            // IMPORTANTE: El backend requiere coordenadas. Por ahora mandamos valores fijos
            // que podrías reemplazar luego con un selector de mapa.
            const payload = {
                origin: {
                    name: origen,
                    coordinates: { lat: 9.9281, lng: -84.0907 } // Ubicación aproximada (San José)
                },
                destination: {
                    name: destino,
                    coordinates: { lat: 9.9322, lng: -84.0410 } // Ubicación aproximada (San Pedro)
                },
                date_time: fullDateTime.toISOString(),
                available_seats: parseInt(asientos)
            };

            // Llamada real al backend usando el servicio centralizado (contiene el token)
            // Se debe importar 'api' de '../services/api'
            const response = await api.post('/rides', payload);

            if (response.data.success) {
                setLoading(false);
                Alert.alert('¡Éxito!', 'Tu viaje ha sido publicado.', [
                    { text: 'OK', onPress: () => navigation.navigate('Home') }
                ]);
            } else {
                throw new Error(response.data.message || 'Error desconocido');
            }

        } catch (error) {
            console.error('Error publicando viaje:', error);
            const errorMsg = error.response?.data?.message || 'Hubo un problema al conectar con el servidor.';
            Alert.alert('Error', errorMsg);
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" />

            {/* Título exterior centrado en la parte superior */}
            <Text style={styles.backgroundTitle}>Publicar Viaje</Text>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Carta principal contenedora del formulario */}
                <View style={styles.card}>

                    {/* Cabecera de la carta con botón de retroceso opcional */}
                    <View style={styles.cardHeader}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                        >
                            <Ionicons name="chevron-back" size={24} color="#1A2B4C" />
                        </TouchableOpacity>
                        <Text style={styles.cardTitle}>Detalles del Viaje</Text>
                    </View>

                    {/* Separador visual */}
                    <View style={styles.divider} />

                    {/* Entrada: Origen */}
                    <View style={[styles.inputWrapper, errors.origen && styles.inputError]}>
                        <Ionicons name="radio-button-off" size={20} color="#999" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            value={origen}
                            onChangeText={(text) => {
                                setOrigen(text);
                                if (errors.origen) setErrors({ ...errors, origen: null });
                            }}
                            placeholder="Origen (Ej. San José)"
                            placeholderTextColor="#999"
                        />
                    </View>

                    {/* Entrada: Destino */}
                    <View style={[styles.inputWrapper, errors.destino && styles.inputError]}>
                        <Ionicons name="location-outline" size={20} color="#999" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            value={destino}
                            onChangeText={(text) => {
                                setDestino(text);
                                if (errors.destino) setErrors({ ...errors, destino: null });
                            }}
                            placeholder="Destino (Ej. Heredia)"
                            placeholderTextColor="#999"
                        />
                    </View>

                    {/* Selector: Fecha y Hora */}
                    <TouchableOpacity
                        style={[styles.inputWrapper, errors.fechaHora && styles.inputError]}
                        onPress={() => setMostrarCalendario(true)}
                    >
                        <Ionicons name="calendar-outline" size={20} color="#999" style={styles.inputIcon} />
                        <Text style={[styles.inputText, (!fechaSeleccionada || !horaSeleccionada) && { color: '#999' }]}>
                            {getFechaHoraText()}
                        </Text>
                    </TouchableOpacity>

                    {/* Selector de dropdown: Asientos Disponibles (máximo 4) */}
                    <View style={[styles.inputWrapper, errors.asientos && styles.inputError]}>
                        <Ionicons name="car-outline" size={20} color="#999" style={styles.inputIcon} />
                        <Picker
                            selectedValue={asientos}
                            onValueChange={(itemValue) => setAsientos(itemValue)}
                            style={styles.picker}
                            dropdownIconColor="#2D63ED"
                        >
                            <Picker.Item label="1 Asiento disponible" value="1" />
                            <Picker.Item label="2 Asientos disponibles" value="2" />
                            <Picker.Item label="3 Asientos disponibles" value="3" />
                            <Picker.Item label="4 Asientos disponibles" value="4" />
                            <Picker.Item label="5 Asientos disponibles" value="5" />
                            <Picker.Item label="6 Asientos disponibles" value="6" />
                            <Picker.Item label="7 Asientos disponibles" value="7" />
                        </Picker>
                    </View>

                    {/* Contenedor del botón de acción */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={styles.publishButton}
                            onPress={handlePublish}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.publishButtonText}>Publicar Viaje Ahora</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                </View>
            </ScrollView>

            {/* Selectores nativos ocultos (se disparan vía estado) */}
            {mostrarCalendario && (
                <DateTimePicker
                    value={fechaSeleccionada || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    onChange={onCambiarFecha}
                />
            )}

            {/* Confirmación manual necesaria para iOS */}
            {mostrarCalendario && Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.iosConfirmButton} onPress={() => { setMostrarCalendario(false); setMostrarHora(true); }}>
                    <Text style={styles.iosConfirmText}>Siguiente: Elegir hora</Text>
                </TouchableOpacity>
            )}

            {mostrarHora && (
                <DateTimePicker
                    value={horaSeleccionada || new Date()}
                    mode="time"
                    is24Hour={false}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onCambiarHora}
                />
            )}

            {mostrarHora && Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.iosConfirmButton} onPress={() => setMostrarHora(false)}>
                    <Text style={styles.iosConfirmText}>Confirmar hora</Text>
                </TouchableOpacity>
            )}

            {/* Navegación inferior fija en la parte baja de la pantalla */}
            <BottomNavigationDriver navigation={navigation} activeTab="Viajes" />

        </SafeAreaView>
    );
};

// --- DEFINICIÓN DE ESTILOS ---
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    // Título de fondo centrado
    backgroundTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#C0C0C0',
        textAlign: 'center', // Centrado horizontal
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 20 : 20,
        marginBottom: 10,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#EFEFEF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
        minHeight: 520,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        position: 'relative',
    },
    backButton: {
        position: 'absolute',
        left: 0,
        padding: 5,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A2B4C',
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginBottom: 25,
        marginHorizontal: -20,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E5E5',
        borderRadius: 8,
        paddingHorizontal: 15,
        height: 52,
        marginBottom: 16,
        backgroundColor: '#FFFFFF',
    },
    inputError: {
        borderColor: '#f53333',
        backgroundColor: 'rgba(245, 51, 51, 0.02)',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#333',
        height: '100%',
    },
    picker: {
        flex: 1,
        height: 52,
        color: '#333',
        marginLeft: -10, // Ajuste para alinear con otros campos
    },
    inputText: {
        flex: 1,
        fontSize: 15,
        color: '#333',
    },
    buttonContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        marginTop: 40,
    },
    publishButton: {
        backgroundColor: '#2D63ED',
        borderRadius: 8,
        height: 54,
        alignItems: 'center',
        justifyContent: 'center',
    },
    publishButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    iosConfirmButton: {
        backgroundColor: '#2D63ED',
        padding: 15,
        alignItems: 'center',
        marginHorizontal: 20,
        borderRadius: 10,
        marginBottom: 20,
    },
    iosConfirmText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    }
});

export default PublishRide;
