import React, { useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    StatusBar,
    Animated,
    Easing,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';

const { width } = Dimensions.get('window');

export default function AccountVerificationSucess({ navigation }) {
    const [fontsLoaded] = useFonts({
        'Poppins-Bold': require('../../fonts/Poppins_700Bold.ttf'),
        'Poppins-SemiBold': require('../../fonts/Poppins_600SemiBold.ttf'),
        'Poppins-Regular': require('../../fonts/Poppins_400Regular.ttf'),
    });

    // Background loop
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Bubble
    const bubbleScale   = useRef(new Animated.Value(0)).current;
    const bubbleOpacity = useRef(new Animated.Value(1)).current;

    // Explosion rings
    const ring1Scale   = useRef(new Animated.Value(0.3)).current;
    const ring1Opacity = useRef(new Animated.Value(0)).current;
    const ring2Scale   = useRef(new Animated.Value(0.3)).current;
    const ring2Opacity = useRef(new Animated.Value(0)).current;
    const ring3Scale   = useRef(new Animated.Value(0.3)).current;
    const ring3Opacity = useRef(new Animated.Value(0)).current;

    // Content
    const contentOpacity   = useRef(new Animated.Value(0)).current;
    const contentTranslate = useRef(new Animated.Value(40)).current;
    const iconScale        = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Infinite background color shift
        Animated.loop(
            Animated.sequence([
                Animated.timing(fadeAnim, { toValue: 1, duration: 5000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(fadeAnim, { toValue: 0, duration: 5000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        ).start();

        // Full animation sequence (~2.5s total)
        Animated.sequence([
            // Phase 1 (0–400ms): bubble pops into view
            Animated.timing(bubbleScale, {
                toValue: 1,
                duration: 400,
                easing: Easing.out(Easing.back(1.8)),
                useNativeDriver: true,
            }),
            // Phase 2 (400–650ms): bubble squishes before exploding
            Animated.timing(bubbleScale, {
                toValue: 0.82,
                duration: 250,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
            }),
            // Phase 3 (650–1550ms): EXPLOSION — bubble + rings all at once
            Animated.parallel([
                // Bubble shoots outward and vanishes
                Animated.timing(bubbleScale, {
                    toValue: 6,
                    duration: 400,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(bubbleOpacity, {
                    toValue: 0,
                    duration: 350,
                    easing: Easing.in(Easing.ease),
                    useNativeDriver: true,
                }),
                // Ring 1 — fastest, largest
                Animated.sequence([
                    Animated.timing(ring1Opacity, { toValue: 1, duration: 60, useNativeDriver: true }),
                    Animated.parallel([
                        Animated.timing(ring1Scale,   { toValue: 4.5, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                        Animated.timing(ring1Opacity, { toValue: 0,   duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                    ]),
                ]),
                // Ring 2 — medium, slight delay
                Animated.sequence([
                    Animated.delay(120),
                    Animated.timing(ring2Opacity, { toValue: 0.85, duration: 60, useNativeDriver: true }),
                    Animated.parallel([
                        Animated.timing(ring2Scale,   { toValue: 3.5, duration: 750, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                        Animated.timing(ring2Opacity, { toValue: 0,   duration: 750, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                    ]),
                ]),
                // Ring 3 — innermost, more delay
                Animated.sequence([
                    Animated.delay(250),
                    Animated.timing(ring3Opacity, { toValue: 0.65, duration: 60, useNativeDriver: true }),
                    Animated.parallel([
                        Animated.timing(ring3Scale,   { toValue: 2.5, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                        Animated.timing(ring3Opacity, { toValue: 0,   duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                    ]),
                ]),
            ]),
            // Phase 4 (1550–1700ms): brief pause
            Animated.delay(150),
            // Phase 5 (1700–2500ms): content slides + fades in
            Animated.parallel([
                Animated.timing(contentOpacity, {
                    toValue: 1,
                    duration: 600,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(contentTranslate, {
                    toValue: 0,
                    duration: 600,
                    easing: Easing.out(Easing.back(1.3)),
                    useNativeDriver: true,
                }),
                Animated.timing(iconScale, {
                    toValue: 1,
                    duration: 550,
                    easing: Easing.out(Easing.back(2.2)),
                    useNativeDriver: true,
                }),
            ]),
        ]).start();
    }, []);

    const handleContinue = () => {
        navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
    };

    if (!fontsLoaded) return null;

    return (
        <View style={styles.container}>
            {/* Background Layer 1: Dark Blue */}
            <LinearGradient
                colors={['#09314bff', '#0c4469ff', '#073050ff']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            {/* Background Layer 2: Light Blue (animated) */}
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
                <LinearGradient
                    colors={['#0a6191ff', '#0a8ac5ff', '#3dabdaff']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0, y: 1 }}
                />
            </Animated.View>

            <SafeAreaView style={styles.safeArea}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <View style={styles.content}>
                    {/* ── Explosion Stage ── */}
                    <View style={styles.explosionStage}>
                        {/* Rings */}
                        <Animated.View style={[styles.ring, { opacity: ring1Opacity, transform: [{ scale: ring1Scale }] }]} />
                        <Animated.View style={[styles.ring, styles.ring2, { opacity: ring2Opacity, transform: [{ scale: ring2Scale }] }]} />
                        <Animated.View style={[styles.ring, styles.ring3, { opacity: ring3Opacity, transform: [{ scale: ring3Scale }] }]} />

                        {/* Main Bubble */}
                        <Animated.View style={[styles.bubble, { opacity: bubbleOpacity, transform: [{ scale: bubbleScale }] }]}>
                            {/* Bubble highlight */}
                            <View style={styles.bubbleHighlight} />
                            <View style={styles.bubbleHighlight2} />
                        </Animated.View>
                    </View>

                    {/* ── Success Content ── */}
                    <Animated.View style={[
                        styles.successContent,
                        { opacity: contentOpacity, transform: [{ translateY: contentTranslate }] }
                    ]}>
                        <Animated.View style={[styles.iconContainer, { transform: [{ scale: iconScale }] }]}>
                            <View style={styles.outerCircle}>
                                <View style={styles.innerCircle}>
                                    <MaterialCommunityIcons name="shield-check" size={52} color="#38BDF8" />
                                </View>
                            </View>
                        </Animated.View>

                        <Text style={styles.title}>¡Cuenta Verificada!</Text>
                        <Text style={styles.subtitle}>
                            Tu cuenta ha sido verificada{'\n'}exitosamente. Ya puedes continuar{'\n'}y empezar a usar Safe Ride.
                        </Text>
                    </Animated.View>
                </View>

                {/* Button */}
                <Animated.View style={[styles.buttonContainer, { opacity: contentOpacity }]}>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleContinue}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.buttonText}>Continuar</Text>
                    </TouchableOpacity>
                </Animated.View>
            </SafeAreaView>
        </View>
    );
}

const BUBBLE_SIZE = 110;
const RING_SIZE   = BUBBLE_SIZE;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#082F49',
    },
    safeArea: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 30,
    },

    // ── Explosion ──
    explosionStage: {
        width: BUBBLE_SIZE,
        height: BUBBLE_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
    },
    bubble: {
        width: BUBBLE_SIZE,
        height: BUBBLE_SIZE,
        borderRadius: BUBBLE_SIZE / 2,
        backgroundColor: 'rgba(56, 189, 248, 0.25)',
        borderWidth: 3,
        borderColor: 'rgba(56, 189, 248, 0.85)',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        overflow: 'hidden',
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 20,
        elevation: 12,
    },
    bubbleHighlight: {
        position: 'absolute',
        top: 14,
        left: 18,
        width: 28,
        height: 16,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.55)',
        transform: [{ rotate: '-30deg' }],
    },
    bubbleHighlight2: {
        position: 'absolute',
        top: 34,
        left: 24,
        width: 12,
        height: 7,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.3)',
        transform: [{ rotate: '-30deg' }],
    },
    ring: {
        position: 'absolute',
        width: RING_SIZE,
        height: RING_SIZE,
        borderRadius: RING_SIZE / 2,
        borderWidth: 3,
        borderColor: '#38BDF8',
    },
    ring2: {
        borderColor: '#0a8ac5ff',
        borderWidth: 2.5,
    },
    ring3: {
        borderColor: '#3dabdaff',
        borderWidth: 2,
    },

    // ── Success Content ──
    successContent: {
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    iconContainer: {
        marginBottom: 28,
    },
    outerCircle: {
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        borderWidth: 2,
        borderColor: 'rgba(56, 189, 248, 0.35)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    innerCircle: {
        width: 85,
        height: 85,
        borderRadius: 42.5,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(56, 189, 248, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontFamily: 'Poppins-Bold',
        fontSize: 26,
        color: '#FFFFFF',
        marginBottom: 14,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    subtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 15,
        color: 'rgba(235, 235, 235, 0.72)',
        textAlign: 'center',
        lineHeight: 24,
    },

    // ── Button ──
    buttonContainer: {
        paddingHorizontal: 28,
        paddingBottom: 36,
    },
    button: {
        height: 52,
        backgroundColor: '#38BDF8',
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
        elevation: 8,
    },
    buttonText: {
        fontFamily: 'Poppins-Bold',
        color: '#FFFFFF',
        fontSize: 16,
        letterSpacing: 0.5,
    },
});
