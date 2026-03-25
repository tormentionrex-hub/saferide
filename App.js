import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DriverThemeProvider } from './src/context/DriverThemeContext';
import { navigationRef } from './src/services/navigationRef';
import ApiHealthCheckScreen from './src/screens/ApiHealthCheckScreen';
import RegisterScreen from './src/screens/register/RegisterScreen';
import TermsServiceScreen from './src/screens/register/TermsServiceScreen';
import VerificationScreen from './src/screens/register/VerificationScreen';
import CreatePasswordScreen from './src/screens/register/CreatePasswordScreen';
import AccountVerificationSucess from './src/screens/register/AccountVerificationSucess';
import RoleSelectionScreen from './src/screens/register/RoleSelectionScreen';
import SignInScreen from './src/screens/login/SignInScreen';
import SplashScreen from './src/screens/SplashScreen';
import LoginSuccessScreen from './src/screens/login/LoginSuccessScreen';

// Importación de los dashboards para la redirección después del login
import DashboardPasajero from './src/screens/pasajero/DashboardPasajero';
import DashboardDriver from './src/screens/conductor/DashboardDriver';
import SearchRide from './src/screens/pasajero/SearchRide';
import History from './src/screens/pasajero/History';
import Metrics from './src/screens/pasajero/Metrics';
import PublishRide from './src/screens/conductor/PublishRide';
import DriverMetrics from './src/screens/conductor/DriverMetrics';
import ManageRides from './src/screens/conductor/ManageRides';
import AjustesConductor from './src/screens/conductor/AjustesConductor';
import ProfileConductor from './src/screens/conductor/ProfileConductor';
import RegisterVehicleStep1 from './src/screens/conductor/RegisterVehicleStep1';
import RegisterVehicleStep2 from './src/screens/conductor/RegisterVehicleStep2';
import ListOfDrivers from './src/screens/pasajero/ListOfDrivers';
import PasajeroProfileScreen from './src/screens/pasajero/PasajeroProfileScreen';
import CustomizeApp from './src/screens/pasajero/CustomizeApp';
import PaymentMethodScreen from './src/screens/pasajero/PaymentMethodScreen';
import RideDetail from './src/screens/pasajero/RideDetail';
import ScreenSaver from './src/screens/pasajero/ScreenSaver';
import ListOfRequests from './src/screens/conductor/ListOfRequests';
import TripInProgress from './src/screens/pasajero/TripInProgress';
import CurrentTrip from './src/screens/conductor/CurrentTrip';
import RatePassenger from './src/screens/conductor/RatePassenger';
import RateDriver from './src/screens/pasajero/RateDriver';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BottomNavigationBar from './src/components/BottomNavigationBar';

import BottomNavigationDriver from './src/components/BottomNavigationDriver';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabsPasajero() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomNavigationBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="DashboardPasajero" component={DashboardPasajero} />
      <Tab.Screen name="SearchRide" component={SearchRide} />
      <Tab.Screen name="History" component={History} />
      <Tab.Screen name="Metrics" component={Metrics} />
      <Tab.Screen name="ListOfDrivers" component={ListOfDrivers} />
    </Tab.Navigator>
  );
}


function MainTabsDriver() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomNavigationDriver {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="DashboardDriver" component={DashboardDriver} />
      <Tab.Screen name="PublishRide" component={PublishRide} />
      <Tab.Screen name="ManageRides" component={ManageRides} />
      <Tab.Screen name="DriverMetrics" component={DriverMetrics} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <DriverThemeProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: 400,
          }}
        >
          <Stack.Screen
            name="Splash"
            component={SplashScreen}
            options={{
              headerShown: false,
              animation: 'fade'
            }}
          />
          <Stack.Screen
            name="Login"
            component={RegisterScreen}
            options={{
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsServiceScreen}
            options={{
              animation: 'fade',
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
              animation: 'fade_from_bottom',
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

          {/* Tab Navigators para flujos principales */}
          <Stack.Screen
            name="MainTabsPasajero"
            component={MainTabsPasajero}
            options={{
              animation: 'fade',
              gestureEnabled: false
            }}
          />

          <Stack.Screen
            name="MainTabsDriver"
            component={MainTabsDriver}
            options={{
              animation: 'fade',
              gestureEnabled: false
            }}
          />

          <Stack.Screen name="AjustesConductor" component={AjustesConductor} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="ProfileConductor" component={ProfileConductor} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="RegisterVehicleStep1" component={RegisterVehicleStep1} options={{ animation: 'slide_from_right', headerShown: false }} />
          <Stack.Screen name="RegisterVehicleStep2" component={RegisterVehicleStep2} options={{ animation: 'slide_from_right', headerShown: false }} />

          <Stack.Screen
            name="Home"
            component={ApiHealthCheckScreen}
            options={{
              title: 'Dashboard',
              headerBackVisible: false,
              animation: 'slide_from_left'
            }}
          />

          <Stack.Screen
            name="PasajeroProfileScreen"

            component={PasajeroProfileScreen}
            options={{
              headerShown: false,
              animation: 'slide_from_right'
            }}
          />

          <Stack.Screen
            name="CustomizeApp"
            component={CustomizeApp}
            options={{
              headerShown: false,
              animation: 'slide_from_right'
            }}
          />

          <Stack.Screen
            name="PaymentMethod"
            component={PaymentMethodScreen}
            options={{ headerShown: false, animation: 'slide_from_right' }}
          />

          <Stack.Screen
            name="RideDetail"
            component={RideDetail}
            options={{
              headerShown: false,
              animation: 'slide_from_bottom'
            }}
          />
          <Stack.Screen
            name="ScreenSaver"
            component={ScreenSaver}
            options={{
              headerShown: false,
              animation: 'slide_from_bottom'
            }}
          />
          <Stack.Screen
            name="ListOfRequests"
            component={ListOfRequests}
            options={{
              headerShown: false,
              animation: 'slide_from_right'
            }}
          />
          <Stack.Screen
            name="TripInProgress"
            component={TripInProgress}
            options={{
              headerShown: false,
              animation: 'slide_from_right'
            }}
            />
          <Stack.Screen
            name="CurrentTrip"
            component={CurrentTrip}
            options={{
              headerShown: false,
              animation: 'slide_from_right'
            }}
          />
          <Stack.Screen
            name="RatePassenger"
            component={RatePassenger}
            options={{
              headerShown: false,
              animation: 'slide_from_bottom',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="RateDriver"
            component={RateDriver}
            options={{
              headerShown: false,
              animation: 'slide_from_bottom',
              gestureEnabled: false,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </DriverThemeProvider>
  );
}
