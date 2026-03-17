import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Easing,
    Dimensions,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';

const { width, height } = Dimensions.get('window');

// Tamaño base de la burbuja
const BUBBLE_SIZE = 130;
const BUBBLE_RADIUS = BUBBLE_SIZE / 2;

// Scale necesario para cubrir toda la pantalla desde el centro
const MAX_SCALE = (Math.sqrt((width / 2) ** 2 + (height / 2) ** 2) / BUBBLE_RADIUS) * 1.3;

export default function LoginSuccessScreen({ navigation }) {
    const [fontsLoaded] = useFonts({
        'Poppins-Bold': require('../fonts/Poppins_700Bold.ttf'),
        'Poppins-SemiBold': require('../fonts/Poppins_600SemiBold.ttf'),
        'Poppins-Regular': require('../fonts/Poppins_400Regular.ttf'),
    });

    // --- Burbuja principal ---
    const bubbleScale   = useRef(new Animated.Value(0)).current;
    const bubbleOpacity = useRef(new Animated.Value(1)).current;

    // --- Ondas de choque (shockwaves) ---
    const wave1Scale   = useRef(new Animated.Value(1)).current;
    const wave1Opacity = useRef(new Animated.Value(0)).current;
    const wave2Scale   = useRef(new Animated.Value(1)).current;
    const wave2Opacity = useRef(new Animated.Value(0)).current;
    const wave3Scale   = useRef(new Animated.Value(1)).current;
    const wave3Opacity = useRef(new Animated.Value(0)).current;

    // --- Contenido de éxito ---
    const contentOpacity    = useRef(new Animated.Value(0)).current;
    const contentTranslateY = useRef(new Animated.Value(40)).current;
    const checkScale        = useRef(new Animated.Value(0)).current;
    const checkOpacity      = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // ─── FASE 1: Burbuja se infla (0 → 500ms) ───
        Animated.timing(bubbleScale, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.back(1.8)),
            useNativeDriver: true,
        }).start(() => {

            // ─── FASE 2: Burbuja explota + ondas (500ms → 1100ms) ───
            Animated.parallel([

                // Burbuja se expande y desaparece
                Animated.timing(bubbleScale, {
                    toValue: MAX_SCALE,
                    duration: 550,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(bubbleOpacity, {
                    toValue: 0,
                    duration: 380,
                    easing: Easing.in(Easing.quad),
                    useNativeDriver: true,
                }),

                // Onda 1 — la más rápida e intensa
                Animated.sequence([
                    Animated.timing(wave1Opacity, { toValue: 0.85, duration: 30, useNativeDriver: true }),
                    Animated.parallel([
                        Animated.timing(wave1Scale, {
                            toValue: 6,
                            duration: 650,
                            easing: Easing.out(Easing.cubic),
                            useNativeDriver: true,
                        }),
                        Animated.timing(wave1Opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
                    ]),
                ]),

                // Onda 2 — media velocidad
                Animated.sequence([
                    Animated.delay(100),
                    Animated.timing(wave2Opacity, { toValue: 0.6, duration: 30, useNativeDriver: true }),
                    Animated.parallel([
                        Animated.timing(wave2Scale, {
                            toValue: 9,
                            duration: 780,
                            easing: Easing.out(Easing.cubic),
                            useNativeDriver: true,
                        }),
                        Animated.timing(wave2Opacity, { toValue: 0, duration: 700, useNativeDriver: true }),
                    ]),
                ]),

                // Onda 3 — la más lenta y amplia
                Animated.sequence([
                    Animated.delay(200),
                    Animated.timing(wave3Opacity, { toValue: 0.4, duration: 30, useNativeDriver: true }),
                    Animated.parallel([
                        Animated.timing(wave3Scale, {
                            toValue: 13,
                            duration: 950,
                            easing: Easing.out(Easing.cubic),
                            useNativeDriver: true,
                        }),
                        Animated.timing(wave3Opacity, { toValue: 0, duration: 850, useNativeDriver: true }),
                    ]),
                ]),

            ]).start(() => {

                // ─── FASE 3: Mensaje de éxito aparece (1100ms → 1800ms) ───
                Animated.parallel([
                    // Ícono de check con spring
                    Animated.spring(checkScale, {
                        toValue: 1,
                        friction: 4,
                        tension: 55,
                        useNativeDriver: true,
                    }),
                    Animated.timing(checkOpacity, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                    // Texto sube y aparece con delay leve
                    Animated.sequence([
                        Animated.delay(150),
                        Animated.parallel([
                            Animated.timing(contentOpacity, {
                                toValue: 1,
                                duration: 500,
                                useNativeDriver: true,
                            }),
                            Animated.timing(contentTranslateY, {
                                toValue: 0,
                                duration: 500,
                                easing: Easing.out(Easing.cubic),
                                useNativeDriver: true,
                            }),
                        ]),
                    ]),
                ]).start();
            });
        });

        // Navegar al Home después de que todo termine
        const navTimer = setTimeout(() => {
            navigation.replace('Home');
        }, 3600);

        return () => clearTimeout(navTimer);
    }, []);

    const fontBold    = fontsLoaded ? 'Poppins-Bold'    : undefined;
    const fontSemi    = fontsLoaded ? 'Poppins-SemiBold': undefined;
    const fontRegular = fontsLoaded ? 'Poppins-Regular' : undefined;

    return (
        <View style={styles.container}>
            <StatusBar hidden />

            {/* Fondo — mismo gradiente que SignIn */}
            <LinearGradient
                colors={['#09314bff', '#0c4469ff', '#073050ff']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* ── Burbuja ── */}
            <Animated.View
                style={[
                    styles.bubble,
                    {
                        opacity: bubbleOpacity,
                        transform: [{ scale: bubbleScale }],
                    },
                ]}
            />

            {/* ── Ondas de choque ── */}
            <Animated.View style={[styles.wave, { opacity: wave1Opacity, transform: [{ scale: wave1Scale }] }]} />
            <Animated.View style={[styles.wave, { opacity: wave2Opacity, transform: [{ scale: wave2Scale }] }]} />
            <Animated.View style={[styles.wave, { opacity: wave3Opacity, transform: [{ scale: wave3Scale }] }]} />

            {/* ── Mensaje de éxito ── */}
            <View style={styles.centerWrapper}>

                {/* Círculo con check */}
                <Animated.View
                    style={[
                        styles.checkCircle,
                        {
                            opacity: checkOpacity,
                            transform: [{ scale: checkScale }],
                        },
                    ]}
                >
                    <Ionicons name="checkmark" size={58} color="#ffffff" />
                </Animated.View>

                {/* Textos */}
                <Animated.View
                    style={{
                        opacity: contentOpacity,
                        transform: [{ translateY: contentTranslateY }],
                        alignItems: 'center',
                    }}
                >
                    <Text style={[styles.title, { fontFamily: fontBold }]}>
                        Inicio de Sesión
                    </Text>
                    <Text style={[styles.titleHighlight, { fontFamily: fontBold }]}>
                        Exitoso
                    </Text>
                    <Text style={[styles.subtitle, { fontFamily: fontRegular }]}>
                        Bienvenido de vuelta.{'\n'}Redirigiendo al panel principal...
                    </Text>
                </Animated.View>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09314b',
    },
    // Burbuja centrada
    bubble: {
        position: 'absolute',
        width: BUBBLE_SIZE,
        height: BUBBLE_SIZE,
        borderRadius: BUBBLE_RADIUS,
        backgroundColor: '#38BDF8',
        top: height / 2 - BUBBLE_RADIUS,
        left: width / 2 - BUBBLE_RADIUS,
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 30,
        elevation: 10,
    },
    // Onda de choque — mismo tamaño y posición que la burbuja, solo borde
    wave: {
        position: 'absolute',
        width: BUBBLE_SIZE,
        height: BUBBLE_SIZE,
        borderRadius: BUBBLE_RADIUS,
        borderWidth: 3,
        borderColor: '#38BDF8',
        top: height / 2 - BUBBLE_RADIUS,
        left: width / 2 - BUBBLE_RADIUS,
    },
    // Wrapper centrado para el contenido
    centerWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    // Círculo verde con checkmark
    checkCircle: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: '#16a34a',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
        shadowColor: '#16a34a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 12,
    },
    title: {
        fontSize: 28,
        color: '#ffffff',
        textAlign: 'center',
        letterSpacing: 0.3,
        lineHeight: 34,
    },
    titleHighlight: {
        fontSize: 32,
        color: '#38BDF8',
        textAlign: 'center',
        letterSpacing: 0.5,
        marginTop: 2,
        marginBottom: 20,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(235,235,235,0.65)',
        textAlign: 'center',
        lineHeight: 22,
    },
});
