import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';

const ScreenSaver = ({ navigation }) => {
    const { theme } = useDriverTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.surface} />
            <View style={styles.content}>
                <Ionicons name="time-outline" size={80} color={theme.accent} />
                <Text style={[styles.text, { color: theme.text }]}>
                    La petición se ha enviado, espera la respuesta del conductor
                </Text>
            </View>
            <TouchableOpacity 
                style={[styles.button, { backgroundColor: theme.accent }]}
                onPress={() => navigation.navigate('DashboardPasajero')}
            >
                <Text style={styles.buttonText}>Volver al Inicio</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        marginTop: 30,
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 30,
    },
    button: {
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 20,
        marginHorizontal: 20,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    }
});

export default ScreenSaver;
