import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ApiHealthCheckScreen from './src/screens/ApiHealthCheckScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import VerificationScreen from './src/screens/VerificationScreen';
import CreatePasswordScreen from './src/screens/CreatePasswordScreen';
import AccountVerificationSucess from './src/screens/AccountVerificationSucess';
import RoleSelectionScreen from './src/screens/RoleSelectionScreen';
import SignInScreen from './src/screens/SignInScreen';
import SplashScreen from './src/screens/SplashScreen';
import LoginSuccessScreen from './src/screens/LoginSuccessScreen';
// Importación de los dashboards para la redirección después del login
import DashboardPasajero from './src/screens/DashboardPasajero';
import DashboardDriver from './src/screens/DashboardDriver';
import SearchRide from './src/screens/SearchRide';
import History from './src/screens/History';
import Settings from './src/screens/Settings';
import Metrics from './src/screens/Metrics';
import PublishRide from './src/screens/PublishRide';
import ManageRequests from './src/screens/ManageRequests';
import DriverMetrics from './src/screens/DriverMetrics';
import ListOfDrivers from './src/screens/ListOfDrivers';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right', // Animación fluida por defecto (abrir/cerrar)
          animationDuration: 400,
        }}
      >
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{ 
            headerShown: false, 
            animation: 'fade' // Entrada y salida suave para el splash
          }}
        />
        <Stack.Screen
          name="Login"
          component={RegisterScreen}
          options={{ 
            animation: 'fade', // Transición más suave al primer paso
          }}
        />
        <Stack.Screen
          name="Verification"
          component={VerificationScreen}
        />
        <Stack.Screen
          name="CreatePassword"
          component={CreatePasswordScreen}
        />
        <Stack.Screen
          name="AccountVerificationSucess"
          component={AccountVerificationSucess}
          options={{ 
            animation: 'fade_from_bottom', // Aparece como un logro alcanzado
          }}
        />
        <Stack.Screen
          name="RoleSelection"
          component={RoleSelectionScreen}
          options={{ 
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="SignIn"
          component={SignInScreen}
        />
        <Stack.Screen
          name="LoginSuccess"
          component={LoginSuccessScreen}
          options={{ 
            animation: 'fade', 
            gestureEnabled: false 
          }}
        />
        {/* Dashboard de Pasajero */}
        <Stack.Screen
          name="DashboardPasajero"
          component={DashboardPasajero}
          options={{ 
            animation: 'fade', 
            gestureEnabled: false 
          }}
        />
        {/* Dashboard de Conductor */}
        <Stack.Screen
          name="DashboardDriver"
          component={DashboardDriver}
          options={{ 
            animation: 'fade', 
            gestureEnabled: false 
          }}
        />
        {/* Buscar Viaje */}
        <Stack.Screen
          name="SearchRide"
          component={SearchRide}
        />
        {/* Historial de viajes */}
        <Stack.Screen
          name="History"
          component={History}
        />
        {/* Configuración */}
        <Stack.Screen
          name="Settings"
          component={Settings}
        />
        {/* Métricas */}
        <Stack.Screen
          name="Metrics"
          component={Metrics}
        />
        <Stack.Screen
          name="Home"
          component={ApiHealthCheckScreen}
          options={{ 
            title: 'Dashboard', 
            headerBackVisible: false,
            animation: 'slide_from_left' // Diferencia el área administrativa
          }}
        />
        {/* Screens del Conductor */}
        <Stack.Screen name="PublishRide" component={PublishRide} />
        <Stack.Screen name="ManageRequests" component={ManageRequests} />
        <Stack.Screen name="DriverMetrics" component={DriverMetrics} />

        {/* Pantalla para resultados de búsqueda de viajes (Pasajeros) */}
        <Stack.Screen name="ListOfDrivers" component={ListOfDrivers} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}
