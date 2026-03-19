import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomNavigationDriver from '../../components/BottomNavigationDriver';

const SettingConductor = ({ navigation }) => {
    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.text}>Yo soy el screen de Configuración</Text>
            </View>
            <BottomNavigationDriver navigation={navigation} activeTab="Configuraciones" />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 18,
        color: '#4B68FF',
        fontFamily: 'Poppins-Bold',
    },
});

export default SettingConductor;
