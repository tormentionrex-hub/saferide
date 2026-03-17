import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import VerificationScreen from './src/screens/VerificationScreen';
import CreatePasswordScreen from './src/screens/CreatePasswordScreen';
import AccountVerificationSucess from './src/screens/AccountVerificationSucess';
import TellUsAboutYouScreen from './src/screens/TellUsAboutYouScreen';
import RoleSelectionScreen from './src/screens/RoleSelectionScreen';
import SignInScreen from './src/screens/SignInScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen
          name="Login"
          component={RegisterScreen}
          options={{ headerShown: false }}
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
          name="TellUsAboutYou"
          component={TellUsAboutYouScreen}
          options={{ headerShown: false, animation: 'slide_from_right' }}
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
          name="Home"
          component={HomeScreen}
          options={{ title: 'Dashboard', headerBackVisible: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
