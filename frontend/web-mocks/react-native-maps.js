// Stub de react-native-maps para web.
// react-native-maps es un módulo solo-nativo (iOS/Android); en web Metro lo
// reemplaza por este archivo (ver metro.config.js) para que el bundle compile.
// Los mapas se muestran como un contenedor vacío con un aviso.
import React from 'react';
import { View, Text } from 'react-native';

// forwardRef + métodos vacíos: las pantallas llaman mapRef.current.animateToRegion /
// fitToCoordinates; sin ellos, en web BuscarViaje lanzaba "animateToRegion is not a function".
const MapPlaceholder = React.forwardRef(({ style, children, ...props }, ref) => {
  React.useImperativeHandle(ref, () => ({
    animateToRegion: () => {},
    animateCamera: () => {},
    fitToCoordinates: () => {},
    fitToElements: () => {},
    fitToSuppliedMarkers: () => {},
    setCamera: () => {},
    getCamera: async () => ({ center: { latitude: 0, longitude: 0 }, zoom: 0, heading: 0, pitch: 0 }),
  }), []);
  return (
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
});
MapPlaceholder.displayName = "MapPlaceholder";

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
