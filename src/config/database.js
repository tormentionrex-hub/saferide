const mongoose = require('mongoose');
const logger = require('../utils/logger');
require('dotenv').config();

const connectDB = async () => {
  try {
    // Connection string para Cosmos DB for MongoDB (vCore)
    let connectionString = process.env.COSMOS_CONNECTION_STRING;
    const dbName = process.env.COSMOS_DATABASE || 'Safe-RideDB';

    if (!connectionString) {
      throw new Error('COSMOS_CONNECTION_STRING is not defined in environment variables');
    }

    // Asegurar que el connection string incluya el nombre de la base de datos
    // Si la URL no tiene un path (termina en .com/ o no tiene /), agregar el nombre de la BD
    if (!connectionString.includes('?')) {
      // No hay query string, agregar /<dbname>?
      connectionString = connectionString.replace(/\/?$/, `/${dbName}?`);
    } else if (!connectionString.match(/\/[^\/]+\?/)) {
      // Hay query string pero no hay nombre de BD entre / y ?
      connectionString = connectionString.replace('?', `/${dbName}?`);
    }

    // Opciones de conexión optimizadas para Cosmos DB vCore
    const options = {
      // Especificar el nombre de la base de datos explícitamente
      dbName: dbName,
      
      // Timeout configurations
      serverSelectionTimeoutMS: 10000, // 10 segundos
      socketTimeoutMS: 45000, // 45 segundos
      connectTimeoutMS: 10000, // 10 segundos
      
      // Connection pool
      maxPoolSize: 10, // Máximo de conexiones simultáneas
      minPoolSize: 2,  // Mínimo de conexiones en el pool
      
      // Retry configuration
      retryWrites: false, // Cosmos DB vCore no soporta retryWrites por defecto
      retryReads: true,
      
      // Additional settings
      maxIdleTimeMS: 120000, // 2 minutos
      compressors: ['zlib'], // Compresión de datos
      
      // TLS/SSL
      tls: true,
      tlsAllowInvalidCertificates: false,
      
      // Authentication
      authSource: 'admin',
      authMechanism: 'SCRAM-SHA-256',
    };

    // Conectar a la base de datos
    await mongoose.connect(connectionString, options);

    logger.success('✅ Cosmos DB for MongoDB (vCore) connected successfully');
    logger.info(`📊 Database: ${mongoose.connection.name}`);
    logger.info(`🌐 Host: ${mongoose.connection.host}`);

    // Event listeners
    mongoose.connection.on('error', (err) => {
      logger.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.success('✅ MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('❌ Error connecting to Cosmos DB:', error);
    
    // Log additional error details
    if (error.message.includes('authentication')) {
      logger.error('Authentication failed. Check your username and password.');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
      logger.error('Network error. Check your connection string and firewall settings.');
    }
    
    // Exit process with failure
    process.exit(1);
  }
};

// Helper function to check database connection status
const checkConnection = () => {
  return mongoose.connection.readyState === 1;
};

// Helper function to get connection stats
const getConnectionStats = () => {
  return {
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    models: Object.keys(mongoose.connection.models),
  };
};

module.exports = {
  connectDB,
  checkConnection,
  getConnectionStats,
};