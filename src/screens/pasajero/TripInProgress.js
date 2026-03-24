import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import BottomNavigationBar from '../../components/BottomNavigationBar';

const TripInProgress = ({ navigation }) => {
    const { theme } = useDriverTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.surface} />
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Viaje en Progreso</Text>
            </View>
            <View style={styles.content}>
                <Ionicons name="car-outline" size={100} color={theme.accent} />
                <Text style={[styles.mainText, { color: theme.text }]}>¡Tu viaje está en curso!</Text>
                <Text style={[styles.subText, { color: theme.textSecondary }]}>Disfruta de tu recorrido seguro y cómodo con Saferide.</Text>
            </View>
            <BottomNavigationBar navigation={navigation} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 0 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#ccc' },
    title: { fontSize: 18, fontWeight: 'bold' },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, paddingBottom: 80 },
    mainText: { fontSize: 24, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
    subText: { fontSize: 16, marginTop: 10, textAlign: 'center' }
});

export default TripInProgress;
