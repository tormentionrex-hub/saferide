import React, { useState, useCallback, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Image,
    SafeAreaView, StatusBar, Platform, Dimensions, ScrollView, ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDriverTheme } from '../../context/DriverThemeContext';
import api from '../../services/api';
import ScreenHeader from '../../components/ScreenHeader';

import { moderateScale } from '../../utils/responsive';
import { devLog } from '../../utils/devLog';
const { width } = Dimensions.get('window');

const SearchRide = ({ navigation }) => {
    const { theme } = useDriverTheme();
    const [userPhoto, setUserPhoto] = useState(null);
    const [userName, setUserName] = useState('');
    const [isChecking, setIsChecking] = useState(true);
    // Refs de control de ciclo de vida y anti-solapamiento (se reinician al entrar a foco)
    const mountedRef = useRef(true);
    const isFetchingRef = useRef(false);

    useFocusEffect(
        useCallback(() => {
            let intervalId;
            // Al obtener foco: reactivar montaje y limpiar bandera (cubre el caso re-foco)
            mountedRef.current = true;
            isFetchingRef.current = false;

            const loadUserData = async () => {
                const photo = await AsyncStorage.getItem('userPhoto');
                const name = await AsyncStorage.getItem('userName');
                if (!mountedRef.current) return;

                if (photo && (photo.startsWith('http') || photo.startsWith('file'))) {
                    setUserPhoto(photo);
                } else {
                    setUserPhoto(null);
                }
                if (name) setUserName(name);
            };

            const checkActiveTrip = async () => {
                // Anti-solapamiento: si la cascada anterior aún corre, saltamos este tick
                if (isFetchingRef.current) return;
                isFetchingRef.current = true;
                try {
                    // Consultamos reservas confirmadas del usuario
                    const resConfirmed = await api.get('/bookings?status=confirmed&limit=5');
                    if (!mountedRef.current) return;
                    const resPending = await api.get('/bookings?status=pending&limit=5');
                    if (!mountedRef.current) return;

                    let activeBooking = null;

                    if (resConfirmed.data?.success) {
                        const bookings = resConfirmed.data.data || [];
                        activeBooking = bookings.find(b => {
                            const rideStatus = b.ride_id?.status;
                            return (
                                rideStatus === 'in progress' ||
                                rideStatus === 'scheduled' ||
                                rideStatus === 'awaiting_payment_verification'
                            );
                        });

                        if (activeBooking) {
                            const rideStatus = activeBooking.ride_id?.status;
                            // Si el ride está esperando verificación de pago,
                            // saltamos directo al paso de pago que corresponda
                            // según payment_type / payment_status. Si seguimos
                            // mandando al pasajero a TripInProgress, su polling
                            // lo redirigiría igual pero con un flash de la
                            // pantalla "Viaje en curso" antes — UX peor.
                            if (rideStatus === 'awaiting_payment_verification') {
                                // El conductor finalizó pero no ha tocado
                                // Continuar en PaymentVerification. El viaje
                                // NO está cerrado: gifted/paid esperan en
                                // WaitingPaymentConfirmation hasta que el
                                // conductor confirme y el booking pase a
                                // 'completed'. Pending va a pagar.
                                const ride = activeBooking.ride_id;
                                const rideIdStr = ride?._id?.toString() || ride?.toString();
                                const driverIdStr = ride?.driver_id?._id?.toString() || ride?.driver_id?.toString();
                                const driverNameStr = ride?.driver_id?.name;
                                const driverImageStr = ride?.driver_id?.profileImage;
                                const storedMethod = await AsyncStorage.getItem('paymentMethod');

                                if (
                                    activeBooking.payment_type === 'gifted' ||
                                    activeBooking.payment_status === 'paid'
                                ) {
                                    navigation.replace('WaitingPaymentConfirmation', {
                                        bookingId: activeBooking._id,
                                        rideId: rideIdStr,
                                        driverId: driverIdStr,
                                        driverName: driverNameStr,
                                        driverImage: driverImageStr,
                                        paymentMethod:
                                            activeBooking.payment_type === 'gifted'
                                                ? 'gifted'
                                                : storedMethod || '',
                                        chargedAmount: activeBooking.charged_amount ?? null,
                                    });
                                } else {
                                    navigation.replace('PayForTravel', {
                                        bookingId: activeBooking._id,
                                        rideId: rideIdStr,
                                        driverId: driverIdStr,
                                        driverName: driverNameStr,
                                        driverImage: driverImageStr,
                                        paymentMethod: storedMethod || '',
                                        chargedAmount: activeBooking.charged_amount ?? null,
                                    });
                                }
                                return;
                            }

                            const dest = rideStatus === 'in progress' ? 'TripInProgress' : 'WaitingForTheStart';
                            navigation.replace(dest, { bookingId: activeBooking._id });
                            return;
                        }
                    }

                    if (!activeBooking && resPending.data?.success) {
                        const bookings = resPending.data.data || [];
                        const pendingBooking = bookings.find(b => b.status === 'pending');
                        if (pendingBooking) {
                            navigation.replace('ScreenSaver', { bookingId: pendingBooking._id });
                            return;
                        }
                    }

                    // Si no hay viajes activos confirmados ni en proceso y termina, quitamos el loader
                    if (mountedRef.current) setIsChecking(false);
                } catch (error) {
                    devLog('Error silenciado verificando viajes activos en SearchRide:', error?.message);
                    if (mountedRef.current) setIsChecking(false);
                } finally {
                    // Liberar bandera siempre, sobrevive a excepciones
                    isFetchingRef.current = false;
                }
            };

            loadUserData();
            checkActiveTrip();
            // Poll cada 15 segundos (balance entre rapidez y ahorro de batería/datos)
            intervalId = setInterval(checkActiveTrip, 15000);

            return () => {
                mountedRef.current = false;
                isFetchingRef.current = false;
                if (intervalId) clearInterval(intervalId);
            };
        }, [navigation])
    );

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            
            <ScreenHeader
                title="Viajes"
                right={
                    <TouchableOpacity
                        onPress={() => navigation.navigate('PasajeroProfileScreen')}
                        style={styles.profileButton}
                    >
                        {userPhoto ? (
                            <Image source={{ uri: userPhoto }} style={styles.profileImg} />
                        ) : (
                            <View style={[styles.profileFallback, { backgroundColor: theme.surfaceVariant }]}>
                                <Text style={[styles.initialsText, { color: theme.navActive }]}>
                                    {getInitials(userName)}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                }
            />

            {/* CONTENIDO SCROLLABLE O LOADER */}
            {isChecking ? (
                <View style={[styles.content, { backgroundColor: theme.bg, flex: 1 }]}>
                    <ActivityIndicator size="large" color={theme.navActive} />
                    <Text style={{ marginTop: 15, color: theme.textSecondary }}>Cargando información...</Text>
                </View>
            ) : (
                <ScrollView 
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    style={{ backgroundColor: theme.bg }}
                >
                    <View style={[styles.content]}>
                        <Text style={[styles.mainTitle, { color: theme.text }]}>
                            No estás en ningún viaje actualmente
                        </Text>
                    
                    <Text style={[styles.subTitle, { color: theme.textSecondary }]}>
                        Por favor busca un viaje para comenzar
                    </Text>

                    <View style={[styles.iconContainer, { backgroundColor: theme.surfaceVariant }]}>
                        <View style={[styles.innerCircle, { backgroundColor: theme.surface, elevation: 2 }]}>
                            <Ionicons name="hourglass-outline" size={60} color={theme.navActive} />
                        </View>
                    </View>

                    <TouchableOpacity 
                        style={[styles.searchButton, { backgroundColor: theme.navActive }]}
                        onPress={() => navigation.navigate('BuscarViaje')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="search" size={20} color="#fff" style={styles.buttonIcon} />
                        <Text style={styles.buttonText}>Buscar un viaje</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    profileButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    profileImg: {
        width: '100%',
        height: '100%',
    },
    profileFallback: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    initialsText: {
        fontSize: moderateScale(16),
        fontFamily: 'Poppins-Bold',
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 100, // Espacio para que el BottomBar no tape nada
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
        paddingVertical: 40,
    },
    mainTitle: {
        fontSize: moderateScale(32),
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
        lineHeight: 40,
        marginBottom: 16,
    },
    subTitle: {
        fontSize: moderateScale(16),
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        marginBottom: 40,
    },
    iconContainer: {
        width: 180,
        height: 180,
        borderRadius: 90,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 60,
    },
    innerCircle: {
        width: 140,
        height: 140,
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 25,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    buttonIcon: {
        marginRight: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: moderateScale(18),
        fontFamily: 'Poppins-Bold',
    },
});

export default SearchRide;
