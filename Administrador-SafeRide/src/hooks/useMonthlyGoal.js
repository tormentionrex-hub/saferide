import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

const CACHE_KEY = 'saferide.monthlyCarbonGoal';
const GOAL_EVENT = 'saferide-monthly-goal-changed';
const DEFAULT_GOAL = 200;

const readCache = () => {
    try {
        const raw = window.localStorage.getItem(CACHE_KEY);
        const value = Number(raw);
        return Number.isFinite(value) && value > 0 ? value : DEFAULT_GOAL;
    } catch {
        return DEFAULT_GOAL;
    }
};

const persist = (value) => {
    try {
        window.localStorage.setItem(CACHE_KEY, String(value));
    } catch {
        return;
    }
    window.dispatchEvent(new CustomEvent(GOAL_EVENT, { detail: { value } }));
};

export const useMonthlyGoal = () => {
    const [goal, setGoal] = useState(readCache);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let activo = true;
        api.get('/settings/monthly-carbon-goal')
            .then((res) => {
                const value = Number(res.data?.data?.value);
                if (activo && Number.isFinite(value) && value > 0) {
                    persist(value);
                    setGoal(value);
                }
            })
            .catch(() => {})
            .finally(() => { if (activo) setLoading(false); });

        const onChange = (event) => {
            const value = Number(event.detail?.value);
            if (Number.isFinite(value) && value > 0) setGoal(value);
        };
        window.addEventListener(GOAL_EVENT, onChange);
        return () => {
            activo = false;
            window.removeEventListener(GOAL_EVENT, onChange);
        };
    }, []);

    const updateGoal = useCallback(async (value) => {
        const numero = Number(value);
        if (!Number.isFinite(numero) || numero <= 0) {
            throw new Error('La meta debe ser un número mayor a 0');
        }
        setSaving(true);
        try {
            const res = await api.put('/settings/monthly-carbon-goal', { value: numero });
            const guardado = Number(res.data?.data?.value ?? numero);
            persist(guardado);
            setGoal(guardado);
            return guardado;
        } finally {
            setSaving(false);
        }
    }, []);

    return { goal, loading, saving, updateGoal };
};
