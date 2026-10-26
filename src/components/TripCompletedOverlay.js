import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const TripCompletedOverlay = ({ visible, onFinish, theme }) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Animación de entrada
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto-finalizar después de 2.5 segundos
            const timer = setTimeout(() => {
                onFinish();
            }, 2500);

            return () => clearTimeout(timer);
        } else {
            scaleAnim.setValue(0);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={styles.overlay}>
                <Animated.View 
                    style={[
                        styles.card, 
                        { 
                            opacity: opacityAnim, 
                            transform: [{ scale: scaleAnim }],
                            backgroundColor: theme.surface,
                            shadowColor: theme.dark ? '#000' : '#1976D2',
                        }
                    ]}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="checkmark-circle" size={100} color="#4CAF50" />
                    </View>
                    
                    <Text style={[styles.title, { color: theme.text }]}>¡Viaje Completado!</Text>
                    
                    <Text style={[styles.message, { color: theme.textSecondary }]}>
                        Gracias por usar SafeRide.{"\n"}
                        Esperamos verte en tu próximo trayecto.
                    </Text>

                    <View style={[styles.badge, { backgroundColor: '#E8F5E9' }]}>
                        <Text style={styles.badgeText}>Finalizado con éxito</Text>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: width * 0.85,
        padding: 35,
        borderRadius: 30,
        alignItems: 'center',
        elevation: 15,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    iconContainer: {
        marginBottom: 20,
    },
    title: {
        fontSize: 26,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 15,
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 30,
    },
    badge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    badgeText: {
        color: '#2E7D32',
        fontWeight: 'bold',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    }
});

export default TripCompletedOverlay;
