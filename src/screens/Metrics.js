import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const Metrics = () => {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Yo soy el screen de Métricas</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 18,
        color: '#045084',
        fontFamily: 'Poppins-Bold',
    },
});

export default Metrics;
