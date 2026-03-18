import React from 'react';
import { 
    StyleSheet, 
    Text, 
    View, 
    SafeAreaView, 
    TouchableOpacity, 
    StatusBar,
    Dimensions,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigationBar from '../components/BottomNavigationBar';

// Obtenemos dimensiones de la pantalla para garantizar responsividad
const { height, width } = Dimensions.get('window');

const DashboardPasajero = ({ navigation, route }) => {
    // Extraemos el nombre del usuario enviado desde SignInScreen. Si no existe, usamos "Usuario" por defecto
    const userName = route?.params?.userName || "Usuario";
    
    // Configuración de colores corporativos especificados
    const primaryColor = '#045084';
    const subtextColor = 'rgba(255,255,255,0.4)';

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Barra de estado con iconos oscuros para fondo claro */}
            <StatusBar barStyle="dark-content" />
            
            {/* Encabezado: Texto 'Saferide' centrado */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Saferide</Text>
            </View>

            {/* Contenido principal del Dashboard */}
            <View style={styles.content}>
                {/* Saludo dinámico al usuario logueado */}
                <Text style={styles.greeting}>Hola, {userName}</Text>

                {/* Tarjeta de búsqueda de viajes */}
                <TouchableOpacity 
                    style={styles.searchCard}
                    onPress={() => {
                        /* 
                           AQUÍ SE REALIZA LA CONEXIÓN PARA LA REDIRECCIÓN 
                           Una vez exista el screen de búsqueda, se descomenta la línea de abajo:
                        */
                        // navigation.navigate('BuscarViajeScreen');
                        console.log("Conexión para redirección a Buscar Viaje detectada");
                    }}
                    activeOpacity={0.9}
                >
                    <View style={styles.searchIconContainer}>
                        <Ionicons name="search" size={24} color="#ffffff" />
                    </View>
                    <View style={styles.searchTextContainer}>
                        {/* Texto en negrita y color especificado #ffffff */}
                        <Text style={styles.cardTitle}>Buscar viaje</Text>
                        {/* Subtítulo con tamaño más pequeño */}
                        <Text style={styles.cardSubtitle}>Encuentra tu próximo viaje seguro</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Barra de navegación inferior (Bottom Nav) */}
            <BottomNavigationBar navigation={navigation} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
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
