import React from 'react';
import RatingScreen from '../shared/RatingScreen';

const RateDriver = ({ route, navigation }) => {
    const { rideId, driverId, driverName, driverImage } = route.params;

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
            onSuccess={() => navigation.navigate('MainTabsPasajero', { screen: 'SearchRide' })}
            onSkip={() => navigation.navigate('MainTabsPasajero', { screen: 'SearchRide' })}
        />
    );
};

export default RateDriver;
