// El backend pagina los listados con `limit = 10` por defecto. La app trata
// estos listados como completos (historial, métricas, cobros pendientes), así
// que sin un límite explícito se perdían registros en silencio. Se aplica un
// tope alto solo a los listados de viajes y reservas que no traen `limit`.
export const LIST_LIMIT = 500;
const PAGINATED_LIST = /^\/(rides|bookings)(\/(driver|passenger)\/[^/?]+)?\/?(\?|$)/;

export const withListLimit = (config) => {
    if ((config.method || 'get').toLowerCase() !== 'get') return config;
    const url = config.url || '';
    if (!PAGINATED_LIST.test(url)) return config;
    if (/[?&]limit=/.test(url) || config.params?.limit != null) return config;
    config.params = { ...(config.params || {}), limit: LIST_LIMIT };
    return config;
};
