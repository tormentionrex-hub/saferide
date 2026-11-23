import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import api from '../services/api';
import { devLog } from '../utils/devLog';

const subscribers = new Set();
let watchSubscription = null;
let startingWatcher = null;
let lastLocation = null;

const publish = (coords) => {
  subscribers.forEach((subscriber) => subscriber.setLocation(coords));
};

const reportError = (message) => {
  subscribers.forEach((subscriber) => subscriber.setErrorMsg(message));
};

const sendLocation = (coords) => {
  api.post('/location/update', coords).catch((error) => {
    devLog('Error enviando GPS al server:', error?.response?.data?.message || error?.message || 'unknown error');
  });
};

const ensureWatcher = () => {
  if (watchSubscription || startingWatcher) return startingWatcher;

  startingWatcher = (async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        reportError('Permiso de GPS denegado');
        return;
      }

      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(() => null);
      if (initial) {
        lastLocation = {
          lat: initial.coords.latitude,
          lng: initial.coords.longitude,
        };
        publish(lastLocation);
        sendLocation(lastLocation);
      }

      watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 50,
        },
        (newLocation) => {
          const coords = {
            lat: newLocation.coords.latitude,
            lng: newLocation.coords.longitude,
          };
          lastLocation = coords;
          publish(coords);
          sendLocation(coords);
        }
      );
    } catch (error) {
      reportError('El GPS debe estar encendido');
    } finally {
      startingWatcher = null;
    }
  })();

  return startingWatcher;
};

const releaseWatcher = () => {
  if (subscribers.size > 0 || !watchSubscription) return;
  watchSubscription.remove();
  watchSubscription = null;
};

export const useLocationTracker = () => {
  const [location, setLocation] = useState(lastLocation);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const subscriber = { setLocation, setErrorMsg };
    subscribers.add(subscriber);
    ensureWatcher();

    return () => {
      subscribers.delete(subscriber);
      releaseWatcher();
    };
  }, []);

  return { location, errorMsg };
};
