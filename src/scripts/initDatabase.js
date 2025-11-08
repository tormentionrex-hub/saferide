const mongoose = require('mongoose');
const logger = require('../utils/logger');
require('dotenv').config();

const models = require('../models');

const initDatabase = async () => {
  try {
    logger.info('🚀 Starting database initialization...');

    // Conectar a la base de datos
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    
    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 10000,
      tls: true,
      authMechanism: 'SCRAM-SHA-256',
      retryWrites: false,
    });

    logger.success('✅ Connected to database');

    // Crear la base de datos si no existe (automático con primera inserción)
    const dbName = process.env.COSMOS_DATABASE || 'SafeRideDB';
    logger.info(`📊 Using database: ${dbName}`);

    // Crear colecciones e índices para cada modelo
    const modelNames = Object.keys(models);
    
    for (const modelName of modelNames) {
      const Model = models[modelName];
      
      logger.info(`📝 Creating collection: ${Model.collection.name}`);
      
      try {
        // Crear colección si no existe
        await Model.createCollection();
      } catch (error) {
        // La colección ya existe, continuar
        if (error.code !== 48) { // 48 = NamespaceExists
          throw error;
        }
        logger.info(`ℹ️  Collection ${Model.collection.name} already exists`);
      }
      
      try {
        // Sincronizar índices (esto maneja duplicados automáticamente en mongoose 6+)
        await Model.syncIndexes();
        logger.success(`✅ Indexes synced for ${Model.collection.name}`);
      } catch (error) {
        // Si hay conflicto de índices, intentar eliminar y recrear
        if (error.code === 86) { // IndexKeySpecsConflict
          logger.warn(`⚠️  Index conflict detected for ${Model.collection.name}, dropping and recreating...`);
          await Model.collection.dropIndexes();
          await Model.syncIndexes();
          logger.success(`✅ Indexes recreated for ${Model.collection.name}`);
        } else {
          throw error;
        }
      }
    }

    // Verificar colecciones creadas
    const collections = await mongoose.connection.db.listCollections().toArray();
    logger.info(`📚 Collections created: ${collections.map(c => c.name).join(', ')}`);


    logger.success('🎉 Database initialization completed successfully!');
    
  } catch (error) {
    logger.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    logger.info('🔌 Database connection closed');
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = initDatabase;