import React, { useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Image,
    SafeAreaView, StatusBar, Platform, Dimensions, ScrollView, ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDriverTheme } from '../../context/DriverThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';

const { width } = Dimensions.get('window');

const SearchRide = ({ navigation }) => {
    const { theme } = useDriverTheme();
    const insets = useSafeAreaInsets();
    const [userPhoto, setUserPhoto] = useState(null);
    const [userName, setUserName] = useState('');
    const [isChecking, setIsChecking] = useState(true);

    useFocusEffect(
        useCallback(() => {
            let intervalId;

            const loadUserData = async () => {
                const photo = await AsyncStorage.getItem('userPhoto');
                const name = await AsyncStorage.getItem('userName');
                
                if (photo && (photo.startsWith('http') || photo.startsWith('file'))) {
                    setUserPhoto(photo);
                } else {
                    setUserPhoto(null);
                }
                if (name) setUserName(name);
            };

            const checkActiveTrip = async () => {
                try {
                    // Consultamos reservas confirmadas del usuario
                    const resConfirmed = await api.get('/bookings?status=confirmed&limit=5');
                    const resPending = await api.get('/bookings?status=pending&limit=5');

                    let activeBooking = null;

                    if (resConfirmed.data?.success) {
                        const bookings = resConfirmed.data.data || [];
                        activeBooking = bookings.find(b => {
                            const rideStatus = b.ride_id?.status;
                            return rideStatus === 'in progress' || rideStatus === 'scheduled';
                        });
                        
                        if (activeBooking) {
                            const rideStatus = activeBooking.ride_id?.status;
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
                    setIsChecking(false);
                } catch (error) {
                    console.log('Error silenciado verificando viajes activos en SearchRide:', error?.message);
                    setIsChecking(false);
                }
            };

            loadUserData();
            checkActiveTrip();
            // Poll cada 15 segundos (balance entre rapidez y ahorro de batería/datos)
            intervalId = setInterval(checkActiveTrip, 15000); 

            return () => {
                if (intervalId) clearInterval(intervalId);
            };
        }, [navigation])
    );

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#F1F5F9' }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            
            {/* HEADER CUSTOM */}
            <View style={[
                styles.header, 
                { 
                    paddingTop: insets.top > 0 ? insets.top + 10 : 25,
                    backgroundColor: theme.bg,
                    borderBottomColor: theme.divider || '#CBD5E1',
                    borderBottomWidth: 1,
                    elevation: 4, // Añadido para dar profundidad
                }
            ]}>
                <TouchableOpacity 
                    onPress={() => navigation.navigate('CustomizeApp')}
                    style={styles.headerIcon}
                >
                    <Ionicons name="settings-sharp" size={24} color={theme.text} />
                </TouchableOpacity>
                
                <Text style={[styles.headerTitle, { color: theme.navActive }]}>Viajes</Text>
                
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
            </View>

            {/* CONTENIDO SCROLLABLE O LOADER */}
            {isChecking ? (
                <View style={[styles.content, { backgroundColor: '#F1F5F9', flex: 1 }]}>
                    <ActivityIndicator size="large" color={theme.navActive} />
                    <Text style={{ marginTop: 15, color: theme.textSecondary }}>Cargando información...</Text>
                </View>
            ) : (
                <ScrollView 
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    style={{ backgroundColor: '#F1F5F9' }}
                >
                    <View style={[styles.content]}>
                        <Text style={[styles.mainTitle, { color: theme.text }]}>
                            No estás en ningún viaje actualmente
                        </Text>
                    
                    <Text style={[styles.subTitle, { color: theme.textSecondary }]}>
                        Por favor busca un viaje para comenzar
                    </Text>

                    <View style={[styles.iconContainer, { backgroundColor: '#E2E8F0' }]}>
                        <View style={[styles.innerCircle, { backgroundColor: '#fff', elevation: 2 }]}>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    headerIcon: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontFamily: 'Poppins-Bold',
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
        fontSize: 16,
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
        fontSize: 32,
        fontFamily: 'Poppins-Bold',
        textAlign: 'center',
        lineHeight: 40,
        marginBottom: 16,
    },
    subTitle: {
        fontSize: 16,
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
        fontSize: 18,
        fontFamily: 'Poppins-Bold',
    },
});

export default SearchRide;
