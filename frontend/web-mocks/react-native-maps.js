// Stub de react-native-maps para web.
// react-native-maps es un módulo solo-nativo (iOS/Android); en web Metro lo
// reemplaza por este archivo (ver metro.config.js) para que el bundle compile.
// Los mapas se muestran como un contenedor vacío con un aviso.
import React from 'react';
import { View, Text } from 'react-native';

const MapPlaceholder = ({ style, children, ...props }) => (
  <View
    style={[
      { backgroundColor: '#e8eaed', alignItems: 'center', justifyContent: 'center', minHeight: 120 },
      style,
    ]}
    {...props}
  >
    <Text style={{ color: '#5f6368' }}>Mapa disponible solo en la app móvil</Text>
    {children}
  </View>
);

const Noop = () => null;

export default MapPlaceholder;
export const Marker = Noop;
export const Polyline = Noop;
export const Polygon = Noop;
export const Circle = Noop;
export const Callout = Noop;
export const Heatmap = Noop;
export const Overlay = Noop;
export const AnimatedRegion = class {};
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';
