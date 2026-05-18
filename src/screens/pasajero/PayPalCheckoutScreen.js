import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import api from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCustomAlert } from '../../context/CustomAlertContext';

const PAYPAL_BLUE = '#003087';
const PAYPAL_YELLOW = '#FFC439';

const PayPalCheckoutScreen = ({ navigation, route }) => {
  const { bookingId, rideId, driverId, driverName, driverImage, mode } = route.params;
  const isLateCharge = mode === 'lateCharge';
  const insets = useSafeAreaInsets();
  const { showAlert } = useCustomAlert();

  const [approvalUrl, setApprovalUrl] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [capturing, setCapturing] = useState(false);

  const goToNext = () => {
    if (isLateCharge) {
      // Cobro pendiente desde el historial: volver al historial
      navigation.navigate('MainTabsPasajero', { screen: 'History' });
    } else {
      navigation.replace('RateDriver', {
        rideId,
        driverId,
        driverName,
        driverImage,
      });
    }
  };

  const handleStartPayPal = async () => {
    if (!bookingId) {
      setError('ID de reserva no proporcionado');
      return;
    }
    setLoading(true);
    setError(null);
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

  const handleNavigationStateChange = async (navState) => {
    const { url } = navState;

    if (url.includes('paypal/success') && !capturing) {
      setCapturing(true);

      try {
        const response = await api.post('/paypal/capture-order', {
          orderId,
          bookingId,
        });

        if (response.data.success) {
          showAlert(
            'Pago exitoso',
            isLateCharge
              ? 'Tu cuota pendiente ha sido pagada. Ya puedes volver a unirte a viajes.'
              : 'Tu pago se ha procesado correctamente. Ahora puedes calificar a tu conductor.',
            'success',
            'Continuar',
            goToNext
          );
        } else {
          setError('El pago fue autorizado pero no se pudo capturar');
          setCapturing(false);
        }
      } catch (err) {
        setError('Ocurrió un error capturando el pago');
        setCapturing(false);
      }
    } else if (url.includes('paypal/cancel')) {
      setApprovalUrl(null);
      setOrderId(null);
    }
  };

  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="warning-outline" size={60} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setError(null); }}>
          <Text style={styles.retryBtnText}>Volver a intentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (capturing) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={PAYPAL_BLUE} />
        <Text style={styles.loadingText}>Procesando pago seguro...</Text>
      </View>
    );
  }

  // Pantalla intermedia: invitación a pagar con PayPal
  if (!approvalUrl) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top || 40 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pago del Viaje</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.introWrap}>
          <View style={styles.paypalLogoCircle}>
            <Ionicons name="logo-paypal" size={56} color={PAYPAL_BLUE} />
          </View>

          <Text style={styles.introTitle}>Realiza su pago con PayPal por favor</Text>
          <Text style={styles.introSubtitle}>
            Tu viaje ha finalizado. Para continuar y calificar a tu conductor,
            completa el pago de forma rápida y segura con PayPal.
          </Text>

          <TouchableOpacity
            style={[styles.paypalBtn, loading && { opacity: 0.85 }]}
            onPress={handleStartPayPal}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color={PAYPAL_BLUE} />
            ) : (
              <View style={styles.paypalBtnContent}>
                <Ionicons name="logo-paypal" size={22} color={PAYPAL_BLUE} />
                <Text style={styles.paypalBtnText}>
                  <Text style={{ color: PAYPAL_BLUE, fontFamily: 'Poppins-Bold' }}>Pay</Text>
                  <Text style={{ color: '#009CDE', fontFamily: 'Poppins-Bold' }}>Pal</Text>
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.secureRow}>
            <Ionicons name="lock-closed" size={14} color="#6B7280" />
            <Text style={styles.secureText}>Pago seguro procesado por PayPal</Text>
          </View>
        </View>
      </View>
    );
  }

  // WebView de PayPal
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
          <ActivityIndicator style={styles.webviewLoader} size="large" color={PAYPAL_BLUE} />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
  },
  errorText: {
    marginTop: 15,
    marginBottom: 30,
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: '#111827',
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: PAYPAL_BLUE,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 15,
  },
  webviewLoader: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF',
  },

  // Pantalla intermedia
  introWrap: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
    alignItems: 'center',
  },
  paypalLogoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#EAF1FB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: PAYPAL_BLUE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  introTitle: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 30,
  },
  introSubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },
  paypalBtn: {
    width: '100%',
    backgroundColor: PAYPAL_YELLOW,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  paypalBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paypalBtnText: {
    fontSize: 17,
    letterSpacing: 0.3,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
  },
  secureText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
  },
});

export default PayPalCheckoutScreen;
