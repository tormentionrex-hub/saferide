// Iniciales para avatares. Solo toma letras (cualquier alfabeto, con tildes):
// un nombre como "(QA) Conductor" daba "(C"; ahora da "QC".
// max: cuántas iniciales; fallback: lo que se muestra si no hay ninguna letra.
export const getInitials = (name, max = 2, fallback = '?') => {
    const words = String(name ?? '').split(/\s+/);
    const letters = [];
    for (const w of words) {
        const m = w.match(/\p{L}/u);
        if (m) letters.push(m[0]);
        if (letters.length >= max) break;
    }
    return letters.length ? letters.join('').toUpperCase() : fallback;
};

export default getInitials;
