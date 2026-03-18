import React, { useEffect, useRef } from 'react';
import {
    StyleSheet,
    StatusBar,
    Animated,
    Easing,
    Dimensions,
    View,
    ImageBackground,
} from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const START_X  = -SCREEN_WIDTH;
const RIGHT_X  =  SCREEN_WIDTH * 0.32;
const CENTER_X =  0;

const CAR_IMG = require('../images/SplashAnimacion.gif');
const BG_IMG  = require('../images/BackgroundSplash.png');

export default function SplashScreen({ navigation }) {
    const translateX    = useRef(new Animated.Value(START_X)).current;
    const translateY    = useRef(new Animated.Value(0)).current;
    const carOpacity    = useRef(new Animated.Value(1)).current;
    const bounceLoop    = useRef(null);
    const routeData     = useRef(null);

    useEffect(() => {
        // Pre-cargar los datos del usuario para navegación inmediata (0 latencia)
        AsyncStorage.multiGet(['userRole', 'userName']).then((values) => {
            const userRole = values[0][1];
            const userName = values[1][1];
            routeData.current = { userRole, userName };
        });

        // ── Fase 1: entra desde la izquierda hasta casi el borde derecho ──
        Animated.timing(translateX, {
            toValue: RIGHT_X,
            duration: 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start(() => {

            // ── Fase 2: regresa al centro ──
            Animated.timing(translateX, {
                toValue: CENTER_X,
                duration: 400,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
            }).start(() => {

                // ── Fase 3: bounce sutil en el centro ──
                bounceLoop.current = Animated.loop(
                    Animated.sequence([
                        Animated.timing(translateY, {
                            toValue: -3,
                            duration: 130,
                            easing: Easing.inOut(Easing.sin),
                            useNativeDriver: true,
                        }),
                        Animated.timing(translateY, {
                            toValue: 2,
                            duration: 130,
                            easing: Easing.inOut(Easing.sin),
                            useNativeDriver: true,
                        }),
                    ])
                );
                bounceLoop.current.start();
            });
        });

        // ── A los 1800ms: animación de desaparición y navegación simultánea síncrona ──
        const navTimer = setTimeout(() => {
            bounceLoop.current?.stop();
            
            // Animación de desaparición súper rápida para el auto
            Animated.timing(carOpacity, {
                toValue: 0,
                duration: 350,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }).start();

            // Navegación inmediata SIN latencia asíncrona
            const data = routeData.current;
            if (data && data.userRole && data.userName) {
                const dashboardRoute = data.userRole === 'conductor' ? 'DashboardDriver' : 'DashboardPasajero';
                navigation.reset({
                    index: 1,
                    routes: [
                        { name: 'SignIn' },
                        { name: dashboardRoute, params: { userName: data.userName } },
                    ],
                });
            } else {
                navigation.replace('SignIn');
            }
        }, 1800);

        return () => {
            clearTimeout(navTimer);
            bounceLoop.current?.stop();
        };
    }, []);

    return (
        <ImageBackground source={BG_IMG} style={styles.container} resizeMode="cover">
            <StatusBar hidden />
            <Animated.View style={{ opacity: carOpacity, transform: [{ translateX }, { translateY }] }}>
                <Image
                    source={CAR_IMG}
                    style={styles.car}
                    contentFit="contain"
                    autoplay
                    transform={[{ scaleX: -1 }]}
                />
            </Animated.View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    car: {
        width: 150,
        height: 95,
    },
});
