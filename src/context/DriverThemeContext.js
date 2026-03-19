import { createContext, useContext, useState, useEffect } from 'react';
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
    bg:              '#0A0A18',
    surface:         '#111128',
    surfaceVariant:  '#16163A',
    text:            '#EEEEFF',
    textSecondary:   '#7A7A9D',
    border:          '#22224A',
    divider:         '#1A1A38',
    accent:          '#748FFF',
    accentAlt:       '#00D4FF',
    danger:          '#FF6B6B',
    navBg:           '#0C0C20',
    navBorder:       '#1A1A35',
    navActive:       '#748FFF',
    navInactive:     '#44445A',
    cardBorder:      'rgba(116, 143, 255, 0.18)',
    iconCircleBg:    '#1C1C40',
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
        });
    }, []);

    // toDark: true → modo oscuro, false → modo claro
    const toggleTheme = async (toDark) => {
        const next = toDark ? darkTheme : lightTheme;
        setTheme(next);
        await AsyncStorage.setItem(STORAGE_KEY, toDark ? 'dark' : 'light');
    };

    return (
        <DriverThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </DriverThemeContext.Provider>
    );
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useDriverTheme = () => useContext(DriverThemeContext);
