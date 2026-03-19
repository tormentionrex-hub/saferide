import React from 'react';
import { StyleSheet, Text, View, SafeAreaView } from 'react-native';
import BottomNavigationDriver from '../components/BottomNavigationDriver';

export default function PublishRide({ navigation }) {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Publicar Viaje</Text>
                <Text style={styles.message}>Aquí podrás configurar tu origen, destino, hora y precio del viaje.</Text>
            </View>
            <BottomNavigationDriver navigation={navigation} activeTab="Viajes" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 10,
    },
    message: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
    },
});
