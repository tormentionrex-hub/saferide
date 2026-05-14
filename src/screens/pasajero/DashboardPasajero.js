import React, { useRef, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
    Alert,
    Image,
    DeviceEventEmitter,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDriverTheme } from '../../context/DriverThemeContext';
import api from '../../services/api';

// Obtenemos dimensiones de la pantalla para garantizar responsividad
const { height, width } = Dimensions.get('window');

const DashboardPasajero = ({ navigation, route }) => {
    const { theme } = useDriverTheme();
    const isDark = theme.dark;

    // Nombre del usuario: primero intenta route.params (viene del login directo),
    // si está vacío lo lee de AsyncStorage (guardado al hacer login en SignInScreen).
    const [userName, setUserName] = useState(route?.params?.userName || '');
    const [userPhoto, setUserPhoto] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isLogoutAlertVisible, setIsLogoutAlertVisible] = useState(false);

    // Valor animado para la rotación de la tuerca
    const rotateAnim = useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('profileUpdated', (newPhoto) => {
            if (newPhoto) setUserPhoto(newPhoto);
        });
        return () => subscription.remove();
    }, []);

    useFocusEffect(
        useCallback(() => {
            const loadData = async () => {
                try {
                    const meRes = await api.get('/auth/me');
                    if (meRes.data.success) {
                        const user = meRes.data.data;
                        if (user.name) {
                            setUserName(user.name.split(' ')[0]);
                            await AsyncStorage.setItem('userName', user.name);
                        }
                        if (user.profileImage) {
                            setUserPhoto(user.profileImage);
                            await AsyncStorage.setItem('userPhoto', user.profileImage);
                        } else {
                            setUserPhoto(null);
                        }
                    }
                } catch (error) {
                    const name = await AsyncStorage.getItem('userName');
                    if (name) setUserName(name.split(' ')[0]);

                    const photo = await AsyncStorage.getItem('userPhoto');
                    if (photo && (photo.startsWith('http') || photo.startsWith('file'))) {
                        setUserPhoto(photo);
                    }
                }
            };
            loadData();
        }, [])
    );

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

    // Lógica de cierre de sesión refactorizada para diseño adhoc
    const handleLogoutPress = () => {
        setIsLogoutAlertVisible(true);
    };

    const confirmLogout = async () => {
        setIsLogoutAlertVisible(false);
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
            
            {/* Encabezado: Texto 'Pasajero' y Tuerquita Animada */}
            <View style={[styles.header, { borderBottomColor: theme.divider || '#CBD5E1', borderBottomWidth: 1 }]}>
                <View style={{ width: 40 }} />
                <Text
                    style={[styles.headerTitle, { color: theme.navActive || '#005BBF' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                >Pasajero</Text>
                
                <TouchableOpacity 
                    style={styles.profileButton}
                    onPress={toggleModal}
                    activeOpacity={0.7}
                >
                    {userPhoto ? (
                        <Image source={{ uri: userPhoto }} style={styles.profileImg} />
                    ) : (
                        <View style={[styles.profileImg, { backgroundColor: theme.accent + '22', justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: theme.accent, fontSize: 20, fontFamily: 'Poppins-Bold' }}>
                                {userName ? userName.charAt(0).toUpperCase() : '?'}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Contenido principal del Dashboard */}
            <View style={styles.content}>

                {/* Saludo dinámico al usuario */}
                <Text style={[styles.greeting, { color: theme.text }]}>Hola, {userName}</Text>

                {/* Tarjeta de búsqueda de viajes (Acceso directo principal) */}
                <TouchableOpacity 
                    style={[styles.searchCard, { backgroundColor: theme.accent || '#2563EB' }]}
                    onPress={() => {
                        // Navega hacia la pantalla de búsqueda de viajes 'SearchRide'
                        navigation.navigate('BuscarViaje');
                    }}
                    activeOpacity={0.9}
                >
                    <View style={styles.searchIconContainer}>
                        <Ionicons name="search" size={24} color="#ffffff" />
                    </View>
                    <View style={styles.searchTextContainer}>
                        {/* Título de la tarjeta informativo */}
                        <Text style={styles.cardTitle}>Buscar viaje</Text>
                        <Text style={styles.cardSubtitle}>Encuentra tu próximo viaje seguro</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Modal de Configuración (Acciones Rápidas) */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isModalVisible}
                onRequestClose={toggleModal}
            >
                {/* Overlay oscuro de fondo */}
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={toggleModal}
                >
                    {/* Contenedor del Modal */}
                    <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
                        
                        {/* Cabecera del Modal con Título y Botón Cerrar (X) */}
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Configuración</Text>
                            <TouchableOpacity onPress={toggleModal} style={styles.closeModalButton}>
                                <Ionicons name="close" size={26} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={[styles.modalSub, { color: theme.textSecondary }]}>¿A dónde quieres ir?</Text>

                        {/* Opciones del Modal en formato de cuadrícula/fila */}
                        <View style={styles.optionsRow}>
                            {/* Opción Perfil */}
                            <TouchableOpacity 
                                style={[styles.optionCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
                                onPress={() => {
                                    toggleModal();
                                    navigation.navigate('PasajeroProfileScreen'); 
                                }}
                            >
                                <View style={[styles.iconCircle, { backgroundColor: theme.surface }]}>
                                    <Ionicons name="person-outline" size={28} color={theme.accent} />
                                </View>
                                <Text style={[styles.optionLabel, { color: theme.text }]}>Perfil</Text>
                                <Text style={[styles.optionSub, { color: theme.textSecondary }]}>Tu información</Text>
                            </TouchableOpacity>

                            {/* Opción Ajustes/Personalización */}
                            <TouchableOpacity 
                                style={[styles.optionCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
                                onPress={() => {
                                    toggleModal();
                                    navigation.navigate('CustomizeApp');
                                }}
                            >
                                <View style={[styles.iconCircle, { backgroundColor: theme.surface }]}>
                                    <Ionicons name="construct-outline" size={28} color={theme.accent} />
                                </View>
                                <Text style={[styles.optionLabel, { color: theme.text }]}>Ajustes</Text>
                                <Text style={[styles.optionSub, { color: theme.textSecondary }]}>Apariencia y más</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Botón de Cerrar Sesión en la parte inferior */}
                        <TouchableOpacity 
                            style={[styles.logoutModalBtn, { borderColor: theme.danger, backgroundColor: theme.surfaceVariant }]}
                            onPress={handleLogoutPress}
                        >
                            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
                            <Text style={[styles.logoutModalText, { color: theme.danger }]}>Cerrar sesión</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Modal de Alerta Customizada de Cierre de Sesión */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isLogoutAlertVisible}
                onRequestClose={() => setIsLogoutAlertVisible(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setIsLogoutAlertVisible(false)}
                >
                    <View style={[styles.alertContent, { backgroundColor: theme.surface }]}>
                        <View style={[styles.alertIconContainer, { backgroundColor: theme.danger + '20' }]}>
                            <Ionicons name="log-out-outline" size={32} color={theme.danger} />
                        </View>
                        <Text style={[styles.alertTitle, { color: theme.text }]}>Cerrar sesión</Text>
                        <Text style={[styles.alertMessage, { color: theme.textSecondary }]}>
                            ¿Estás seguro que deseas salir de tu cuenta?
                        </Text>
                        
                        <View style={styles.alertActions}>
                            <TouchableOpacity 
                                style={[styles.alertCancelBtn, { backgroundColor: theme.surfaceVariant }]}
                                onPress={() => setIsLogoutAlertVisible(false)}
                            >
                                <Text style={[styles.alertCancelText, { color: theme.text }]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.alertConfirmBtn, { backgroundColor: theme.danger }]}
                                onPress={confirmLogout}
                            >
                                <Text style={styles.alertConfirmText}>Sí, salir</Text>
                            </TouchableOpacity>
                        </View>
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
        fontSize: 22,
    },
    profileButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    profileImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
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
    // Estilos del Modal (Inspirados en DashboardDriver / SettingsGearButton)
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 10,
        alignItems: 'center',
    },
    modalHeader: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        position: 'relative',
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: 'Poppins-Bold',
    },
    closeModalButton: {
        position: 'absolute',
        right: 0,
        padding: 2,
    },
    modalSub: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        marginBottom: 20,
    },
    optionsRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
        marginBottom: 16,
    },
    optionCard: {
        flex: 1,
        borderRadius: 16,
        borderWidth: 1,
        paddingVertical: 20,
        alignItems: 'center',
    },
    iconCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        elevation: 2,
    },
    optionLabel: {
        fontSize: 14, // Reducido un punto para asegurar que quepa el texto largo
        fontFamily: 'Poppins-Bold',
        marginBottom: 2,
        textAlign: 'center',
        paddingHorizontal: 4,
    },
    optionSub: {
        fontSize: 11,
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
    },
    logoutModalBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1.5,
    },
    logoutModalText: {
        fontSize: 15,
        fontFamily: 'Poppins-Bold',
        marginLeft: 8,
    },
    alertContent: {
        width: '85%',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
    },
    alertIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    alertTitle: {
        fontSize: 20,
        fontFamily: 'Poppins-Bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    alertMessage: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    alertActions: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    alertCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },
    alertCancelText: {
        fontSize: 15,
        fontFamily: 'Poppins-SemiBold',
    },
    alertConfirmBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },
    alertConfirmText: {
        color: '#fff',
        fontSize: 15,
        fontFamily: 'Poppins-SemiBold',
    }
});


export default DashboardPasajero;
