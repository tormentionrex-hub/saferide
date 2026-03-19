import { StyleSheet, Text, View, SafeAreaView, StatusBar } from 'react-native';
import BottomNavigationDriver from '../../components/BottomNavigationDriver';
import { useDriverTheme } from '../../context/DriverThemeContext';

export default function DriverMetrics({ navigation }) {
    const { theme } = useDriverTheme();
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
            <View style={styles.content}>
                <Text style={[styles.title, { color: theme.text }]}>Métricas del Conductor</Text>
                <Text style={[styles.message, { color: theme.textSecondary }]}>Aquí aparecerán tus estadísticas: dinero ganado, viajes realizados y calificación.</Text>
            </View>
            <BottomNavigationDriver navigation={navigation} activeTab="Inicio" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
    },
});
