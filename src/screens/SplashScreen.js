import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';

// TODO: Reemplazar con el componente de video cuando se proporcione el archivo
// import { Video } from 'expo-av';

const SPLASH_DURATION_MS = 3000; // Ajustar según la duración del video

export default function SplashScreen({ navigation }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            navigation.replace('Login');
        }, SPLASH_DURATION_MS);

        return () => clearTimeout(timer);
    }, [navigation]);

    return (
        <View style={styles.container}>
            <StatusBar hidden />
            {/* AQUÍ IRÁ EL VIDEO DE ANIMACIÓN */}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
