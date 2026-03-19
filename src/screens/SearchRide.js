import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, StatusBar, Platform, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigationBar from '../components/BottomNavigationBar';
import { API_URL } from '../config';

const SearchRide = ({ navigation }) => {
    // Estados para almacenar los campos del pasajero
    const [origen, setOrigen] = useState('');
    const [destino, setDestino] = useState('');
    const [fechaSeleccionada, setFechaSeleccionada] = useState(null); // Objeto Date del calendario
    const [mostrarCalendario, setMostrarCalendario] = useState(false); // Controla la visibilidad del calendario
    const [horaSeleccionada, setHoraSeleccionada] = useState(null);    // Objeto Date con la hora elegida
    const [mostrarHora, setMostrarHora] = useState(false);             // Controla la visibilidad del selector de hora
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({}); // Objeto que acumula los errores por campo

    // Convierte un objeto Date a string en formato YYYY-MM-DD para el API
    const formatearFecha = (date) => {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Texto amigable de la fecha para mostrar al usuario (DD/MM/YYYY)
    const formatearFechaDisplay = (date) => {
        if (!date) return 'Seleccionar fecha';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Formatea la hora para mostrar al usuario en formato AM/PM
    const formatearHoraDisplay = (date) => {
        if (!date) return 'Seleccionar hora';
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    };

    // Verifica si la combinación de fecha+hora seleccionada es en el pasado (hora local)
    const esFechaHoraPasada = () => {
        if (!fechaSeleccionada || !horaSeleccionada) return false;

        // Construimos un único Date combinando la fecha y la hora seleccionadas
        const combinado = new Date(
            fechaSeleccionada.getFullYear(),
            fechaSeleccionada.getMonth(),
            fechaSeleccionada.getDate(),
            horaSeleccionada.getHours(),
            horaSeleccionada.getMinutes(),
            0
        );

        // Comparamos con el momento actual
        return combinado <= new Date();
    };

    // Se ejecuta cuando el usuario selecciona una fecha en el calendario
    const onCambiarFecha = (event, selectedDate) => {
        // En Android el picker se cierra solo; en iOS permanece visible
        if (Platform.OS === 'android') {
            setMostrarCalendario(false);
        }
        if (selectedDate) {
            setFechaSeleccionada(selectedDate);
        }
    };

    // Se ejecuta cuando el usuario selecciona una hora
    const onCambiarHora = (event, selectedTime) => {
        if (Platform.OS === 'android') {
            setMostrarHora(false);
        }
        if (selectedTime) {
            setHoraSeleccionada(selectedTime);
        }
    };

    // Función que se ejecuta al presionar el botón "Buscar"
    const handleSearch = async () => {
        // --- Validación inline (igual a CreatePasswordScreen): todos los campos son obligatorios ---
        const newErrors = {};

        if (!origen.trim()) {
            newErrors.origen = 'El origen del viaje es requerido.';
        }
        if (!destino.trim()) {
            newErrors.destino = 'El destino del viaje es requerido.';
        }
        if (!fechaSeleccionada) {
            newErrors.fecha = 'Por favor selecciona una fecha.';
        }
        if (!horaSeleccionada) {
            newErrors.hora = 'Por favor selecciona una hora.';
        }

        // Validación de fecha+hora en el pasado (solo si ambas fueron seleccionadas)
        if (fechaSeleccionada && horaSeleccionada && esFechaHoraPasada()) {
            newErrors.hora = 'La fecha y hora seleccionadas ya pasaron. Elige un momento futuro.';
        }

        // Si hay errores, los mostramos y no continuamos
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        // Si pasó todas las validaciones, limpiamos los errores
        setErrors({});

        setLoading(true);
        try {
            // Construimos los parámetros de búsqueda de acuerdo al API
            const queryParams = new URLSearchParams();
            // El backend espera coordenadas en formato "lat,lng" para origen y destino
            if (origen) queryParams.append('origin', origen);
            if (destino) queryParams.append('destination', destino);
            // Convertimos el Date seleccionado a formato YYYY-MM-DD para el backend
            const fechaStr = formatearFecha(fechaSeleccionada);
            if (fechaStr) queryParams.append('date', fechaStr);

            const url = `${API_URL}/rides?${queryParams.toString()}`;

            // Timeout de 10 segundos para evitar que se quede pensando indefinidamente
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            // Verificamos si la respuesta HTTP fue exitosa (status 2xx) antes de parsear
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                Alert.alert('Error', errorData.message || `Error del servidor (${response.status})`);
                return;
            }

            const result = await response.json();

            if (result.success) {
                // Redirige al nuevo screen con los resultados de la búsqueda
                navigation.navigate('ListOfDrivers', { rides: result.data || [] });
            } else {
                Alert.alert('Error', result.message || 'No se pudo obtener los viajes.');
            }
        } catch (error) {
            console.error('Error fetching rides:', error);
            if (error.name === 'AbortError') {
                Alert.alert('Error de Conexión', 'El servidor tardó mucho en responder.');
            } else {
                Alert.alert('Error', 'Hubo un problema al conectar con el servidor.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" />

            {/* Encabezado: muestra "Buscar Viaje" en lugar de "Saferide" */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Buscar Viaje</Text>
            </View>

            {/* ScrollView para evitar que el teclado tape los campos en pantallas pequeñas */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Input de Origen con validación inline */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Origen</Text>
                    <TextInput
                        style={[styles.input, errors.origen && styles.inputError]}
                        value={origen}
                        onChangeText={(text) => {
                            setOrigen(text);
                            // Limpia el error del campo en cuanto el usuario escribe
                            if (errors.origen) setErrors({ ...errors, origen: null });
                        }}
                        placeholder="Ej: 9.928,-84.090 (lat,lng)"
                        placeholderTextColor="#999"
                    />
                    {errors.origen && <Text style={styles.errorText}>{errors.origen}</Text>}
                </View>

                {/* Input de Destino con validación inline */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Destino</Text>
                    <TextInput
                        style={[styles.input, errors.destino && styles.inputError]}
                        value={destino}
                        onChangeText={(text) => {
                            setDestino(text);
                            if (errors.destino) setErrors({ ...errors, destino: null });
                        }}
                        placeholder="Ej: 9.933,-84.083 (lat,lng)"
                        placeholderTextColor="#999"
                    />
                    {errors.destino && <Text style={styles.errorText}>{errors.destino}</Text>}
                </View>

                {/* --- Selector de Fecha --- */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Fecha</Text>
                    {/* Botón que abre el calendario nativo al presionarlo */}
                    <TouchableOpacity
                        style={[styles.datePickerButton, errors.fecha && styles.inputError]}
                        onPress={() => {
                            setMostrarCalendario(true);
                            if (errors.fecha) setErrors({ ...errors, fecha: null });
                        }}
                    >
                        <Ionicons name="calendar-outline" size={22} color="#045084" />
                        <Text style={[
                            styles.datePickerText,
                            !fechaSeleccionada && styles.datePickerPlaceholder
                        ]}>
                            {formatearFechaDisplay(fechaSeleccionada)}
                        </Text>
                    </TouchableOpacity>

                    {errors.fecha && <Text style={styles.errorText}>{errors.fecha}</Text>}
                    {/* DateTimePicker nativo solo visible cuando el usuario lo activa */}
                    {mostrarCalendario && (
                        <DateTimePicker
                            value={fechaSeleccionada || new Date()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            minimumDate={new Date()} // No permite fechas pasadas
                            onChange={onCambiarFecha}
                        />
                    )}
                    {/* Botón confirmar solo en iOS */}
                    {mostrarCalendario && Platform.OS === 'ios' && (
                        <TouchableOpacity style={styles.confirmButton} onPress={() => setMostrarCalendario(false)}>
                            <Text style={styles.confirmButtonText}>Confirmar fecha</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* --- Selector de Hora --- */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Hora</Text>
                    {/* Botón que abre el selector de hora nativo */}
                    <TouchableOpacity
                        style={[styles.datePickerButton, errors.hora && styles.inputError]}
                        onPress={() => {
                            setMostrarHora(true);
                            if (errors.hora) setErrors({ ...errors, hora: null });
                        }}
                    >
                        <Ionicons name="time-outline" size={22} color="#045084" />
                        <Text style={[
                            styles.datePickerText,
                            !horaSeleccionada && styles.datePickerPlaceholder
                        ]}>
                            {formatearHoraDisplay(horaSeleccionada)}
                        </Text>
                    </TouchableOpacity>

                    {errors.hora && <Text style={styles.errorText}>{errors.hora}</Text>}
                    {/* Selector nativo de hora del dispositivo */}
                    {mostrarHora && (
                        <DateTimePicker
                            value={horaSeleccionada || new Date()}
                            mode="time"
                            is24Hour={false}
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={onCambiarHora}
                        />
                    )}
                    {/* Botón confirmar solo en iOS */}
                    {mostrarHora && Platform.OS === 'ios' && (
                        <TouchableOpacity style={styles.confirmButton} onPress={() => setMostrarHora(false)}>
                            <Text style={styles.confirmButtonText}>Confirmar hora</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Botón de búsqueda: valida todos los campos antes de hacer la petición */}
                <TouchableOpacity
                    style={styles.searchButton}
                    onPress={handleSearch}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.searchButtonText}>Buscar</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            {/* Componente de navegación inferior */}
            <BottomNavigationBar navigation={navigation} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 0,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    headerTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 24,
        color: '#045084',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 120, // Espacio para el BottomNavBar
    },
    inputContainer: {
        marginBottom: 22,
    },
    label: {
        fontSize: 14,
        color: '#555',
        marginBottom: 8,
        fontWeight: '600',
        textTransform: 'uppercase', // Labels en mayúsculas para diseño más limpio
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: '#F5F7FA',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#333',
    },
    // Borde rojo en el campo cuando hay error (igual que CreatePasswordScreen)
    inputError: {
        borderColor: '#f53333',
        borderWidth: 2,
        backgroundColor: 'rgba(245, 51, 51, 0.05)',
    },
    // Texto de error rojo debajo del campo (igual que CreatePasswordScreen)
    errorText: {
        color: '#f53333',
        fontSize: 13,
        marginTop: 5,
        marginLeft: 2,
        fontWeight: '500',
    },
    // Botón grande que simula un input y abre el picker nativo
    datePickerButton: {
        backgroundColor: '#F5F7FA',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56, // Altura mínima generosa para que sea fácil de tocar
    },
    datePickerText: {
        fontSize: 16,
        color: '#333',
        flex: 1,
    },
    datePickerPlaceholder: {
        color: '#999',
    },
    // Botón de confirmar que aparece en iOS para cerrar el spinner
    confirmButton: {
        backgroundColor: '#045084',
        borderRadius: 10,
        padding: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    confirmButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 15,
    },
    searchButton: {
        backgroundColor: '#045084',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#045084',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
    },
    searchButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    }
});

export default SearchRide;
