const mongoose = require('mongoose');
const logger = require('../utils/logger');
require('dotenv').config();
//Script to initialize the database: create collections and indexes as per models. Note: If the databse is already initialized, it will skip existing collections/indexes.
// Import all models
const models = require('../models');
// Main function to initialize the database
const initDatabase = async () => {
  try {
    logger.info('🚀 Starting database initialization...');

    // Connect to the database
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    
    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 10000,
      tls: true,
      authMechanism: 'SCRAM-SHA-256',
      retryWrites: false,
    });

    logger.success('✅ Connected to database');

    // Create the database if it doesn't exist (automatic with first insertion)
    const dbName = process.env.COSMOS_DATABASE || 'SafeRideDB';
    logger.info(`📊 Using database: ${dbName}`);

    // Create collections and indexes for each model
    const modelNames = Object.keys(models);
    
    for (const modelName of modelNames) {
      const Model = models[modelName];
      
      logger.info(`📝 Creating collection: ${Model.collection.name}`);
      
      try {
        // Create collection if it doesn't exist
        await Model.createCollection();
      } catch (error) {
        // Collection already exists, continue
        if (error.code !== 48) { // 48 = NamespaceExists
          throw error;
        }
        logger.info(`ℹ️  Collection ${Model.collection.name} already exists`);
      }
      
      try {
        // Synchronize indexes (this handles duplicates automatically in mongoose 6+)
        await Model.syncIndexes();
        logger.success(`✅ Indexes synced for ${Model.collection.name}`);
      } catch (error) {
        // If there is an index conflict, try dropping and recreating
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

    // Verify created collections
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

// Execute if called directly
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = initDatabase;