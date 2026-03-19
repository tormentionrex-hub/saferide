import React, { useRef, useEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    SafeAreaView,
    TouchableOpacity,
    StatusBar,
    Dimensions,
    Platform,
    Animated,
    Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigationBar from '../components/BottomNavigationBar';

// Obtenemos dimensiones de la pantalla para garantizar responsividad
const { height, width } = Dimensions.get('window');

const DashboardPasajero = ({ navigation, route }) => {
    // Nombre del usuario: primero intenta route.params (viene del login directo),
    // si está vacío lo lee de AsyncStorage (guardado al hacer login en SignInScreen).
    const [userName, setUserName] = useState(route?.params?.userName || '');

    useEffect(() => {
        // Si no llegó el nombre por los parámetros de navegación, lo buscamos en AsyncStorage
        if (!route?.params?.userName) {
            AsyncStorage.getItem('userName').then((name) => {
                if (name) setUserName(name);
            });
        }
    }, []);

    // Colores principales de la aplicación para mantener cohesión visual
    const primaryColor = '#045084';
    const subtextColor = 'rgba(255,255,255,0.4)';

    return (
        <Animated.View style={styles.safeAreaWrapper}>
        <SafeAreaView style={styles.safeArea}>
            {/* Barra de estado con iconos oscuros para fondo claro */}
            <StatusBar barStyle="dark-content" />
            
            {/* Encabezado: Texto 'Saferide' centrado */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Saferide</Text>
            </View>

            {/* Contenido principal del Dashboard */}
            <View style={styles.content}>
                {/* Saludo dinámico al usuario: Muestra el nombre recibido por parámetros o 'Usuario' por defecto */}
                <Text style={styles.greeting}>Hola, {userName}</Text>

                {/* Tarjeta de búsqueda de viajes (Cuadro azul) */}
                <TouchableOpacity 
                    style={styles.searchCard}
                    onPress={() => {
                        // Navega hacia la pantalla de búsqueda de viajes 'SearchRide'
                        navigation.navigate('SearchRide');
                        console.log("Redirigiendo a la pantalla de búsqueda de viajes...");
                    }}
                    activeOpacity={0.9}
                >
                    <View style={styles.searchIconContainer}>
                        <Ionicons name="search" size={24} color="#ffffff" />
                    </View>
                    <View style={styles.searchTextContainer}>
                        {/* Título de la tarjeta en negrita y color blanco */}
                        <Text style={styles.cardTitle}>Buscar viaje</Text>
                        {/* Subtítulo informativo debajo del título principal */}
                        <Text style={styles.cardSubtitle}>Encuentra tu próximo viaje seguro</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Barra de navegación inferior (Bottom Nav) customizada */}
            <BottomNavigationBar navigation={navigation} />
        </SafeAreaView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    safeAreaWrapper: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF', // Fondo blanco para que resalte el contenido
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 0, // Evita choque con barra de estado
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        alignItems: 'center', // Centrado
    },
    headerTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 24,
        color: '#045084',
        paddingHorizontal: 10, // Agregamos espacio a los lados para evitar que se corte la última letra
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
        alignItems: 'center', // Centrar el saludo y la caja
    },
    greeting: {
        fontSize: 22,
        color: '#000000',
        marginBottom: 30,
        fontFamily: 'Poppins-Bold',
        alignSelf: 'flex-start', // Mantener el saludo a la izquierda
    },
    searchCard: {
        backgroundColor: '#2563EB', // Color de fondo solicitado
        width: '90%',              // Ampliado
        height: 120,               // Ampliado de alto
        padding: 20,
        borderRadius: 15,
        // Sombra para dar profundidad (efecto premium)
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    searchIconContainer: {
        marginRight: 15,
        marginTop: 2,
    },
    searchTextContainer: {
        flex: 1,
    },
    cardTitle: {
        color: '#ffffff', // Color de letra solicitado
        fontSize: 18,
        fontWeight: 'bold',             // Diseño en negrita
        marginBottom: 5,
    },
    cardSubtitle: {
        color: '#ffffff', // Color de letra solicitado
        fontSize: 14,
    }
});

export default DashboardPasajero;
