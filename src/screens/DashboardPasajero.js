import React from 'react';
import { 
    StyleSheet, 
    Text, 
    View, 
    SafeAreaView, 
    TouchableOpacity, 
    StatusBar,
    Dimensions
} from 'react-native';
import BottomNavigationBar from '../components/BottomNavigationBar';

const { height, width } = Dimensions.get('window');

const DashboardPasajero = ({ navigation, route }) => {
    // Simulamos la obtención del usuario logueado (ej: desde route.params o un context)
    const userName = route?.params?.userName || "Usuario";
    
    // Color especificado por el usuario (ajustado a #045084 basado en SignInScreen)
    const primaryColor = '#045084';
    const subtextColor = 'rgba(255,255,255,0.4)';

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" />
            
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Saferide</Text>
            </View>

            {/* Body */}
            <View style={styles.content}>
                <Text style={styles.greeting}>Hola, {userName}</Text>

                <TouchableOpacity 
                    style={styles.searchCard}
                    onPress={() => {
                        /* Redirección al screen de buscar viaje */
                        // navigation.navigate('BuscarViajeScreen');
                        console.log("Conexión para redirección a Buscar Viaje");
                    }}
                    activeOpacity={0.9}
                >
                    <Text style={styles.cardTitle}>Buscar viaje</Text>
                    <Text style={styles.cardSubtitle}>Encuentra tu próximo viaje seguro</Text>
                </TouchableOpacity>
            </View>

            {/* Bottom Nav Bar */}
            <BottomNavigationBar navigation={navigation} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        alignItems: 'flex-start', // En la esquina
    },
    headerTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 24,
        color: '#045084',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    greeting: {
        fontSize: 22,
        color: '#000000',
        marginBottom: 30,
        fontFamily: 'Poppins-Bold',
    },
    searchCard: {
        backgroundColor: '#045084',
        width: '70%',
        padding: 20,
        borderRadius: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    cardTitle: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 18,
        fontWeight: 'bold', // Diseño en negrita solicitado
        marginBottom: 5,
    },
    cardSubtitle: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
    }
});

export default DashboardPasajero;
