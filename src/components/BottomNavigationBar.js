import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';

const { width } = Dimensions.get('window');

// Mapeo de cada item del nav con sus screens relacionados y los iconos que usa
const NAV_ITEMS = [
    {
        label: 'Inicio',
        activeIcon: 'home',
        inactiveIcon: 'home-outline',
        screens: ['DashboardPasajero'],
        target: 'DashboardPasajero',
    },
    {
        label: 'Buscar viaje',
        activeIcon: 'compass',
        inactiveIcon: 'compass-outline',
        // Se ilumina tanto en SearchRide como en ListOfDrivers (flujo de búsqueda)
        screens: ['SearchRide', 'ListOfDrivers'],
        target: 'SearchRide',
    },
    {
        label: 'Historial',
        activeIcon: 'time',
        inactiveIcon: 'time-outline',
        screens: ['History'],
        target: 'History',
    },
    {
        label: 'Métricas',
        activeIcon: 'bar-chart',
        inactiveIcon: 'bar-chart-outline',
        screens: ['Metrics'],
        target: 'Metrics',
    },
];

const BottomNavigationBar = ({ state, descriptors, navigation }) => {
    const primaryColor = '#045084';
    const activeColor = '#045084';    // Color del tab activo
    const inactiveColor = '#A0ADB8';  // Color de los tabs inactivos (gris apagado)
    const insets = useSafeAreaInsets();

    // Si no hay estado (caso de uso directo sin Tab.Navigator), usamos el hook useRoute
    // Esto es para compatibilidad con las pantallas que aún lo importan manualmente
    const route = useRoute();
    const currentRouteName = state ? state.routes[state.index].name : route.name;

    return (
        <View style={[
            styles.container,
            { paddingBottom: insets.bottom > 0 ? insets.bottom : 14, height: 70 + (insets.bottom > 0 ? insets.bottom : 14) }
        ]}>
            {NAV_ITEMS.map((item) => {
                // Determinamos si este tab está activo comparando el screen actual con los screens del item
                const isActive = item.screens.includes(currentRouteName);
                const iconName = isActive ? item.activeIcon : item.inactiveIcon;
                const color = isActive ? activeColor : inactiveColor;

                const onPress = () => {
                    if (state) {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: item.target,
                            canPreventDefault: true,
                        });

                        if (!isActive && !event.defaultPrevented) {
                            navigation.navigate(item.target);
                        }
                    } else {
                        navigation.navigate(item.target);
                    }
                };

                return (
                    <TouchableOpacity
                        key={item.label}
                        style={styles.navItem}
                        activeOpacity={0.6}
                        onPress={onPress}
                    >
                        <Ionicons
                            name={iconName}
                            size={isActive ? 26 : 24}
                            color={color}
                        />
                        <Text style={[
                            styles.navText,
                            { color },
                            isActive && styles.navTextActive
                        ]}>
                            {item.label}
                        </Text>
                        {isActive && <View style={styles.activeDot} />}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.97)',
        width: '100%',
        justifyContent: 'space-around',
        alignItems: 'center',
        position: 'absolute',
        bottom: 0,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
        elevation: 10,
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        paddingTop: 10,
        position: 'relative',
    },
    navText: {
        fontSize: 10,
        marginTop: 3,
        textAlign: 'center',
        width: '100%',
    },
    navTextActive: {
        fontWeight: 'bold', // Texto en negrita cuando está activo
    },
    // Pequeño punto azul debajo del tab activo como indicador adicional
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#045084',
        marginTop: 3,
    },
});

export default BottomNavigationBar;

