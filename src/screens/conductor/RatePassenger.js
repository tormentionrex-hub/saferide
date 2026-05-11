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
            accentColor="#1976D2"
            badgeColor={{ bg: '#E3F2FD', icon: '#1976D2' }}
            onSuccess={() => navigation.navigate('MainTabsDriver', { screen: 'DashboardDriver' })}
            onSkip={() => navigation.navigate('MainTabsDriver', { screen: 'DashboardDriver' })}
        />
    );
};

export default RatePassenger;
