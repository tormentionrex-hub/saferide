/**
 * Migración idempotente: añade trustScore=4 a los usuarios existentes que no
 * tienen el campo. Se puede ejecutar varias veces sin efectos secundarios.
 *
 * Uso:
 *   node src/scripts/add_trust_score.js
 *
 * Variables de entorno: las mismas que el resto del backend (.env).
 */
const mongoose = require('mongoose');
const logger = require('../utils/logger');
require('dotenv').config();

const { connectDB } = require('../config/database');
const { User } = require('../models');

const run = async () => {
    try {
        logger.info('🛠  Migración: añadir trustScore=4 a usuarios existentes...');
        await connectDB();
        logger.success('✅ Conectado a la base de datos');

        // Usuarios sin el campo (los nuevos ya lo tienen por default del schema).
        const missingCount = await User.countDocuments({
            trustScore: { $exists: false },
        });
        logger.info(`📊 Usuarios sin trustScore: ${missingCount}`);

        if (missingCount === 0) {
            logger.success('🎉 Nada que migrar: todos los usuarios ya tienen trustScore.');
        } else {
            const result = await User.updateMany(
                { trustScore: { $exists: false } },
                { $set: { trustScore: 4 } }
            );
            logger.success(`✅ Actualizados ${result.modifiedCount} usuarios`);
        }

        // Sanity check: cualquier usuario con isActive=false pero trustScore>0
        // refleja un estado inconsistente previo (admin deshabilitó manualmente).
        // No lo tocamos: respetamos esa decisión manual.
        const inconsistent = await User.countDocuments({
            isActive: false,
            trustScore: { $gt: 0 },
        });
        if (inconsistent > 0) {
            logger.info(
                `ℹ️  ${inconsistent} usuario(s) con isActive=false y trustScore>0. ` +
                'No se modificaron — probablemente deshabilitados manualmente por admin.'
            );
        }

        await mongoose.disconnect();
        logger.success('🔌 Conexión cerrada. Migración completa.');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Error en migración:', error.message);
        console.error(error);
        process.exit(1);
    }
};

run();
