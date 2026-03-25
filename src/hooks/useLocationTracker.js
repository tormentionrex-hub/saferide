import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import api from '../services/api';

export const useLocationTracker = (inTrip = false) => {
    const [location, setLocation] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const locationSubscription = useRef(null);

    useEffect(() => {
        let isMounted = true;

        const startTracking = async () => {
            try {
                // 1. Request Foreground Permissions
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setErrorMsg('Permiso de GPS denegado');
                    return;
                }

                // 2. Optimization: Aggressive tracking only if "inTrip" is true
                if (inTrip) {
                    locationSubscription.current = await Location.watchPositionAsync(
                        {
                            accuracy: Location.Accuracy.High,
                            timeInterval: 10000, // Every 10 seconds
                            distanceInterval: 50, // Or every 50 meters
                        },
                        (newLocation) => {
                            if (!isMounted) return;
                            const coords = {
                                lat: newLocation.coords.latitude,
                                lng: newLocation.coords.longitude
                            };
                            setLocation(coords);
                            
                            // 3. Ping Backend in background
                            api.post('/location/update', { ...coords, inTrip: true })
                               .catch(err => console.log('Error enviando GPS al server:', err));
                        }
                    );
                }
            } catch (error) {
                setErrorMsg('El GPS debe estar encendido');
            }
        };

        if (inTrip) {
            startTracking();
        }

        // Cleanup to prevent zombie battery drain
        return () => {
            isMounted = false;
            if (locationSubscription.current) {
                locationSubscription.current.remove();
            }
        };
    }, [inTrip]);

    return { location, errorMsg };
};
