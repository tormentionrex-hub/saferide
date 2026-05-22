import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEYS = [
    'userRole',
    'userName',
    'userId',
    'userEmail',
    'userPhone',
    'userPhoto',
    'userCompany',
];

const sessionStorage = {
    setSession: async (user) => {
        const entries = [
            ['userRole', user.type || ''],
            ['userName', user.name || ''],
            ['userId', user._id || ''],
            ['userEmail', user.email || ''],
            ['userPhone', user.phone || ''],
            ['userPhoto', user.profileImage || ''],
            ['userCompany', user.company || ''],
        ];
        await AsyncStorage.multiSet(entries);
    },

    /**
     * Actualiza solo los campos provistos sin tocar los demás. Útil cuando
     * solo se conoce un subconjunto del perfil (ej. tras editar el formulario
     * o subir una nueva foto). Pasar `setSession` borraría los campos omitidos.
     */
    updateSession: async (partial) => {
        const map = {
            type: 'userRole',
            name: 'userName',
            _id: 'userId',
            email: 'userEmail',
            phone: 'userPhone',
            profileImage: 'userPhoto',
            company: 'userCompany',
        };
        const entries = Object.entries(map)
            .filter(([key]) => partial[key] !== undefined)
            .map(([key, storageKey]) => [storageKey, partial[key] ?? '']);
        if (entries.length === 0) return;
        await AsyncStorage.multiSet(entries);
    },

    getSession: async () => {
        const pairs = await AsyncStorage.multiGet(SESSION_KEYS);
        return Object.fromEntries(pairs);
    },

    getRole: () => AsyncStorage.getItem('userRole'),
    getName: () => AsyncStorage.getItem('userName'),

    clearSession: async () => {
        await AsyncStorage.multiRemove(SESSION_KEYS);
    },
};

export default sessionStorage;
