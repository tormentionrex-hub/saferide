const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// react-native-maps es solo-nativo; en web se reemplaza por un stub
// para que el bundle no falle (Importing native-only module ... on web).
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    (moduleName === 'react-native-maps' || moduleName.startsWith('react-native-maps/'))
  ) {
    return {
      filePath: path.resolve(__dirname, 'web-mocks', 'react-native-maps.js'),
      type: 'sourceFile',
    };
  }
  // datetimepicker no tiene implementación web (no renderiza nada): en web se
  // usa un diálogo con <input type="date|time"> del navegador.
  if (platform === 'web' && moduleName === '@react-native-community/datetimepicker') {
    return {
      filePath: path.resolve(__dirname, 'web-mocks', 'datetimepicker.js'),
      type: 'sourceFile',
    };
  }
  // 2.6.4 revienta en el navegador (TDZ de _request); copia corregida solo para web.
  if (platform === 'web' && moduleName === 'react-native-google-places-autocomplete') {
    return {
      filePath: path.resolve(__dirname, 'web-mocks', 'google-places-autocomplete.js'),
      type: 'sourceFile',
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
