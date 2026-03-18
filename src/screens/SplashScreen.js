import React, { useEffect, useRef } from 'react';
import {
    StyleSheet,
    StatusBar,
    Animated,
    Easing,
    Dimensions,
    View,
    Text,
    ImageBackground,
} from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Posiciones
const START_X = -SCREEN_WIDTH;
const CENTER_X = 0;

const CAR_IMG = require('../images/SplashIcon.png');
const BG_IMG = require('../images/SplashBackground.png');

export default function SplashScreen({ navigation }) {
    // Animaciones del coche
    const translateX = useRef(new Animated.Value(START_X)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const rotate = useRef(new Animated.Value(0)).current;
    const exitOpacity = useRef(new Animated.Value(0)).current; // Empezamos en 0 para face-in suave
    
    // Animación de la sombra
    const shadowOpacity = useRef(new Animated.Value(0.4)).current;
    const shadowScale = useRef(new Animated.Value(1)).current;

    // Animaciones del título
    const titleOpacity = useRef(new Animated.Value(0)).current;
    const titleTranslateY = useRef(new Animated.Value(40)).current;
    const titleScale = useRef(new Animated.Value(0.7)).current;
    
    // Pulso del underline
    const underlineScale = useRef(new Animated.Value(1)).current;

    const bounceLoop = useRef(null);
    const pulseLoop = useRef(null);
    const routeData = useRef(null);

    const [fontsLoaded] = useFonts({
        'Poppins-Bold': require('../fonts/Poppins_700Bold.ttf'),
    });

    // Interpolación para rotación física (Inclinación de suspensión)
    const rotateInterpolate = rotate.interpolate({
        inputRange: [-1, 1],
        outputRange: ['-6deg', '6deg'],
    });

    useEffect(() => {
        // 1. Aparece el fondo suavemente (más rápido)
        Animated.timing(exitOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
        }).start();
        
        // Precargar datos de sesión
        AsyncStorage.multiGet(['userRole', 'userName']).then((values) => {
            const userRole = values[0][1];
            const userName = values[1][1];
            routeData.current = { userRole, userName };
        });

        // 🏎️ Secuencia de movimiento realista acelerada
        Animated.sequence([
            // Fase 1: Aceleración (Más dinámica)
            Animated.parallel([
                Animated.timing(translateX, {
                    toValue: 100, 
                    duration: 750, // Más rápido
                    easing: Easing.bezier(0.2, 0, 0.2, 1),
                    useNativeDriver: true,
                }),
                Animated.timing(rotate, {
                    toValue: 0.8,
                    duration: 350,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: -2,
                    duration: 350,
                    useNativeDriver: true,
                }),
            ]),

            // Fase 2: Frenado (Más seco y responsivo)
            Animated.parallel([
                Animated.spring(translateX, {
                    toValue: CENTER_X,
                    friction: 7,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.sequence([
                    Animated.timing(rotate, {
                        toValue: -1.2,
                        duration: 250, // Más rápido
                        useNativeDriver: true,
                    }),
                    Animated.spring(rotate, {
                        toValue: 0,
                        friction: 5,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(translateY, {
                        toValue: 6,
                        duration: 250, // Más rápido
                        useNativeDriver: true,
                    }),
                    Animated.spring(translateY, {
                        toValue: 0,
                        friction: 4,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(shadowOpacity, { toValue: 0.7, duration: 250, useNativeDriver: true }),
                    Animated.timing(shadowOpacity, { toValue: 0.4, duration: 350, useNativeDriver: true }),
                ]),
            ]),
        ]).start(() => {
            // 🔄 Motor encendido
            bounceLoop.current = Animated.loop(
                Animated.sequence([
                    Animated.timing(translateY, {
                        toValue: -0.8, 
                        duration: 300, 
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateY, {
                        toValue: 0.8, 
                        duration: 300, 
                        useNativeDriver: true,
                    }),
                ])
            );
            bounceLoop.current.start();

            // Aparece el título (Más rápido)
            Animated.parallel([
                Animated.timing(titleOpacity, {
                    toValue: 1,
                    duration: 450, // Más rápido
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.spring(titleTranslateY, {
                    toValue: 0,
                    friction: 5,
                    tension: 50,
                    useNativeDriver: true,
                }),
                Animated.spring(titleScale, {
                    toValue: 1,
                    friction: 5,
                    tension: 50,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                pulseLoop.current = Animated.loop(
                    Animated.sequence([
                        Animated.timing(underlineScale, {
                            toValue: 1.1,
                            duration: 1000,
                            easing: Easing.inOut(Easing.sin),
                            useNativeDriver: true,
                        }),
                        Animated.timing(underlineScale, {
                            toValue: 1,
                            duration: 1000,
                            easing: Easing.inOut(Easing.sin),
                            useNativeDriver: true,
                        }),
                    ])
                );
                pulseLoop.current.start();
            });
        });

        // Navegación (MUCHO más rápido el tiempo total de splash)
        const timer = setTimeout(() => {
            Animated.timing(exitOpacity, {
                toValue: 0,
                duration: 400, // Salida rápida
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }).start(() => {
                bounceLoop.current?.stop();
                pulseLoop.current?.stop();
                const data = routeData.current;

                if (data && data.userRole && data.userName) {
                    const route = data.userRole === 'conductor' ? 'DashboardDriver' : 'DashboardPasajero';
                    navigation.reset({
                        index: 1,
                        routes: [
                            { name: 'SignIn' },
                            { name: route, params: { userName: data.userName } },
                        ],
                    });
                } else {
                    navigation.replace('SignIn');
                }
            });
        }, 2800); // Antes 4800


        return () => {
            clearTimeout(timer);
            bounceLoop.current?.stop();
            pulseLoop.current?.stop();
        };
    }, []);

    if (!fontsLoaded) return null;

    return (
        <ImageBackground source={BG_IMG} style={styles.container} resizeMode="cover">
            <StatusBar hidden />

            <Animated.View style={[styles.content, { opacity: exitOpacity }]}>
                
                {/* Contenedor del Coche y Sombra */}
                <View style={styles.carArea}>
                    {/* Sombra Dinámica */}
                    <Animated.View 
                        style={[
                            styles.carShadow,
                            {
                                opacity: shadowOpacity,
                                transform: [{ scale: shadowScale }]
                            }
                        ]} 
                    />

                    {/* Animación del coche */}
                    <Animated.View
                        style={[
                            styles.carContainer,
                            {
                                transform: [
                                    { translateX },
                                    { translateY },
                                    { rotate: rotateInterpolate },
                                ],
                            }
                        ]}
                    >
                        <Image
                            source={CAR_IMG}
                            style={styles.car}
                            contentFit="contain"
                        />
                    </Animated.View>
                </View>

                {/* Contención del Título */}
                <Animated.View
                    style={[
                        styles.titleContainer,
                        {
                            opacity: titleOpacity,
                            transform: [
                                { translateY: titleTranslateY },
                                { scale: titleScale }
                            ],
                        },
                    ]}
                >
                    <Text style={styles.title}>SafeRide</Text>
                    <Animated.View 
                        style={[
                            styles.titleUnderline,
                            { transform: [{ scaleX: underlineScale }] }
                        ]} 
                    />
                </Animated.View>
            </Animated.View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    carArea: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 300,
        width: SCREEN_WIDTH,
        marginTop: SCREEN_HEIGHT * 0.2,
    },
    carShadow: {
        position: 'absolute',
        bottom: 50,
        width: 280,
        height: 30,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 50,
        transform: [{ scaleX: 1.2 }],
        blurRadius: 10,
    },
    carContainer: {
        position: 'relative',
        alignItems: 'center',
    },
    car: {
        width: 420,
        height: 250,
    },
    titleContainer: {
        alignItems: 'center',
        marginTop: -30,
    },
    title: {
        fontSize: 58,
        color: '#ffffff',
        fontFamily: 'Poppins-Bold',
        letterSpacing: 3,
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 6 },
        textShadowRadius: 18,
    },
    titleUnderline: {
        width: 130,
        height: 7,
        backgroundColor: '#38BDF8',
        borderRadius: 4,
        marginTop: 5,
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 12,
    },
});