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
    Image,
    DeviceEventEmitter,
    ScrollView,
    InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import sessionStorage from '../../services/sessionStorage';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { useCustomAlert } from '../../context/CustomAlertContext';
import api from '../../services/api';
import passengerBookingsCache from '../../services/passengerBookingsCache';
import ScrollIndicator, { useScrollIndicator } from '../../components/ScrollIndicator';
import NotificationBell from '../../components/NotificationBell';
import NotificationCenterModal from '../../components/NotificationCenterModal';
import { useNotifications } from '../../hooks/useNotifications';

// Obtenemos dimensiones de la pantalla para garantizar responsividad
const { height, width } = Dimensions.get('window');

const DashboardPasajero = ({ navigation, route }) => {
    const { theme } = useDriverTheme();
    const isDark = theme.dark;
    const si = useScrollIndicator();
    const { showAlert } = useCustomAlert();

    // Nombre del usuario: primero intenta route.params (viene del login directo),
    // si está vacío lo lee de AsyncStorage (guardado al hacer login en SignInScreen).
    const [userName, setUserName] = useState(route?.params?.userName || '');
    const [userPhoto, setUserPhoto] = useState(null);
    const [userCompany, setUserCompany] = useState('');
    const [frequentRoutes, setFrequentRoutes] = useState([]);
    const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);

    // ── Centro de notificaciones (campana) ──
    const [notifCenterVisible, setNotifCenterVisible] = useState(false);
    const {
        notifications,
        unreadCount,
        loading: notifLoading,
        markAsRead,
        markAllAsRead,
    } = useNotifications(true);

    // Routing al tap sobre una notificación. Mantenemos la navegación
    // centralizada aquí: el modal NO toca navigation, solo nos avisa.
    const handleNotificationPress = useCallback((notification) => {
        if (notification.status === 'unread') {
            markAsRead(notification._id);
        }
        setNotifCenterVisible(false);

        // Mapeamos tipos del backend a destinos del pasajero.
        switch (notification.type) {
            case 'booking_confirmed':
                // Confirmación recién aceptada → pantalla de espera.
                navigation.navigate('MainTabsPasajero', { screen: 'SearchRide' });
                break;
            case 'ride_started':
                // Viaje arrancó → TripInProgress (sin bookingId; la pantalla
                // tiene fallback que busca el booking activo automáticamente).
                navigation.navigate('TripInProgress');
                break;
            case 'ride_completed':
            case 'booking_cancelled':
            case 'booking_denied':
            case 'ride_cancelled':
                navigation.navigate('History');
                break;
            default:
                // system / ride_reminder / trust_score_updated / review_request
                // No navegamos: solo cerramos el modal.
                break;
        }
    }, [navigation, markAsRead]);

    React.useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('profileUpdated', (newPhoto) => {
            if (newPhoto) setUserPhoto(newPhoto);
        });
        return () => subscription.remove();
    }, []);

    useFocusEffect(
        useCallback(() => {
            // 1) Hidratación inmediata desde AsyncStorage — pinta el header sin
            //    esperar red. Si hay datos cacheados de un foco anterior, el
            //    usuario ve "Hola, <nombre>" y su foto al instante.
            (async () => {
                try {
                    const [cachedName, cachedPhoto, cachedCompany] = await Promise.all([
                        AsyncStorage.getItem('userName'),
                        AsyncStorage.getItem('userPhoto'),
                        AsyncStorage.getItem('userCompany'),
                    ]);
                    if (cachedName) setUserName(cachedName);
                    if (cachedPhoto && (cachedPhoto.startsWith('http') || cachedPhoto.startsWith('file'))) {
                        setUserPhoto(cachedPhoto);
                    }
                    if (cachedCompany) setUserCompany(cachedCompany);
                } catch (_) { }
            })();

            // 2) Trabajo pesado (red + rutas frecuentes) diferido hasta que las
            //    animaciones del tab terminen, para no robarle frames a la
            //    transición de pantalla.
            const task = InteractionManager.runAfterInteractions(async () => {
                // Refrescar perfil desde el backend
                try {
                    const meRes = await api.get('/auth/me');
                    if (meRes.data.success) {
                        const user = meRes.data.data;
                        if (user.name) setUserName(user.name);
                        setUserPhoto(user.profileImage || null);
                        if (user.company) setUserCompany(user.company);
                        sessionStorage.setSession(user).catch(() => { });
                    }
                } catch (_) {
                    // Si falla la red, los valores hidratados desde AsyncStorage
                    // ya están en pantalla — no es necesario re-leerlos.
                }

                // ── Cargar rutas frecuentes y pagos pendientes ──
                try {
                    const bookings = await passengerBookingsCache.get();
                    if (bookings && bookings.length > 0) {
                        const completed = bookings.filter(
                            b => b.status === 'completed' && b.ride_id?.origin && b.ride_id?.destination
                        );
                        // Agrupar por par origen→destino (por nombre)
                        const routeMap = {};
                        completed.forEach(b => {
                            const ride = b.ride_id;
                            const key = `${ride.origin.name}|||${ride.destination.name}`;
                            if (!routeMap[key]) {
                                routeMap[key] = {
                                    count: 0,
                                    origin: {
                                        name: ride.origin.name,
                                        lat: ride.origin.coordinates?.lat,
                                        lng: ride.origin.coordinates?.lng,
                                    },
                                    destination: {
                                        name: ride.destination.name,
                                        lat: ride.destination.coordinates?.lat,
                                        lng: ride.destination.coordinates?.lng,
                                    },
                                };
                            }
                            routeMap[key].count += 1;
                        });
                        // Ordenar y tomar top 2 (solo rutas con 4+ viajes)
                        const sorted = Object.values(routeMap)
                            .filter(r => r.count >= 4)
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 2);
                        setFrequentRoutes(sorted);
                    }
                } catch (e) {
                    console.log('Frequent routes load error:', e);
                }
            });
            return () => task.cancel();
        }, [])
    );

    return (
        <View style={[styles.safeAreaWrapper, { backgroundColor: theme.bg }]}>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>

            {/* Barra de estado adaptativa */}
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            
            {/* Encabezado: Texto 'Pasajero' y Tuerquita */}
            <View style={[styles.header, { borderBottomColor: theme.divider || '#CBD5E1', borderBottomWidth: 1 }]}>
                <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('CustomizeApp')}>
                    <Ionicons name="settings-sharp" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text
                    style={[styles.headerTitle, { color: theme.navActive || '#005BBF' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                >Pasajero</Text>

                <View style={styles.headerRight}>
                    <NotificationBell
                        unreadCount={unreadCount}
                        color={theme.text}
                        onPress={() => setNotifCenterVisible(true)}
                    />
                    <TouchableOpacity
                        style={styles.profileButton}
                        onPress={() => navigation.navigate('PasajeroProfileScreen')}
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
            </View>

            {/* Contenido principal del Dashboard */}
            <View style={{ flex: 1 }}>
                <ScrollView 
                    {...si.scrollProps}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >

                {/* Saludo dinámico al usuario */}
                <Text style={[styles.greeting, { color: theme.text }]}>Hola, {userName}</Text>

                {/* Banner rojo de pago pendiente */}
                {pendingPaymentsCount > 0 && (
                    <TouchableOpacity
                        style={styles.pendingBanner}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate('History')}
                    >
                        <View style={styles.pendingBannerIcon}>
                            <Ionicons name="warning" size={20} color="#fff" />
                        </View>
                        <View style={styles.pendingBannerTextWrap}>
                            <Text style={styles.pendingBannerTitle}>
                                Recuerda pagar tu viaje pendiente
                            </Text>
                            <Text style={styles.pendingBannerSub}>
                                Si no lo haces no podrás seguir solicitando viajes. Toca para pagar.
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                )}

                {/* Tarjeta de búsqueda de viajes (Acceso directo principal) */}
                <TouchableOpacity
                    style={[styles.searchCard, { backgroundColor: theme.accent || '#2563EB' }, pendingPaymentsCount > 0 && { opacity: 0.55 }]}
                    onPress={() => {
                        if (pendingPaymentsCount > 0) {
                            showAlert(
                                'Tienes un pago pendiente',
                                'No puedes solicitar nuevos viajes hasta que pagues tu viaje pendiente. Ve al historial para completar el pago.',
                                'warning',
                                'Ir al historial',
                                () => navigation.navigate('History')
                            );
                            return;
                        }
                        navigation.navigate('BuscarViaje');
                    }}
                    activeOpacity={0.9}
                >
                    {/* Contenedor interno para marca de agua sin afectar la sombra */}
                    <View style={[StyleSheet.absoluteFill, { borderRadius: 15, overflow: 'hidden' }]}>
                        <Ionicons name="car" size={140} color="rgba(255,255,255,0.15)" style={styles.watermarkIcon} />
                    </View>

                    <View style={styles.searchIconContainer}>
                        <Ionicons name="search" size={24} color="#ffffff" />
                    </View>
                    <View style={styles.searchTextContainer}>
                        {/* Título de la tarjeta informativo */}
                        <Text style={styles.cardTitle}>Buscar viaje</Text>
                        <Text style={styles.cardSubtitle}>Encuentra tu próximo viaje seguro</Text>
                    </View>
                </TouchableOpacity>

                {/* ── SECCIÓN: Rutas Frecuentes ── */}
                <View style={styles.quickDestinationsWrapper}>
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Rutas Frecuentes</Text>
                    
                    {frequentRoutes.length > 0 && (
                        <View style={styles.quickCardsRow}>
                            {frequentRoutes.map((rt, idx) => {
                                const icons = ['navigate-circle-outline', 'location-outline'];
                                const iconColors = [theme.accent || '#2563EB', '#FF5A5F'];
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={[styles.quickCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder || theme.divider }]}
                                        onPress={() => navigation.navigate('BuscarViaje', {
                                            prefillOrigin: rt.origin,
                                            prefillDestination: rt.destination,
                                        })}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[styles.quickIconCircle, { backgroundColor: theme.iconCircleBg || 'rgba(37, 99, 235, 0.1)' }]}>
                                            <Ionicons name={icons[idx] || 'navigate-outline'} size={26} color={iconColors[idx] || theme.accent} />
                                        </View>
                                        <Text style={[styles.quickCardTitle, { color: theme.text }]} numberOfLines={1}>
                                            {rt.destination.name}
                                        </Text>
                                        <Text style={[styles.quickCardSub, { color: theme.textSecondary }]} numberOfLines={1}>
                                            {rt.count} {rt.count === 1 ? 'viaje' : 'viajes'}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>

                {/* ── BANNER: Comunidad y Gamificación ── */}
                <View style={[styles.ecoBanner, { backgroundColor: isDark ? '#132A1D' : '#ECFDF5', borderColor: isDark ? '#166534' : '#A7F3D0' }]}>
                    <View style={[styles.ecoIconBox, { backgroundColor: isDark ? '#166534' : '#D1FAE5' }]}>
                        <Ionicons name="leaf-outline" size={24} color={isDark ? '#4ADE80' : '#059669'} />
                    </View>
                    <View style={styles.ecoTextCont}>
                        <Text style={[styles.ecoTitle, { color: isDark ? '#6EE7B7' : '#065F46' }]}>Comunidad SafeRide</Text>
                        <Text style={[styles.ecoSub, { color: isDark ? '#A7F3D0' : '#047857' }]}>
                            Al compartir viaje con tus compañeros, ayudas a reducir el tráfico y la huella de carbono.
                        </Text>
                    </View>
                </View>

                </ScrollView>
                <ScrollIndicator si={si} thumbColor={theme.accent} />
            </View>

            <NotificationCenterModal
                visible={notifCenterVisible}
                onClose={() => setNotifCenterVisible(false)}
                notifications={notifications}
                loading={notifLoading}
                markAllAsRead={markAllAsRead}
                onNotificationPress={handleNotificationPress}
            />

        </SafeAreaView>
        </View>
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
    headerIconBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
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
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 120,
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
        fontFamily: 'Poppins-Bold',
        marginBottom: 5,
    },
    cardSubtitle: {
        color: '#ffffff',
        fontSize: 14,
    },
    watermarkIcon: {
        position: 'absolute',
        right: -20,
        bottom: -30,
        transform: [{ rotate: '-15deg' }],
    },
    quickDestinationsWrapper: {
        width: '100%', // Usa 100% porque el contenedor padre ya tiene paddingHorizontal 20
        marginTop: 28,
    },
    sectionTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 14,
        marginBottom: 14,
        letterSpacing: 0.5,
        alignSelf: 'flex-start',
    },
    quickCardsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 14,
    },
    quickCard: {
        flex: 1,
        borderRadius: 18,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    quickIconCircle: {
        width: 54,
        height: 54,
        borderRadius: 27,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    quickCardTitle: {
        fontSize: 14,
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
    },
    quickCardSub: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        marginTop: 2,
    },
    ecoBanner: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 28,
        padding: 18,
        borderRadius: 18,
        borderWidth: 1,
    },
    ecoIconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    ecoTextCont: {
        flex: 1,
    },
    ecoTitle: {
        fontSize: 15,
        fontFamily: 'Poppins-Bold',
        marginBottom: 4,
    },
    ecoSub: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        lineHeight: 18,
    },
    pendingBanner: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#FF3B30',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 18,
        shadowColor: '#FF3B30',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 5,
    },
    pendingBannerIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pendingBannerTextWrap: {
        flex: 1,
    },
    pendingBannerTitle: {
        color: '#fff',
        fontFamily: 'Poppins-Bold',
        fontSize: 14,
        marginBottom: 2,
    },
    pendingBannerSub: {
        color: 'rgba(255,255,255,0.92)',
        fontFamily: 'Poppins-Regular',
        fontSize: 11.5,
        lineHeight: 15,
    },
});


export default DashboardPasajero;
