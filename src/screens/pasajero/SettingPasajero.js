import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomNavigationBar from '../../components/BottomNavigationBar';

const SettingPasajero = ({ navigation }) => {
    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.text}>Yo soy el screen de Configuración</Text>
            </View>
            <BottomNavigationBar navigation={navigation} />
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
        color: '#045084',
        fontFamily: 'Poppins-Bold',
    },
});

export default SettingPasajero;
