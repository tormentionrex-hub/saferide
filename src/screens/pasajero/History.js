import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useDriverTheme } from '../../context/DriverThemeContext';

const History = () => {
    const { theme } = useDriverTheme();
    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            <Text style={[styles.text, { color: theme.text }]}>Yo soy el screen de Historial</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 18,
        fontFamily: 'Poppins-Bold',
    },
});

export default History;
