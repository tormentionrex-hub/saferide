import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Button, ActivityIndicator } from 'react-native';
import api from '../services/api';

export default function HomeScreen() {
    const [healthStatus, setHealthStatus] = useState(null);
    const [loading, setLoading] = useState(false);

    const checkApiHealth = async () => {
        setLoading(true);
        try {
            // Hacemos una petición al backend que acabamos de levantar
            const response = await api.get('/health');
            setHealthStatus(response.data);
        } catch (error) {
            console.error('API Error:', error);
            setHealthStatus({ error: error.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkApiHealth();
    }, []);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>SafeRide Driver/Passenger App</Text>

            <View style={styles.statusBox}>
                <Text style={styles.subtitle}>Estado del API Backend:</Text>
                {loading ? (
                    <ActivityIndicator size="small" color="#0000ff" />
                ) : healthStatus && healthStatus.success ? (
                    <Text style={styles.successText}>✅ Conectado: {healthStatus.message}</Text>
                ) : (
                    <Text style={styles.errorText}>
                        ❌ Error de conexión: {healthStatus?.error || 'Falló al conectar al backend'}
                    </Text>
                )}
                <Text style={styles.hint}>
                    Nota: Debes cambiar la IP en src/config.js a la IP de tu PC para que Expo conecte al servidor 8080.
                </Text>
            </View>

            <Button title="Verificar Conexión" onPress={checkApiHealth} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 30,
        color: '#333',
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
    },
    statusBox: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 30,
        alignItems: 'center',
    },
    successText: {
        color: 'green',
        fontSize: 16,
        marginVertical: 10,
    },
    errorText: {
        color: 'red',
        fontSize: 14,
        marginVertical: 10,
        textAlign: 'center',
    },
    hint: {
        fontSize: 12,
        color: '#888',
        textAlign: 'center',
        marginTop: 15,
    }
});
