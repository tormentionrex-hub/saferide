require('dotenv').config();
const { connectDB } = require('../config/database');

async function migrate() {
    try {
        await connectDB();
        const Vehicle = require('../models/Vehicle');
        const indexes = await Vehicle.collection.indexes();
        console.log('Índices actuales:', indexes.map(i => i.name));

        // Solo dropear el unique viejo (sin partialFilterExpression).
        // Si ya existe la versión partial unique, NO la tocamos (idempotencia).
        const oldIndex = indexes.find(
            i => i.name === 'driver_id_1' && !i.partialFilterExpression
        );
        if (oldIndex) {
            await Vehicle.collection.dropIndex('driver_id_1');
            console.log('✅ Índice viejo driver_id_1 (unique simple) dropeado');
        } else {
            console.log('ℹ️  Índice viejo driver_id_1 (unique simple) no existe (nada que hacer)');
        }

        await Vehicle.syncIndexes();
        console.log('✅ Índices sincronizados con el schema');

        const finalIndexes = await Vehicle.collection.indexes();
        console.log('Índices finales:', finalIndexes.map(i => ({
            name: i.name,
            partial: !!i.partialFilterExpression,
        })));
        process.exit(0);
    } catch (err) {
        console.error('❌ Error en migración:', err);
        process.exit(1);
    }
}

migrate();
