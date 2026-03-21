import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDriverTheme } from '../context/DriverThemeContext';

const BottomNavigationBarAlt = ({ state, descriptors, navigation, activeTab: manualActiveTab }) => {
    const insets = useSafeAreaInsets();
    const { theme } = useDriverTheme();

    // Determinar la pestaña activa
    let currentTab = manualActiveTab || 'Inicio';
    if (state) {
        const routeName = state.routes[state.index].name;
        if (routeName === 'DashboardDriver') currentTab = 'Inicio';
        else if (routeName === 'PublishRide') currentTab = 'Viajes';
        else if (routeName === 'ManageRequests') currentTab = 'Mensajes';
        else if (routeName === 'DriverMetrics') currentTab = 'Stats';
    }

    const getColor = (tabName) => currentTab === tabName ? theme.navActive : theme.navInactive;

    const navigateTo = (routeName) => {
        if (state) {
            const event = navigation.emit({
                type: 'tabPress',
                target: routeName,
                canPreventDefault: true,
            });

            if (currentTab !== routeName && !event.defaultPrevented) {
                navigation.navigate(routeName);
            }
        } else {
            navigation.navigate(routeName);
        }
    };

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
                onPress={() => navigateTo('DashboardDriver')}
            >
                <Ionicons 
                    name={currentTab === 'Inicio' ? "home" : "home-outline"} 
                    size={24} color={getColor('Inicio')} 
                />
                <Text style={[styles.navText, { color: getColor('Inicio') }]}>Inicio</Text>
            </TouchableOpacity>

            {/* 2. BOTÓN: VIAJES */}
            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => navigateTo('PublishRide')}
            >
                <Ionicons 
                    name={currentTab === 'Viajes' ? "map" : "map-outline"} 
                    size={24} color={getColor('Viajes')} 
                />
                <Text style={[styles.navText, { color: getColor('Viajes') }]}>Viajes</Text>
            </TouchableOpacity>

            {/* 3. BOTÓN: MENSAJES */}
            <TouchableOpacity 
                style={styles.navItem} 
                activeOpacity={0.6}
                onPress={() => navigateTo('ManageRequests')}
            >
                <Ionicons 
                    name={currentTab === 'Mensajes' ? "chatbox" : "chatbox-outline"} 
                    size={24} color={getColor('Mensajes')} 
                />
                <Text style={[styles.navText, { color: getColor('Mensajes') }]}>Mensajes</Text>
            </TouchableOpacity>

            {/* 4. BOTÓN: STATS */}
            <TouchableOpacity
                style={styles.navItem}
                activeOpacity={0.6}
                onPress={() => navigateTo('DriverMetrics')}
            >
                <Ionicons
                    name={currentTab === 'Stats' ? "bar-chart" : "bar-chart-outline"}
                    size={24} color={getColor('Stats')}
                />
                <Text style={[styles.navText, { color: getColor('Stats') }]}>Stats</Text>
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
        fontFamily: 'Poppins-SemiBold',
        textAlign: 'center',
    }
});

export default BottomNavigationBarAlt;