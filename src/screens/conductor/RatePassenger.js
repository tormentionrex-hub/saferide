import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import RatingScreen from '../shared/RatingScreen';

const RatePassenger = ({ route, navigation }) => {
    const {
        rideId,
        passengerId,
        passengerName,
        passengerImage,
        bookingId: bookingIdParam,
        bookingStatus: bookingStatusParam,
    } = route.params || {};

    // El back hardware siempre va al Dashboard del conductor, nunca al stack
    // anterior — venir de ListOfRequests/PaymentVerification y volver allí
    // no tiene sentido una vez que ya se calificó (o se omitió la calificación).
    const goToDashboard = useCallback(() => {
        navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabsDriver', params: { screen: 'DashboardDriver' } }],
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
    // La UI se habilita/deshabilita en función del status de este booking,
    // NO del status del ride: un mismo ride puede tener múltiples bookings con
    // estados independientes en el futuro.
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
                if (!rideId || !passengerId) return;
                const res = await api.get(`/bookings/ride/${rideId}`);
                if (!mounted) return;
                if (res.data?.success) {
                    const pid = passengerId?.toString?.() || String(passengerId);
                    const booking = (res.data.data || []).find(b => {
                        const bpid = b.passenger_id?._id?.toString?.()
                            || b.passenger_id?.toString?.();
                        return bpid === pid;
                    });
                    setBookingStatus(booking?.status ?? null);
                }
            } catch (e) {
                console.log('[RatePassenger] No se pudo cargar el booking:', e?.message);
            }
        };
        fetchBookingStatus();
        return () => { mounted = false; };
    }, [rideId, passengerId, bookingIdParam, bookingStatusParam]);

    const isCancelled = bookingStatus === 'cancelled' || bookingStatus === 'canceled';

    return (
        <RatingScreen
            rideId={rideId}
            revieweeId={passengerId}
            personName={passengerName}
            personImage={passengerImage}
            personRole="Pasajero"
            title="Por favor califique su experiencia"
            subtitle="Calificar al pasajero"
            accentColor="#1976D2"
            badgeColor={{ bg: '#E3F2FD', icon: '#1976D2' }}
            disabled={isCancelled}
            onSuccess={goToDashboard}
            onSkip={goToDashboard}
        />
    );
};

export default RatePassenger;
