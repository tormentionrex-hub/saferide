import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDriverTheme } from '../../context/DriverThemeContext';

const ProfilePasajero = ({ navigation }) => {
    const { theme } = useDriverTheme();
    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Mi Perfil</Text>
            </View>
            <View style={styles.content}>
                <Text style={{ color: theme.text }}>Esta es la pantalla de perfil del pasajero.</Text>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    headerTitle: { fontSize: 20, fontFamily: 'Poppins-Bold', marginLeft: 16 },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default ProfilePasajero;
