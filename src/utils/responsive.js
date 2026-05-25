import { Dimensions, PixelRatio } from 'react-native';

// Ancho de diseño base (iPhone 11/SE2 = 375pt). Tomamos el ancho de la
// pantalla UNA SOLA VEZ al cargar el módulo: así StyleSheet.create se
// resuelve estático y no hay re-renders por rotación → fluidez intacta.
const REFERENCE_WIDTH = 375;
const REFERENCE_HEIGHT = 812;

const { width, height } = Dimensions.get('window');
const widthRatio = width / REFERENCE_WIDTH;
const heightRatio = height / REFERENCE_HEIGHT;

// Escala lineal por ancho. roundToNearestPixel evita medios píxeles
// que provocan bordes borrosos en algunos devices.
export const scale = (size) =>
    PixelRatio.roundToNearestPixel(size * widthRatio);

export const verticalScale = (size) =>
    PixelRatio.roundToNearestPixel(size * heightRatio);

// Escala "amortiguada": ideal para tipografías, donde un crecimiento
// lineal en tablets sería excesivo. factor=0 no escala; factor=1 escala
// completo; default 0.5 da un punto medio que se ve bien en 320pt–430pt.
export const moderateScale = (size, factor = 0.5) =>
    PixelRatio.roundToNearestPixel(size + (size * widthRatio - size) * factor);
