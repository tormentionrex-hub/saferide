import React from 'react';
import RatingScreen from '../shared/RatingScreen';

const RatePassenger = ({ route, navigation }) => {
    const { rideId, passengerId, passengerName, passengerImage } = route.params;

    return (
        <RatingScreen
            rideId={rideId}
            revieweeId={passengerId}
            personName={passengerName}
            personImage={passengerImage}
            personRole="Pasajero"
            title="Por favor califique su experiencia"
            subtitle="Calificar al pasajero"
            accentColor="#EF5350"
            badgeColor={{ bg: '#E8F5E9', icon: '#4CAF50' }}
            onSuccess={() => navigation.navigate('MainTabsDriver')}
            onSkip={() => navigation.navigate('MainTabsDriver')}
        />
    );
};

export default RatePassenger;
