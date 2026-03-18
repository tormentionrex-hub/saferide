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

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash">
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={RegisterScreen}
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="Verification"
          component={VerificationScreen}
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="CreatePassword"
          component={CreatePasswordScreen}
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="AccountVerificationSucess"
          component={AccountVerificationSucess}
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="RoleSelection"
          component={RoleSelectionScreen}
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="SignIn"
          component={SignInScreen}
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="LoginSuccess"
          component={LoginSuccessScreen}
          options={{ headerShown: false, animation: 'fade', gestureEnabled: false }}
        />
        {/* Dashboard de Pasajero: se redirige aquí si el usuario logueado es de tipo 'pasajero' */}
        <Stack.Screen
          name="DashboardPasajero"
          component={DashboardPasajero}
          options={{ headerShown: false, animation: 'fade', gestureEnabled: false }}
        />
        {/* Dashboard de Conductor: se redirige aquí si el usuario logueado es de tipo 'conductor' */}
        <Stack.Screen
          name="DashboardDriver"
          component={DashboardDriver}
          options={{ headerShown: false, animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen
          name="Home"
          component={ApiHealthCheckScreen}
          options={{ title: 'Dashboard', headerBackVisible: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
