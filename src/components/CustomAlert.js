import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Animated,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../context/DriverThemeContext';

const { width } = Dimensions.get('window');

/**
 * CustomAlert - Un componente de alerta premium y temático.
 * 
 * @param {boolean} visible - Controla la visibilidad
 * @param {string} title - Título de la alerta
 * @param {string} message - Mensaje del cuerpo
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {string} cancelText - Texto botón secundario; null = sin botón cancelar
 * @param {function} onConfirm - Se llama al pulsar confirmar (2-botones); si es null se usa onClose
 */
const CustomAlert = ({
    visible,
    title,
    message,
    type = 'success',
    onClose,
    onConfirm,
    confirmText = 'Entendido',
    cancelText = null,
    dismissText = null,
    onDismiss = null,
}) => {
    const { theme } = useDriverTheme();
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 7,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(scaleAnim, {
                    toValue: 0.8,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const getIcon = () => {
        switch (type) {
            case 'success': return { name: 'checkmark-circle', color: '#00C851' };
            case 'error': return { name: 'alert-circle', color: theme.danger || '#ff4444' };
            case 'warning': return { name: 'warning', color: '#FFBB33' };
            case 'confirm': return { name: 'help-circle', color: theme.danger || '#ff4444' };
            case 'info': return { name: 'information-circle', color: theme.accent || '#33b5e5' };
            case 'map':  return { name: 'map', color: '#2563EB' };
            default: return { name: 'help-circle', color: theme.accent };
        }
    };

    const iconData = getIcon();
    const hasTwoButtons = !!cancelText;

    if (!visible && opacityAnim._value === 0) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Animated.View
                    style={[
                        styles.container,
                        {
                            backgroundColor: theme.surface || '#FFFFFF',
                            borderColor: theme.divider,
                            opacity: opacityAnim,
                            transform: [{ scale: scaleAnim }]
                        }
                    ]}
                >
                    {/* Icon Header */}
                    <View style={[styles.iconContainer, { backgroundColor: iconData.color + '20' }]}>
                        <Ionicons name={iconData.name} size={42} color={iconData.color} />
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                        <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
                    </View>

                    {/* Botones */}
                    {hasTwoButtons ? (
                        <View style={styles.buttonRow}>
                            {/* Cancelar */}
                            <TouchableOpacity
                                style={[
                                    styles.buttonHalf,
                                    {
                                        backgroundColor: '#f0f0f0ff',
                                        borderWidth: 1.4,
                                        borderColor: theme.divider || '#ccc',
                                    },
                                ]}
                                onPress={onClose}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.buttonText, { color: theme.textSecondary || '#888' }]}>
                                    {cancelText}
                                </Text>
                            </TouchableOpacity>

                            {/* Confirmar */}
                            <TouchableOpacity
                                style={[styles.buttonHalf, { backgroundColor: iconData.color }]}
                                onPress={onConfirm || onClose}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.buttonText}>{confirmText}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: iconData.color }]}
                            onPress={onClose}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.buttonText}>{confirmText}</Text>
                        </TouchableOpacity>
                    )}

                    {/* Botón Cancelar (tercer botón rojo, opcional) */}
                    {dismissText && (
                        <TouchableOpacity
                            style={[styles.dismissButton]}
                            onPress={onDismiss || onClose}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.dismissButtonText}>{dismissText}</Text>
                        </TouchableOpacity>
                    )}
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
        padding: 30,
    },
    container: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 28,
        borderWidth: 1,
        padding: 24,
        alignItems: 'center',
        // Glassmorphism effect in some platforms
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    content: {
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 22,
        fontFamily: 'Poppins-Bold', // Asumiendo que usas Poppins
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    message: {
        fontSize: 15,
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        lineHeight: 22,
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    button: {
        width: '100%',
        height: 54,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 3,
    },
    /* Fila de 2 botones */
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    buttonHalf: {
        flex: 1,
        height: 54,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 2,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 15,
        fontFamily: 'Poppins-SemiBold',
        fontWeight: '600',
    },
    secondaryButtonText: {
        fontSize: 16,
        fontFamily: 'Poppins-SemiBold',
        fontWeight: '600',
    },
    dismissButton: {
        marginTop: 10,
        width: '100%',
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ff444420',
        borderWidth: 1.4,
        borderColor: '#ff4444',
    },
    dismissButtonText: {
        color: '#ff4444',
        fontSize: 15,
        fontFamily: 'Poppins-SemiBold',
        fontWeight: '600',
    },
});

export default CustomAlert;
