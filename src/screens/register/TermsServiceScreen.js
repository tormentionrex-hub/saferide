import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const TERMS_SECTIONS = [
    { title: "1. Introducción", content: "Al registrarse, acceder o utilizar la aplicación SafeRide, usted declara haber leído, comprendido y aceptado íntegramente los presentes Términos, Servicios y Políticas de Uso. En caso de no estar de acuerdo, deberá abstenerse de utilizar la Plataforma." },

    { title: "2. Naturaleza del Servicio", content: "SafeRide es una plataforma tecnológica de uso interno que permite la conexión entre funcionarios de una misma organización o comunidad laboral, con el fin de facilitar opciones de transporte compartido dentro de un área específica. \n\n El Usuario reconoce y acepta que:\n\n • Los servicios de transporte son ofrecidos directamente por otros funcionarios, de manera voluntaria. \n\n • SafeRide actúa exclusivamente como intermediario digital. \n\n • SafeRide no presta servicios de transporte ni emplea a los conductores. \n\n • La relación entre conductor y pasajero es de carácter independiente y voluntaria entre ambas partes. " },

    { title: "3. Ámbito de Aplicación y Acceso", content: "El uso de la Plataforma está limitado a:\n\n • Funcionarios pertenecientes a la misma organización o comunidad autorizada. \n\n • Ubicación: Belén de Heredia, Costa Rica, específicamente en la Zona Franca El Cafetal.\n\n El Usuario acepta que:\n\n • El acceso es restringido y puede requerir validación interna. \n\n • La Plataforma se encuentra en fase beta, por lo que puede presentar errores, interrupciones o cambios sin previo aviso. " },

    { title: "4. Registro y Verificación", content: "Para utilizar la Plataforma, el Usuario deberá:\n\n • Ser mayor de edad. \n • Pertenecer a la organización o comunidad autorizada. \n • Proporcionar información veraz, completa y verificable. \n\n SafeRide podrá:\n\n • Validar la pertenencia del Usuario a la organización. \n • Suspender o rechazar registros que no cumplan con los requisitos. " },

    { title: "5. Modalidad del Servicio", content: "El Usuario entiende y acepta que:\n\n • Los viajes ofrecidos a través de la Plataforma son de carácter colaborativo entre funcionarios. \n\n • No constituyen un servicio de transporte público ni comercial formal. \n\n • Los conductores pueden recibir una compensación económica, la cual no constituye una relación laboral con SafeRide. " },

    { title: "6. Condiciones de Uso por Tipo de Usuario", content: "6.1 Usuarios Conductores\n\n El Usuario que ofrezca transporte declara que:\n\n • Ofrece el servicio de manera voluntaria a otros funcionarios. \n • Su vehículo se encuentra en condiciones seguras y adecuadas. \n • Cumple con la normativa de tránsito vigente. \n • Asume plena responsabilidad por la conducción y el servicio brindado. \n\n 6.2 Usuarios Pasajeros\n\n El Usuario que solicita transporte se compromete a:\n • Utilizar el servicio de forma respetuosa y responsable. \n • Coordinar correctamente puntos de recogida y destino. \n • Cumplir con el pago o contribución acordada. " },

    { title: "7. Pagos y Contribuciones", content: "El Usuario entiende y acepta que:\n\n • Los pagos realizados corresponden a una contribución por el traslado. \n\n • SafeRide podrá aplicar comisiones por el uso de la Plataforma. \n\n • Las tarifas serán visibles antes de confirmar el viaje. " },

    { title: "8. Conducta y Comportamiento", content: "Fomentamos una comunidad de respeto y tolerancia. Cualquier comportamiento de acoso, discriminación o falta de civilidad hacia otros usuarios o personal de soporte resultará en la suspensión inmediata y permanente de la cuenta investigada." },

    { title: "9. Pagos y Contribuciones", content: "SafeRide facilita la compartición de gastos, no es un servicio de transporte tradicional o lucrativo. Los pasajeros acuerdan contribuir al costo del combustible y mantenimiento del vehículo bajo los términos fijados voluntariamente." },

    { title: "10. Responsabilidad y Límites", content: "SafeRide actúa únicamente como intermediario tecnológico. No somos dueños de los vehículos ni ofrecemos los servicios de transporte personalmente. No garantizamos una disponibilidad continua y no nos hacemos responsables de daños a propiedades en eventos de fuerza mayor." },

    { title: "11. Propiedad Intelectual", content: "Todos los elementos de hardware, software, marcas comerciales, algoritmos y códigos asociados a SafeRide son propiedad exclusiva de la empresa matriz. Queda prohíbida su reproducción parcial o total sin consentimiento escrito y firmado." },

    { title: "12. Modificaciones a los Términos", content: "Nos reservamos el estricto derecho de modificar estos términos en cualquier momento. Las modificaciones serán notificadas a través de la aplicación. Su uso continuo constituye la aceptación total de los nuevos términos establecidos." },

    { title: "13. Suspensión de Cuentas", content: "Podemos suspender o cancelar definitivamente su cuenta si detectamos incumplimiento grave de estos términos. El usuario también puede cerrar su cuenta en cualquier momento solicitándolo directamente en la configuración del perfil interno." },

    { title: "14. Jurisdicción Aplicable", content: "Estos términos se regirán e interpretarán de acuerdo con las leyes aplicables del país de operación principal (Costa Rica). Cualquier disputa será resuelta amistosamente de primera mano, o eventualmente sometida a tribunales competentes." },
];

function TermsServiceScreen({ navigation }) {
    const [reachedBottom, setReachedBottom] = useState(false);
    const [showButton, setShowButton] = useState(false);
    
    // Animaciones para el botón
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        if (showButton) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    friction: 7,
                    tension: 50,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [showButton]);

    const handleScroll = (event) => {
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        const paddingToBottom = 150; // Margen para detectar el final de la pantalla
        
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
            if (!reachedBottom) {
                setReachedBottom(true);
                // Retardo de 2.5 segundos para mostrar el botón
                setTimeout(() => {
                    setShowButton(true);
                }, 2500);
            }
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#073050ff" />
            
            <View style={styles.header}>
                <LinearGradient
                    colors={['#09314bff', '#0c4469ff', '#073050ff']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Términos y Servicios</Text>
            </View>

            <ScrollView 
                style={styles.scrollContainer} 
                contentContainerStyle={styles.scrollContent}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.topInfo}>
                    <Ionicons name="document-text" size={60} color="#0c4469ff" style={{ alignSelf: 'center', marginBottom: 12 }} />

                    <Text style={styles.TitleCompany}>SafeRide</Text>

                    <Text style={styles.mainTitle}>TÉRMINOS, SERVICIOS Y POLÍTICAS DE USO</Text>
                    <Text style={styles.lastUpdated}>Última actualización: Marzo 2026</Text>
                    
                    <View style={styles.alertBox}>
                        <Ionicons name="information-circle" size={20} color="#0c4469ff" />
                        <Text style={styles.introParagraph}>
                            Por favor, lea detalladamente el contenido de este documento. 
                            Es necesario que llegues hasta el final de los términos para poder aceptarlos.
                        </Text>
                    </View>
                </View>

                {TERMS_SECTIONS.map((section, index) => (
                    <View key={index} style={styles.sectionContainer}>

                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        
                        <Text style={styles.sectionContent}>

                            {section.content.split(/(SafeRide|Costa Rica|El Usuario acepta que:|6.1 Usuarios Conductores|6.2 Usuarios Pasajeros)/g).map((part, i) => {
                                if (part === 'SafeRide') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#073050ff' }}>{part}</Text>;
                                } else if (part === 'El Usuario acepta que:') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#333' }}>{part}</Text>;
                                } else if (part === 'Costa Rica') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#333' }}>{part}</Text>;
                                } else if (part === '6.1 Usuarios Conductores') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#333' }}>{part}</Text>;
                                } else if (part === '6.2 Usuarios Pasajeros') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#333' }}>{part}</Text>;
                                }
                                return <React.Fragment key={i}>{part}</React.Fragment>;
                            })}
                        </Text>
                    </View>
                ))}
                
                <View style={styles.bottomSpacer}>
                    {!showButton && reachedBottom && (
                        <Text style={styles.loadingText}>Procesando tu lectura...</Text>
                    )}
                </View>
            </ScrollView>

            {/* Contenedor del Botón Aceptar Flotante */}
            {showButton && (
                <Animated.View style={[
                    styles.bottomButtonContainer, 
                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                ]}>
                    <TouchableOpacity 
                        style={styles.acceptButton}
                        activeOpacity={0.8}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.acceptButtonText}>Aceptar Términos de Servicio</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f6f9fc',
    },
    header: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    backButton: {
        padding: 5,
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 40,
    },
    topInfo: {
        marginBottom: 35,
        paddingBottom: 25,
        borderBottomWidth: 1,
        borderBottomColor: '#d6e2ec',
    },

    TitleCompany: {
        fontSize: 35,
        fontWeight: '900',
        color: '#073050ff',
        textAlign: 'center',
        marginBottom: 30,
        marginTop: 10,
    },
    mainTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#073050ff',
        textAlign: 'center',
        marginBottom: 8,
    },
    lastUpdated: {
        fontSize: 13,
        color: '#555',
        textAlign: 'center',
        marginBottom: 20,
        fontStyle: 'italic',
    },
    alertBox: {
        flexDirection: 'row',
        backgroundColor: '#eaf4fc',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    introParagraph: {
        fontSize: 13,
        color: '#09314bff',
        lineHeight: 20,
        marginLeft: 10,
        flex: 1,
        fontWeight: '500',
    },
    sectionContainer: {
        marginBottom: 26,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0a6191ff',
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    sectionContent: {
        fontSize: 15,
        color: '#444',
        lineHeight: 24,
        textAlign: 'justify',
    },
    bottomSpacer: {
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#0a6191ff',
        fontStyle: 'italic',
        fontSize: 14,
    },
    bottomButtonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 25, 
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    acceptButton: {
        backgroundColor: '#0a8ac5ff',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    acceptButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    }
});

export default TermsServiceScreen;