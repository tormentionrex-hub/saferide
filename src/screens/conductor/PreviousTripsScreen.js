import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';

export default function PreviousTripsScreen() {
    const { theme } = useDriverTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            <View style={styles.content}>
                <View style={[styles.iconCircle, { backgroundColor: theme.surfaceVariant }]}>
                    <Ionicons name="time-outline" size={48} color={theme.accent} />
                </View>
                <Text style={[styles.title, { color: theme.text }]}>Viajes Anteriores</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                    Aquí aparecerá el historial de tus viajes. Pronto disponible.
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        gap: 16,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
    },
});
