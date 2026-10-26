import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import RatingScreen from '../shared/RatingScreen';
import { devLog } from '../../utils/devLog';

const RateDriver = ({ route, navigation }) => {
    const {
        rideId,
        driverId,
        driverName,
        driverImage,
        bookingId: bookingIdParam,
        bookingStatus: bookingStatusParam,
    } = route.params || {};

    // El back (hardware Android) siempre va al Dashboard, nunca al stack
    // anterior — al venir de PayForTravel (skip pago) o de TripInProgress
    // no tiene sentido dejar al pasajero volver a la pantalla previa.
    const goToDashboard = useCallback(() => {
        navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabsPasajero', params: { screen: 'DashboardPasajero' } }],
        });
    }, [navigation]);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => { goToDashboard(); return true; };
            const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => sub.remove();
        }, [goToDashboard])
    );

    // Inicializamos desde route.params para reaccionar correctamente al booking
    // individual desde el primer render (evita flicker / habilitación temporal).
    // Si el flujo que nos invoca no pasa bookingStatus, el useEffect lo resolverá.
    // La UI se habilita/deshabilita en función del status del booking del pasajero,
    // NO del status del ride.
    const [bookingStatus, setBookingStatus] = useState(bookingStatusParam ?? null);

    useEffect(() => {
        // Si ya tenemos el status por params no hace falta consultar el backend.
        if (bookingStatusParam) return;

        let mounted = true;
        const fetchBookingStatus = async () => {
            try {
                if (bookingIdParam) {
                    const res = await api.get(`/bookings/${bookingIdParam}`);
                    if (!mounted) return;
                    if (res.data?.success) {
                        setBookingStatus(res.data.data?.status ?? null);
                    }
                    return;
                }
                if (!rideId) return;
                // /bookings devuelve los bookings del usuario autenticado;
                // buscamos el que corresponde a este ride.
                const res = await api.get('/bookings');
                if (!mounted) return;
                if (res.data?.success) {
                    const rid = String(rideId);
                    const booking = (res.data.data || []).find(b => {
                        const brid = b.ride_id?._id?.toString?.()
                            || b.ride_id?.toString?.();
                        return brid === rid;
                    });
                    setBookingStatus(booking?.status ?? null);
                }
            } catch (e) {
                devLog('[RateDriver] No se pudo cargar el booking:', e?.message);
            }
        };
        fetchBookingStatus();
        return () => { mounted = false; };
    }, [rideId, bookingIdParam, bookingStatusParam]);

    const isCancelled = bookingStatus === 'cancelled' || bookingStatus === 'canceled';

    return (
        <RatingScreen
            rideId={rideId}
            revieweeId={driverId}
            personName={driverName}
            personImage={driverImage}
            personRole="Conductor"
            title="Por favor califique su experiencia"
            subtitle="Calificar al conductor"
            accentColor="#1976D2"
            badgeColor={{ bg: '#E3F2FD', icon: '#1976D2' }}
            disabled={isCancelled}
            onSuccess={goToDashboard}
            onSkip={goToDashboard}
        />
    );
};

export default RateDriver;
