import React from 'react';
import { StyleSheet, Text, View, SafeAreaView } from 'react-native';
import BottomNavigationDriver from '../components/BottomNavigationDriver';

export default function ManageRequests({ navigation }) {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Gestionar Solicitudes</Text>
                <Text style={styles.message}>Aquí verás quién quiere subirse a tu viaje y podrás Aceptar o Rechazar solicitudes.</Text>
            </View>
            <BottomNavigationDriver navigation={navigation} activeTab="Mensajes" />
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
