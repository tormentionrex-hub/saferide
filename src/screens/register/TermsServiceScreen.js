import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions, StatusBar, Easing } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

    { title: "8. Responsabilidad y Relación entre Usuarios", content: "El Usuario reconoce que:\n\n • Los viajes se realizan entre particulares pertenecientes a una misma comunidad laboral. \n • SafeRide no interviene en la ejecución del servicio. \n • Cada Usuario es responsable de su conducta, decisiones y seguridad. \n\n SafeRide no será responsable por:\n\n • Accidentes o incidentes durante los viajes \n • Daños personales o materiales \n • Pérdida de objetos \n • Conductas inapropiadas de otros usuarios" },

    { title: "9. Política de Conducta y Convivencia", content: "Dado que la Plataforma está diseñada para una comunidad de funcionarios, el Usuario se compromete a mantener un comportamiento respetuoso, profesional y seguro en todo momento.\n\n Queda estrictamente prohibido:\n\n 8.1 Acoso y Conductas Inapropiadas\n\n • Acoso físico, verbal o psicológico. \n• Acoso sexual, insinuaciones o comportamientos no consentidos.\n • Contacto físico inapropiado.\n• Comentarios ofensivos, humillantes o intimidatorios.\n\n 8.2 Acoso Digital\n\n • Mensajes ofensivos, insistentes o no deseados.\n • Amenazas o intimidación a través de la Plataforma.\n • Difusión de información privada sin consentimiento.\n\n 8.3 Conductas de Riesgo\n\n • Conducir de manera imprudente o negligente.\n • Uso del servicio bajo efectos de alcohol o drogas.\n • Poner en riesgo la integridad de otros funcionarios.\n\n 8.4 Uso Indebido de la Plataforma\n\n • Suplantación de identidad.\n • Uso de información falsa.\n • Manipulación del sistema o tarifas.\n • Uso con fines ilegales o no autorizados.\n\n 8.5 Discriminación\n\n • Cualquier conducta discriminatoria por motivos de género, orientación sexual, religión, nacionalidad, condición física u otros.\n\n El incumplimiento de estas normas podrá resultar en:\n\n • Suspensión inmediata de la cuenta\n • Expulsión permanente de la Plataforma\n • Reporte a instancias internas de la organización o autoridades competentes" },

    { title: "10. Suspensión y Control de Acceso", content: "SafeRide se reserva el derecho de:\n\n • Suspender o cancelar cuentas que incumplan estos términos. \n• Restringir el acceso por motivos de seguridad. \n• Investigar reportes de conducta inapropiada." },

    { title: "11. Protección de Datos", content: "El Usuario autoriza el tratamiento de sus datos para:\n\n • Operación del servicio \n• Verificación dentro de la organización \n• Mejora de la experiencia y seguridad" },

    { title: "12. Modificaciones", content: "SafeRide podrá modificar estos Términos en cualquier momento. El uso continuo de la Plataforma implica la aceptación de dichos cambios." },

    { title: "13. Legislación Aplicable", content: "Estos Términos se rigen por las leyes de la República de Costa Rica." },

    { title: "14. Aceptación Expresa", content: "Al seleccionar “Aceptar”, el Usuario declara que: \n\n • Comprende que el servicio es entre funcionarios de una misma comunidad. \n • Acepta que SafeRide actúa únicamente como intermediario. \n • Se compromete a cumplir con todas las normas establecidas." },
];

function TermsServiceScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [reachedBottom, setReachedBottom] = useState(false);
    const [showButton, setShowButton] = useState(false);
    
    // Animaciones para botones y fondo
    const bgFadeAnim = useRef(new Animated.Value(0)).current;
    const buttonFadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    useEffect(() => {

        // Crear un bucle infinito
        Animated.loop(
            Animated.sequence([
                Animated.timing(bgFadeAnim, {
                    toValue: 1,
                    duration: 5000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(bgFadeAnim, {
                    toValue: 0,
                    duration: 5000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    useEffect(() => {

        // Animacion para el boton
        if (showButton) {
            Animated.parallel([
                Animated.timing(buttonFadeAnim, {
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
                // Retardo de 1.5 segundos para mostrar el botón
                setTimeout(() => {
                    setShowButton(true);
                }, 1500);
            }
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
            
            <View style={styles.header}>
                <LinearGradient
                    colors={['#09314bff', '#0c4469ff', '#073050ff']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                
                <View style={{ height: insets.top, width: '100%' }} />
                
                <View style={styles.headerContent}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Términos y Servicios</Text>
                </View>
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

                            {section.content.split(/(SafeRide|Costa Rica|El Usuario acepta que:|6.1 Usuarios Conductores|6.2 Usuarios Pasajeros|8.1 Acoso y Conductas Inapropiadas|8.2 Acoso Digital|8.3 Conductas de Riesgo|8.4 Uso Indebido de la Plataforma|8.5 Discriminación|El incumplimiento de estas normas podrá resultar en:|República de Costa Rica)/g).map((part, i) => {
                                if (part === 'SafeRide') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#075692ff' }}>{part}</Text>;
                                } else if (part === 'El Usuario acepta que:') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#075692ff' }}>{part}</Text>;
                                } else if (part === 'Costa Rica') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#075692ff' }}>{part}</Text>;
                                } else if (part === '6.1 Usuarios Conductores') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#075692ff' }}>{part}</Text>;
                                } else if (part === '6.2 Usuarios Pasajeros') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#075692ff' }}>{part}</Text>;
                                } else if (part === '8.1 Acoso y Conductas Inapropiadas') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#075692ff' }}>{part}</Text>;
                                } else if (part === '8.2 Acoso Digital') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#075692ff' }}>{part}</Text>;
                                } else if (part === '8.3 Conductas de Riesgo') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#075692ff' }}>{part}</Text>;
                                } else if (part === '8.4 Uso Indebido de la Plataforma') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#075692ff' }}>{part}</Text>;
                                } else if (part === '8.5 Discriminación') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#075692ff' }}>{part}</Text>;
                                } else if (part === 'El incumplimiento de estas normas podrá resultar en:') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#075692ff' }}>{part}</Text>;
                                } else if (part === 'República de Costa Rica') {
                                    return <Text key={i} style={{ fontWeight: 'bold', color: '#075692ff' }}>{part}</Text>;
                                }
                                
                                return <React.Fragment key={i}>{part}</React.Fragment>;
                            })}
                        </Text>

                    </View>
                ))}

                <Text style={styles.declare}>
                    "Declaro que he leído y acepto los Términos, Condiciones y Políticas de Uso de SafeRide, comprendiendo que es un servicio interno entre funcionarios."
                </Text>
                
                <View style={styles.bottomSpacer}>
                    {!showButton && reachedBottom && (
                        <Text style={styles.loadingText}>Procesando su lectura...</Text>
                    )}
                </View>
            </ScrollView>

            {/* Contenedor del Botón Aceptar Flotante */}
            {showButton && (

                <Animated.View style={[
                    styles.bottomButtonContainer, 
                    { opacity: buttonFadeAnim, transform: [{ translateY: slideAnim }] }
                ]}>
                    <TouchableOpacity 
                        style={styles.acceptButton}
                        activeOpacity={0.8}
                        onPress={() => navigation.goBack()}
                    >
                        <LinearGradient
                            colors={['#09314bff', '#0c4469ff', '#073050ff']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                        <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgFadeAnim }]}>
                            <LinearGradient
                                colors={['#0a6191ff', '#0a8ac5ff', '#3dabdaff']}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 1, y: 0 }}
                                end={{ x: 0, y: 1 }}
                            />
                        </Animated.View>
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    headerContent: {
        marginTop: 10,
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
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

    declare: {
        backgroundColor: '#eaf4fc',
        padding: 18,
        borderRadius: 12,
        fontSize: 15,
        color: '#444',
        lineHeight: 24,
        textAlign: 'justify',
        marginTop: 20,
        fontStyle: 'italic',
    },
    bottomSpacer: {
        height: 90,
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
        paddingBottom: 70, 
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
        backgroundColor: 'transparent',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        overflow: 'hidden',
    },
    acceptButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    }
});

export default TermsServiceScreen;