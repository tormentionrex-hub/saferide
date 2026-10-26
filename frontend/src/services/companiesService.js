import { useEffect, useState } from 'react';
import api from './api';

// Empresas con convenio. La lista oficial vive en el backend
// (GET /users/companies, público); esta copia solo se usa si no hay conexión
// para que el registro no quede sin opciones.
export const FALLBACK_COMPANIES = [
    'Intel', 'Cargill', 'Deloitte', 'Citi', 'Experian',
    '3M', 'DHL', 'Bill Gosling Outsourcing (BGO)',
    'WeWork Costa Rica', 'Concentrix', 'Nestlé Costa Rica',
];

let cached = null;
let inflight = null;

export const fetchCompanies = async () => {
    if (cached) return cached;
    if (!inflight) {
        inflight = api.get('/users/companies')
            .then((res) => {
                const list = Array.isArray(res.data?.data) ? res.data.data.filter(Boolean) : [];
                cached = list.length ? list : null;
                return cached || FALLBACK_COMPANIES;
            })
            .catch(() => FALLBACK_COMPANIES)
            .finally(() => { inflight = null; });
    }
    return inflight;
};

// Devuelve la lista al instante (respaldo) y la reemplaza por la del servidor
// cuando llega.
export const useCompanies = () => {
    const [companies, setCompanies] = useState(cached || FALLBACK_COMPANIES);
    useEffect(() => {
        let alive = true;
        fetchCompanies().then((list) => { if (alive) setCompanies(list); });
        return () => { alive = false; };
    }, []);
    return companies;
};
