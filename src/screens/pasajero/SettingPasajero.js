import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useDriverTheme } from '../../context/DriverThemeContext';

const SettingPasajero = ({ navigation }) => {
    const { theme } = useDriverTheme();
    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
             <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            <View style={styles.content}>
                <Text style={[styles.text, { color: theme.text }]}>Yo soy el screen de Configuración</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 18,
        fontFamily: 'Poppins-Bold',
    },
});

export default SettingPasajero;
