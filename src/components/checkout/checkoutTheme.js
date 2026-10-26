// Colores del checkout derivados del tema de SafeRide (DriverThemeContext),
// para que el pago siga la marca y el modo claro u oscuro del usuario. Los
// mismos valores usa la página de tarjeta del backend (public/checkout), que
// recibe el modo por query para que el paso a la WebView no se note.
export const getCheckoutColors = (theme) => ({
    bg: theme.bg,
    surface: theme.surface,
    onSurface: theme.text,
    // El textSecondary de la app (#8E8E93) da 3.3:1 sobre blanco; para los
    // textos de 13px del checkout se oscurece hasta superar 4.5:1.
    muted: theme.dark ? theme.textSecondary : '#636366',
    line: theme.border,
    accent: theme.accent,
    logoBorder: theme.dark ? 'transparent' : theme.border,
    warningBg: theme.dark ? '#2B2410' : '#FFF6E0',
    warning: theme.dark ? '#F5C451' : '#8A5A00',
    errorBg: theme.dark ? '#2C1414' : '#FFECEB',
    error: theme.dark ? '#FF8A84' : '#C4261D',
    ctaBg: theme.accent,
    ctaText: '#FFFFFF',
    statusBar: theme.dark ? 'light-content' : 'dark-content',
});
