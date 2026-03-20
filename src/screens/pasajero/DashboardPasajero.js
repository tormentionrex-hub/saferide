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
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDriverTheme } from '../../context/DriverThemeContext';

// Obtenemos dimensiones de la pantalla para garantizar responsividad
const { height, width } = Dimensions.get('window');

const DashboardPasajero = ({ navigation, route }) => {
    const { theme } = useDriverTheme();
    const isDark = theme.dark;

    // Nombre del usuario: primero intenta route.params (viene del login directo),
    // si está vacío lo lee de AsyncStorage (guardado al hacer login en SignInScreen).
    const [userName, setUserName] = useState(route?.params?.userName || '');
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Valor animado para la rotación de la tuerca
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Si no llegó el nombre por los parámetros de navegación, lo buscamos en AsyncStorage
        if (!route?.params?.userName) {
            AsyncStorage.getItem('userName').then((name) => {
                if (name) setUserName(name);
            });
        }
    }, []);

    // Lógica de apertura/cierre con animación
    const toggleModal = () => {
        const toValue = isModalVisible ? 0 : 1;
        
        // Animación de rotación de 360 grados
        Animated.timing(rotateAnim, {
            toValue: toValue,
            duration: 400,
            useNativeDriver: true,
        }).start();

        setIsModalVisible(!isModalVisible);
    };

    // Interpolación para convertir el valor 0-1 en grados 0-360
    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    // Lógica de cierre de sesión
    const handleLogout = async () => {
        setIsModalVisible(false);
        await AsyncStorage.multiRemove(['userToken', 'userRole', 'userName']);
        navigation.reset({
            index: 0,
            routes: [{ name: 'SignIn' }],
        });
    };

    return (
        <Animated.View style={[styles.safeAreaWrapper, { backgroundColor: theme.bg }]}>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
            {/* Barra de estado adaptativa */}
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            
            {/* Encabezado: Texto 'Saferide' y Tuerquita Animada */}
            <View style={styles.header}>
                <View style={{ width: 40 }} />
                <Text style={[styles.headerTitle, { color: theme.text }]}>Saferide</Text>
                
                <TouchableOpacity 
                    style={styles.settingsButton}
                    onPress={toggleModal}
                    activeOpacity={0.7}
                >
                    <Animated.View style={{ transform: [{ rotate: spin }] }}>
                        <Ionicons name="settings-sharp" size={28} color={theme.text} />
                    </Animated.View>
                </TouchableOpacity>
            </View>

            {/* Contenido principal del Dashboard */}
            <View style={styles.content}>
                {/* Saludo dinámico al usuario */}
                <Text style={[styles.greeting, { color: theme.text }]}>Hola, {userName}</Text>

                {/* Tarjeta de búsqueda de viajes (Cuadro azul) */}
                <TouchableOpacity 
                    style={[styles.searchCard, { backgroundColor: theme.accent || '#2563EB' }]}
                    onPress={() => {
                        navigation.navigate('SearchRide');
                    }}
                    activeOpacity={0.9}
                >
                    <View style={styles.searchIconContainer}>
                        <Ionicons name="search" size={24} color="#ffffff" />
                    </View>
                    <View style={styles.searchTextContainer}>
                        <Text style={styles.cardTitle}>Buscar viaje</Text>
                        <Text style={styles.cardSubtitle}>Encuentra tu próximo viaje seguro</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Modal de Opciones */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isModalVisible}
                onRequestClose={toggleModal}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={toggleModal}
                >
                    <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Configuración</Text>
                        
                        <TouchableOpacity 
                            style={styles.modalOption}
                            onPress={() => {
                                toggleModal();
                                navigation.navigate('ProfilePasajero'); 
                            }}
                        >
                            <Ionicons name="person-outline" size={22} color={theme.text} />
                            <Text style={[styles.modalOptionText, { color: theme.text }]}>Perfil</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.modalOption}
                            onPress={() => {
                                toggleModal();
                                navigation.navigate('CustomizeApp');
                            }}
                        >
                            <Ionicons name="color-palette-outline" size={22} color={theme.text} />
                            <Text style={[styles.modalOptionText, { color: theme.text }]}>Personalizar App</Text>
                        </TouchableOpacity>

                        <View style={[styles.modalDivider, { backgroundColor: theme.divider }]} />

                        <TouchableOpacity 
                            style={styles.modalOption}
                            onPress={handleLogout}
                        >
                            <Ionicons name="log-out-outline" size={22} color={theme.danger} />
                            <Text style={[styles.modalOptionText, { color: theme.danger }]}>Cerrar sesión</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

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
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 20 : 20,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 24,
    },
    settingsButton: {
        padding: 5,
        zIndex: 10, // Asegura que esté por encima por si acaso
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
        alignItems: 'center',
    },
    greeting: {
        fontSize: 22,
        marginBottom: 30,
        fontFamily: 'Poppins-Bold',
        alignSelf: 'flex-start',
    },
    searchCard: {
        width: '90%',
        height: 120,
        padding: 20,
        borderRadius: 15,
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
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    cardSubtitle: {
        color: '#ffffff',
        fontSize: 14,
    },
    // Estilos del Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%', // Hecho más grande como se solicitó
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontFamily: 'Poppins-Bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    modalOptionText: {
        fontSize: 18, // También aumentamos el tamaño de fuente de las opciones
        fontFamily: 'Poppins-Medium',
        marginLeft: 18,
    },
    modalDivider: {
        height: 1,
        marginVertical: 12,
    }
});


export default DashboardPasajero;
