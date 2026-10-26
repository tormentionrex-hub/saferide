import { useRef, useState } from 'react';
import {
    TouchableOpacity,
    Animated,
    StyleSheet,
    Modal,
    View,
    Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../context/DriverThemeContext';

const SettingsGearButton = ({
    navigation,
    color,
    style,
    profileScreen = 'ProfileConductor',
    settingsScreen = 'AjustesConductor',
}) => {
    const { theme } = useDriverTheme();
    const [modalVisible, setModalVisible] = useState(false);

    const rotation     = useRef(new Animated.Value(0)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;
    const cardScale    = useRef(new Animated.Value(0.8)).current;
    const cardOpacity  = useRef(new Animated.Value(0)).current;

    const spin = rotation.interpolate({
        inputRange:  [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    const handlePress = () => {
        Animated.timing(rotation, {
            toValue: 1, duration: 350, useNativeDriver: true,
        }).start(() => {
            rotation.setValue(0);
            setModalVisible(true);
            Animated.parallel([
                Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.spring(cardScale,    { toValue: 1, friction: 7, tension: 100, useNativeDriver: true }),
                Animated.timing(cardOpacity,  { toValue: 1, duration: 180, useNativeDriver: true }),
            ]).start();
        });
    };

    const closeModal = (callback) => {
        Animated.parallel([
            Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
            Animated.timing(cardScale,    { toValue: 0.85, duration: 160, useNativeDriver: true }),
            Animated.timing(cardOpacity,  { toValue: 0, duration: 160, useNativeDriver: true }),
        ]).start(() => {
            setModalVisible(false);
            cardScale.setValue(0.8);
            cardOpacity.setValue(0);
            backdropAnim.setValue(0);
            if (callback) callback();
        });
    };

    const handleOption = (screen) => closeModal(() => navigation.navigate(screen));

    return (
        <>
            <TouchableOpacity
                onPress={handlePress}
                activeOpacity={0.7}
                style={[styles.btn, style]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="settings-outline" size={26} color={color || theme.text} />
                </Animated.View>
            </TouchableOpacity>

            <Modal visible={modalVisible} transparent animationType="none" statusBarTranslucent>
                {/* Backdrop */}
                <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />

                {/* Card centrada */}
                <View style={styles.modalOuter} pointerEvents="box-none">
                    <Animated.View
                        style={[
                            styles.modalCard,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                            { opacity: cardOpacity, transform: [{ scale: cardScale }] },
                        ]}
                    >
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Configuración</Text>
                        <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                            ¿A dónde quieres ir?
                        </Text>

                        <View style={styles.optionsRow}>
                            {/* Perfil */}
                            <TouchableOpacity
                                style={[styles.optionCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
                                onPress={() => handleOption(profileScreen)}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.iconCircle, { backgroundColor: theme.surface }]}>
                                    <Ionicons name="person-outline" size={30} color={theme.accent} />
                                </View>
                                <Text style={[styles.optionLabel, { color: theme.text }]}>Perfil</Text>
                                <Text style={[styles.optionSub, { color: theme.textSecondary }]}>Tu información</Text>
                            </TouchableOpacity>

                            {/* Ajustes */}
                            <TouchableOpacity
                                style={[styles.optionCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
                                onPress={() => handleOption(settingsScreen)}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.iconCircle, { backgroundColor: theme.surface }]}>
                                    <Ionicons name="construct-outline" size={30} color={theme.accent} />
                                </View>
                                <Text style={[styles.optionLabel, { color: theme.text }]}>Ajustes</Text>
                                <Text style={[styles.optionSub, { color: theme.textSecondary }]}>Apariencia y más</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[styles.cancelBtn, { borderColor: theme.border, backgroundColor: theme.surfaceVariant }]}
                            onPress={() => closeModal()}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancelar</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    btn: { padding: 4 },

    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        opacity: 0.5,
    },
    modalOuter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    modalCard: {
        width: '100%',
        borderRadius: 24,
        borderWidth: 1,
        padding: 24,
        alignItems: 'center',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: 'Poppins-Bold',
        marginBottom: 4,
    },
    modalSub: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        marginBottom: 20,
    },
    optionsRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginBottom: 16,
    },
    optionCard: {
        flex: 1,
        borderRadius: 16,
        borderWidth: 1,
        paddingVertical: 20,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    iconCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    optionLabel: {
        fontSize: 15,
        fontFamily: 'Poppins-Bold',
        marginBottom: 2,
    },
    optionSub: {
        fontSize: 11,
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
    },
    cancelBtn: {
        width: '100%',
        paddingVertical: 13,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 14,
        fontFamily: 'Poppins-Bold',
    },
});

export default SettingsGearButton;
