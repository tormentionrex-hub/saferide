import React, { useState, useRef } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, ScrollView, Image,
    StatusBar, Platform, Animated, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import api from '../../services/api';
import StarRating from '../../components/StarRating';
import TripCompletedOverlay from '../../components/TripCompletedOverlay';

const RATING_LABELS = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

/**
 * RatingScreen — pantalla genérica de calificación post-viaje.
 *
 * Props:
 *   rideId       {string}   ID del viaje a calificar
 *   revieweeId   {string}   ID del usuario que recibe la calificación
 *   personName   {string}   Nombre a mostrar
 *   personImage  {string}   URL de foto de perfil (opcional)
 *   personRole   {string}   Etiqueta de rol: "Conductor" | "Pasajero"
 *   title        {string}   Título principal de la pantalla
 *   subtitle     {string}   Subtítulo debajo del título
 *   accentColor  {string}   Color del botón de enviar
 *   badgeColor   {{ bg, icon }} Colores del ícono de completado
 *   onSuccess    {function} Se llama cuando la review se envió con éxito
 *   onSkip       {function} Se llama cuando el usuario omite la calificación
 */
const RatingScreen = ({
    rideId,
    revieweeId,
    personName,
    personImage,
    personRole,
    title,
    subtitle,
    accentColor,
    badgeColor,
    onSuccess,
    onSkip,
}) => {
    const { theme } = useDriverTheme();

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [isFocused, setIsFocused] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Animación para el label de rating
    const labelAnim = useRef(new Animated.Value(0)).current;

    // Animaciones del modal de éxito
    const checkScale = useRef(new Animated.Value(0)).current;
    const checkOpacity = useRef(new Animated.Value(0)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;

    const triggerSuccessModal = (callback) => {
        setShowSuccess(true);
        // El auto-navegado ahora lo maneja el componente TripCompletedOverlay a través de su prop onFinish
    };

    const handleRatingChange = (newRating) => {
        setRating(newRating);
        labelAnim.setValue(0);
        Animated.spring(labelAnim, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
        }).start();
    };

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert('Selecciona una calificación', 'Por favor selecciona al menos 1 estrella.');
            return;
        }
        setLoading(true);
        setSubmitError(null);
        // Extraer IDs asegurando que sean strings (por si vienen como objetos poblados)
        const cleanRideId = typeof rideId === 'object' ? rideId?._id?.toString() : rideId?.toString();
        const cleanRevieweeId = typeof revieweeId === 'object' ? revieweeId?._id?.toString() : revieweeId?.toString();

        const payload = {
            ride_id: cleanRideId,
            reviewee_id: cleanRevieweeId,
            rating,
            comment: comment.trim(),
        };

        console.log('[DEBUG] Enviando reseña con payload:', payload);

        try {
            console.log('[DEBUG] Enviando reseña a /reviews/direct-submit con payload:', payload);
            const response = await api.post('/reviews/direct-submit', payload);
            triggerSuccessModal(onSuccess);
        } catch (error) {
            console.error('Error al enviar reseña:', error.response?.data || error.message);
            const errorMessage = error.response?.data?.message || 'No se pudo enviar la calificación';
            setSubmitError(errorMessage);
            setLoading(false);
            Alert.alert('Error', errorMessage);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

            {/* Modal de éxito animado y premium */}
            <TripCompletedOverlay 
                visible={showSuccess}
                theme={theme}
                onFinish={() => {
                    setShowSuccess(false);
                    onSuccess();
                }}
            />

            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Ícono de viaje completado */}
                <View style={[styles.iconBadge, { backgroundColor: badgeColor.bg }]}>
                    <Ionicons name="checkmark-circle" size={48} color={badgeColor.icon} />
                </View>

                <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>

                {/* Avatar + nombre del usuario a calificar */}
                <View style={styles.personSection}>
                    {personImage ? (
                        <Image source={{ uri: personImage }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.border }]}>
                            <Ionicons name="person" size={40} color={theme.textSecondary} />
                        </View>
                    )}
                    <Text style={[styles.personName, { color: theme.text }]}>
                        {personName || personRole}
                    </Text>
                    <Text style={[styles.personRole, { color: theme.textSecondary }]}>
                        {personRole}
                    </Text>
                </View>

                {/* Estrellas */}
                <StarRating
                    value={rating}
                    onChange={handleRatingChange}
                    emptyColor={theme.border}
                />
                <Animated.View style={{ 
                    opacity: labelAnim,
                    transform: [{ scale: labelAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1]
                    }) }]
                }}>
                    {rating > 0 && (
                        <Text style={styles.ratingLabel}>{RATING_LABELS[rating]}</Text>
                    )}
                </Animated.View>

                {/* Comentario opcional */}
                <TextInput
                    style={[styles.commentInput, {
                        backgroundColor: theme.surface,
                        color: theme.text,
                        borderColor: isFocused ? accentColor : theme.border,
                        borderWidth: isFocused ? 2 : 1,
                    }]}
                    placeholder="Deja un comentario (opcional)"
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                    value={comment}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onChangeText={(text) => {
                        setComment(text);
                        if (submitError) setSubmitError(null);
                    }}
                    textAlignVertical="top"
                />
                <Text style={[styles.charCount, { color: theme.textSecondary }]}>
                    {comment.length}/500
                </Text>

                {/* Mensaje de error inline */}
                {submitError && (
                    <View style={[styles.errorBox, { backgroundColor: '#FFEBEE' }]}>
                        <Ionicons name="alert-circle-outline" size={16} color="#C62828" />
                        <Text style={styles.errorText}>{submitError}</Text>
                    </View>
                )}

                {/* Botón enviar */}
                <TouchableOpacity
                    style={[
                        styles.submitBtn,
                        { backgroundColor: accentColor, opacity: rating === 0 ? 0.5 : 1 },
                    ]}
                    onPress={handleSubmit}
                    disabled={loading || rating === 0}
                    activeOpacity={0.8}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.submitBtnText}>Enviar calificación</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.skipBtn} 
                    onPress={() => triggerSuccessModal(onSkip)}
                >
                    <Text style={[styles.skipBtnText, { color: theme.textSecondary }]}>
                        Omitir
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    content: {
        padding: 24,
        alignItems: 'center',
        paddingBottom: 40,
    },
    iconBadge: {
        width: 80,
        height: 80,
        borderRadius: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 10,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 22,
    },
    personSection: {
        alignItems: 'center',
        marginBottom: 15,
    },
    avatar: {
        width: 70,
        height: 70,
        borderRadius: 35,
        marginBottom: 8,
    },
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    personName: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    personRole: {
        fontSize: 13,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    ratingLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFC107',
        marginTop: 10,
        marginBottom: 4,
    },
    commentInput: {
        width: '100%',
        borderRadius: 16,
        padding: 16,
        fontSize: 15,
        minHeight: 100,
        marginTop: 5,
    },
    charCount: {
        alignSelf: 'flex-end',
        fontSize: 12,
        marginTop: 6,
        marginBottom: 16,
        fontWeight: '500',
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },
    errorText: {
        color: '#C62828',
        fontSize: 13,
        marginLeft: 8,
        flex: 1,
    },
    submitBtn: {
        width: '100%',
        height: 54,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 14,
    },
    submitBtnText: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '700',
    },
    skipBtn: {
        padding: 12,
    },
    skipBtnText: {
        fontSize: 15,
        fontWeight: '500',
    },
    successOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    successCard: {
        backgroundColor: '#FFF',
        borderRadius: 28,
        paddingVertical: 44,
        paddingHorizontal: 36,
        alignItems: 'center',
        width: '78%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 12,
    },
    successCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 28,
    },
    successCircleInner: {
        width: 88,
        height: 88,
        borderRadius: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    successTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#1A1A1A',
        marginBottom: 10,
    },
    successMessage: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
    },
});

export default RatingScreen;
