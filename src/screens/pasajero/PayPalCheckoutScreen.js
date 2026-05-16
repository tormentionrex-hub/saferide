import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import api from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PayPalCheckoutScreen = ({ navigation, route }) => {
  const { bookingId, rideId, driverId, driverName, driverImage } = route.params;
  const insets = useSafeAreaInsets();
  
  const [approvalUrl, setApprovalUrl] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    // 1. Llamar al backend para crear la orden de PayPal
    const createOrder = async () => {
      try {
        const response = await api.post('/paypal/create-order', { bookingId });
        if (response.data.success) {
          setApprovalUrl(response.data.approvalUrl);
          setOrderId(response.data.orderId);
        } else {
          setError(response.data.message || 'Error al inicializar PayPal');
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Error de conexión con el servidor');
      } finally {
        setLoading(false);
      }
    };

    if (bookingId) {
      createOrder();
    } else {
      setError('ID de reserva no proporcionado');
      setLoading(false);
    }
  }, [bookingId]);

  const handleNavigationStateChange = async (navState) => {
    const { url } = navState;

    // Si la URL contiene el returnUrl que le dimos a PayPal (paypal/success)
    if (url.includes('paypal/success') && !capturing) {
      setCapturing(true);
      
      try {
        // 2. Llamar al backend para capturar el pago
        const response = await api.post('/paypal/capture-order', {
          orderId,
          bookingId
        });

        if (response.data.success) {
          // Pago exitoso, avanzar a RateDriver
          navigation.replace('RateDriver', { 
            rideId,
            driverId,
            driverName,
            driverImage
          });
        } else {
          setError('El pago fue autorizado pero no se pudo capturar');
        }
      } catch (err) {
        setError('Ocurrió un error capturando el pago');
      }
    } else if (url.includes('paypal/cancel')) {
      // El usuario canceló
      navigation.goBack();
    }
  };

  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="warning-outline" size={60} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading || capturing) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>
          {capturing ? 'Procesando pago seguro...' : 'Conectando con PayPal...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top || 40 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pagar con PayPal</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <WebView 
        source={{ uri: approvalUrl }} 
        onNavigationStateChange={handleNavigationStateChange}
        startInLoadingState={true}
        renderLoading={() => (
          <ActivityIndicator style={styles.webviewLoader} size="large" color="#2563EB" />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF'
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB'
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827'
  },
  loadingText: {
    marginTop: 15,
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280'
  },
  errorText: {
    marginTop: 15,
    marginBottom: 30,
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: '#111827',
    textAlign: 'center'
  },
  btn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8
  },
  btnText: {
    color: '#FFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 15
  },
  webviewLoader: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF'
  }
});

export default PayPalCheckoutScreen;
