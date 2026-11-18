import { useEffect, useState } from 'react';

const PREFS_KEY = 'saferide-admin-prefs';
const PREFS_EVENT = 'saferide-prefs-changed';

const readPref = (key, defaultVal) => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultVal;
    const v = JSON.parse(raw)[key];
    return v == null ? defaultVal : v;
  } catch {
    return defaultVal;
  }
};

// Lee una pref del admin y se entera de cambios:
//  - 'storage' event: cambios en OTRAS tabs.
//  - 'saferide-prefs-changed' custom event: cambios en la MISMA tab
//    (PerfilAdmin dispara este evento tras actualizar localStorage).
export const useAdminPref = (key, defaultVal = false) => {
  const [val, setVal] = useState(() => readPref(key, defaultVal));
  useEffect(() => {
    const onChange = () => setVal(readPref(key, defaultVal));
    const onStorage = (e) => { if (e.key === PREFS_KEY) onChange(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(PREFS_EVENT, onChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(PREFS_EVENT, onChange);
    };
  }, [key, defaultVal]);
  return val;
};
