import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const BottomNavigationBar = ({ navigation }) => {
    // Definimos el color especificado por el usuario (ajustado a #045084 basado en el diseño existente)
    const primaryColor = '#045084';
    const glassBackground = 'rgba(255,255,255,0.4)';
    const insets = useSafeAreaInsets(); // Obtiene la altura real de los botones/gestos del celular

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20, height: 70 + (insets.bottom > 0 ? insets.bottom : 20) }]}>
            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => {
                    /* Redirección a Inicio */
                    // navigation.navigate('Inicio');
                }}
            >
                <Ionicons name="home" size={24} color={primaryColor} />
                <Text style={[styles.navText, { color: primaryColor }]}>Inicio</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => {
                    /* Redirección a Buscar Viaje */
                    // navigation.navigate('BuscarViaje');
                }}
            >
                <View style={styles.iconWithOverlay}>
                    <Ionicons name="compass-outline" size={24} color={primaryColor} />
                </View>
                <Text style={[styles.navText, { color: primaryColor }]}>Buscar viaje</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => {
                    /* Redirección a Historial */
                    // navigation.navigate('Historial');
                }}
            >
                <Ionicons name="time-outline" size={24} color={primaryColor} />
                <Text style={[styles.navText, { color: primaryColor }]}>Historial</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => {
                    /* Redirección a Métricas */
                    // navigation.navigate('Metricas');
                }}
            >
                <Ionicons name="bar-chart-outline" size={24} color={primaryColor} />
                <Text style={[styles.navText, { color: primaryColor }]}>Métricas</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => {
                    /* Redirección a Perfil */
                    // navigation.navigate('Perfil');
                }}
            >
                <Ionicons name="person-outline" size={24} color={primaryColor} />
                <Text style={[styles.navText, { color: primaryColor }]}>Perfil</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.95)',
        width: '100%',
        justifyContent: 'space-around',
        alignItems: 'center',
        position: 'absolute',
        bottom: 0,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        // Glassmorphism effect (blur is usually handled by other libs in RN, but we follow requested color)
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    navText: {
        fontSize: 10,
        marginTop: 4,
        fontFamily: 'Poppins-Regular', // Asignado basado en SignInScreen
    },
    iconWithOverlay: {
        alignItems: 'center',
        justifyContent: 'center',
    }
});

export default BottomNavigationBar;
