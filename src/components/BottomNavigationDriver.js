import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDriverTheme } from '../context/DriverThemeContext';

const BottomNavigationBarAlt = ({ navigation, activeTab = 'Inicio' }) => {
    const insets = useSafeAreaInsets();
    const { theme } = useDriverTheme();

    const getColor = (tabName) => activeTab === tabName ? theme.navActive : theme.navInactive;

    return (
        <View style={[
            styles.container,
            {
                paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
                height: 70 + (insets.bottom > 0 ? insets.bottom : 20),
                backgroundColor: theme.navBg,
                borderTopColor: theme.navBorder,
            }
        ]}>
            
            {/* 1. BOTÓN: INICIO (DashboardDriver) */}
            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => navigation.navigate('DashboardDriver')}
            >
                <Ionicons 
                    name={activeTab === 'Inicio' ? "home" : "home-outline"} 
                    size={24} color={getColor('Inicio')} 
                />
                <Text style={[styles.navText, { color: getColor('Inicio') }]}>Inicio</Text>
            </TouchableOpacity>

            {/* 2. BOTÓN: VIAJES */}
            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => navigation.navigate('PublishRide')}
            >
                <Ionicons 
                    name={activeTab === 'Viajes' ? "map" : "map-outline"} 
                    size={24} color={getColor('Viajes')} 
                />
                <Text style={[styles.navText, { color: getColor('Viajes') }]}>Viajes</Text>
            </TouchableOpacity>

            {/* 3. BOTÓN: MENSAJES */}
            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => navigation.navigate('ManageRequests')}
            >
                <Ionicons 
                    name={activeTab === 'Mensajes' ? "chatbox" : "chatbox-outline"} 
                    size={24} color={getColor('Mensajes')} 
                />
                <Text style={[styles.navText, { color: getColor('Mensajes') }]}>Mensajes</Text>
            </TouchableOpacity>

            {/* 4. BOTÓN: PERFIL */}
            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => navigation.navigate('DriverMetrics')}
            >
                <Ionicons 
                    name={activeTab === 'Perfil' ? "person" : "person-outline"} 
                    size={24} color={getColor('Perfil')} 
                />
                <Text style={[styles.navText, { color: getColor('Perfil') }]}>Perfil</Text>
            </TouchableOpacity>

            {/* 5. BOTÓN: CONFIGURACIONES */}
            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => navigation.navigate('SettingConductor')}
            >
                <Ionicons 
                    name={activeTab === 'Configuraciones' ? "settings" : "settings-outline"} 
                    size={24} color={getColor('Configuraciones')} 
                />
                <Text style={[styles.navText, { color: getColor('Configuraciones') }]}>Ajustes</Text>
            </TouchableOpacity>

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        width: '100%',
        justifyContent: 'space-around',
        alignItems: 'center',
        position: 'absolute',
        bottom: 0,
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        paddingTop: 10,
    },
    navText: {
        fontSize: 10, 
        marginTop: 4,
        fontFamily: 'Poppins-Regular',
        fontWeight: '500',
    }
});

export default BottomNavigationBarAlt;