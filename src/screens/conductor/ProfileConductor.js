import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';

const ProfileConductor = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { theme } = useDriverTheme();

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 16, borderBottomColor: theme.divider }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Perfil</Text>
            </View>

            {/* Contenido */}
            <View style={styles.center}>
                <Ionicons name="person-circle-outline" size={80} color={theme.textSecondary} style={{ marginBottom: 16 }} />
                <Text style={[styles.message, { color: theme.textSecondary }]}>Este es el perfil</Text>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    backBtn:     { position: 'absolute', left: 16 },
    headerTitle: { fontSize: 18, fontFamily: 'Poppins-Bold' },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    message: {
        fontSize: 16,
        fontFamily: 'Poppins-Regular',
    },
});

export default ProfileConductor;
