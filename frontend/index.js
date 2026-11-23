import { registerRootComponent } from 'expo';

import App from './App';
import { installWebAlert } from './src/utils/webAlert';

// Alert.alert no hace nada en react-native-web; en web usa los diálogos del navegador.
installWebAlert();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
