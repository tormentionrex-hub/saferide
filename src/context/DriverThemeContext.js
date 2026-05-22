import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'driverTheme';

// ── Paleta CLARO ──────────────────────────────────────────────────────────────
export const lightTheme = {
    dark: false,
    bg:              '#F2F2F7',
    surface:         '#FFFFFF',
    surfaceVariant:  '#F3F7FF',
    text:            '#1C1C1E',
    textSecondary:   '#8E8E93',
    border:          '#E5E5EA',
    divider:         '#F0F0F0',
    accent:          '#4B68FF',
    accentAlt:       '#2563EB',
    danger:          '#FF3B30',
    navBg:           '#FFFFFF',
    navBorder:       '#F0F0F0',
    navActive:       '#4B68FF',
    navInactive:     '#8E8E93',
    cardBorder:      'rgba(37, 99, 235, 0.10)',
    iconCircleBg:    '#FFFFFF',
    statusBar:       'dark-content',
};

// ── Paleta OSCURO (futurista, vibrante) ───────────────────────────────────────
export const darkTheme = {
    dark: true,
    bg:              '#000000',
    surface:         '#121212',
    surfaceVariant:  '#1C1C1E',
    text:            '#FFFFFF',
    textSecondary:   '#A0A0A0',
    border:          '#333333',
    divider:         '#2A2A2A',
    accent:          '#276EF1',
    accentAlt:       '#05A357',
    danger:          '#E2202C',
    navBg:           '#000000',
    navBorder:       '#2A2A2A',
    navActive:       '#FFFFFF',
    navInactive:     '#757575',
    cardBorder:      '#333333',
    iconCircleBg:    '#2C2C2E',
    statusBar:       'light-content',
};

// ── Contexto ──────────────────────────────────────────────────────────────────
const DriverThemeContext = createContext({
    theme: lightTheme,
    toggleTheme: () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────
export const DriverThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(lightTheme);

    // Carga el tema guardado al iniciar
    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
            if (saved === 'dark') setTheme(darkTheme);
        }).catch(() => {});
    }, []);

    // toDark: true → modo oscuro, false → modo claro.
    // useCallback estabiliza la referencia: junto con el useMemo del value,
    // evita que consumers que sólo necesitan `toggleTheme` se re-rendericen
    // cuando el tema cambia.
    const toggleTheme = useCallback(async (toDark) => {
        const next = toDark ? darkTheme : lightTheme;
        setTheme(next);
        try {
            await AsyncStorage.setItem(STORAGE_KEY, toDark ? 'dark' : 'light');
        } catch (_) {}
    }, []);

    // El objeto value solo cambia cuando el tema realmente cambia, no en cada
    // render del provider. Sin esto, cualquier re-render aguas arriba forzaría
    // a TODOS los consumers (prácticamente toda la app) a re-renderizar.
    const contextValue = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

    return (
        <DriverThemeContext.Provider value={contextValue}>
            {children}
        </DriverThemeContext.Provider>
    );
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useDriverTheme = () => useContext(DriverThemeContext);
