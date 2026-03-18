import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

/**
 * Componente BottomNavigationBarAlt
 * @param {Object} navigation - Propiedad proporcionada por React Navigation para cambiar de pantalla.
 * @param {String} activeTab - Nombre de la pestaña actual para resaltar el ícono y texto.
 */
const BottomNavigationBarAlt = ({ navigation, activeTab = 'Inicio' }) => {
    // Hook para manejar el espacio seguro en dispositivos con "notch" (como iPhone o Android modernos)
    const insets = useSafeAreaInsets(); 
    
    // Configuración de colores (Basados en tu imagen)
    const primaryColor = '#4B68FF';  // Color azul cuando el botón está seleccionado
    const inactiveColor = '#8E8E93'; // Color gris cuando el botón no está seleccionado

    // Función interna para determinar el color dinámicamente
    const getColor = (tabName) => activeTab === tabName ? primaryColor : inactiveColor;

    return (
        <View style={[
            styles.container, 
            { 
                // Ajusta la altura dinámicamente según el área segura del celular
                paddingBottom: insets.bottom > 0 ? insets.bottom : 20, 
                height: 70 + (insets.bottom > 0 ? insets.bottom : 20) 
            }
        ]}>
            
            {/* --- BOTÓN: INICIO --- */}
            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => {
                    // 👇 AQUÍ CAMBIAS: Pon el nombre de tu pantalla de Inicio
                    // navigation.navigate('NombreDeTuPantallaInicio');
                }}
            >
                <Ionicons 
                    // Cambia el icono a "relleno" si está activo, o "contorno" si no
                    name={activeTab === 'Inicio' ? "home" : "home-outline"} 
                    size={24} 
                    color={getColor('Inicio')} 
                />
                <Text style={[styles.navText, { color: getColor('Inicio') }]}>Inicio</Text>
            </TouchableOpacity>


            {/* --- BOTÓN: VIAJES --- */}
            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => {
                    // 👇 AQUÍ CAMBIAS: Pon el nombre de tu pantalla de Viajes
                    // navigation.navigate('NombreDeTuPantallaViajes');
                }}
            >
                <Ionicons 
                    name={activeTab === 'Viajes' ? "map" : "map-outline"} 
                    size={24} 
                    color={getColor('Viajes')} 
                />
                <Text style={[styles.navText, { color: getColor('Viajes') }]}>Viajes</Text>
            </TouchableOpacity>


            {/* --- BOTÓN: MENSAJES --- */}
            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => {
                    // 👇 AQUÍ CAMBIAS: Pon el nombre de tu pantalla de Chat/Mensajes
                    // navigation.navigate('NombreDeTuPantallaMensajes');
                }}
            >
                <Ionicons 
                    name={activeTab === 'Mensajes' ? "chatbox" : "chatbox-outline"} 
                    size={24} 
                    color={getColor('Mensajes')} 
                />
                <Text style={[styles.navText, { color: getColor('Mensajes') }]}>Mensajes</Text>
            </TouchableOpacity>


            {/* --- BOTÓN: PERFIL --- */}
            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => {
                    // 👇 AQUÍ CAMBIAS: Pon el nombre de tu pantalla de Perfil
                    // navigation.navigate('NombreDeTuPantallaPerfil');
                }}
            >
                <Ionicons 
                    name={activeTab === 'Perfil' ? "person" : "person-outline"} 
                    size={24} 
                    color={getColor('Perfil')} 
                />
                <Text style={[styles.navText, { color: getColor('Perfil') }]}>Perfil</Text>
            </TouchableOpacity>

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF', // Fondo blanco sólido para que se vea limpio
        width: '100%',
        justifyContent: 'space-around',
        alignItems: 'center',
        position: 'absolute',
        bottom: 0,
        // Bordes redondeados superiores
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        // Sombra sutil para dar elevación
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        // Línea divisoria muy suave en la parte superior
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        paddingTop: 10,
    },
    navText: {
        fontSize: 11,
        marginTop: 4,
        fontFamily: 'Poppins-Regular', // Asegúrate de tener cargada esta fuente o cámbiala por la de tu sistema
        fontWeight: '500',
    }
});

export default BottomNavigationBarAlt;