import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Los temas soportados son: 'estandar', 'oscuro', 'claro', 'salvia'
    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem('saferide-theme');
        return savedTheme || 'estandar';
    });

    useEffect(() => {
        // Guardar en localStorage
        localStorage.setItem('saferide-theme', theme);

        // Aplicar el nuevo tema como atributo data-theme
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme debe ser utilizado dentro de un ThemeProvider');
    }
    return context;
};
