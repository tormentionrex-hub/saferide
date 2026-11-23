// Alert.alert en web: react-native-web lo deja vacío; installWebAlert lo
// reemplaza por window.alert / window.confirm solo cuando Platform.OS === 'web'.
const load = (os) => {
    jest.resetModules();
    const Alert = { alert: jest.fn() };
    jest.doMock('react-native', () => ({ Alert, Platform: { OS: os } }));
    const { installWebAlert } = require('../src/utils/webAlert');
    return { Alert, installWebAlert };
};

describe('installWebAlert', () => {
    beforeEach(() => {
        global.window = global.window || {};
        window.alert = jest.fn();
        window.confirm = jest.fn();
    });

    test('en android no reemplaza nada', () => {
        const { Alert, installWebAlert } = load('android');
        const original = Alert.alert;
        installWebAlert();
        expect(Alert.alert).toBe(original);
    });

    test('sin botones usa window.alert con título y mensaje', () => {
        const { Alert, installWebAlert } = load('web');
        installWebAlert();
        Alert.alert('Error', 'No se pudo');
        expect(window.alert).toHaveBeenCalledWith('Error\n\nNo se pudo');
    });

    test('un botón: alert y luego su onPress', () => {
        const { Alert, installWebAlert } = load('web');
        installWebAlert();
        const onPress = jest.fn();
        Alert.alert('Listo', null, [{ text: 'OK', onPress }]);
        expect(window.alert).toHaveBeenCalledWith('Listo');
        expect(onPress).toHaveBeenCalled();
    });

    test.each([[true, 'ok'], [false, 'cancel']])('dos botones, confirm=%p → %s', (answer, expected) => {
        const { Alert, installWebAlert } = load('web');
        installWebAlert();
        window.confirm.mockReturnValue(answer);
        const calls = [];
        Alert.alert('¿Seguro?', 'Texto', [
            { text: 'Cancelar', style: 'cancel', onPress: () => calls.push('cancel') },
            { text: 'Sí', onPress: () => calls.push('ok') },
        ]);
        expect(calls).toEqual([expected]);
    });

    test('tres botones: Aceptar = el último que no es cancel', () => {
        const { Alert, installWebAlert } = load('web');
        installWebAlert();
        window.confirm.mockReturnValue(true);
        const calls = [];
        Alert.alert('t', 'm', [
            { text: 'Luego', onPress: () => calls.push('luego') },
            { text: 'Cancelar', style: 'cancel', onPress: () => calls.push('cancel') },
            { text: 'Ahora', onPress: () => calls.push('ahora') },
        ]);
        expect(calls).toEqual(['ahora']);
    });

    test('botones sin onPress no rompen', () => {
        const { Alert, installWebAlert } = load('web');
        installWebAlert();
        window.confirm.mockReturnValue(false);
        expect(() => Alert.alert('t', 'm', [{ text: 'A' }, { text: 'B' }])).not.toThrow();
    });
});
